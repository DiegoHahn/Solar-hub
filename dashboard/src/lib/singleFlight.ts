/**
 * Returns a runner that executes at most one task per key at a time: callers arriving while a task
 * for the same key is pending get that task's promise instead of starting another one.
 */
export function singleFlight<T>(): (key: string, task: () => Promise<T>) => Promise<T> {
  const pending = new Map<string, Promise<T>>();
  return (key, task) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const promise = task().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
