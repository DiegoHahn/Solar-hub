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

/** Data ISO (YYYY-MM-DD) em Brasília de `days` dias antes de `now`. */
export function brasiliaIsoDaysAgo(days: number, now: Date = new Date()): string {
  return toBrasiliaIsoDate(new Date(now.getTime() - days * DAY_MS));
}
