/**
 * Calculates the minutes elapsed since the specified ISO timestamp.
 */
export function minutesSince(isoDate: string, now: number = Date.now()): number {
  return Math.round((now - new Date(isoDate).getTime()) / 60000);
}

/**
 * Formats an ISO date into a relative time string (Portuguese fallback).
 * For locale-aware relative formatting, prefer `@/i18n/formatters`.
 */
export function formatRelativeTime(isoDate: string, now: number = Date.now()): string {
  const diffMin = minutesSince(isoDate, now);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}
