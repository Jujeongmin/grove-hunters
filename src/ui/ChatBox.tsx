import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import type { Key } from "./strings/ko";
import { typing } from "../game/render/FpsInput";
import { CHAT_MAX } from "../game/world/chat";
import type { ChatLine, WorldClient } from "../net/worldClient";

// Closed, the box shows the last few lines, each for a while after it came.
const QUIET_LINES = 6;
const QUIET_MS = 15_000;
// Open, it shows this many to scroll back through.
const OPEN_LINES = 30;

const PROBLEM: Record<string, Key> = {
  too_fast: "problem.tooFast",
};

// The channel chat, at the bottom left: the latest lines, and a box to say one. Enter opens it on a
// keyboard (and sends), the chat button on a touch screen, and a tap on the lines themselves
// anywhere; closing it (the button, Escape) also clears the lines seen so far off the screen.
export function ChatBox({ client, keyHints }: { client: WorldClient; keyHints: boolean }) {
  const [lines, setLines] = useState<ChatLine[]>(client.state.chat);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Lines heard up to when the chat was last closed have been seen: they stay off the closed box.
  const [seenUntil, setSeenUntil] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => client.onChange((s) => setLines((prev) => (prev === s.chat ? prev : s.chat))), [client]);
  // Once a second, so old lines fade out of the closed box.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || typing(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines, open]);

  // Closing by hand marks the lines so far as seen; closing on a send does not, so what you just
  // said (and what came meanwhile) still shows in the closed box.
  const close = (seen = true) => {
    setOpen(false);
    setProblem(null);
    if (seen) setSeenUntil(Date.now());
    input.current?.blur();
  };
  const send = async () => {
    if (!text.trim()) {
      close();
      return;
    }
    const code = await client.say(text);
    if (code) {
      setProblem(t(PROBLEM[code] ?? "problem.cannotSend"));
      return;
    }
    setText("");
    close(false);
  };

  const shown = open
    ? lines.slice(-OPEN_LINES)
    : lines.slice(-QUIET_LINES).filter((l) => l.heardAt > seenUntil && now - l.heardAt < QUIET_MS);
  return (
    <div className={`chat${open ? " open" : ""}`}>
      {shown.length > 0 && (
        <div className="chat-log" ref={log} onClick={open ? undefined : () => setOpen(true)}>
          {shown.map((l) => (
            <p key={l.id} className={l.mine ? "mine" : undefined}><b>{l.name}</b> {l.text}</p>
          ))}
        </div>
      )}
      {open ? (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            ref={input} value={text} maxLength={CHAT_MAX} placeholder={t("chat.placeholder")} enterKeyHint="send"
            onChange={(e) => {
              setText(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
            }}
          />
          <button type="button" className="chat-close" onClick={() => close()}>{t("common.close")}</button>
          {problem && <span className="chat-problem">{problem}</span>}
        </form>
      ) : (
        !keyHints
          ? <button type="button" className="chat-open band" onClick={() => setOpen(true)}>{t("chat.open")}</button>
          // On a keyboard the bar says how to talk: Enter opens it, like a click on it.
          : <button type="button" className="chat-bar" onClick={() => setOpen(true)}><kbd>Enter</kbd>{t("chat.enterHint")}</button>
      )}
    </div>
  );
}
