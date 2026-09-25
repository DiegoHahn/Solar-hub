import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` no SSR e na hidratação, `true` após montar no navegador.
 * Evita mismatch de hidratação em componentes que dependem do layout do cliente (ex.: ResponsiveContainer do Recharts).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
