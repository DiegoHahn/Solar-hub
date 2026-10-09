import {
  RiSunLine,
  RiCloudLine,
  RiRainyLine,
  RiThunderstormsLine,
  RiSunCloudyLine,
} from "@remixicon/react";
import { cx } from "@/lib/utils";
import type { DailyWeather } from "@/lib/weather";

/** Colored Remix icon for a weather condition. */
export function renderWeatherIcon(icon: DailyWeather["icon"], className = "size-4") {
  switch (icon) {
    case "sun":
      return <RiSunLine className={cx(className, "text-amber-500")} />;
    case "cloud-sun":
      return <RiSunCloudyLine className={cx(className, "text-amber-400")} />;
    case "cloud":
      return <RiCloudLine className={cx(className, "text-gray-400")} />;
    case "rain":
      return <RiRainyLine className={cx(className, "text-blue-400")} />;
    case "storm":
      return <RiThunderstormsLine className={cx(className, "text-purple-400")} />;
  }
}
