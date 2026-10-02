import { MusicPlayer } from "./MusicPlayer";
import type { Track } from "./musicTrack";
import { onSettings, settings } from "../../ui/settings";

let player: MusicPlayer | null = null;

function live(): MusicPlayer {
  if (!player) {
    player = new MusicPlayer();
    // Every piece fetched from the start, like the models: nothing waits for its file mid-game.
    player.warm();
    player.setVolume(settings().music);
    onSettings((s) => player?.setVolume(s.music));
    // Stopped by the phone (see wakeAudio), the music comes back on the next touch or on coming back.
    window.addEventListener("pointerdown", () => player?.revive(), true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") player?.revive();
    });
  }
  return player;
}

// Asks for a track; the player fades between them and follows the music setting.
export function playMusic(track: Track): void {
  live().play(track);
}
