import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders button with text and default variant", () => {
    render(<Button>Clique aqui</Button>);
    const btn = screen.getByRole("button", { name: "Clique aqui" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("applies correct classes for different variants", () => {
    const { rerender } = render(<Button variant="secondary">Secundário</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-gray-300");

    rerender(<Button variant="light">Light</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-gray-200");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-transparent");

    rerender(<Button variant="destructive">Destrutivo</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-red-600");
  });

  it("calls onClick callback when clicked and not disabled", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Ação</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Ação" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onClick when disabled", () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Desabilitado</Button>);
    const btn = screen.getByRole("button", { name: "Desabilitado" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders loading state with spinner and disables button", () => {
    render(<Button isLoading loadingText="Carregando dados...">Salvar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(screen.getAllByText("Carregando dados...").length).toBeGreaterThan(0);
  });

  it("supports rendering asChild using Slot", () => {
    render(
      <Button asChild>
        <a href="/destino">Link como botão</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Link como botão" });
    expect(link).toHaveAttribute("href", "/destino");
  });
});
