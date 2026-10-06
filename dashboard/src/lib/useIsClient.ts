import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns `false` during SSR and initial hydration, then `true` once mounted on client.
 * Prevents hydration mismatches in components dependent on client viewport (e.g. Recharts ResponsiveContainer).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
