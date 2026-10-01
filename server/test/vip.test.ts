import { VIP_POINTS } from "../../src/game/account/premium";
import { editActive, enterAs, errorOf, makeCharacter } from "./helpers";

// The points for VIP `n`.
const points = (n: number) => VIP_POINTS[n - 1];

async function vipMail(server: any, account: string): Promise<any[]> {
  server.connect({ account });
  return (await server.getMail()).mail.filter((m: any) => m.kind === "vip_daily");
}

describe("VIP perks", () => {
  test("from VIP 3 the first visit of the day brings gems, more at 6 and 9; once a day", async (server) => {
    await makeCharacter(server, "test-a", "브이아이피");
    await $global.updateUserState("test-a", { vipPoints: points(3) });
    await enterAs(server, "test-a");
    await enterAs(server, "test-a");
    expect((await vipMail(server, "test-a")).map((m) => m.gems)).toEqual([10]);

    await makeCharacter(server, "test-b", "큰손님");
    await $global.updateUserState("test-b", { vipPoints: points(9) });
    await enterAs(server, "test-b");
    expect((await vipMail(server, "test-b")).map((m) => m.gems)).toEqual([50]);
  });

  test("below VIP 3, nothing a day", async (server) => {
    await makeCharacter(server, "test-a", "작은손님");
    await $global.updateUserState("test-a", { vipPoints: points(2) });
    await enterAs(server, "test-a");
    expect(await vipMail(server, "test-a")).toEqual([]);
  });

  test("from VIP 4 rising where you fell costs nothing", async (server) => {
    await makeCharacter(server, "test-a", "부활왕");
    await $global.updateUserState("test-a", { vipPoints: points(4) });
    await enterAs(server, "test-a");
    await $room.updateMyState({ dead: true, hp: 0 });
    // No gold at all, and up all the same.
    expect(await $asset.get("gold")).toBe(0);
    await server.reviveHere();
    expect((await $room.getMyState()).dead).toBe(false);
  });

  test("from VIP 2 the bag holds ten more pieces of gear", async (server) => {
    await makeCharacter(server, "test-a", "가방왕");
    const pieces = Array.from({ length: 50 }, (_, i) => ({ uid: `p${i}`, id: "weapon_1", plus: 0, trade: false }));
    await editActive("test-a", (c) => ({ ...c, pieces, gear: { ...c.gear, weapon: { uid: "w", id: "weapon_1", plus: 0, trade: false } } }));
    server.connect({ account: "test-a" });
    // Full at fifty: what is worn cannot come off.
    expect(await errorOf(server.unequipItem("weapon"))).toContain("bag_full");
    await $global.updateUserState("test-a", { vipPoints: points(2) });
    expect((await server.unequipItem("weapon")).pieces.length).toBe(51);
  });
});
