import { useEffect, useRef, useState } from "react";
import { t } from "./lang";
import type { Key } from "./strings/ko";
import { typing } from "../game/render/FpsInput";
import { CHAT_MAX } from "../game/world/chat";
import type { ChatLine, WorldClient } from "../net/worldClient";
import { announceText } from "./announceText";
import { settings } from "./settings";
import { VIP_MIGHT } from "../game/account/premium";

// Open, it shows this many to scroll back through.
const OPEN_LINES = 30;
// Guild chat is asked for this often: while its tab is open, and otherwise.
const GUILD_POLL_OPEN_MS = 5_000;
const GUILD_POLL_MS = 30_000;

const PROBLEM: Record<string, Key> = {
  too_fast: "problem.tooFast",
};

// The chat, at the bottom left: the channel's lines and your guild's (marked), and a box to say one
// in either (tabs, once you are in a guild). Closed, the latest line stays in view on one line above
// the chat button, as a preview. Enter opens it on a keyboard (and sends), the chat button on a touch
// screen (and the send button beside the box, or the keyboard's own), and a tap on the preview
// anywhere; closing it (the button, Escape, or the focus leaving the box, as when a phone's keyboard is
// put away) also clears the lines seen so far off the screen, and keeps what was typed for next time.
// Open, it stands in the middle above the skill bar, off the pad.
export function ChatBox({ client, keyHints }: { client: WorldClient; keyHints: boolean }) {
  const [lines, setLines] = useState<ChatLine[]>(client.state.chat);
  const [guildLines, setGuildLines] = useState<ChatLine[]>(client.state.guildChat);
  const [inGuild, setInGuild] = useState(client.state.inGuild);
  const [announced, setAnnounced] = useState(client.state.announced);
  const [mode, setMode] = useState<"channel" | "guild">("channel");
  // Guild lines heard up to when the guild tab was last looked at: newer ones put a dot on it.
  const [guildSeen, setGuildSeen] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => client.onChange((s) => {
    setLines((prev) => (prev === s.chat ? prev : s.chat));
    setGuildLines((prev) => (prev === s.guildChat ? prev : s.guildChat));
    setInGuild(s.inGuild);
    setAnnounced((prev) => (prev === s.announced ? prev : s.announced));
  }), [client]);
  const guildOpen = open && mode === "guild";
  useEffect(() => {
    void client.pollGuildChat();
    const timer = setInterval(() => void client.pollGuildChat(), guildOpen ? GUILD_POLL_OPEN_MS : GUILD_POLL_MS);
    return () => clearInterval(timer);
  }, [client, guildOpen]);
  useEffect(() => {
    if (guildOpen) setGuildSeen(Date.now());
  }, [guildOpen, guildLines]);
  useEffect(() => {
    if (!inGuild) setMode("channel");
  }, [inGuild]);
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

  const close = () => {
    setOpen(false);
    setProblem(null);
    input.current?.blur();
  };
  const send = async () => {
    if (!text.trim()) {
      close();
      return;
    }
    const code = mode === "guild" ? await client.guildSay(text) : await client.say(text);
    if (code) {
      setProblem(t(PROBLEM[code] ?? "problem.cannotSend"));
      return;
    }
    setText("");
    close();
  };

  // The announcements to every server, as lines of the channel's chat (the game's, not a player's).
  const told = settings().showAnnouncements ? announced.map((a, i) => ({
    id: -1 - i, account: "", name: "📢", text: announceText(a), at: a.at, heardAt: a.heardAt, mine: false, guild: false, system: true, vip: 0,
  })) : [];
  const channel = [...lines.map((l) => ({ ...l, guild: false, system: false })), ...told].sort((a, b) => a.heardAt - b.heardAt);
  // Closed, the latest of the channel's and the guild's lines.
  const heard = [...channel, ...guildLines.map((l) => ({ ...l, guild: true, system: false }))].sort((a, b) => a.heardAt - b.heardAt);
  const shown = open
    ? (mode === "guild" ? guildLines.map((l) => ({ ...l, guild: true, system: false })) : channel).slice(-OPEN_LINES)
    : heard.slice(-1);
  const guildNew = guildLines.some((l) => l.heardAt > guildSeen && !l.mine);
  return (
    <div className={`chat${open ? " open" : ""}`}>
      {open && inGuild && (
        <div className="chat-tabs">
          {(["channel", "guild"] as const).map((m) => (
            <button
              key={m} type="button" className={`chat-tab${mode === m ? " on" : ""}`}
              // Kept off the focus, so the box stays open (see onBlur below).
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setMode(m);
                setProblem(null);
                input.current?.focus();
              }}
            >
              {t(m === "guild" ? "chat.guild" : "chat.channel")}
              {m === "guild" && guildNew && mode !== "guild" && <i className="hud-dot" />}
            </button>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <div className="chat-log" ref={log} onClick={open ? undefined : () => setOpen(true)}>
          {shown.map((l) => (
            <p key={`${l.guild ? "g" : "c"}${l.id}`} className={[l.mine ? "mine" : "", l.guild ? "guild" : "", l.system ? "system" : ""].join(" ").trim() || undefined}>
              {l.guild && !open && <span className="chat-guild-tag">[{t("chat.guild")}]</span>}{(l.vip ?? 0) > 0 && <span className="vip-mark">VIP {l.vip}</span>}<b className={(l.vip ?? 0) >= VIP_MIGHT ? "vip-gold" : undefined}>{l.name}</b> {l.text}
            </p>
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
            onBlur={() => close()}
          />
          {/* These act the moment they are pressed: on a phone the box may lose the focus (and close) as
              the finger lands, before any click would come. Enter still sends through the form. */}
          <button
            type="button" className="chat-send"
            onPointerDown={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {t("chat.send")}
          </button>
          <button
            type="button" className="chat-close"
            onPointerDown={(e) => {
              e.preventDefault();
              close();
            }}
          >
            {t("common.close")}
          </button>
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
