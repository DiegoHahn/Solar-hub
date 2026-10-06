import { describe, expect, it } from "vitest";
import { cx, focusInput, focusRing, hasErrorInput } from "./utils";

describe("cx", () => {
  it("concatenates multiple class names", () => {
    expect(cx("text-sm", "font-medium", "text-gray-900")).toBe("text-sm font-medium text-gray-900");
  });

  it("ignores falsy and conditional values", () => {
    const isError = false;
    const isSuccess = true;
    expect(cx("base-class", isError && "text-red-500", isSuccess && "text-emerald-500", null, undefined)).toBe(
      "base-class text-emerald-500",
    );
  });

  it("resolves Tailwind utility conflicts via tailwind-merge", () => {
    expect(cx("px-2 py-1", "p-4")).toBe("p-4");
    expect(cx("bg-red-500", "bg-emerald-500")).toBe("bg-emerald-500");
    expect(cx("text-sm", "text-lg")).toBe("text-lg");
  });
});

describe("input and focus design tokens", () => {
  it("exports arrays containing design system focus and error classes", () => {
    expect(focusInput.length).toBeGreaterThan(0);
    expect(focusRing.length).toBeGreaterThan(0);
    expect(hasErrorInput.length).toBeGreaterThan(0);

    expect(focusRing[0]).toContain("outline");
    expect(hasErrorInput[0]).toContain("ring-2");
  });
});
