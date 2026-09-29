import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Nav } from "./Nav";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();
let authCallback: ((event: string, session: { user?: { email?: string } } | null) => void) | null = null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      onAuthStateChange: vi.fn((cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }),
    },
  }),
}));

describe("Nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = "/";
    authCallback = null;
    mockGetUser.mockResolvedValue({ data: { user: { email: "teste@solarhub.local" } } });
    mockSignOut.mockResolvedValue({});
  });

  it("não renderiza nada em rotas de autenticação (/login ou /auth)", () => {
    currentPathname = "/login";
    const { container, rerender } = render(<Nav />);
    expect(container).toBeEmptyDOMElement();

    currentPathname = "/auth/callback";
    rerender(<Nav />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza todos os links de navegação", async () => {
    render(<Nav />);

    const homeLinks = screen.getAllByRole("link", { name: /Início/i });
    expect(homeLinks.length).toBeGreaterThan(0);

    const placasLinks = screen.getAllByRole("link", { name: /Placas/i });
    expect(placasLinks.length).toBeGreaterThan(0);

    const coopLinks = screen.getAllByRole("link", { name: /Cooperativa/i });
    expect(coopLinks.length).toBeGreaterThan(0);

    const analiseLinks = screen.getAllByRole("link", { name: /Análise/i });
    expect(analiseLinks.length).toBeGreaterThan(0);
  });

  it("destaca visualmente o item ativo de acordo com a rota atual", () => {
    currentPathname = "/placas";
    render(<Nav />);

    const placasLinks = screen.getAllByRole("link", { name: /Placas/i });
    // No desktop nav, item ativo ganha text-amber-500
    expect(placasLinks[0]).toHaveClass("text-amber-500");
  });

  it("exibe o e-mail do usuário autenticado", async () => {
    render(<Nav />);
    await waitFor(() => {
      expect(screen.getByText("teste@solarhub.local")).toBeInTheDocument();
    });
  });

  it("atualiza o e-mail quando o estado de autenticação muda", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    render(<Nav />);

    expect(screen.queryByText("novo@solarhub.local")).not.toBeInTheDocument();

    if (authCallback) {
      authCallback("SIGNED_IN", { user: { email: "novo@solarhub.local" } });
    }

    await waitFor(() => {
      expect(screen.getByText("novo@solarhub.local")).toBeInTheDocument();
    });
  });

  it("executa logout e redireciona para /login ao clicar em Sair", async () => {
    render(<Nav />);

    const logoutButtons = screen.getAllByRole("button", { name: /Sair/i });
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
