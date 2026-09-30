# News Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players see what changed in each update: once on entering the world when something is unread, and any time from a `소식` button in the menu.

**Architecture:** The news lives in code (`src/game/news.ts`, shared by server and client), newest first, five languages per entry. The account keeps the id of the newest entry it has seen (`newsSeen` in its global user state); the server reads and writes it (`getNewsSeen`, `markNewsSeen`). The world client loads it once per session and the screen shows a panel and a red dot.

**Tech Stack:** TypeScript, React, Verse8 GameServer (`@agent8/gameserver-node` test runner), Vitest.

Spec: [2026-09-30-news-design.md](../specs/2026-09-30-news-design.md)

## Global Constraints

- New entries go on the **front** of `NEWS` only; ids are `YYYY-MM-DD-topic` and never removed.
- Every entry has title and lines in all five languages (`ko`, `en`, `ja`, `zh-Hant`, `zh-Hans`); `Record<Lang, …>` enforces it.
- `src/game/news.ts` imports `Lang` with `import type` only (the server must not pull in React).
- UI strings go in all five bundles in `src/ui/strings/*.ts` (the Korean one is the key source).
- Before every commit: `npx tsc -b`, `npx vitest run`, `npm run server:test`.
- Comment style: short prose comments saying what and why, like the surrounding code.

---

### Task 1: The news list and its rules

**Files:**
- Create: `src/game/news.ts`
- Test: `tests/news.test.ts`

**Interfaces:**
- Produces: `NewsEntry`, `NEWS`, `readNewsId(raw: unknown): string | null`, `unseenNews(seen: string | null): number`, `newestNews(): string`.

- [ ] Write `tests/news.test.ts`: ids unique; dates `YYYY-MM-DD` and non-increasing; every language has a non-empty title and at least one non-empty line; `unseenNews(null) === NEWS.length`, `unseenNews(NEWS[0].id) === 0`, `unseenNews(NEWS[1].id) === 1`, `unseenNews("nope") === NEWS.length`; `readNewsId` accepts listed ids only.
- [ ] Run `npx vitest run tests/news.test.ts` — fails (module missing).
- [ ] Write `src/game/news.ts` with the three first entries (2026-09-28 grove & tutorial, 2026-09-29 mounts & stable & performance, 2026-09-30 news board) in five languages.
- [ ] Run the test — passes. Commit with Task 2.

### Task 2: The server keeps what each account has seen

**Files:**
- Modify: `server/src/server.ts` (two remote functions)
- Test: `server/test/news.test.ts`

**Interfaces:**
- Consumes: `readNewsId`, `NEWS` from Task 1.
- Produces: remote `getNewsSeen(): Promise<{ seen: string | null }>`, `markNewsSeen(id: unknown): Promise<{ seen: string }>`.

```ts
  // The newest update notice this account has read (see news.ts); null before the first.
  async getNewsSeen(): Promise<{ seen: string | null }> {
    return { seen: readNewsId((await $global.getUserState($sender.account)).newsSeen) };
  }

  // Marks the news read up to `id`. An older id than the one kept (a late call) changes nothing.
  async markNewsSeen(raw: unknown): Promise<{ seen: string }> {
    const id = readNewsId(raw);
    if (!id) throw new RuleViolation("unavailable");
    const account = $sender.account;
    const kept = readNewsId((await $global.getUserState(account)).newsSeen);
    if (kept && NEWS.findIndex((n) => n.id === kept) <= NEWS.findIndex((n) => n.id === id)) return { seen: kept };
    await $global.updateUserState(account, { newsSeen: id });
    return { seen: id };
  }
```

- [ ] Write `server/test/news.test.ts`: fresh account → `{ seen: null }`; mark newest → kept; mark an older one afterwards → still newest; unknown id and non-string → `unavailable`.
- [ ] `npm run server:test` — fails; add the functions; passes.
- [ ] Commit: `feat: the news: what each update brought, kept in code, and which of it an account has read`.

### Task 3: The panel, the menu button and the popup

**Files:**
- Create: `src/ui/NewsPanel.tsx`
- Modify: `src/net/worldClient.ts` (load/mark), `src/ui/WorldScreen.tsx` (panel, menu item, dot, auto-open), `src/index.css`, `src/ui/strings/{ko,en,ja,zhHans,zhHant}.ts`

**Interfaces:**
- Consumes: `NEWS`, `unseenNews`, remote functions from Task 2.
- Produces: `WorldClient.newsSeen(): Promise<string | null>` (loaded once per client), `WorldClient.markNewsRead(): void` (marks `NEWS[0].id`, locally at once).

- [ ] `WorldClient`: a cached `seenNews: string | null | undefined`; `newsSeen()` calls `getNewsSeen` once (null on failure); `markNewsRead()` sets the cache to `NEWS[0].id` and calls `markNewsSeen` with `needResponse: false`. A session flag `newsShown` so the popup opens once per world visit, not once per zone.
- [ ] `NewsPanel({ onClose })`: `menu-modal` + `solid-panel news-panel`; list of entries (date, title); the first open, others toggle open on tap; lines as a list; close button. Text in the current language (`currentLang()` from `lang.ts`).
- [ ] `WorldScreen`: `Panel` gains `"news"`; menu item `{ id: "news", label: t("menu.news"), key: "Y", code: "KeyY", dot: unread > 0 }`; the menu button shows a dot (`<i className="hud-dot" />`) when any folded item has one; opening the panel calls `client.markNewsRead()` and clears the dot. On ready: if unread and the tutorial is over and not yet shown this session → open it.
- [ ] Strings: `menu.news`, `news.title` in five languages.
- [ ] CSS: `.news-panel`, `.news-list`, `.hud-dot` (8px red dot, top-left of the button).
- [ ] `npx tsc -b`, `npx vitest run`, `npm run server:test`; check in the offline preview that the panel opens, the dot shows and goes.
- [ ] Commit: `feat: the news panel: opens once on coming in when there is something new, and from the menu`.

### Task 4: Ship

- [ ] Merge `master` into `develop`, build check in a clean `develop` worktree (`npx vite build`, `npx tsc -b`), push `origin master` and `gitlab develop`.
