import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/Nav", () => ({
  Nav: () => <nav data-testid="mock-nav">Nav</nav>,
}));

describe("AppShell", () => {
  it("renders Nav and padded content when on internal routes", () => {
    currentPathname = "/";
    render(
      <AppShell>
        <main data-testid="main-content">Dashboard Content</main>
      </AppShell>,
    );

    expect(screen.getByTestId("mock-nav")).toBeInTheDocument();
    expect(screen.getByTestId("main-content")).toBeInTheDocument();
    expect(screen.getByTestId("main-content").parentElement).toHaveClass("md:pl-56");
  });

  it("does not render Nav when on authentication routes (/login or /auth)", () => {
    currentPathname = "/login";
    render(
      <AppShell>
        <main data-testid="login-content">Login Screen</main>
      </AppShell>,
    );

    expect(screen.queryByTestId("mock-nav")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-content")).toBeInTheDocument();
    expect(screen.getByTestId("login-content").parentElement).toHaveClass("min-h-screen", "w-full");
  });
});
