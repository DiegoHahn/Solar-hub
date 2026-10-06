import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageToggle } from "./LanguageToggle";
import { I18nProvider } from "@/i18n/context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

describe("LanguageToggle", () => {
  it("renders both PT and EN toggle buttons with PT active by default", () => {
    render(
      <I18nProvider initialLocale="pt-BR">
        <LanguageToggle />
      </I18nProvider>,
    );

    const ptBtn = screen.getByRole("button", { name: "PT" });
    const enBtn = screen.getByRole("button", { name: "EN" });

    expect(ptBtn).toBeInTheDocument();
    expect(enBtn).toBeInTheDocument();
    expect(ptBtn).toHaveAttribute("aria-pressed", "true");
    expect(enBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("switches language when clicking EN button", () => {
    render(
      <I18nProvider initialLocale="pt-BR">
        <LanguageToggle />
      </I18nProvider>,
    );

    const enBtn = screen.getByRole("button", { name: "EN" });
    fireEvent.click(enBtn);

    expect(enBtn).toHaveAttribute("aria-pressed", "true");
  });
});
