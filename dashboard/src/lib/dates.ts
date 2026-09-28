const TZ = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Data ISO (YYYY-MM-DD) do instante informado no fuso de Brasília. */
export function toBrasiliaIsoDate(date: Date): string {
  return date
    .toLocaleDateString("pt-BR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .split("/")
    .reverse()
    .join("-");
}

/** Hora local de Brasília ("HH:MM") e se está no período de geração solar (06h às 19h). */
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

/** Data ISO (YYYY-MM-DD) em Brasília de `days` dias antes de `now`. */
export function brasiliaIsoDaysAgo(days: number, now: Date = new Date()): string {
  return toBrasiliaIsoDate(new Date(now.getTime() - days * DAY_MS));
}
