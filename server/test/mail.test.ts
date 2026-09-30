import { GOLD } from "../../src/game/account/items";
import { MAIL_KEEP_MS, giftsDue } from "../../src/game/account/mail";
import { TUTORIAL_POTIONS } from "../../src/game/account/tutorial";
import { errorOf, makeCharacter } from "./helpers";

// A letter straight into an account's mailbox, as the market will send them.
async function post(account: string, letter: { gold?: number; gems?: number; items?: { id: string; n: number }[]; at?: number }) {
  const row = await $global.addCollectionItem("mail", {
    account, kind: "gift", at: letter.at ?? Date.now(), gold: letter.gold ?? 0, gems: letter.gems ?? 0, items: letter.items ?? [], params: {},
  });
  return row.__id as string;
}

// The letters that are not the game's gifts (the gifts due depend on today's date).
const posted = (mail: { id: string; params: Record<string, unknown> }[]) => mail.filter((m) => !m.params.gift);

describe("mail", () => {
  test("the gifts on now arrive once per account", async (server) => {
    server.connect({ account: "test-a" });
    const due = giftsDue([], Date.now()).length;
    expect((await server.getMail()).mail.length).toBe(due);
    expect((await server.getMail()).mail.length).toBe(due);
    expect((await server.mailCount()).count).toBe(due);
    server.connect({ account: "test-b" });
    expect((await server.mailCount()).count).toBe(due);
  });

  test("a letter's gold, gems and items go to the account and the character that takes it, once", async (server) => {
    await makeCharacter(server, "test-a", "우편왕");
    const id = await post("test-a", { gold: 50, gems: 7, items: [{ id: "potion_big", n: 3 }] });
    const gold = await $asset.get(GOLD);
    const after = posted((await server.claimMail(id)).mail);
    expect(after.find((m: { id: string }) => m.id === id)).toBeUndefined();
    expect(await $asset.get(GOLD)).toBe(gold + 50);
    expect((await server.getMounts()).gems).toBe(7);
    // The HUD reads them off the bag.
    expect((await server.getBag()).gems).toBe(7);
    expect((await server.getBag()).bag.potion_big).toBe(3);
    // Taken already: a second call finds nothing, and pays nothing.
    expect(await errorOf(server.claimMail(id))).toContain("no_mail");
    expect(await $asset.get(GOLD)).toBe(gold + 50);
    expect((await server.getBag()).bag.potion_big).toBe(3);
  });

  test("only your own letters", async (server) => {
    await makeCharacter(server, "test-a", "우편왕");
    const theirs = await post("test-b", { gold: 50 });
    expect(await errorOf(server.claimMail(theirs))).toContain("no_mail");
    expect(await errorOf(server.claimMail("nope"))).toContain("no_mail");
    server.connect({ account: "test-b" });
    expect(posted((await server.getMail()).mail).map((m: { id: string }) => m.id)).toEqual([theirs]);
  });

  test("a full bag leaves the letter where it is", async (server) => {
    await makeCharacter(server, "test-a", "우편왕");
    const id = await post("test-a", { items: [{ id: "potion_small", n: 99 - TUTORIAL_POTIONS + 1 }] });
    expect(await errorOf(server.claimMail(id))).toContain("bag_full");
    expect(posted((await server.getMail()).mail).map((m: { id: string }) => m.id)).toEqual([id]);
    expect((await server.getBag()).bag.potion_small).toBe(TUTORIAL_POTIONS);
  });

  test("without a character only gold and gems can be taken", async (server) => {
    server.connect({ account: "test-a" });
    const items = await post("test-a", { items: [{ id: "potion_big", n: 1 }] });
    const gold = await post("test-a", { gold: 20 });
    expect(await errorOf(server.claimMail(items))).toContain("no_character");
    await server.claimMail(gold);
    expect(await $asset.get(GOLD)).toBe(20);
    expect(posted((await server.getMail()).mail).map((m: { id: string }) => m.id)).toEqual([items]);
  });

  test("taking everything takes what fits and says what was left", async (server) => {
    await makeCharacter(server, "test-a", "우편왕");
    await server.getMail();
    await post("test-a", { gold: 10 });
    await post("test-a", { items: [{ id: "potion_small", n: 99 }] });
    await post("test-a", { items: [{ id: "potion_big", n: 2 }] });
    const result = await server.claimAllMail();
    expect(result.left).toBe(1);
    expect(result.problem).toBe("bag_full");
    expect(posted(result.mail).length).toBe(1);
    expect(result.mail.length).toBe(1);
    // The gifts on now were taken along with the rest.
    const gifted = giftsDue([], Date.now()).flatMap((g) => g.items).filter((i) => i.id === "potion_big").reduce((n, i) => n + i.n, 0);
    expect((await server.getBag()).bag.potion_big).toBe(2 + gifted);
  });

  test("letters older than thirty days are gone", async (server) => {
    server.connect({ account: "test-a" });
    const old = await post("test-a", { gold: 10, at: Date.now() - MAIL_KEEP_MS - 1 });
    const fresh = await post("test-a", { gold: 10, at: Date.now() - MAIL_KEEP_MS + 60_000 });
    expect(posted((await server.getMail()).mail).map((m: { id: string }) => m.id)).toEqual([fresh]);
    expect(await errorOf(server.claimMail(old))).toContain("no_mail");
  });
});
