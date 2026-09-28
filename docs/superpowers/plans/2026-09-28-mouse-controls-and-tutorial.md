# 마우스 조작 + 첫 튜토리얼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC에서도 마우스만으로 모든 플레이가 되게 하고(마우스 잠금·WASD 제거, 가상 패드), 새 캐릭터가 촌장에게 스킬 1과 물약을 받아 스킬 등록 → 자동 사용 → 자동 전투를 해 보는 튜토리얼을 넣는다.

**Architecture:** 튜토리얼 단계 규칙은 `src/game/account/tutorial.ts` 순수 함수 하나에 모으고 서버와 화면이 같이 쓴다. 서버는 캐릭터마다 `tutorial` 단계(0~3, 없으면 완료)를 저장하고 보상을 한 번만 준다. 화면은 `useTutorial` 훅이 설정·HUD를 보고 서버에 다음 단계를 알리고, `TutorialTracker`가 퀘스트 칸 자리에 할 일을 보여 준다. 마우스 조작은 `FpsInput`에서 잠금과 WASD를 빼고, 화면 배치는 터치 배치를 모든 기기에 쓴다.

**Tech Stack:** Vite + React 18 + TypeScript, three.js, @agent8/gameserver (server/src/server.ts), vitest (클라이언트 `tests/`, 서버 `server/test/`).

**Spec:** [docs/superpowers/specs/2026-09-28-mouse-controls-and-tutorial-design.md](../specs/2026-09-28-mouse-controls-and-tutorial-design.md)

## Global Constraints

- 사용자와는 한국어로 말한다. 코드·주석·커밋 메시지는 영어, 주변 코드의 주석 밀도와 말투를 따른다.
- 커밋 직전마다 `npx tsc -b`, `npx vitest run`, `npm run server:test`를 돌려 모두 통과해야 한다.
- 커밋은 `master`에. 마지막 태스크에서 `master`를 로컬 `develop`에 머지하고 `origin master`, `gitlab develop`을 푸시한다. force-push 금지, 손으로 배포 금지, `develop`을 `master`에 머지 금지.
- 게임 에셋은 `develop`에만 있다. 브랜치를 바꾸면 무시된 에셋이 지워지니, 전환 뒤 `git checkout gitlab/develop -- public/assets/models public/assets/ui && git restore --staged public/assets`로 되살린다.
- 화면 문구는 5개 언어(ko, en, ja, zhHant, zhHans) 모두에 넣는다. 키 타입은 `ko.ts`에서 나오므로 다섯 파일에 같은 키가 있어야 `tsc`가 통과한다.
- 가장 작은 무대 800×450에서 패널 스크롤 0, HUD 겹침 0을 유지한다.
- 코드로 그린 그림(도형으로 만든 장면)은 넣지 않는다. UI 테두리 빛(CSS box-shadow)은 괜찮다.
- 튜토리얼 수치: 촌장 물약 `potion_small` 5개, 끝 보상 골드 100. 새 캐릭터 가방은 `{}`.
- 터치 기기의 동작은 바뀌지 않는다.

---

## File Structure

| 파일 | 할 일 |
|---|---|
| `src/game/account/tutorial.ts` (새) | 단계 상수, `readTutorial`, `skillLearned`, `tutorialStepDone`, `tutorialGlow`, 보상 수치 |
| `tests/account/tutorial.test.ts` (새) | 위 순수 함수 테스트 |
| `src/game/account/characters.ts` | `Character.tutorial`, `readCharacters`가 읽음 |
| `src/game/account/items.ts` | `BagView.tutorial` |
| `src/game/world/zones.ts` | `ZoneLook.learned?` |
| `server/src/store.ts` | `zoneLook`에 `learned`, 옛 계정 이전 캐릭터에 `tutorial: null` |
| `server/src/hunt.ts` | `Fighter.learned`, `useSkill`이 배우기 전 슬롯 0 거절 |
| `server/src/server.ts` | 새 캐릭터 시작 상태, `bagView`, 엔드포인트 4개 |
| `server/test/helpers.ts` | `makeCharacter`가 기본으로 튜토리얼을 건너뜀 |
| `server/test/tutorial.test.ts` (새) | 서버 튜토리얼 테스트 |
| `server/test/bag.test.ts`, `server/test/growth.test.ts` | 시작 물약 3 → 5 반영 |
| `src/net/worldClient.ts` | `tutorialTalk/Step/Finish/Skip` |
| `src/game/render/WorldView.ts` | 배우지 않은 스킬은 HUD에서 빈 칸, 누르기·자동 전투가 안 씀 |
| `src/game/render/FpsInput.ts` | 마우스 잠금·WASD 제거 |
| `tests/render/fpsInput.test.ts` (새) | 끌어서 보기, 클릭 공격, WASD 무시 |
| `src/ui/TouchControls.tsx` | 패드는 모든 기기, 오른쪽 보기 영역은 터치만, 자동 버튼 빛 |
| `src/ui/WorldScreen.tsx` | 잠금 코드·조준점 제거, `keyHints`, 튜토리얼 연결 |
| `src/ui/ChatBox.tsx` | `touch` → `keyHints` |
| `src/ui/useTutorial.ts` (새) | 단계 판정·서버 호출·2단계 자동 끄기·건너뛰기 |
| `src/ui/TutorialTracker.tsx` (새) | 할 일 줄 + 건너뛰기, 끝 배너 |
| `src/ui/SkillBar.tsx` | 빛 표시 |
| `src/ui/SkillPanel.tsx` | 배우기 전 스킬 1 잠금, 놓았을 때 알림 |
| `src/ui/QuestPanel.tsx` | 튜토리얼 중 촌장 대사 |
| `src/ui/strings/{ko,en,ja,zhHant,zhHans}.ts` | 새 문구 |
| `src/index.css` | 터치 배치를 모든 기기에, 조준점 제거, 튜토리얼 빛·건너뛰기 |

---

### Task 1: 튜토리얼 규칙 (공용 순수 함수)

**Files:**
- Create: `src/game/account/tutorial.ts`
- Test: `tests/account/tutorial.test.ts`

**Interfaces:**
- Produces:
  - `TUTORIAL = { talk: 0, register: 1, auto: 2, battle: 3 } as const`
  - `type TutorialStep = 0 | 1 | 2 | 3`
  - `TUTORIAL_POTIONS = 5`, `TUTORIAL_GOLD = 100`
  - `readTutorial(raw: unknown): TutorialStep | null`
  - `skillLearned(step: TutorialStep | null, index: number): boolean`
  - `interface TutorialSeen { placedSkill: boolean; autoSkill: boolean; autoPotion: boolean; autoBattle: boolean }`
  - `tutorialStepDone(step: TutorialStep, seen: TutorialSeen): boolean`
  - `type TutorialGlow = "tracker" | "fold" | "skills" | "slot0" | "bar" | "auto" | null`
  - `tutorialGlow(step: TutorialStep | null, ui: { menuOpen: boolean; skillsOpen: boolean }): TutorialGlow`

- [ ] **Step 1: Write the failing test**

`tests/account/tutorial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TUTORIAL, readTutorial, skillLearned, tutorialGlow, tutorialStepDone, type TutorialSeen,
} from "../../src/game/account/tutorial";

const NOTHING: TutorialSeen = { placedSkill: false, autoSkill: false, autoPotion: false, autoBattle: false };

describe("the first tutorial", () => {
  it("reads a saved step, and anything else as finished", () => {
    expect(readTutorial(0)).toBe(0);
    expect(readTutorial(3)).toBe(3);
    expect(readTutorial(undefined)).toBeNull();
    expect(readTutorial(null)).toBeNull();
    expect(readTutorial(4)).toBeNull();
    expect(readTutorial(1.5)).toBeNull();
    expect(readTutorial("1")).toBeNull();
  });

  it("keeps the first skill until the elder teaches it; the others are never held back", () => {
    expect(skillLearned(TUTORIAL.talk, 0)).toBe(false);
    expect(skillLearned(TUTORIAL.talk, 1)).toBe(true);
    expect(skillLearned(TUTORIAL.register, 0)).toBe(true);
    expect(skillLearned(null, 0)).toBe(true);
  });

  it("moves each step on by what the player did", () => {
    // The elder's step is the server's to move on.
    expect(tutorialStepDone(TUTORIAL.talk, { placedSkill: true, autoSkill: true, autoPotion: true, autoBattle: true })).toBe(false);
    expect(tutorialStepDone(TUTORIAL.register, NOTHING)).toBe(false);
    expect(tutorialStepDone(TUTORIAL.register, { ...NOTHING, placedSkill: true })).toBe(true);
    expect(tutorialStepDone(TUTORIAL.auto, { ...NOTHING, autoSkill: true })).toBe(false);
    expect(tutorialStepDone(TUTORIAL.auto, { ...NOTHING, autoPotion: true })).toBe(false);
    expect(tutorialStepDone(TUTORIAL.auto, { ...NOTHING, autoSkill: true, autoPotion: true })).toBe(true);
    expect(tutorialStepDone(TUTORIAL.battle, NOTHING)).toBe(false);
    expect(tutorialStepDone(TUTORIAL.battle, { ...NOTHING, autoBattle: true })).toBe(true);
  });

  it("lights what to press next", () => {
    const closed = { menuOpen: false, skillsOpen: false };
    expect(tutorialGlow(null, closed)).toBeNull();
    expect(tutorialGlow(TUTORIAL.talk, closed)).toBe("tracker");
    expect(tutorialGlow(TUTORIAL.register, closed)).toBe("fold");
    expect(tutorialGlow(TUTORIAL.register, { menuOpen: true, skillsOpen: false })).toBe("skills");
    expect(tutorialGlow(TUTORIAL.register, { menuOpen: true, skillsOpen: true })).toBe("slot0");
    expect(tutorialGlow(TUTORIAL.auto, closed)).toBe("bar");
    expect(tutorialGlow(TUTORIAL.battle, closed)).toBe("auto");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/account/tutorial.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/game/account/tutorial"`.

- [ ] **Step 3: Write minimal implementation**

`src/game/account/tutorial.ts`:

```ts
// The first tutorial, for new characters: the elder teaches the first skill and hands over potions,
// then the player puts the skill on the bar, lets auto-battle use it and the potion, and turns
// auto-battle on. A character keeps its step on the server; one without a step (every character
// from before the tutorial, and one that finished or skipped it) is done.
export const TUTORIAL = { talk: 0, register: 1, auto: 2, battle: 3 } as const;
export type TutorialStep = (typeof TUTORIAL)[keyof typeof TUTORIAL];

// What the elder hands over, and what finishing pays.
export const TUTORIAL_POTIONS = 5;
export const TUTORIAL_GOLD = 100;

export function readTutorial(raw: unknown): TutorialStep | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= TUTORIAL.talk && raw <= TUTORIAL.battle
    ? (raw as TutorialStep)
    : null;
}

// The first skill waits for the elder; the others are held back by level and advancement as ever.
export function skillLearned(step: TutorialStep | null, index: number): boolean {
  return index !== 0 || step === null || step >= TUTORIAL.register;
}

// What the screen has seen the player do.
export interface TutorialSeen {
  // Dropped a skill onto the bar from the skill panel, during the step that asks for it.
  placedSkill: boolean;
  // Auto-battle may use the slot holding the first skill, and the potion.
  autoSkill: boolean;
  autoPotion: boolean;
  autoBattle: boolean;
}

export function tutorialStepDone(step: TutorialStep, seen: TutorialSeen): boolean {
  switch (step) {
    // Talking to the elder is checked (and paid) by the server, which moves this step on itself.
    case TUTORIAL.talk: return false;
    case TUTORIAL.register: return seen.placedSkill;
    case TUTORIAL.auto: return seen.autoSkill && seen.autoPotion;
    case TUTORIAL.battle: return seen.autoBattle;
  }
}

// What lights up for the step: the tracker (tapping it walks to the elder), the folded menu, the
// skills button in it, the bar's first slot, the whole bar, or the auto-battle button.
export type TutorialGlow = "tracker" | "fold" | "skills" | "slot0" | "bar" | "auto" | null;

export function tutorialGlow(step: TutorialStep | null, ui: { menuOpen: boolean; skillsOpen: boolean }): TutorialGlow {
  if (step === null) return null;
  if (step === TUTORIAL.talk) return "tracker";
  if (step === TUTORIAL.register) return ui.skillsOpen ? "slot0" : ui.menuOpen ? "skills" : "fold";
  if (step === TUTORIAL.auto) return "bar";
  return "auto";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/account/tutorial.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

Run `npx tsc -b`, `npx vitest run`, `npm run server:test` (all pass), then:

```bash
git add src/game/account/tutorial.ts tests/account/tutorial.test.ts
git commit -m "feat: the first tutorial's steps as shared rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 서버 — 튜토리얼 단계, 시작 상태, 스킬 1 잠금, 엔드포인트

**Files:**
- Modify: `src/game/account/characters.ts` (Character, readCharacters)
- Modify: `src/game/account/items.ts:162-171` (BagView)
- Modify: `src/game/world/zones.ts:203-210` (ZoneLook)
- Modify: `server/src/store.ts` (`zoneLook` ~292, 옛 이전 캐릭터 ~85-97)
- Modify: `server/src/hunt.ts` (Fighter 36-47, readFighter 52-, useSkill 218-)
- Modify: `server/src/server.ts` (imports, `bagView` 187, `createCharacter` 271-289, 새 엔드포인트는 `claimQuest` 바로 위)
- Modify: `server/test/helpers.ts:16-19`
- Modify: `server/test/bag.test.ts:22-31, 53-70, 113-123`, `server/test/growth.test.ts:119`
- Create: `server/test/tutorial.test.ts`

**Interfaces:**
- Consumes: Task 1의 `TUTORIAL`, `TutorialStep`, `TUTORIAL_POTIONS`, `TUTORIAL_GOLD`, `readTutorial`, `skillLearned`.
- Produces:
  - `Character.tutorial: TutorialStep | null`
  - `BagView.tutorial: TutorialStep | null`
  - `ZoneLook.learned?: boolean`
  - 서버 엔드포인트 (모두 `Promise<BagView>`): `tutorialTalk()`, `tutorialStep(from: 1 | 2)`, `tutorialFinish()`, `tutorialSkip()`
  - 테스트 헬퍼 `makeCharacter(server, account, name, playerClass?, costume?, tutorial = false)`: `tutorial`이 false면 만든 뒤 `tutorialSkip()`을 부른다.

- [ ] **Step 1: Write the failing server test**

`server/test/tutorial.test.ts`:

```ts
import { TUTORIAL, TUTORIAL_GOLD, TUTORIAL_POTIONS } from "../../src/game/account/tutorial";
import { zoneLayout } from "../../src/game/world/zones";
import { enterAs, errorOf, makeCharacter, toNpc, walkTo } from "./helpers";

// A brand-new character in the village, tutorial and all.
async function newcomer(server: any, account = "test-a"): Promise<void> {
  await makeCharacter(server, account, `새내기${account.slice(-1)}`, "warrior", "0000", true);
  await enterAs(server, account);
}

describe("the first tutorial", () => {
  test("a new character starts at the elder, with an empty bag and without its first skill", async (server) => {
    await newcomer(server);
    const bag = await server.getBag();
    expect(bag.tutorial).toBe(TUTORIAL.talk);
    expect(bag.bag).toEqual({});
    expect(await errorOf(server.useSkill(0))).toContain("unavailable");
  });

  test("the elder teaches the skill and hands over potions once, and only up close", async (server) => {
    await newcomer(server);
    const spawn = zoneLayout("village").playerSpawn;
    await walkTo(server, spawn.x, spawn.z);
    expect(await errorOf(server.tutorialTalk())).toContain("not_near");
    await toNpc(server, "elder");
    const taught = await server.tutorialTalk();
    expect(taught.tutorial).toBe(TUTORIAL.register);
    expect(taught.bag.potion_small).toBe(TUTORIAL_POTIONS);
    expect(await errorOf(server.useSkill(0))).toBe("");
    const again = await server.tutorialTalk();
    expect(again.tutorial).toBe(TUTORIAL.register);
    expect(again.bag.potion_small).toBe(TUTORIAL_POTIONS);
  });

  test("the steps only go forward, one at a time, and finishing pays once", async (server) => {
    await newcomer(server);
    await toNpc(server, "elder");
    await server.tutorialTalk();
    expect(await errorOf(server.tutorialStep(0))).toContain("unavailable");
    expect(await errorOf(server.tutorialStep(3))).toContain("unavailable");
    expect((await server.tutorialStep(TUTORIAL.auto)).tutorial).toBe(TUTORIAL.register);
    expect((await server.tutorialFinish()).gold).toBe(0);
    expect((await server.tutorialStep(TUTORIAL.register)).tutorial).toBe(TUTORIAL.auto);
    expect((await server.tutorialStep(TUTORIAL.register)).tutorial).toBe(TUTORIAL.auto);
    expect((await server.tutorialStep(TUTORIAL.auto)).tutorial).toBe(TUTORIAL.battle);
    const done = await server.tutorialFinish();
    expect(done.tutorial).toBeNull();
    expect(done.gold).toBe(TUTORIAL_GOLD);
    expect((await server.tutorialFinish()).gold).toBe(TUTORIAL_GOLD);
  });

  test("skipping at the elder still gives the skill and the potions, but not the gold", async (server) => {
    await newcomer(server);
    const skipped = await server.tutorialSkip();
    expect(skipped.tutorial).toBeNull();
    expect(skipped.bag.potion_small).toBe(TUTORIAL_POTIONS);
    expect(skipped.gold).toBe(0);
    expect(await errorOf(server.useSkill(0))).toBe("");
    expect((await server.tutorialSkip()).bag.potion_small).toBe(TUTORIAL_POTIONS);
  });

  test("skipping later gives nothing more", async (server) => {
    await newcomer(server);
    await toNpc(server, "elder");
    await server.tutorialTalk();
    const skipped = await server.tutorialSkip();
    expect(skipped.tutorial).toBeNull();
    expect(skipped.bag.potion_small).toBe(TUTORIAL_POTIONS);
  });

  test("a character from before the tutorial is left as it was", async (server) => {
    await makeCharacter(server, "test-b", "고참");
    await enterAs(server, "test-b");
    const state = await $global.getUserState("test-b");
    const map = { ...state.characterMap };
    delete map[state.active].tutorial;
    await $global.updateUserState("test-b", { characterMap: map });
    expect((await server.getBag()).tutorial).toBeNull();
    expect(await errorOf(server.useSkill(0))).toBe("");
    await toNpc(server, "elder");
    const talked = await server.tutorialTalk();
    expect(talked.tutorial).toBeNull();
    expect(talked.bag.potion_small).toBe(TUTORIAL_POTIONS);
  });
});
```

(마지막 테스트의 물약 5개는 헬퍼의 `tutorialSkip()`이 이미 준 것이다. `tutorialTalk`가 더 주지 않는다는 뜻.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run server:test -- tutorial`
Expected: FAIL — `bag.tutorial`이 `undefined`, `server.tutorialTalk is not a function` 등.

- [ ] **Step 3: Character와 BagView, ZoneLook에 필드 추가**

`src/game/account/characters.ts` — import 추가:

```ts
import { readTutorial, type TutorialStep } from "./tutorial";
```

`Character`의 `quest: QuestProgress;` 아래:

```ts
  // Where it is in the first tutorial (see tutorial.ts); null once done, and for characters from
  // before it.
  tutorial: TutorialStep | null;
```

`readCharacters`의 `out.push({...})` 끝 `quest: readQuest(c.quest),` 뒤에 `tutorial: readTutorial(c.tutorial),` 추가.

`src/game/account/items.ts` — `import type { TutorialStep } from "./tutorial";` 추가, `BagView`의 `daily: DailyProgress;` 아래:

```ts
  // The first tutorial's step; null once done (see tutorial.ts).
  tutorial: TutorialStep | null;
```

`src/game/world/zones.ts` `ZoneLook`의 `job` 아래:

```ts
  // Whether the first skill is learned yet (new characters learn it from the elder); missing counts
  // as learned.
  learned?: boolean;
```

- [ ] **Step 4: store와 hunt**

`server/src/store.ts` — import에 `import { skillLearned } from "../../src/game/account/tutorial";` 추가. `zoneLook`:

```ts
export function zoneLook(c: Character): ZoneLook {
  // The advanced class goes out as its id, not its name: every client says it in its own language.
  return {
    name: c.name, costume: c.costume, playerClass: c.playerClass, level: levelOf(c.xp).level, job: c.job,
    learned: skillLearned(c.tutorial, 0),
  };
}
```

옛 계정 이전 캐릭터(`quest: QUEST_START,` 가 있는 객체, ~96행) 끝에 `tutorial: null,` 추가.

`server/src/hunt.ts` — `Fighter`의 `gear: FightBonus;` 아래:

```ts
  // Whether the first skill is learned yet (see tutorial.ts).
  learned: boolean;
```

`readFighter`의 반환 객체에 `learned: state.look?.learned !== false,` 추가.

`useSkill`에서 `if (!skill || f.level < skill.level) throw new RuleViolation("unavailable");` 바로 아래:

```ts
  if (slot === 0 && !f.learned) throw new RuleViolation("unavailable");
```

- [ ] **Step 5: server.ts — 시작 상태, bagView, 엔드포인트**

import 추가:

```ts
import {
  TUTORIAL, TUTORIAL_GOLD, TUTORIAL_POTIONS, readTutorial, type TutorialStep,
} from "../../src/game/account/tutorial";
```

`bagView` 반환 객체에 `tutorial: character.tutorial,` 추가.

`createCharacter`의 캐릭터:

```ts
      const character: Character = {
        id: `c-${token(10)}`, world, name, playerClass: picked, costume: look.id, xp: 0, spot: null, made: Date.now(),
        // Nothing to start with: the elder hands out the first skill and potions (the tutorial).
        bag: {}, gear: NO_GEAR, plus: {}, daily: readDaily(null), job: null, quest: QUEST_START, tutorial: TUTORIAL.talk,
      };
```

`claimQuest` 바로 위에 넣는다:

```ts
  // The first tutorial (see tutorial.ts). Talking to the elder teaches the first skill and hands
  // over potions, once.
  async tutorialTalk(): Promise<BagView> {
    const account = $sender.account;
    await playing(account);
    await requireNpc("elder");
    const next = await updateActive(account, (c) => (c.tutorial === TUTORIAL.talk
      ? { ...c, tutorial: TUTORIAL.register, bag: addItem(c.bag, "potion_small", TUTORIAL_POTIONS) }
      : c));
    await refreshFighter(next);
    return bagView(next);
  }

  // The steps after the elder are the player's own bar and auto-battle, which only the screen sees:
  // it says when one is done. Nothing is paid for them, and a step only ever moves on by one.
  async tutorialStep(from: unknown): Promise<BagView> {
    const step = readTutorial(from);
    if (step !== TUTORIAL.register && step !== TUTORIAL.auto) throw new RuleViolation("unavailable");
    const account = $sender.account;
    await playing(account);
    return bagView(await updateActive(account, (c) => (c.tutorial === step ? { ...c, tutorial: (step + 1) as TutorialStep } : c)));
  }

  // The last step done: the tutorial is over and pays its gold, once.
  async tutorialFinish(): Promise<BagView> {
    const account = $sender.account;
    await playing(account);
    let paid = false;
    const next = await updateActive(account, (c) => {
      if (c.tutorial !== TUTORIAL.battle) return c;
      paid = true;
      return { ...c, tutorial: null };
    });
    if (paid) await $asset.mint(GOLD, TUTORIAL_GOLD);
    return bagView(next);
  }

  // Skipping: still the elder's skill and potions if they were not had yet, but not the gold.
  async tutorialSkip(): Promise<BagView> {
    const account = $sender.account;
    await playing(account);
    const next = await updateActive(account, (c) => (c.tutorial === null ? c : {
      ...c,
      tutorial: null,
      bag: c.tutorial === TUTORIAL.talk ? addItem(c.bag, "potion_small", TUTORIAL_POTIONS) : c.bag,
    }));
    await refreshFighter(next);
    return bagView(next);
  }
```

- [ ] **Step 6: 테스트 헬퍼와 기존 테스트**

`server/test/helpers.ts`:

```ts
// Makes a character on the account's server and plays it. Unless a test is about the tutorial, the
// character skips it, starting as characters did before it: first skill learned, potions in the bag.
export async function makeCharacter(
  server: any, account: string, name: string, playerClass = "warrior", costume = "0000", tutorial = false,
): Promise<any> {
  server.connect({ account });
  const view = await server.createCharacter(name, playerClass, costume);
  if (!tutorial) await server.tutorialSkip();
  return view;
}
```

`server/test/bag.test.ts`:
- 26행 기대값: `gold: 0, bag: { potion_small: 5 }, gear: { weapon: null, armor: null }, plus: {}, job: null, quest: { index: 0, count: 0 }, tutorial: null,`
- 60~65행:

```ts
    const bought = await server.buyItem("potion_small", 2);
    expect(bought.gold).toBe(100 - ITEMS.potion_small.price! * 2);
    expect(bought.bag.potion_small).toBe(7);
    const sold = await server.sellItem("potion_small", 7);
    expect(sold.bag.potion_small).toBeUndefined();
    expect(sold.gold).toBe(bought.gold + sellPrice("potion_small") * 7);
```

- 물약 테스트(113~123행):

```ts
  test("a potion heals up to full and is used up", async (server) => {
    await inVillage(server);
    await $room.updateMyState({ hp: 10 });
    const after = await server.drinkPotion("potion_small");
    expect(after.bag.potion_small).toBe(4);
    expect((await $room.getMyState()).hp).toBe(10 + ITEMS.potion_small.heal);
    for (let i = 0; i < 4; i++) await server.drinkPotion("potion_small");
    expect((await $room.getMyState()).hp).toBe(maxHpAt(1));
    expect(await errorOf(server.drinkPotion("potion_small"))).toContain("no_item");
  });
```

`server/test/growth.test.ts:119`: `3 + first.items[0].n` → `5 + first.items[0].n`.

- [ ] **Step 7: Run tests**

Run: `npm run server:test`
Expected: 전부 PASS (새 tutorial 6개 포함). 다른 테스트가 `tutorial` 필드 없는 `toEqual` 때문에 깨지면 기대값에 `tutorial: null`을 넣는다.

Run: `npx tsc -b`
Expected: 오류 0. `Character`나 `BagView`를 직접 만드는 곳(예: `src/net/local/`, `tests/`)에서 `tutorial` 누락 오류가 나면 `tutorial: null`을 넣는다.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/account/characters.ts src/game/account/items.ts src/game/world/zones.ts server/src server/test
git commit -m "feat: new characters learn their first skill and get potions from the elder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 클라이언트 — 튜토리얼 호출, 배우지 않은 스킬 막기

**Files:**
- Modify: `src/net/worldClient.ts` (claimDaily 아래에 메서드 4개)
- Modify: `src/game/render/WorldView.ts` (`handleActions` ~698, HUD `skills` ~948, `path` getter 옆)
- Test: `tests/net/localWorld.test.ts` (새 테스트 1개, 회귀용)

**Interfaces:**
- Consumes: Task 1 `skillLearned`, `TutorialStep`; Task 2 엔드포인트.
- Produces: `WorldClient.tutorialTalk(): Promise<string | null>`, `tutorialStep(from: TutorialStep)`, `tutorialFinish()`, `tutorialSkip()` — 모두 끝나면 `null`, 거절이면 오류 코드. 성공하면 `client.state.bag`이 새 `BagView`로 바뀐다.

- [ ] **Step 1: Write the failing test**

`tests/net/localWorld.test.ts`의 `describe("LocalWorld", ...)` 안 마지막에 추가 (파일 위쪽의 `enter` 헬퍼를 쓴다):

```ts
  it("brings a new character into the world at the tutorial's first step, the elder's lesson ahead", async () => {
    const world = new LocalWorld(new Server());
    const { roomId } = await enter(world, "test-a");
    const bag = (await world.call("test-a", roomId, "getBag")) as { tutorial: number | null; bag: Record<string, number> };
    expect(bag.tutorial).toBe(0);
    expect(bag.bag).toEqual({});
    expect(await codeOf(world.call("test-a", roomId, "useSkill", [0, 0]))).toContain("unavailable");
  });
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/net/localWorld.test.ts`
Expected: PASS — 로컬 서버는 Task 2의 `server.ts`를 그대로 쓴다. 이 테스트는 `?local` 모드가 튜토리얼 상태를 싣는지 지키는 회귀 테스트다. FAIL이면 Task 2가 빠진 것이니 Task 2부터 확인한다.

- [ ] **Step 3: WorldClient 메서드**

`src/net/worldClient.ts` — `import type { TutorialStep } from "../game/account/tutorial";` 추가, `claimDaily` 아래:

```ts
  // The first tutorial (see tutorial.ts): the elder's lesson, a step done on the screen, the end,
  // and skipping it.
  tutorialTalk(): Promise<string | null> {
    return this.bagCall("tutorialTalk", []);
  }

  tutorialStep(from: TutorialStep): Promise<string | null> {
    return this.bagCall("tutorialStep", [from]);
  }

  tutorialFinish(): Promise<string | null> {
    return this.bagCall("tutorialFinish", []);
  }

  tutorialSkip(): Promise<string | null> {
    return this.bagCall("tutorialSkip", []);
  }
```

- [ ] **Step 4: WorldView가 배우지 않은 스킬을 쓰지 않게**

`src/game/render/WorldView.ts` — import에 `import { skillLearned } from "../account/tutorial";` 추가. `path` getter 아래:

```ts
  // Where the character is in the first tutorial: until the elder has taught it, the first skill
  // is not there to use.
  private learned(index: number): boolean {
    return skillLearned(this.client.state.bag?.tutorial ?? null, index);
  }
```

`handleActions`의 `ready`:

```ts
    const ready = (index: number | null): index is number => {
      const skill = index === null ? null : skillIn(index);
      return skill !== null && this.learned(index!) && this.skillOpen(skill) && now - this.lastSkillAt[index!] >= skill.cooldownMs;
    };
```

HUD의 `skills:` 매핑 첫 줄 다음:

```ts
        if (index === null || !skill || !this.learned(index)) return null;
```

(기존 `if (index === null || !skill) return null;` 을 이 줄로 바꾼다.)

- [ ] **Step 5: Run checks**

Run: `npx tsc -b && npx vitest run && npm run server:test`
Expected: 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/net/worldClient.ts src/game/render/WorldView.ts tests/net/localWorld.test.ts
git commit -m "feat: the client can walk the tutorial, and leaves an unlearned skill alone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 마우스 입력 — 잠금과 WASD 제거

**Files:**
- Modify: `src/game/render/FpsInput.ts`
- Create: `tests/render/fpsInput.test.ts`

**Interfaces:**
- Produces: `FpsInput`에서 `lock()`, `locked`, `dragToLook`가 사라진다. 나머지 공개 API(`firing`, `blocking`, `moveInput`, `setVirtualMove`, `addVirtualLook`, `setVirtualFiring`, `setVirtualBlocking`, `press`, `consumeLook`, `consumePress`, `dispose`)는 그대로.

- [ ] **Step 1: Write the failing test**

`tests/render/fpsInput.test.ts` (node 환경이라 창과 문서를 EventTarget으로 흉내 낸다):

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FpsInput } from "../../src/game/render/FpsInput";

// Node has no DOM: the window, the document and the canvas are plain event targets here.
function event(type: string, fields: Record<string, unknown>): Event {
  return Object.assign(new Event(type), fields);
}

describe("mouse and keys", () => {
  let canvas: EventTarget;
  let input: FpsInput;
  beforeEach(() => {
    Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget() });
    canvas = new EventTarget();
    input = new FpsInput(canvas as HTMLElement);
  });
  afterEach(() => input.dispose());

  it("walks only by the pad, never by WASD", () => {
    // Two keys, not four: W with S (or A with D) would cancel out and hide a key that still walks.
    for (const code of ["KeyW", "KeyD"]) window.dispatchEvent(event("keydown", { code, repeat: false }));
    expect(input.moveInput()).toEqual({ forward: 0, strafe: 0 });
    input.setVirtualMove(1, -0.5);
    expect(input.moveInput()).toEqual({ forward: 1, strafe: -0.5 });
  });

  it("still takes the other keys", () => {
    window.dispatchEvent(event("keydown", { code: "KeyQ", repeat: false }));
    expect(input.consumePress("KeyQ")).toBe(true);
  });

  it("turns the view by dragging, and a click that stayed put strikes", () => {
    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    document.dispatchEvent(event("mousemove", { movementX: 30, movementY: -4 }));
    window.dispatchEvent(event("mouseup", { button: 0 }));
    expect(input.consumeLook()).toEqual({ dx: 30, dy: -4 });
    expect(input.consumePress("VirtualFire")).toBe(false);

    canvas.dispatchEvent(event("mousedown", { button: 0 }));
    document.dispatchEvent(event("mousemove", { movementX: 2, movementY: 1 }));
    window.dispatchEvent(event("mouseup", { button: 0 }));
    expect(input.consumePress("VirtualFire")).toBe(true);
  });

  it("does not turn the view when the mouse moves without a button held", () => {
    document.dispatchEvent(event("mousemove", { movementX: 50, movementY: 50 }));
    expect(input.consumeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it("raises the shield while the right button is held", () => {
    canvas.dispatchEvent(event("mousedown", { button: 2 }));
    expect(input.blocking).toBe(true);
    window.dispatchEvent(event("mouseup", { button: 2 }));
    expect(input.blocking).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/fpsInput.test.ts`
Expected: FAIL — WASD 테스트에서 `forward: 0` 대신 다른 값, 끌기 테스트에서 시점이 안 바뀜(잠금이 없으니 `dragging`이 안 켜짐).

- [ ] **Step 3: FpsInput 고치기**

`src/game/render/FpsInput.ts`에서:

1. 생성자와 `dispose`의 `click`, `pointerlockerror`, `pointerlockchange` 리스너 등록·해제를 지운다. `dispose`의 `if (this.locked) document.exitPointerLock();`도 지운다.
2. 잠금 설명 주석 블록(“Some embeds refuse the pointer lock …”)과 `lockDenied`, `get locked()`, `lock()`, `get dragToLook()`, `onClick`, `onLockError`, `onLockChange`를 지운다. `dragging`, `dragged`는 남기고 그 위에 주석을 단다:

```ts
  // The mouse is never captured: the cursor stays for the buttons, and the view turns while the
  // left button is held and dragged across the world. A press that barely moved is a click at
  // something, which lands a blow.
  private dragging = false;
  private dragged = 0;
```

3. `moveInput()`:

```ts
  // Walking is the on-screen pad's alone, on every device, so the mouse plays the whole game.
  moveInput(): MoveInput {
    const { forward, strafe } = this.virtualMove;
    return { forward: Math.max(-1, Math.min(1, forward)), strafe: Math.max(-1, Math.min(1, strafe)) };
  }
```

4. `onMouseDown`:

```ts
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.dragging = true;
      this.dragged = 0;
    }
    if (e.button === 2) this.mouseBlocking = true;
    this.firing = this.mouseFiring || this.virtualFiring;
    this.blocking = this.mouseBlocking || this.virtualBlocking;
  };
```

5. `onMouseMove`:

```ts
  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
    this.dragged += Math.abs(e.movementX) + Math.abs(e.movementY);
  };
```

6. `mouseFiring`은 이제 켜지는 곳이 없다. 필드와 `onMouseUp`/`onBlur`/`onMouseDown`의 `mouseFiring` 참조를 지우고 `this.firing = this.virtualFiring;`으로 줄인다. `onBlur`에서 `this.dragging = false;`도 넣는다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/fpsInput.test.ts`
Expected: PASS (5 tests).

Run: `npx tsc -b`
Expected: `WorldScreen.tsx`에서 `controls.lock` 오류가 난다 — Task 5에서 지운다. 여기서는 오류 난 줄(`else view.current?.controls.lock();`가 있는 `useEffect`)만 우선 지워 컴파일을 통과시킨다:

```ts
  // (지울 것)
  useEffect(() => {
    if (touch) return;
    if (uiOpen) document.exitPointerLock?.();
    else view.current?.controls.lock();
  }, [uiOpen, touch]);
```

`uiOpen`이 더 이상 안 쓰이면 그 선언과 위 주석도 지운다.

- [ ] **Step 5: Run checks and commit**

Run: `npx tsc -b && npx vitest run && npm run server:test` — 전부 PASS.

```bash
git add src/game/render/FpsInput.ts tests/render/fpsInput.test.ts src/ui/WorldScreen.tsx
git commit -m "feat: the mouse is never captured: drag to look, click to strike, the pad to walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 화면 배치 — 모든 기기에 패드, 키 표시 분리, 조준점 제거

**Files:**
- Modify: `src/ui/TouchControls.tsx`
- Modify: `src/ui/WorldScreen.tsx`
- Modify: `src/ui/ChatBox.tsx`
- Modify: `src/index.css` (159, 270, 329, 365, 983-989행 근처)

**Interfaces:**
- Consumes: Task 4의 `FpsInput`(잠금 없음).
- Produces: `TouchStick({ controls, look }: { controls: FpsInput; look: boolean })`; `ChatBox({ client, keyHints })`; `PadButtons`에 `glowAuto?: boolean` (Task 6에서 씀).

- [ ] **Step 1: TouchStick — 보기 영역은 터치만**

`src/ui/TouchControls.tsx`:

```ts
// The joystick at the bottom left to walk, on every device (the mouse plays the whole game), and on
// a touch screen a drag anywhere on the right to look round (a mouse drags the world itself).
export function TouchStick({ controls, look: lookArea }: { controls: FpsInput; look: boolean }) {
```

`<div className="touch-look" .../>`를 `{lookArea && (<div className="touch-look" ... />)}`로 감싼다 (함수 안의 `look` ref와 이름이 겹치지 않게 prop을 `lookArea`로 받는다).

`PadButtonsProps`에 추가:

```ts
  // The tutorial's pointer at the auto-battle button.
  glowAuto?: boolean;
```

자동 버튼: `className={`${auto ? "on" : ""}${glowAuto ? " tutorial-glow" : ""}`}`. 함수 인자 구조 분해에 `glowAuto`를 넣는다.

- [ ] **Step 2: WorldScreen — 잠금 코드 제거, keyHints**

`src/ui/WorldScreen.tsx`:

1. `const touch = isTouchDevice();` → 

```ts
  // Every device plays with the pad and the mouse (or a finger); a keyboard's keys show on the
  // buttons that have one.
  const touch = isTouchDevice();
  const keyHints = !touch;
```

2. `document.exitPointerLock?.();` 세 줄(onTalk, toggle, 설정 메뉴 act)을 지운다. 설정 메뉴 `act`는 `act: () => setMenu((m) => !m),`로 줄인다.
3. `pointerlockchange`를 듣는 `useEffect` 전체와 그 위 커서 설명 주석을 지운다.
4. JSX에서 `!touch && <kbd`로 키를 보여 주는 곳 셋(채널 C, 메뉴 항목, 메뉴 M)을 `keyHints && <kbd`로 바꾼다. `keys={!touch}` → `keys={keyHints}`, `keyLabel={touch ? null : "J"}` → `keyLabel={keyHints ? "J" : null}`, 잠긴 포털 안내의 `touch ? t("world.portalLocked.tap") : "(E)"`는 그대로 둔다(터치 여부가 맞다).
5. `{touch && view.current && <TouchStick controls={view.current.controls} />}` → `{view.current && <TouchStick controls={view.current.controls} look={touch} />}`
6. `<ChatBox client={client} touch={touch} />` → `<ChatBox client={client} keyHints={keyHints} />`
7. `{!touch && <div className="crosshair" />}` 줄을 지운다.
8. 루트 `<div className={`ui${touch ? " touch" : ""}`}>` → `<div className="ui">`.

- [ ] **Step 3: ChatBox**

`src/ui/ChatBox.tsx`: 시그니처를 `export function ChatBox({ client, keyHints }: { client: WorldClient; keyHints: boolean })`로, 루트 클래스를 `` `chat${open ? " open" : ""}` ``로. 닫기 버튼 `{touch && ...}` → `{!keyHints && ...}`, 닫힌 상태 분기 `touch ? <chat-open> : <chat-bar>` → `!keyHints ? <chat-open> : <chat-bar>`.

- [ ] **Step 4: CSS — 터치 배치를 기본으로**

`src/index.css`:
- 159행 `.crosshair { ... }` 삭제.
- 270행 `.ui.touch .side-panel { top: 64px; width: 280px; }` → `.ui .side-panel { top: 64px; width: 280px; }` (`.ui .side-panel.quest-log`, `.ui .side-panel.skill-panel` 같은 더 구체적인 규칙은 그대로 이긴다).
- 365행 `.ui.touch .hud-quest { width: 210px; }` → `.hud-quest { width: 210px; }` 로 바꾸되, 363행의 `.hud-quest { top: 210px; ... }` 규칙 안에 `width: 210px;`를 넣고 365행은 지운다.
- 983~989행: `.chat`의 `bottom: 110px; width: 340px;` → `bottom: 268px; width: 280px;`, `.chat.touch { ... }` 줄 삭제, 위 주석을 “The channel chat, at the left, above the joystick.”로.
- `.touch-stick`, `.touch-look` 위 주석을 “The pad at the bottom left (every device) …”로 고친다.
- 캔버스 끌기 커서: `.app canvas { display: block; width: 100%; height: 100%; }` 아래에 `.app canvas:active { cursor: grabbing; }`.

- [ ] **Step 5: 문구 확인**

Run: `grep -n "WASD\|잠금\|pointer" src/ui/strings/ko.ts`
Expected: 조작 안내에 WASD나 마우스 잠금을 말하는 문구가 있으면 다섯 언어 파일에서 같은 키를 “패드로 이동, 끌어서 시점” 뜻으로 고친다. 없으면 넘어간다.

- [ ] **Step 6: 브라우저에서 확인**

`.claude/launch.json`의 `?local` 구성(오프라인 입구, 5175 포트)으로 `preview_start`. OneDrive 때문에 변경이 안 잡히면 서버를 재시작한다. 월드에 들어가서:
1. 커서가 계속 보이는지, 캔버스를 끌면 시점이 도는지, 가만히 클릭하면 공격하는지.
2. WASD로 안 움직이고 패드를 마우스로 끌면 움직이는지. Space/Q/1~3/R/E/J/C/Enter/메뉴 키가 되는지.
3. `resize_window` 800×450, 1000×562에서 HUD 요소(`.touch-stick`, `.chat`, `.hud-skills`, `.potion-setting`, `.pad-buttons`의 각 버튼, `.hud-quest`, `.minimap`, `.hud-left`, `.hud-menu-buttons`)의 `getBoundingClientRect()`가 서로 겹치지 않는지 `javascript_tool`로 잰다. 겹치면 CSS 위치만 고친다(예: `.touch-stick`의 `bottom`, `.chat`의 `bottom`).
4. 패널 16개를 800×450에서 다시 열어 스크롤 0인지 잰다(`scrollHeight > clientHeight` 요소 0개).
5. 스크린샷을 남긴다.

- [ ] **Step 7: Run checks and commit**

Run: `npx tsc -b && npx vitest run && npm run server:test` — 전부 PASS.

```bash
git add src/ui/TouchControls.tsx src/ui/WorldScreen.tsx src/ui/ChatBox.tsx src/index.css src/ui/strings
git commit -m "feat: every device plays with the pad; keys show only as hints, no crosshair

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 튜토리얼 화면 — 할 일 줄, 빛, 스킬 창 잠금, 촌장 대사, 끝 배너

**Files:**
- Create: `src/ui/useTutorial.ts`
- Create: `src/ui/TutorialTracker.tsx`
- Modify: `src/ui/WorldScreen.tsx`, `src/ui/SkillBar.tsx`, `src/ui/SkillPanel.tsx`, `src/ui/QuestPanel.tsx`
- Modify: `src/ui/strings/{ko,en,ja,zhHant,zhHans}.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 1 전부, Task 3 `WorldClient.tutorial*`, Task 5 `PadButtons.glowAuto`, `settings.ts`의 `hotbarFor`, `setHotbarSlot`, `settings`, `updateSettings`, `onSettings`.
- Produces:
  - `useTutorial(client: WorldClient, bag: BagView | null, playerClass: PlayerClass, autoBattle: boolean): { step: TutorialStep | null; placed: () => void; skip: () => void; finished: boolean; clearFinished: () => void }`
  - `TutorialTracker({ step, glow, keyLabel, onWalk, onSkip })`, `TutorialDoneBanner({ onClose })`
  - `SkillBar`의 새 prop `glow: "slot0" | "bar" | null`
  - `SkillPanel`의 새 prop `tutorial: TutorialStep | null`, `onPlaced: () => void`

- [ ] **Step 1: 문구 (5개 언어)**

각 파일에서 `"skills.learnAt"` 줄 아래에 `skills.fromElder`, `"npc.elder.done"` 줄 아래에 `npc.elder.tutorial`, 파일 끝 닫는 `};` 바로 위에 `tutorial.*` 묶음을 넣는다.

`ko.ts`:

```ts
  "skills.fromElder": "촌장에게 배우기",
  "npc.elder.tutorial": "\"왔구먼. 이 기술을 익히고 물약도 챙겨 가게. 스킬 창에서 기술을 칸에 끌어 두면 쓸 수 있다네.\"",
  "tutorial.title": "첫걸음",
  "tutorial.step0": "촌장에게 말을 거세요",
  "tutorial.step1": "스킬 창을 열어 받은 스킬을 1번 칸에 끌어 놓으세요",
  "tutorial.step2": "스킬 칸과 물약 칸을 아래로 끌어 자동 사용을 켜세요",
  "tutorial.step3": "자동 전투 버튼을 눌러 보세요",
  "tutorial.skip": "건너뛰기",
  "tutorial.doneTitle": "준비 끝!",
  "tutorial.doneHint": "촌장의 첫 부탁을 확인하세요",
```

`en.ts`:

```ts
  "skills.fromElder": "Learn from the elder",
  "npc.elder.tutorial": "\"There you are. Take this skill, and these potions. Drag the skill onto a slot from the skill panel to use it.\"",
  "tutorial.title": "First Steps",
  "tutorial.step0": "Talk to the elder",
  "tutorial.step1": "Open the skill panel and drag your new skill onto slot 1",
  "tutorial.step2": "Drag the skill slot and the potion slot down to let them auto-use",
  "tutorial.step3": "Press the auto-battle button",
  "tutorial.skip": "Skip",
  "tutorial.doneTitle": "All set!",
  "tutorial.doneHint": "See the elder's first request",
```

`ja.ts`:

```ts
  "skills.fromElder": "村長から習う",
  "npc.elder.tutorial": "「来たか。この技を覚えて、薬も持って行きなさい。スキル画面で技をスロットにドラッグすれば使えるぞ。」",
  "tutorial.title": "はじめの一歩",
  "tutorial.step0": "村長に話しかけよう",
  "tutorial.step1": "スキル画面を開き、覚えた技をスロット1にドラッグしよう",
  "tutorial.step2": "スキルと薬のスロットを下にドラッグして自動使用をオンにしよう",
  "tutorial.step3": "自動戦闘ボタンを押してみよう",
  "tutorial.skip": "スキップ",
  "tutorial.doneTitle": "準備完了！",
  "tutorial.doneHint": "村長の最初の頼みを確かめよう",
```

`zhHant.ts`:

```ts
  "skills.fromElder": "向村長學習",
  "npc.elder.tutorial": "「你來了。學會這個技能，把藥水也帶上。在技能視窗把技能拖到欄位上就能使用。」",
  "tutorial.title": "第一步",
  "tutorial.step0": "與村長交談",
  "tutorial.step1": "打開技能視窗，把新技能拖到 1 號欄位",
  "tutorial.step2": "把技能欄和藥水欄往下拖，開啟自動使用",
  "tutorial.step3": "按下自動戰鬥按鈕",
  "tutorial.skip": "跳過",
  "tutorial.doneTitle": "準備完成！",
  "tutorial.doneHint": "看看村長的第一個請託",
```

`zhHans.ts`:

```ts
  "skills.fromElder": "向村长学习",
  "npc.elder.tutorial": "「你来了。学会这个技能，把药水也带上。在技能窗口把技能拖到栏位上就能使用。」",
  "tutorial.title": "第一步",
  "tutorial.step0": "与村长交谈",
  "tutorial.step1": "打开技能窗口，把新技能拖到 1 号栏位",
  "tutorial.step2": "把技能栏和药水栏往下拖，开启自动使用",
  "tutorial.step3": "按下自动战斗按钮",
  "tutorial.skip": "跳过",
  "tutorial.doneTitle": "准备完成！",
  "tutorial.doneHint": "看看村长的第一个请托",
```

Run: `npx tsc -b` — 오류 0 (다섯 파일 키가 같아야 함).

- [ ] **Step 2: useTutorial 훅**

`src/ui/useTutorial.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { BagView } from "../game/account/items";
import type { PlayerClass } from "../game/combat/classes";
import { TUTORIAL, tutorialStepDone, type TutorialStep } from "../game/account/tutorial";
import type { WorldClient } from "../net/worldClient";
import { hotbarFor, onSettings, setHotbarSlot, settings, updateSettings } from "./settings";

// Whether auto-battle may use the slot holding the first skill, and the potion.
function autoFlags(playerClass: PlayerClass): { skill: boolean; potion: boolean } {
  const s = settings();
  const at = hotbarFor(playerClass).indexOf(0);
  return { skill: at >= 0 && s.autoSkills[at] === true, potion: s.autoPotion };
}

// The first tutorial on the screen: watches the bar, the auto-use settings and auto-battle, and tells
// the server when a step is done (the elder's step the server moves on itself).
export function useTutorial(client: WorldClient, bag: BagView | null, playerClass: PlayerClass, autoBattle: boolean) {
  const step = bag ? bag.tutorial : null;
  const [placedSkill, setPlacedSkill] = useState(false);
  const [auto, setAuto] = useState(() => autoFlags(playerClass));
  const [finished, setFinished] = useState(false);
  useEffect(() => onSettings(() => setAuto(autoFlags(playerClass))), [playerClass]);

  // Coming into the auto-use step, the bar's auto-use starts off (the first skill starts on by
  // default), so that dragging a slot down turns it on rather than off. Only on the step's start,
  // not on coming back to a step already begun.
  const last = useRef<TutorialStep | null>(step);
  useEffect(() => {
    if (last.current === TUTORIAL.register && step === TUTORIAL.auto) {
      const at = hotbarFor(playerClass).indexOf(0);
      const autoSkills = settings().autoSkills.map((on, i) => (i === at ? false : on));
      updateSettings({ autoSkills, autoPotion: false });
    }
    last.current = step;
  }, [step, playerClass]);

  // One call per step: the answer brings the next step with the bag.
  const sent = useRef<TutorialStep | null>(null);
  useEffect(() => {
    if (step === null || step === TUTORIAL.talk || sent.current === step) return;
    const seen = { placedSkill, autoSkill: auto.skill, autoPotion: auto.potion, autoBattle };
    if (!tutorialStepDone(step, seen)) return;
    sent.current = step;
    const call = step === TUTORIAL.battle ? client.tutorialFinish() : client.tutorialStep(step);
    void call.then((code) => {
      if (code) sent.current = null;
      else if (step === TUTORIAL.battle) setFinished(true);
    });
  }, [step, placedSkill, auto, autoBattle, client]);

  const placed = useCallback(() => {
    if (step === TUTORIAL.register) setPlacedSkill(true);
  }, [step]);

  // Skipped: the first skill goes on the bar if it is not there, so nothing is left to set up.
  const skip = useCallback(() => {
    void client.tutorialSkip().then((code) => {
      if (!code && !hotbarFor(playerClass).includes(0)) setHotbarSlot(playerClass, 0, 0);
    });
  }, [client, playerClass]);

  return { step, placed, skip, finished, clearFinished: () => setFinished(false) };
}
```

- [ ] **Step 3: TutorialTracker와 끝 배너**

`src/ui/TutorialTracker.tsx`:

```tsx
import { t, type Key } from "./lang";
import type { TutorialGlow, TutorialStep } from "../game/account/tutorial";

interface TutorialTrackerProps {
  step: TutorialStep;
  glow: TutorialGlow;
  // J does what tapping it does (none on a touch screen).
  keyLabel: string | null;
  // Tapping the elder's step walks there.
  onWalk: () => void;
  onSkip: () => void;
}

// The first tutorial's next thing to do, where the quest usually sits. It never stands in the way:
// the rest of the game works meanwhile, and it can be skipped.
export function TutorialTracker({ step, glow, keyLabel, onWalk, onSkip }: TutorialTrackerProps) {
  const walks = step === 0;
  return (
    <div
      className={`hud-quest tutorial${walks ? " clickable" : ""}${glow === "tracker" ? " tutorial-glow" : ""}`}
      role={walks ? "button" : undefined}
      onClick={walks ? onWalk : undefined}
    >
      <b>{t("tutorial.title")}</b>
      <span>{t(`tutorial.step${step}` as Key)}</span>
      <button
        type="button" className="tutorial-skip"
        onClick={(e) => {
          e.stopPropagation();
          onSkip();
        }}
      >
        {t("tutorial.skip")}
      </button>
      {walks && keyLabel && <kbd className="hud-key">{keyLabel}</kbd>}
    </div>
  );
}

export function TutorialDoneBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="quest-complete" role="status" onClick={onClose}>
      <span className="quest-complete-title">{t("tutorial.doneTitle")}</span>
      <span className="hint">{t("tutorial.doneHint")}</span>
    </div>
  );
}
```

- [ ] **Step 4: SkillBar 빛**

`src/ui/SkillBar.tsx`: `SkillBarProps`에

```ts
  // The tutorial's pointer: at the first slot, or at the whole bar.
  glow: "slot0" | "bar" | null;
```

`CellProps`에 `glow: boolean;`을 넣고 `Cell`의 `hud-cell` 클래스 끝에 `${glow ? " tutorial-glow" : ""}`를 붙인다. `SkillBar`의 루트를 `<div className={`hud-skills${glow === "bar" ? " tutorial-glow" : ""}`}>`로, 물약 `Cell`에 `glow={false}`, 스킬 `Cell`에 `glow={glow === "slot0" && i === 0}`.

- [ ] **Step 5: SkillPanel 잠금과 알림**

`src/ui/SkillPanel.tsx`: import `import { skillLearned, type TutorialStep } from "../game/account/tutorial";`. props:

```ts
  // The first tutorial's step: until the elder has taught it, the first skill is held back.
  tutorial: TutorialStep | null;
  // A skill was dropped on the bar (the tutorial waits for this).
  onPlaced: () => void;
```

`drop` 안: `if (cell) { setHotbarSlot(playerClass, Number(cell.dataset.slot), skill); onPlaced(); }`.

`const learned = skill !== null && level >= skill.level;` → 

```ts
          const taught = skillLearned(tutorial, i);
          const learned = skill !== null && taught && level >= skill.level;
```

노트 삼항의 `!learned ? t("skills.learnAt", ...)` 앞에 `!taught ? t("skills.fromElder") :`를 넣는다:

```tsx
                  {!skill
                    ? t("skills.afterAdvance", { n: ADVANCE_LEVEL })
                    : !taught ? t("skills.fromElder")
                    : !learned ? t("skills.learnAt", { n: skill.level }) : slot >= 0 ? t("skills.inSlot", { n: slot + 1 }) : t("skills.dragIn")}
```

배우지 않았으면 “빼기” 버튼도 숨긴다: `{slot >= 0 && taught && (...)}`.

- [ ] **Step 6: QuestPanel 촌장 대사**

`src/ui/QuestPanel.tsx`: `bag` 분기 맨 앞에 튜토리얼 분기를 넣는다:

```tsx
        {!bag ? (
          <p className="note">{t("common.loading")}</p>
        ) : bag.tutorial !== null ? (
          // In the first tutorial the elder teaches, rather than asks.
          <p className="npc-line">{t("npc.elder.tutorial")}</p>
        ) : !quest ? (
```

- [ ] **Step 7: WorldScreen 연결**

`src/ui/WorldScreen.tsx`:

imports:

```ts
import { tutorialGlow } from "../game/account/tutorial";
import { useTutorial } from "./useTutorial";
import { TutorialDoneBanner, TutorialTracker } from "./TutorialTracker";
```

`ZoneScreen` 안, `hud` state 선언 뒤:

```ts
  const tutorial = useTutorial(client, bag, playerClass, hud?.auto ?? false);
  const glow = tutorialGlow(tutorial.step, { menuOpen, skillsOpen: panel === "skills" });
  // Read by the once-bound handlers below (talking to the elder, J).
  const tutorialStep = useRef(tutorial.step);
  tutorialStep.current = tutorial.step;
```

(`menuOpen`, `panel`은 위에서 이미 선언돼 있어야 하므로 이 블록을 `menuOpen` 선언 아래로 둔다.)

`onTalk`:

```ts
      onTalk: (id) => {
        // The elder's lesson in the first tutorial: the server checks you are by the elder.
        if (id === "elder" && tutorialStep.current === 0) void client.tutorialTalk();
        setPanel(id === "merchant" ? "shop" : id === "smith" ? "smith" : "quest");
      },
```

`questAct.current` 맨 앞:

```ts
    if (tutorialStep.current === 0) {
      view.current?.walkToNpc("elder");
      return;
    }
```

메뉴 JSX: 접기 버튼(`ui_more`)의 클래스 끝에 `${glow === "fold" ? " tutorial-glow" : ""}`, 메뉴 항목 버튼 클래스 끝에 `${glow === "skills" && item.id === "skills" ? " tutorial-glow" : ""}`.

`PadButtons`에 `glowAuto={glow === "auto"}`. `SkillBar`에 `glow={glow === "slot0" || glow === "bar" ? glow : null}`.

퀘스트 칸:

```tsx
          {panel !== "quests" && panel !== "skills" && (
            tutorial.step !== null ? (
              <TutorialTracker
                step={tutorial.step} glow={glow} keyLabel={keyHints ? "J" : null}
                onWalk={() => view.current?.walkToNpc("elder")} onSkip={tutorial.skip}
              />
            ) : (
              <QuestTracker
                bag={bag} seeking={hud.seeking} inVillage={inVillage} keyLabel={keyHints ? "J" : null}
                onSeek={(types) => view.current?.seekQuest(types)} onReport={() => view.current?.walkToNpc("elder")}
              />
            )
          )}
```

`SkillPanel`에 `tutorial={tutorial.step} onPlaced={tutorial.placed}`.

끝 배너(퀘스트 완료 배너 옆):

```tsx
      {tutorial.finished && <TutorialDoneBanner onClose={tutorial.clearFinished} />}
```

그리고 배너가 저절로 사라지게, `finished` 타이머 `useEffect` 아래에:

```ts
  useEffect(() => {
    if (!tutorial.finished) return;
    playCue("quest");
    const timer = setTimeout(tutorial.clearFinished, QUEST_BANNER_MS);
    return () => clearTimeout(timer);
  }, [tutorial.finished]);
```

- [ ] **Step 8: CSS**

`src/index.css`의 `.hud-quest .hint` 규칙 아래:

```css
/* The first tutorial: what to do next sits where the quest does, with a way out, and what to press
   next glows. */
.hud-quest.tutorial { padding-right: 58px; }
.hud-quest.tutorial > span { color: var(--ink); }
.tutorial-skip {
  position: absolute; top: 4px; right: 6px; padding: 2px 6px; border: 0; border-radius: 4px; cursor: pointer;
  background: rgba(255, 255, 255, 0.12); color: var(--ink-dim); font: 600 11px var(--font-body);
}
.tutorial-skip:hover { color: var(--ink); background: rgba(255, 255, 255, 0.2); }
.tutorial-glow { animation: tutorial-glow 1.4s ease-in-out infinite; }
@keyframes tutorial-glow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(255, 211, 106, 0.35), 0 0 8px rgba(255, 211, 106, 0.25); }
  50% { box-shadow: 0 0 0 3px #ffd36a, 0 0 18px rgba(255, 211, 106, 0.8); }
}
```

`.hud-quest`에 `position: absolute`가 이미 있으므로 건너뛰기 버튼의 기준이 된다.

- [ ] **Step 9: Run checks**

Run: `npx tsc -b && npx vitest run && npm run server:test`
Expected: 전부 PASS.

- [ ] **Step 10: 브라우저에서 끝까지 해 보기**

`?local` 미리보기(Task 5와 같은 구성)에서 새 캐릭터를 만든다:
1. 할 일 줄 “촌장에게 말을 거세요”가 미니맵 아래에 빛나며 뜨고, 가방에 물약 0, 스킬바 1번 칸이 비어 있고, 스킬 창에서 스킬 1이 “촌장에게 배우기”로 잠겨 있는지.
2. 할 일 줄을 누르면 촌장에게 걸어가고, 대화하면 촌장 튜토리얼 대사가 뜨고 물약 5개가 생기는지.
3. 메뉴 접기 버튼 → 스킬 버튼 → 1번 칸 순으로 빛이 옮겨 가고, 스킬을 칸에 놓으면 다음 단계로 가는지.
4. 스킬바가 빛나고 스킬 1 칸과 물약 칸 자동 사용이 꺼져 있다가, 둘 다 아래로 끌면 다음 단계로 가는지.
5. 자동 버튼이 빛나고, 누르면 “준비 끝!” 배너, 골드 100, 할 일 줄이 퀘스트 1로 바뀌는지.
6. 다른 새 캐릭터로 첫 단계에서 건너뛰기: 물약 5, 스킬 1이 1번 칸에, 퀘스트 1 표시.
7. 기존 캐릭터: 할 일 줄이 없고 그대로인지.
8. 800×450에서 다섯 언어로 할 일 줄이 두 줄 이내이고 미니맵·패드 버튼과 겹치지 않는지 (`localStorage` `traitor-hunt:settings`의 `lang`을 바꾸고 새로고침).
9. 스크린샷을 남긴다.

- [ ] **Step 11: Commit**

```bash
git add src/ui src/index.css
git commit -m "feat: the first tutorial on screen: the next thing to do, what to press glowing, and a way out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 문서, 머지, 푸시

**Files:**
- Modify: `README.md`, `docs/STORE.md` (조작 방법을 말하는 곳이 있으면)

- [ ] **Step 1: 문서의 조작 설명 확인**

Run: `grep -n "WASD\|마우스\|mouse\|튜토리얼\|tutorial" README.md docs/STORE.md`
Expected: WASD나 마우스 잠금을 말하는 곳이 있으면 “가상 패드로 이동, 끌어서 시점, 클릭·버튼으로 공격, 마우스만으로 플레이”로 고치고, 새 캐릭터가 촌장에게 첫 기술과 물약을 받는 튜토리얼을 한 줄 넣는다.

- [ ] **Step 2: 최종 검사**

Run: `npx tsc -b && npx vitest run && npm run server:test && npm run build`
Expected: 전부 통과, 빌드 성공.

- [ ] **Step 3: 커밋, 머지, 푸시**

```bash
git add README.md docs/STORE.md
git commit -m "docs: mouse-only play and the first tutorial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git checkout develop
git checkout gitlab/develop -- public/assets/models public/assets/ui
git restore --staged public/assets
git merge master --no-edit
git push origin master
git push gitlab develop
git checkout master
git checkout gitlab/develop -- public/assets/models public/assets/ui
git restore --staged public/assets
```

(`README.md`나 `docs/STORE.md`에 바꿀 것이 없었으면 첫 커밋은 건너뛴다. 머지 전 `docs/VERSE8-EDITOR.md`의 푸시 전 점검 목록을 따른다.)

- [ ] **Step 4: 배포 확인**

푸시 뒤 Verse8 에디터 미리보기가 검은 화면 없이 뜨는지 `docs/VERSE8-EDITOR.md`의 방법으로 확인한다.
