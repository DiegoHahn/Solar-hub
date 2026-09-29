import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

describe("ThemeProvider", () => {
  it("renderiza os elementos filhos corretamente", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <div data-testid="child-element">Conteúdo com tema</div>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("child-element")).toHaveTextContent("Conteúdo com tema");
  });
});
