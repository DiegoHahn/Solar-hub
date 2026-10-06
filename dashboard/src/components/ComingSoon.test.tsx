import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoon } from "./ComingSoon";

describe("ComingSoon", () => {
  it("renders provided title and under construction message", () => {
    render(<ComingSoon title="Página em Desenvolvimento" />);
    expect(screen.getByRole("heading", { name: "Página em Desenvolvimento", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Em construção.")).toBeInTheDocument();
  });
});
