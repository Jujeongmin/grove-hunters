import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkWatch, PING_TIMEOUT_MS, withTimeout } from "../../src/net/linkWatch";

describe("the link watch", () => {
  afterEach(() => vi.useRealTimers());

  it("calls the line shaky only after two unanswered pings, and steady again at the first answer", async () => {
    let answer = true;
    const seen: boolean[] = [];
    const watch = new LinkWatch(() => (answer ? Promise.resolve("ok") : Promise.reject(new Error("down"))), (s) => seen.push(s));
    await watch.check();
    answer = false;
    await watch.check();
    expect(seen).toEqual([]);
    await watch.check();
    expect(seen).toEqual([true]);
    await watch.check();
    expect(seen).toEqual([true]);
    answer = true;
    await watch.check();
    expect(seen).toEqual([true, false]);
  });

  it("counts a ping that never comes back as unanswered", async () => {
    vi.useFakeTimers();
    const seen: boolean[] = [];
    const watch = new LinkWatch(() => new Promise(() => {}), (s) => seen.push(s));
    for (let i = 0; i < 2; i++) {
      const done = watch.check();
      await vi.advanceTimersByTimeAsync(PING_TIMEOUT_MS + 1);
      await done;
    }
    expect(seen).toEqual([true]);
  });

  it("stopping it calls the line steady again", async () => {
    const seen: boolean[] = [];
    const watch = new LinkWatch(() => Promise.reject(new Error("down")), (s) => seen.push(s));
    await watch.check();
    await watch.check();
    watch.stop();
    expect(seen).toEqual([true, false]);
  });

  it("a call that is never answered gives up", async () => {
    vi.useFakeTimers();
    const late = withTimeout(new Promise(() => {}), 1000);
    const caught = late.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await caught).toBe("timeout");
    expect(await withTimeout(Promise.resolve(5), 1000)).toBe(5);
  });
});
