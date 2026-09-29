import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SkeletonPage,
  SkeletonBlock,
  SkeletonCard,
  SkeletonChartCard,
  SkeletonKpiGrid,
  SkeletonPageHeader,
} from "./Skeleton";
import HomeLoading from "@/app/loading";

describe("Skeleton e Loading", () => {
  it("SkeletonPage possui role='status' e aria-busy='true'", () => {
    render(
      <SkeletonPage>
        <p>Carregando conteúdo...</p>
      </SkeletonPage>,
    );

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-busy", "true");
    expect(statusEl).toHaveAttribute("aria-label", "Carregando");
  });

  it("HomeLoading renderiza página de carregamento acessível com role status", () => {
    render(<HomeLoading />);

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("renderiza blocos individuais sem erros de layout", () => {
    const { container } = render(
      <div>
        <SkeletonPageHeader />
        <SkeletonCard />
        <SkeletonKpiGrid count={4} />
        <SkeletonChartCard />
        <SkeletonBlock className="h-4 w-10" />
      </div>,
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
