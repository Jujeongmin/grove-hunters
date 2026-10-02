import { settings } from "../../ui/settings";
import { publicUrl } from "../assets/publicUrl";

// Recorded sound effects (CC0: artisticdude's RPG Sound Pack and Swishes, rubberduck's 80 CC0 RPG SFX,
// StarNinjas' sword sounds; see docs/licenses/asset-provenance.md), picked by ear one by one. Each is
// fetched and decoded once, the first time it is wanted (or when preloadCues asks), and played at its
// own level: the levels bring the loudest moment of each to about the same loudness, fights a little
// above the menus.
const CUES = {
  swing: { file: "swing.ogg", level: 0.2 },
  // The monk's fists and the cleric's staff (Mixkit, see the provenance notes): not a blade's ring.
  punch: { file: "punch.ogg", level: 0.22 },
  staff: { file: "staff.ogg", level: 0.24 },
  arrow: { file: "arrow.wav", level: 0.27 },
  bolt: { file: "bolt.ogg", level: 3.3 },
  skill: { file: "skill.ogg", level: 1.35 },
  // The ranger's, the wizard's and the cleric's skills have their own (Mixkit; the player chose them,
  // the long ones cut to a second and a half): an arrow's hit, ice, a healing spell.
  skill_arrow: { file: "skill_arrow.ogg", level: 0.2 },
  skill_magic: { file: "skill_magic.ogg", level: 0.36 },
  skill_heal: { file: "skill_heal.ogg", level: 0.45 },
  // Something to answer while another screen is up: a Trial Dungeon match, a party invitation.
  notify: { file: "notify.ogg", level: 0.25 },
  // Rewards and mail taken.
  coins: { file: "coins.ogg", level: 0.23 },
  die: { file: "die.ogg", level: 0.32 },
  potion: { file: "potion.wav", level: 0.23 },
  // Heard on most kills, so it sits well under the rest.
  gold: { file: "gold.wav", level: 0.14 },
  click: { file: "click.wav", level: 0.17 },
  open: { file: "cloth.wav", level: 0.15 },
  close: { file: "cloth.wav", level: 0.12 },
  enhance_ok: { file: "enhance_ok.wav", level: 0.21 },
  // A level and a finished quest ring the same bell as a finished enhancement (the player chose it),
  // each a little louder than the last, since each comes round less often.
  levelup: { file: "enhance_ok.wav", level: 0.28 },
  quest: { file: "enhance_ok.wav", level: 0.33 },
  // Heard far more than any of them, so it sits under the loudness the others share.
  hurt: { file: "hurt.wav", level: 0.2 },
  // A boss marks the ground: step out. A deep heartbeat (Mixkit), nothing like any attack's sound.
  warn: { file: "warn.ogg", level: 0.23 },
  enhance_fail: { file: "enhance_fail.ogg", level: 0.66 },
  enhance_break: { file: "enhance_break.ogg", level: 0.6 },
} as const;
export type Cue = keyof typeof CUES;

let audio: AudioContext | null = null;

// The page's one audio context: the cues play through it, and so does the music (see MusicPlayer).
export function audioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  audio ??= new AudioContext();
  return audio;
}

// A phone stops the audio context now and then (another app's sound, low memory, the screen going
// off); it is started again on the next touch or on coming back to the page.
export function wakeAudio(): void {
  if (audio && audio.state !== "running" && audio.state !== "closed") void audio.resume().catch(() => undefined);
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", wakeAudio, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wakeAudio();
  });
}

// Decoded files, by file name (two cues may share one).
const buffers = new Map<string, AudioBuffer | Promise<AudioBuffer | null>>();

function load(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  const loading = fetch(publicUrl(`assets/sfx/${file}`))
    .then((r) => r.arrayBuffer())
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => {
      buffers.set(file, buffer);
      return buffer;
    })
    .catch(() => null);
  buffers.set(file, loading);
  return loading;
}

export function preloadCues(): void {
  const ctx = audioContext();
  if (!ctx) return;
  for (const { file } of Object.values(CUES)) if (!buffers.has(file)) void load(ctx, file);
}

export function playCue(cue: Cue): void {
  const ctx = audioContext();
  if (!ctx) return;
  const { file, level: own } = CUES[cue];
  const level = own * settings().volume;
  if (level <= 0) return;
  const play = (buffer: AudioBuffer | null) => {
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // A little higher or lower each time, so a sound heard over and over does not drone.
    if (cue === "swing" || cue === "punch" || cue === "staff" || cue === "arrow") source.playbackRate.value = 0.94 + Math.random() * 0.12;
    const gain = ctx.createGain();
    gain.gain.value = level;
    source.connect(gain).connect(ctx.destination);
    source.start();
  };
  const held = buffers.get(file);
  if (held instanceof AudioBuffer) play(held);
  else void (held ?? load(ctx, file)).then(play);
}
