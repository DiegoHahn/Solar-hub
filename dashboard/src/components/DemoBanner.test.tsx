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

  it("renderiza o banner com link para sair quando em rota autenticada/demo", () => {
    mockUsePathname.mockReturnValue("/");
    render(<DemoBanner />);

    expect(
      screen.getByText("Modo demonstração — dados fictícios"),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Sair da demonstração" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/demo/sair");
  });

  it("renderiza em subpáginas do dashboard como /placas", () => {
    mockUsePathname.mockReturnValue("/placas");
    render(<DemoBanner />);

    expect(
      screen.getByText("Modo demonstração — dados fictícios"),
    ).toBeInTheDocument();
  });

  it("não renderiza na rota de /login", () => {
    mockUsePathname.mockReturnValue("/login");
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("não renderiza na rota de /auth/callback", () => {
    mockUsePathname.mockReturnValue("/auth/callback");
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });
});
