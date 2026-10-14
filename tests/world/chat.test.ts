import { describe, expect, it } from "vitest";
import { CHAT_BURST, CHAT_GAP_MS, CHAT_MAX, CHAT_WINDOW_MS, chatAllowed, readChat } from "../../src/game/world/chat";

describe("readChat", () => {
  it("tidies a line and turns away empty or overlong ones", () => {
    expect(readChat("  a \t b\n")).toBe("a b");
    expect(readChat("x​y")).toBe("x y");
    expect(readChat("   ")).toBeNull();
    expect(readChat(7)).toBeNull();
    expect(readChat("가".repeat(CHAT_MAX))).toHaveLength(CHAT_MAX);
    expect(readChat("가".repeat(CHAT_MAX + 1))).toBeNull();
  });

  it("hides swearing with *, through digits, _ and case, and leaves the rest of the line", () => {
    expect(readChat("아 시발 뭐야")).toBe("아 ** 뭐야");
    expect(readChat("시1발")).toBe("***");
    expect(readChat("ㅅㅂ 진짜")).toBe("** 진짜");
    expect(readChat("what the FUCK")).toBe("what the ****");
    expect(readChat("병신아 병신")).toBe("**아 **");
    // Harmless in a sentence, banned only in names; and the staff may be called.
    expect(readChat("보지 마 운영자님")).toBe("보지 마 운영자님");
    expect(readChat("다시 발견했어")).toBe("다시 발견했어");
  });
});

describe("chatAllowed", () => {
  it("keeps lines apart and caps a burst", () => {
    expect(chatAllowed([], 0)).toBe(true);
    expect(chatAllowed([1000], 1000 + CHAT_GAP_MS - 1)).toBe(false);
    expect(chatAllowed([1000], 1000 + CHAT_GAP_MS)).toBe(true);
    const burst = Array.from({ length: CHAT_BURST }, (_, i) => i * CHAT_GAP_MS);
    const after = burst[burst.length - 1] + CHAT_GAP_MS;
    expect(chatAllowed(burst, after)).toBe(false);
    expect(chatAllowed(burst, CHAT_WINDOW_MS + 1)).toBe(true);
  });
});
