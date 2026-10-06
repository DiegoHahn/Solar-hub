import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressCircle } from "./ProgressCircle";

describe("ProgressCircle", () => {
  it("renders progressbar element with aria attributes and value", () => {
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

  it("clamps negative values to zero and values above maximum to max", () => {
    const { rerender } = render(<ProgressCircle value={-10} max={100} />);
    let progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("data-value", "0");

    rerender(<ProgressCircle value={150} max={100} />);
    progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("data-value", "100");
  });

  it("renders with color variants and custom sizes", () => {
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
