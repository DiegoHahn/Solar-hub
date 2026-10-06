const TZ = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO date (YYYY-MM-DD) of the given instant in Brasília timezone (America/Sao_Paulo). */
export function toBrasiliaIsoDate(date: Date): string {
  return date
    .toLocaleDateString("pt-BR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .split("/")
    .reverse()
    .join("-");
}

/** Local Brasília time ("HH:MM") and boolean indicating daytime solar generation hours (06:00 to 19:00). */
export function brasiliaClock(now: Date = new Date()): { time: string; isDaytime: boolean } {
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const hour = Number(time.slice(0, 2));
  return { time, isDaytime: hour >= 6 && hour < 19 };
}

/** ISO date (YYYY-MM-DD) in Brasília timezone `days` before `now`. */
export function brasiliaIsoDaysAgo(days: number, now: Date = new Date()): string {
  return toBrasiliaIsoDate(new Date(now.getTime() - days * DAY_MS));
}

/** Whole minutes elapsed since `isoDate`. */
export function minutesSince(isoDate: string, now: number = Date.now()): number {
  return Math.round((now - new Date(isoDate).getTime()) / 60000);
}
