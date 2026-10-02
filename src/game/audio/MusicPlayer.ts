import { publicUrl } from "../assets/publicUrl";
import { MUSIC_FILES, MUSIC_LEVEL, MUSIC_TRACKS, type Track } from "./musicTrack";
import { audioContext } from "./sfx";

// How long one piece takes to fade out while the next fades in: short, so a new zone sounds like itself
// at once.
export const CROSSFADE_MS = 1000;
const STEP_MS = 50;

// What the player needs from an audio element, so tests can hand it a fake one.
export interface MusicElement {
  volume: number;
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
  currentTime: number;
}

// Asks to be called back the next time the page is touched, so a refused start can be retried.
export type WaitForTouch = (again: () => void) => void;

const waitForTouch: WaitForTouch = (again) => {
  if (typeof window === "undefined") return;
  const once = () => {
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
    again();
  };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
};

// A track's element, fetched ahead (the player makes them all at the start). Its loudness goes through
// the audio context's gain where there is one: iPhones ignore an audio element's volume (always full),
// so the levels below and the music setting would not count there otherwise.
function makeAudio(src: string): MusicElement {
  const audio = new Audio(publicUrl(src));
  audio.preload = "auto";
  const ctx = audioContext();
  let gain: GainNode;
  try {
    if (!ctx) return audio;
    gain = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
  } catch {
    return audio;
  }
  gain.gain.value = 0;
  return {
    get volume() {
      return gain.gain.value;
    },
    set volume(v: number) {
      gain.gain.value = v;
    },
    get loop() {
      return audio.loop;
    },
    set loop(v: boolean) {
      audio.loop = v;
    },
    get currentTime() {
      return audio.currentTime;
    },
    set currentTime(v: number) {
      audio.currentTime = v;
    },
    // The context starts held until the page is touched, like the element.
    play: () => {
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      return audio.play();
    },
    pause: () => audio.pause(),
  };
}

// Plays one looping track at a time, fading between them. Browsers refuse to start audio before the
// page is touched, so a refused start is retried on the first click or key press.
export class MusicPlayer {
  private readonly loaded = new Map<Track, MusicElement>();
  private readonly gains = new Map<Track, number>();
  private wanted: Track | null = null;
  private volume = 0.5;
  private timer: ReturnType<typeof setInterval> | null = null;
  private waitingForTouch = false;
  private disposed = false;

  constructor(
    private readonly create: (src: string) => MusicElement = makeAudio,
    private readonly onTouch: WaitForTouch = waitForTouch,
  ) {}

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.apply();
    // Turning the music back up after silence starts it again.
    if (this.volume > 0 && this.wanted) {
      this.start(this.wanted);
      this.run();
    }
  }

  play(track: Track | null): void {
    if (this.disposed || track === this.wanted) return;
    this.wanted = track;
    if (track) this.start(track);
    this.run();
  }

  // Starts the wanted piece again if something stopped it (a phone pausing the page's sound).
  revive(): void {
    if (this.wanted && !this.disposed) this.start(this.wanted);
  }

  // Makes every track's element now, so each is fetched ahead and a zone's piece starts at once.
  warm(): void {
    for (const track of MUSIC_TRACKS) this.element(track);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const element of this.loaded.values()) element.pause();
    this.loaded.clear();
    this.gains.clear();
  }

  private element(track: Track): MusicElement {
    let element = this.loaded.get(track);
    if (!element) {
      element = this.create(MUSIC_FILES[track]);
      element.loop = true;
      element.volume = 0;
      this.loaded.set(track, element);
    }
    return element;
  }

  private start(track: Track): void {
    if (this.volume === 0) return;
    const element = this.element(track);
    void Promise.resolve(element.play()).catch(() => this.retryOnTouch());
  }

  private retryOnTouch(): void {
    if (this.waitingForTouch) return;
    this.waitingForTouch = true;
    this.onTouch(() => {
      this.waitingForTouch = false;
      if (this.wanted && !this.disposed) this.start(this.wanted);
    });
  }

  // One interval drives every fade; it stops once nothing is moving.
  private run(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(), STEP_MS);
  }

  private step(): void {
    const stride = STEP_MS / CROSSFADE_MS;
    let moving = false;
    for (const track of this.loaded.keys()) {
      const goal = track === this.wanted ? 1 : 0;
      const gain = this.gains.get(track) ?? 0;
      const next = gain < goal ? Math.min(goal, gain + stride) : Math.max(goal, gain - stride);
      if (next !== gain) moving = true;
      this.gains.set(track, next);
      if (next === 0 && goal === 0) {
        const element = this.loaded.get(track)!;
        element.pause();
        element.currentTime = 0;
      }
    }
    this.apply();
    if (!moving && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private apply(): void {
    for (const [track, element] of this.loaded) {
      element.volume = this.volume * MUSIC_LEVEL[track] * (this.gains.get(track) ?? 0);
    }
  }
}
