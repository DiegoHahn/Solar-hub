import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoBanner } from "./DemoBanner";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("DemoBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders banner with exit link when on authenticated/demo route", () => {
    mockUsePathname.mockReturnValue("/");
    render(<DemoBanner />);

    expect(
      screen.getByText("Modo demonstração — dados fictícios"),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Sair da demonstração" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/demo/sair");
  });

  it("renders on dashboard subpages such as /placas", () => {
    mockUsePathname.mockReturnValue("/placas");
    render(<DemoBanner />);

    expect(
      screen.getByText("Modo demonstração — dados fictícios"),
    ).toBeInTheDocument();
  });

  it("does not render on /login route", () => {
    mockUsePathname.mockReturnValue("/login");
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render on /auth/callback route", () => {
    mockUsePathname.mockReturnValue("/auth/callback");
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });
});
