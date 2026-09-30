# 업데이트 소식 — 설계

게임 안에서 업데이트 내용을 볼 수 있게 한다. 안 읽은 소식이 있으면 들어올 때 한 번 띄우고, 메뉴의 `소식` 버튼으로 지난
소식을 언제든 본다. 이후 길드·우편·거래소 같은 기능을 낼 때마다 같은 커밋에 소식을 한 줄 더한다.

## 1. 데이터 `src/game/news.ts` (서버와 화면이 같이 씀)

```ts
export interface NewsText { title: string; lines: string[] }
export interface NewsEntry { id: string; date: string /* YYYY-MM-DD, 한국 시간 */; text: Record<Lang, NewsText> }
export const NEWS: readonly NewsEntry[] // 최신이 맨 앞
export function readNewsId(raw: unknown): string | null   // NEWS에 있는 id만
export function unseenNews(seen: string | null): number   // seen 이후(앞쪽)에 있는 소식 수; seen이 null이거나 모르는 id면 전부
```

- `Lang`은 `src/ui/lang.ts`의 언어 5개(ko·en·ja·zh-Hant·zh-Hans, `import type`으로만 가져온다). `Record<Lang, …>`라 한 언어라도 빠지면 컴파일되지 않는다.
- id는 `YYYY-MM-DD-주제` 꼴. 새 소식은 **맨 앞에만** 더한다(읽음 판정이 순서에 기댄다).
- 첫 소식 3개: 9/28 숲 정화·마을 복구와 첫 튜토리얼, 9/29 탈것·마구간·알 부화·보석 상점과 모바일 성능, 9/30 소식판.

## 2. 읽음 상태 (계정 단위, 서버 저장)

- 계정의 global user state에 `newsSeen: string`(마지막으로 본 소식 id).
- localStorage를 쓰지 않는다: 에디터 iframe에서 막힐 수 있고, 기기를 바꾸면 다시 뜬다.
- `getAccount`가 돌려주는 `AccountView`에 `newsSeen: string | null`.
- 원격 함수 `markNewsSeen(id)`: `readNewsId`로 확인, 모르는 id면 `RuleViolation("unavailable")`. 이미 더 최신 id를 봤으면
  덮어쓰지 않는다(늦게 도착한 요청이 되돌리지 않게).

## 3. 화면

- `src/ui/NewsPanel.tsx`: 날짜와 제목 목록, 최신 소식은 펼친 채로 연다. 다른 패널과 같은 틀(검은 판, 닫기 버튼, Escape).
  열려 있는 동안 맨 앞 소식 id로 `markNewsSeen`을 보낸다(닫을 때가 아니라 열 때: 창을 닫지 않고 나가도 다시 뜨지 않게).
- 월드에 들어와 안 읽은 소식이 있으면 한 번 자동으로 연다. 튜토리얼 중인 캐릭터는 자동으로 열지 않고 빨간 점만 보인다.
- 메뉴 그리드에 `소식` 버튼. 안 읽은 소식이 있으면 버튼과 접힌 메뉴 버튼에 빨간 점.
- 문구(패널 제목, 버튼 이름)는 기존 문자열 표(`src/ui/strings/*.ts`)에 5개 언어로.

## 4. 오류 처리

- `markNewsSeen` 실패는 조용히 넘긴다(다음 접속에 다시 뜰 뿐). 화면은 보낸 즉시 읽은 것으로 표시한다.
- 저장된 `newsSeen`이 지금 목록에 없는 id면(지운 소식) 전부 안 읽은 것으로 본다. 소식은 지우지 않는 것을 원칙으로 한다.

## 5. 테스트

- `news.ts`: id가 겹치지 않음, 날짜가 최신순, 5개 언어 모두 제목과 줄이 비어 있지 않음, `unseenNews` 경계(null·맨 앞·중간·모르는 id).
- 서버: `markNewsSeen`이 모르는 id를 거부, 더 오래된 id로 되돌리지 않음, `getAccount`에 `newsSeen`이 실림.
