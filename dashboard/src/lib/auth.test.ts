import { describe, expect, it, afterEach } from "vitest";
import { isEmailAllowed, maskEmail, getSafeRedirectUrl } from "./auth";

describe("auth helpers", () => {
  const originalEnv = process.env.ALLOWED_EMAILS;

  afterEach(() => {
    process.env.ALLOWED_EMAILS = originalEnv;
  });

  describe("isEmailAllowed", () => {
    it("allows email explicitly listed", () => {
      process.env.ALLOWED_EMAILS = "diego@example.com,outro@example.com";
      expect(isEmailAllowed("diego@example.com")).toBe(true);
      expect(isEmailAllowed("outro@example.com")).toBe(true);
    });

    it("is case-insensitive and trims whitespace", () => {
      process.env.ALLOWED_EMAILS = "  Diego@Example.com , OUTRO@example.com ";
      expect(isEmailAllowed("diego@example.com")).toBe(true);
      expect(isEmailAllowed("DIEGO@EXAMPLE.COM")).toBe(true);
      expect(isEmailAllowed("  diego@example.com  ")).toBe(true);
    });

    it("rejects unlisted email", () => {
      process.env.ALLOWED_EMAILS = "diego@example.com";
      expect(isEmailAllowed("invasor@example.com")).toBe(false);
    });

    it("operates in fail-closed mode when ALLOWED_EMAILS is empty or unset", () => {
      process.env.ALLOWED_EMAILS = "";
      expect(isEmailAllowed("diego@example.com")).toBe(false);

      delete process.env.ALLOWED_EMAILS;
      expect(isEmailAllowed("diego@example.com")).toBe(false);
    });

    it("rejects null or empty values", () => {
      process.env.ALLOWED_EMAILS = "diego@example.com";
      expect(isEmailAllowed("")).toBe(false);
      expect(isEmailAllowed(null)).toBe(false);
      expect(isEmailAllowed(undefined)).toBe(false);
    });
  });

  describe("maskEmail", () => {
    it("masks standard emails preserving endpoints and domain", () => {
      expect(maskEmail("diego@example.com")).toBe("d***o@example.com");
      expect(maskEmail("usuario@empresa.com.br")).toBe("u***o@empresa.com.br");
    });

    it("masks short usernames", () => {
      expect(maskEmail("ab@example.com")).toBe("***@example.com");
    });

    it("handles invalid or null values safely", () => {
      expect(maskEmail(null)).toBe("unknown");
      expect(maskEmail("")).toBe("unknown");
      expect(maskEmail("invalido")).toBe("***");
    });
  });

  describe("getSafeRedirectUrl", () => {
    it("accepts valid relative paths", () => {
      expect(getSafeRedirectUrl("/")).toBe("/");
      expect(getSafeRedirectUrl("/cooperativa")).toBe("/cooperativa");
      expect(getSafeRedirectUrl("/placas?tab=2")).toBe("/placas?tab=2");
    });

    it("rejects open redirect vectors and defaults to /", () => {
      expect(getSafeRedirectUrl("@evil.com")).toBe("/");
      expect(getSafeRedirectUrl("/@evil.com")).toBe("/");
      expect(getSafeRedirectUrl("//evil.com")).toBe("/");
      expect(getSafeRedirectUrl("//evil.com/path")).toBe("/");
      expect(getSafeRedirectUrl("/\\evil.com")).toBe("/");
      expect(getSafeRedirectUrl("https://evil.com")).toBe("/");
      expect(getSafeRedirectUrl("http://evil.com")).toBe("/");
      expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/");
    });

    it("returns / for null or empty inputs", () => {
      expect(getSafeRedirectUrl(null)).toBe("/");
      expect(getSafeRedirectUrl(undefined)).toBe("/");
      expect(getSafeRedirectUrl("")).toBe("/");
    });
  });
});
