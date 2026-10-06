// Keeps an eye on the line to the server while you are in the world: a small call every so often,
// and when it goes unanswered twice running the line counts as shaky (the screen says so) until an
// answer comes again. The SDK reconnects on its own; this only notices when calls stop coming back,
// which a half-dead connection can hide from it.

export const PING_EVERY_MS = 8_000;
export const PING_TIMEOUT_MS = 6_000;
// Unanswered pings in a row before the line counts as shaky.
const MISSES = 2;

export class LinkWatch {
  private timer: ReturnType<typeof setInterval> | null = null;
  private misses = 0;
  private shaky = false;
  private busy = false;

  constructor(
    private readonly ping: () => Promise<unknown>,
    private readonly onChange: (shaky: boolean) => void,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.check(), PING_EVERY_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.misses = 0;
    this.set(false);
  }

  // One look (exposed for tests): the ping, given PING_TIMEOUT_MS to answer.
  async check(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await withTimeout(this.ping(), PING_TIMEOUT_MS);
      this.misses = 0;
      this.set(false);
    } catch {
      this.misses++;
      if (this.misses >= MISSES) this.set(true);
    } finally {
      this.busy = false;
    }
  }

  private set(shaky: boolean): void {
    if (shaky === this.shaky) return;
    this.shaky = shaky;
    this.onChange(shaky);
  }
}

// A promise that gives up after `ms` (rejecting with "timeout"), so a call the server never answers
// does not hang whatever waits on it.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}
