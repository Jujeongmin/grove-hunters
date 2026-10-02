import { describe, expect, it } from "vitest";
import { INVITE_MS, PARTY_MAX, inviteLive, readInvite, readParty, shareOf, without } from "../../src/game/account/party";

const member = (account: string) => ({ account, characterId: `c-${account}`, name: account });
const party = (...accounts: string[]) => readParty({ __id: "p1", world: "w1", leader: accounts[0], members: accounts.map(member), made: 1 })!;

describe("parties", () => {
  it("shares a kill: alone the whole of it, together a little more in all, split evenly", () => {
    expect(shareOf(1)).toBe(1);
    expect(shareOf(2)).toBeCloseTo(0.55);
    expect(shareOf(4)).toBeCloseTo(0.325);
    expect(shareOf(4) * 4).toBeGreaterThan(1);
  });

  it("reads a party row, keeping only what makes sense", () => {
    expect(readParty(null)).toBeNull();
    expect(readParty({ __id: "p", world: "w1", leader: "a", members: [] })).toBeNull();
    const read = readParty({
      __id: "p", world: "w1", leader: "ghost",
      members: [member("a"), member("a"), { account: "b" }, member("c"), member("d"), member("e"), member("f")],
    })!;
    // No twice over, nothing broken, no more than PARTY_MAX; a leader who is not a member is the first.
    expect(read.members.map((m) => m.account)).toEqual(["a", "c", "d", "e"].slice(0, PARTY_MAX));
    expect(read.leader).toBe("a");
  });

  it("lets a member go: the next leads if the leader went, and one left is no party", () => {
    expect(without(party("a", "b", "c"), "a")).toMatchObject({ leader: "b", members: [member("b"), member("c")] });
    expect(without(party("a", "b", "c"), "c")?.leader).toBe("a");
    expect(without(party("a", "b"), "b")).toBeNull();
  });

  it("holds an invitation for a minute", () => {
    const invite = readInvite({ __id: "i", to: "b", from: "a", fromName: "에이", party: null, world: "w1", at: 1000 })!;
    expect(invite.party).toBeNull();
    expect(inviteLive(invite, 1000 + INVITE_MS - 1)).toBe(true);
    expect(inviteLive(invite, 1000 + INVITE_MS)).toBe(false);
    expect(readInvite({ __id: "i", to: "b" })).toBeNull();
  });
});
