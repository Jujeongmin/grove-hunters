// Keeps the frame rate by trading sharpness for it: the world is drawn at fewer pixels a point while
// frames come late, and at more again once they have kept time for a while. On time is 60 frames a
// second: a 120 Hz screen running at 60 is not worth blurring for.

// Steps of pixels a point, and the fewest it goes down to: one pixel a point, never fewer (below it
// a phone's picture turned visibly blurry).
const STEP = 0.25;
export const FLOOR_RATIO = 1;
// How often it judges, over how many frames, and how late the middle frame may be.
const JUDGE_MS = 1000;
const WINDOW = 90;
const LATE_MS = 21;
const ON_TIME_MS = 18.5;
// A gap this long is not a slow frame but a pause (another tab, the power saver): not counted.
const PAUSE_MS = 250;
// How long frames must keep time before it sharpens again; and after sharpening brought the lateness
// back, how long it leaves well alone.
const CALM_MS = 8000;
const BURNED_MS = 60_000;

export class FrameGovernor {
  private readonly gaps: number[] = [];
  private last = 0;
  private lastJudged = 0;
  private calmSince = 0;
  private raisedAt = -Infinity;
  private noRaiseUntil = 0;
  private ratio: number;

  // cap: the most pixels a point the settings allow.
  constructor(private cap: number) {
    this.ratio = cap;
  }

  get pixelRatio(): number {
    return this.ratio;
  }

  // The settings changed: start again from their cap.
  setCap(cap: number): void {
    this.cap = cap;
    this.ratio = cap;
    this.reset(performance.now());
    this.noRaiseUntil = 0;
  }

  // Each drawn frame. Answers the new pixels a point when it changes, else null.
  frame(now: number): number | null {
    const gap = now - this.last;
    this.last = now;
    if (gap <= 0 || gap > PAUSE_MS) return null;
    this.gaps.push(gap);
    if (this.gaps.length > WINDOW) this.gaps.shift();
    if (now - this.lastJudged < JUDGE_MS || this.gaps.length < WINDOW / 2) return null;
    this.lastJudged = now;
    const middle = [...this.gaps].sort((a, b) => a - b)[Math.floor(this.gaps.length / 2)];
    if (middle > LATE_MS) {
      this.calmSince = now;
      // Sharpening just now brought this on: back down, and no more tries for a while.
      if (now - this.raisedAt < CALM_MS) this.noRaiseUntil = now + BURNED_MS;
      if (this.ratio <= FLOOR_RATIO) return null;
      return this.change(Math.max(FLOOR_RATIO, this.ratio - STEP), now);
    }
    if (middle > ON_TIME_MS) {
      this.calmSince = now;
      return null;
    }
    if (this.ratio >= this.cap || now < this.noRaiseUntil || now - this.calmSince < CALM_MS) return null;
    this.raisedAt = now;
    return this.change(Math.min(this.cap, this.ratio + STEP), now);
  }

  private change(ratio: number, now: number): number {
    this.ratio = ratio;
    this.reset(now);
    return ratio;
  }

  // After a change the frames before it say nothing about the new size.
  private reset(now: number): void {
    this.gaps.length = 0;
    this.calmSince = now;
    this.lastJudged = now;
  }
}
