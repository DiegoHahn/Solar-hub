import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InverterCardsSection } from "./InverterCardsSection";
import type { InverterReading } from "@/lib/types";
import telemetryDayFixture from "../test/fixtures/telemetry-day.json";

describe("InverterCardsSection", () => {
  const inverters = telemetryDayFixture[0].inverters_data as unknown as InverterReading[];

  it("renderiza todos os inversores da lista", () => {
    render(<InverterCardsSection inverters={inverters} />);

    for (const inv of inverters) {
      expect(screen.getByText(inv.name)).toBeInTheDocument();
    }
  });

  it("sincroniza a expansão e recolhimento do diagnóstico entre todos os cards", () => {
    render(<InverterCardsSection inverters={inverters} />);

    expect(screen.queryAllByText("Sensores Térmicos")).toHaveLength(0);

    const toggleButtons = screen.getAllByRole("button", { name: /Diagnóstico/ });
    expect(toggleButtons.length).toBe(inverters.length);

    fireEvent.click(toggleButtons[0]);

    expect(screen.getAllByText("Sensores Térmicos")).toHaveLength(inverters.length);

    fireEvent.click(toggleButtons[1]);

    expect(screen.queryAllByText("Sensores Térmicos")).toHaveLength(0);
  });
});
