import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isDemoMode,
  getDataSource,
} from "./dataSource";
import * as demoQueries from "./demo/queries";
import * as realQueries from "./queries";
import * as realWeather from "./weatherData";

const mockCookieGet = vi.fn();
const mockCookieGetAll = vi.fn();
const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(async () => ({
  auth: {
    getUser: mockGetUser,
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    getAll: mockCookieGetAll,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("dataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isDemoMode", () => {
    it("returns false if no solarhub_demo cookie exists", async () => {
      mockCookieGet.mockReturnValue(undefined);
      const result = await isDemoMode();
      expect(result).toBe(false);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("returns false if solarhub_demo value is not 1", async () => {
      mockCookieGet.mockReturnValue({ value: "0" });
      const result = await isDemoMode();
      expect(result).toBe(false);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("returns true and NEVER calls createClient when solarhub_demo exists with no supabase cookies", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "other_cookie", value: "xyz" },
      ]);

      const result = await isDemoMode();
      expect(result).toBe(true);
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("returns false if demo cookie exists but user is authenticated in Supabase (logged-in user takes priority)", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "sb-solarhub-auth-token", value: "token123" },
      ]);
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-1", email: "diego@solarhub.local" } },
      });

      const result = await isDemoMode();
      expect(result).toBe(false);
      expect(mockCreateClient).toHaveBeenCalled();
    });

    it("returns true if Supabase auth cookie exists but session is expired/null", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "sb-solarhub-auth-token", value: "expired" },
      ]);
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
      });

      const result = await isDemoMode();
      expect(result).toBe(true);
    });

    it("returns true as fallback if Supabase check throws an error", async () => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([
        { name: "solarhub_demo", value: "1" },
        { name: "sb-solarhub-auth-token", value: "err" },
      ]);
      mockGetUser.mockRejectedValueOnce(new Error("Supabase unavailable"));

      const result = await isDemoMode();
      expect(result).toBe(true);
    });
  });

  describe("getDataSource - Strict Demo Mode Isolation", () => {
    beforeEach(() => {
      mockCookieGet.mockReturnValue({ value: "1" });
      mockCookieGetAll.mockReturnValue([{ name: "solarhub_demo", value: "1" }]);
    });

    it("returns DataSource with isDemo: true and functions pointing to demoQueries", async () => {
      const ds = await getDataSource();
      expect(ds.isDemo).toBe(true);
      expect(ds.getLatestTelemetry).toBe(demoQueries.getDemoLatestTelemetry);
      expect(ds.getLatestUtilityData).toBe(demoQueries.getDemoLatestUtilityData);
      expect(ds.getTodaySunCurve).toBe(demoQueries.getDemoTodaySunCurve);
      expect(ds.getGenerationByDay).toBe(demoQueries.getDemoGenerationByDay);
      expect(ds.getMonthlyGeneration).toBe(demoQueries.getDemoMonthlyGeneration);
      expect(ds.getMultiYearHistory).toBe(demoQueries.getDemoMultiYearHistory);
      expect(ds.getYearlyGeneration).toBe(demoQueries.getDemoYearlyGeneration);
      expect(ds.getIcaraWeatherData).toBe(demoQueries.getDemoIcaraWeatherData);
    });

    it("executes all demo queries without touching Supabase", async () => {
      mockCreateClient.mockImplementation(() => {
        throw new Error("SUPABASE MUST NOT BE CALLED IN DEMO MODE!");
      });

      const ds = await getDataSource();
      const telemetry = await ds.getLatestTelemetry();
      const utility = await ds.getLatestUtilityData();
      const sunCurve = await ds.getTodaySunCurve();
      const genByDay = await ds.getGenerationByDay(7);
      const monthly = await ds.getMonthlyGeneration();
      const multiYear = await ds.getMultiYearHistory("en");
      const yearly = await ds.getYearlyGeneration("en");
      const weather = await ds.getIcaraWeatherData();

      expect(telemetry).not.toBeNull();
      expect(utility).not.toBeNull();
      expect(Array.isArray(sunCurve)).toBe(true);
      expect(typeof genByDay).toBe("object");
      expect(Array.isArray(monthly)).toBe(true);
      expect(multiYear).toHaveProperty("yearsTotals");
      expect(Array.isArray(yearly)).toBe(true);
      expect(Array.isArray(weather)).toBe(true);

      // Absolute guarantee of zero calls to Supabase client
      expect(mockCreateClient).not.toHaveBeenCalled();
    });
  });

  describe("getDataSource - Live Production Mode (non-demo)", () => {
    beforeEach(() => {
      mockCookieGet.mockReturnValue(undefined);
      mockCookieGetAll.mockReturnValue([]);
    });

    it("returns DataSource with isDemo: false and functions pointing to real queries", async () => {
      const ds = await getDataSource();
      expect(ds.isDemo).toBe(false);
      expect(ds.getLatestTelemetry).toBe(realQueries.getLatestTelemetry);
      expect(ds.getLatestUtilityData).toBe(realQueries.getLatestUtilityData);
      expect(ds.getTodaySunCurve).toBe(realQueries.getTodaySunCurve);
      expect(ds.getGenerationByDay).toBe(realQueries.getGenerationByDay);
      expect(ds.getMonthlyGeneration).toBe(realQueries.getMonthlyGeneration);
      expect(ds.getMultiYearHistory).toBe(realQueries.getMultiYearHistory);
      expect(ds.getYearlyGeneration).toBe(realQueries.getYearlyGeneration);
      expect(ds.getIcaraWeatherData).toBe(realWeather.getIcaraWeatherData);
    });
  });
});

