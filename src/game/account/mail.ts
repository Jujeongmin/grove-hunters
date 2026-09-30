import type { Lang } from "../langs";
import { readItemId, type ItemId } from "./items";
import { fits, type Inventory } from "./inventory";

// Mail: only the game sends it (gifts now; the market's proceeds and returns later). One mailbox per
// account, the same on every server and character; what a letter carries goes to the character that
// takes it, its gold and gems to the account.

export type MailKind = "gift";

export interface MailItem { id: ItemId; n: number }

export interface Mail {
  // The row's id in the mail collection.
  id: string;
  kind: MailKind;
  // When it arrived (ms).
  at: number;
  gold: number;
  gems: number;
  items: MailItem[];
  // The holes in its words (a gift's id, a price…).
  params: Record<string, string | number>;
}

// A letter is kept this long, then goes, taken or not.
export const MAIL_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
// The mailbox shows the newest this many.
export const MAILBOX_SHOWN = 50;

const KINDS: readonly MailKind[] = ["gift"];

const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : 0);

function readItems(raw: unknown): MailItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MailItem[] = [];
  for (const entry of raw) {
    const id = readItemId((entry as { id?: unknown } | null)?.id);
    const n = count((entry as { n?: unknown } | null)?.n);
    if (!id || n === 0) return null;
    out.push({ id, n });
  }
  return out;
}

// A row of the mail collection as a letter; null for anything that does not read back whole.
export function readMail(row: unknown): Mail | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.__id !== "string" || !KINDS.includes(r.kind as MailKind) || typeof r.at !== "number") return null;
  const items = readItems(r.items ?? []);
  if (!items) return null;
  const params: Record<string, string | number> = {};
  if (r.params && typeof r.params === "object") {
    for (const [k, v] of Object.entries(r.params as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number") params[k] = v;
    }
  }
  return { id: r.__id, kind: r.kind as MailKind, at: r.at, gold: count(r.gold), gems: count(r.gems), items, params };
}

export function mailExpired(mail: Pick<Mail, "at">, now: number): boolean {
  return now - mail.at >= MAIL_KEEP_MS;
}

// Whole days left before it goes (a part of a day counts as one), never below zero.
export function daysLeft(mail: Pick<Mail, "at">, now: number): number {
  return Math.max(0, Math.ceil((mail.at + MAIL_KEEP_MS - now) / (24 * 60 * 60 * 1000)));
}

// Whether everything a letter carries fits the bag (no stack past MAX_STACK, no gear past
// MAX_PIECES). One that does not is left in the mailbox rather than half taken.
export function mailFits(inv: Inventory, mail: Pick<Mail, "items">): boolean {
  return fits(inv, mail.items, false);
}

// Gifts from the game to every account that comes in while one is on: each account gets each once.
// Kept in code like the news; an id is never used twice.
export interface Gift {
  id: string;
  // On from `from` until `until` (ms).
  from: number;
  until: number;
  gold: number;
  gems: number;
  items: MailItem[];
  text: Record<Lang, { title: string; body: string }>;
}

const DAY = 24 * 60 * 60 * 1000;
const KST = (date: string) => Date.parse(`${date}T00:00:00+09:00`);

export const GIFTS: readonly Gift[] = [
  {
    id: "2026-09-30-mailbox",
    from: KST("2026-09-30"),
    until: KST("2026-09-30") + 14 * DAY,
    gold: 0,
    gems: 0,
    items: [{ id: "potion_big", n: 10 }],
    text: {
      ko: { title: "우편함이 열렸어요", body: "우편함을 연 기념으로 큰 물약 10개를 보내요. 즐거운 사냥 되세요!" },
      en: { title: "The mailbox is open", body: "To mark the mailbox opening, here are 10 large potions. Happy hunting!" },
      ja: { title: "郵便箱がオープンしました", body: "郵便箱のオープンを記念して、大きなポーションを10個お送りします。楽しい狩りを！" },
      "zh-Hant": { title: "郵箱開放了", body: "為紀念郵箱開放，送上大藥水10個。祝狩獵愉快！" },
      "zh-Hans": { title: "邮箱开放了", body: "为纪念邮箱开放，送上大药水10个。祝狩猎愉快！" },
    },
  },
];

export function giftById(id: unknown): Gift | null {
  return GIFTS.find((g) => g.id === id) ?? null;
}

// The ids of the gifts an account has had, as saved.
export function readGiftsTaken(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

// The gifts on now that the account has not had yet.
export function giftsDue(taken: readonly string[], now: number): Gift[] {
  return GIFTS.filter((g) => g.from <= now && now < g.until && !taken.includes(g.id));
}
