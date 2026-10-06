import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import React from "react";
import { useIsClient } from "./useIsClient";

function TestComponent() {
  const isClient = useIsClient();
  return React.createElement("span", null, isClient ? "client" : "server");
}

describe("useIsClient", () => {
  it("returns true after mounting on client", () => {
    const { result } = renderHook(() => useIsClient());
    expect(result.current).toBe(true);
  });

  it("returns false during server-side rendering (SSR)", () => {
    const html = renderToString(React.createElement(TestComponent));
    expect(html).toContain("server");
  });
});
