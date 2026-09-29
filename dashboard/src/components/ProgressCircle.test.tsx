import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressCircle } from "./ProgressCircle";

describe("ProgressCircle", () => {
  it("renderiza o elemento progressbar com atributos aria e valor", () => {
    render(
      <ProgressCircle value={45} max={100}>
        <span>45%</span>
      </ProgressCircle>,
    );

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "45");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("limita valores negativos a zero e valores maiores que o máximo a max", () => {
    const { rerender } = render(<ProgressCircle value={-10} max={100} />);
    let progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("data-value", "0");

    rerender(<ProgressCircle value={150} max={100} />);
    progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("data-value", "100");
  });

  it("renderiza com variantes de cor e tamanhos personalizados", () => {
    render(
      <ProgressCircle
        value={80}
        variant="solar"
        radius={48}
        strokeWidth={8}
        showAnimation={false}
      />,
    );

    const progress = screen.getByRole("progressbar");
    expect(progress).toBeInTheDocument();
  });
});
