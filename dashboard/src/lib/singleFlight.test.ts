import { describe, expect, it, vi } from "vitest";
import { singleFlight } from "./singleFlight";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("singleFlight", () => {
  it("shares one pending task between concurrent callers with the same key", async () => {
    const run = singleFlight<string>();
    const pending = deferred<string>();
    const task = vi.fn(() => pending.promise);

    const first = run("pt-BR", task);
    const second = run("pt-BR", task);
    pending.resolve("analysis");

    await expect(Promise.all([first, second])).resolves.toEqual(["analysis", "analysis"]);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs separate tasks for different keys", async () => {
    const run = singleFlight<string>();
    const task = vi.fn(async () => "analysis");

    await Promise.all([run("pt-BR", task), run("en", task)]);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it("starts a new task once the previous one has settled, including after a failure", async () => {
    const run = singleFlight<string>();
    const failing = vi.fn(async () => {
      throw new Error("timeout");
    });
    const succeeding = vi.fn(async () => "analysis");

    await expect(run("pt-BR", failing)).rejects.toThrow("timeout");
    await expect(run("pt-BR", succeeding)).resolves.toBe("analysis");
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});
