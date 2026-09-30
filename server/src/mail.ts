import {
  MAILBOX_SHOWN, giftsDue, mailExpired, readGiftsTaken, readMail, type Mail,
} from "../../src/game/account/mail";
import { RuleViolation } from "../../src/game/world/types";

// One row per letter, looked up by the account it is for. Anyone may put one in (a buyer's call
// pays the seller); only the account it is for takes it out, under its mail lock.
export const MAIL_COLLECTION = "mail";
// Read this many of an account's rows at most (the box shows MAILBOX_SHOWN; the rest wait their turn).
const MAILBOX_READ = 200;

export type Letter = Omit<Mail, "id" | "at">;

export function withMailLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  return $lock(`mail:${account}`, fn);
}

// Puts a letter in an account's mailbox; answers its id.
export async function sendMail(account: string, letter: Letter, now: number): Promise<string> {
  const row = await $global.addCollectionItem(MAIL_COLLECTION, { account, ...letter, at: now });
  return (row as { __id: string }).__id;
}

async function rowsOf(account: string): Promise<Record<string, unknown>[]> {
  return (await $global.getCollectionItems(MAIL_COLLECTION, {
    filters: [{ field: "account", operator: "==", value: account }],
    limit: MAILBOX_READ,
  })) as Record<string, unknown>[];
}

// The gifts on now that the account has not had yet go into its mailbox, once each. Call inside its
// mail lock.
async function deliverGifts(account: string, now: number): Promise<void> {
  const taken = readGiftsTaken((await $global.getUserState(account)).giftsTaken);
  const due = giftsDue(taken, now);
  if (due.length === 0) return;
  // Marked first: should a letter fail to go in, the gift is missed rather than sent twice.
  await $global.updateUserState(account, { giftsTaken: [...taken, ...due.map((g) => g.id)] });
  for (const gift of due) {
    await sendMail(account, { kind: "gift", gold: gift.gold, gems: gift.gems, items: gift.items, params: { gift: gift.id } }, now);
  }
}

// An account's mailbox, newest first: gifts due are delivered and letters past their time go.
export function openMailbox(account: string, now: number): Promise<Mail[]> {
  return withMailLock(account, async () => {
    await deliverGifts(account, now);
    const kept: Mail[] = [];
    for (const row of await rowsOf(account)) {
      const mail = readMail(row);
      if (!mail || mailExpired(mail, now)) await $global.deleteCollectionItem(MAIL_COLLECTION, row.__id as string);
      else kept.push(mail);
    }
    return kept.sort((a, b) => b.at - a.at).slice(0, MAILBOX_SHOWN);
  });
}

// Takes one letter: `check` refuses it before anything changes (the bag is full), then the row goes
// and `grant` hands over what it carries; should that fail, the letter goes back in.
export function takeMail(
  account: string, id: string, now: number, check: (mail: Mail) => Promise<void>, grant: (mail: Mail) => Promise<void>,
): Promise<void> {
  return withMailLock(account, async () => {
    const row = await $global.getCollectionItem(MAIL_COLLECTION, id).catch(() => null);
    const mail = readMail(row);
    if (!mail || (row as { account?: unknown }).account !== account || mailExpired(mail, now)) throw new RuleViolation("no_mail");
    await check(mail);
    await $global.deleteCollectionItem(MAIL_COLLECTION, id);
    try {
      await grant(mail);
    } catch (error) {
      const { id: _, at, ...letter } = mail;
      await $global.addCollectionItem(MAIL_COLLECTION, { account, ...letter, at });
      throw error;
    }
  });
}
