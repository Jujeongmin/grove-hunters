import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import type { FpsInput } from "../game/render/FpsInput";
import { iconFor } from "../game/render/icons";
import { pointIn } from "./useUiScale";

// Whether this is a touch device (a phone or tablet): then the look area shows and the keys do not.
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

// The joystick's ring, and how far the knob can be pushed, in CSS pixels.
const STICK_RADIUS = 56;

// The joystick at the bottom left to walk, on every device (the mouse plays the whole game), and on
// a touch screen a drag anywhere on the right to look round (a mouse drags the world itself).
export function TouchStick({ controls, look: lookArea }: { controls: FpsInput; look: boolean }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const stick = useRef<HTMLDivElement>(null);
  const stickPointer = useRef<number | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);

  // Let go when the controls unmount (leaving the zone).
  useEffect(() => () => controls.setVirtualMove(0, 0), [controls]);

  const moveKnob = (e: React.PointerEvent) => {
    const el = stick.current;
    if (!el) return;
    // In the pixels the ring is drawn in, not the screen's: the overlay is scaled to the stage, so
    // a raw rect would make the knob saturate at a different reach than the ring shows.
    const at = pointIn(el, e.clientX, e.clientY);
    let dx = at.x - el.offsetWidth / 2;
    let dy = at.y - el.offsetHeight / 2;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx *= STICK_RADIUS / len;
      dy *= STICK_RADIUS / len;
    }
    setKnob({ x: dx, y: dy });
    controls.setVirtualMove(-dy / STICK_RADIUS, dx / STICK_RADIUS);
  };
  const releaseKnob = () => {
    stickPointer.current = null;
    setKnob(null);
    controls.setVirtualMove(0, 0);
  };

  return (
    <>
      {lookArea && (
        <div
          className="touch-look"
          onPointerDown={(e) => {
            if (look.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            const l = look.current;
            if (!l || l.id !== e.pointerId) return;
            controls.addVirtualLook((e.clientX - l.x) * 2, (e.clientY - l.y) * 2);
            l.x = e.clientX;
            l.y = e.clientY;
          }}
          onPointerUp={(e) => {
            if (look.current?.id === e.pointerId) look.current = null;
          }}
          onPointerCancel={() => {
            look.current = null;
          }}
        />
      )}
      <div
        ref={stick}
        className="touch-stick"
        onPointerDown={(e) => {
          if (stickPointer.current !== null) return;
          stickPointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          moveKnob(e);
        }}
        onPointerMove={(e) => {
          if (stickPointer.current === e.pointerId) moveKnob(e);
        }}
        onPointerUp={releaseKnob}
        onPointerCancel={releaseKnob}
      >
        <div className="touch-knob" style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }} />
      </div>
    </>
  );
}

interface PadButtonsProps {
  controls: FpsInput;
  auto: boolean;
  // Someone to talk to close by: then a talk button shows.
  talkTo: string | null;
  onJump: () => void;
  onAuto: () => void;
  onTalk: () => void;
  // Keyboard players see each button's key in its corner.
  keys: boolean;
  // The tutorial's pointer at the auto-battle button.
  glowAuto?: boolean;
}

// One round, see-through button: its picture (496 RPG icons pack), its name, and its key.
function PadButton({ id, label, keyLabel, className = "", ...rest }: {
  id: string; label: string; keyLabel: string | null; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`pad-button pad-${id} ${className}`} {...rest}>
      <img src={iconFor(`pad_${id}`) ?? undefined} alt="" draggable={false} />
      <span>{label}</span>
      {keyLabel && <kbd className="hud-key">{keyLabel}</kbd>}
    </button>
  );
}

// The round buttons at the bottom right, on every device: a big attack button (held for a flurry)
// with guard, jump, auto-battle and (by someone) talk round it.
export function PadButtons({ controls, auto, talkTo, onJump, onAuto, onTalk, keys, glowAuto }: PadButtonsProps) {
  useEffect(() => () => {
    controls.setVirtualFiring(false);
    controls.setVirtualBlocking(false);
  }, [controls]);

  const hold = (set: (on: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      set(true);
    },
    onPointerUp: () => set(false),
    onPointerCancel: () => set(false),
  });

  return (
    <div className="pad-buttons">
      <PadButton id="attack" label={t("pad.attack")} keyLabel={keys ? t("pad.leftClick") : null} {...hold((on) => controls.setVirtualFiring(on))} />
      <PadButton id="block" label={t("pad.block")} keyLabel={keys ? t("pad.rightClick") : null} {...hold((on) => controls.setVirtualBlocking(on))} />
      <PadButton id="jump" label={t("pad.jump")} keyLabel={keys ? "Space" : null} onPointerDown={onJump} />
      <PadButton id="auto" label={auto ? t("pad.autoOn") : t("pad.auto")} keyLabel={keys ? "R" : null} className={`${auto ? "on" : ""}${glowAuto ? " tutorial-glow" : ""}`} onClick={onAuto} />
      {talkTo && <PadButton id="talk" label={t("pad.talk")} keyLabel={keys ? "E" : null} onClick={onTalk} />}
    </div>
  );
}
