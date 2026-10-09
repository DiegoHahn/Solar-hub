import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderWeatherIcon } from "./WeatherIcon";
import type { WeatherIcon } from "@/lib/weather";

describe("renderWeatherIcon", () => {
  it.each([
    ["sun", "text-amber-500"],
    ["cloud-sun", "text-amber-400"],
    ["cloud", "text-gray-400"],
    ["rain", "text-blue-400"],
    ["storm", "text-purple-400"],
  ] as Array<[WeatherIcon, string]>)("renders the %s icon with its color", (icon, colorClass) => {
    const { container } = render(<>{renderWeatherIcon(icon, "size-6")}</>);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("size-6", colorClass);
  });

  it("defaults to the small size", () => {
    const { container } = render(<>{renderWeatherIcon("sun")}</>);
    expect(container.querySelector("svg")).toHaveClass("size-4");
  });
});
