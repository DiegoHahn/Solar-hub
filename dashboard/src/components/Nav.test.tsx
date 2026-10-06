import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Nav } from "./Nav";
import { I18nProvider } from "@/i18n/context";

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
    if (typeof document !== "undefined") {
      document.cookie = "";
    }
  });

  it("renders nothing on authentication routes (/login or /auth)", () => {
    currentPathname = "/login";
    const { container, rerender } = render(<Nav />);
    expect(container).toBeEmptyDOMElement();

    currentPathname = "/auth/callback";
    rerender(<Nav />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all navigation links", async () => {
    render(<Nav />);

    const homeLinks = screen.getAllByRole("link", { name: /Visão Geral|Início/i });
    expect(homeLinks.length).toBeGreaterThan(0);

    const placasLinks = screen.getAllByRole("link", { name: /Inversores|Placas/i });
    expect(placasLinks.length).toBeGreaterThan(0);

    const coopLinks = screen.getAllByRole("link", { name: /Cooperativa/i });
    expect(coopLinks.length).toBeGreaterThan(0);

    const analiseLinks = screen.getAllByRole("link", { name: /Análise/i });
    expect(analiseLinks.length).toBeGreaterThan(0);
  });

  it("visually highlights active item according to current route", () => {
    currentPathname = "/placas";
    render(<Nav />);

    const placasLinks = screen.getAllByRole("link", { name: /Inversores|Placas/i });
    // On desktop nav, active item gets text-amber-500
    expect(placasLinks[0]).toHaveClass("text-amber-500");
  });

  it("displays authenticated user email", async () => {
    render(<Nav />);
    await waitFor(() => {
      expect(screen.getByText("teste@solarhub.local")).toBeInTheDocument();
    });
  });

  it("updates email when authentication state changes", async () => {
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

  it("executes logout and redirects to /login on Sign out click", async () => {
    render(<Nav />);

    const logoutButtons = screen.getAllByRole("button", { name: /Sair/i });
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("allows switching language to English and updates navigation labels", async () => {
    render(
      <I18nProvider>
        <Nav />
      </I18nProvider>,
    );

    const enButtons = screen.getAllByRole("button", { name: "EN" });
    fireEvent.click(enButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Overview/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /Inverters/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /Utility/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /Analysis/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /Sign out/i }).length).toBeGreaterThan(0);
    });
  });
});
