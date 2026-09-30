# 우편 — 설계

시스템만 보내는 우편. 유저끼리 편지를 주고받지는 않는다. 우편함은 **계정 하나에 하나**라서 어느 서버 어느 캐릭터로
들어와도 같고, 받은 아이템은 받기를 누른 캐릭터의 가방으로 들어간다.

## 1. 종류

| kind | 보내는 곳 | 담기는 것 |
|---|---|---|
| `gift` | 운영 보상 (코드의 `GIFTS`) | 골드·보석·아이템 |
| `market_sold` | 거래소: 팔린 매물의 대금 | 보석 |
| `market_bought` | 거래소: 산 물건 | 장비 한 점 또는 재료 묶음 |
| `market_returned` | 거래소: 취소·기간 만료 | 장비 한 점 또는 재료 묶음 |

`market_*`는 거래소 단계에서, 길드 우편이 필요하면 길드 단계에서 더한다. 이 문서의 구현은 `gift`까지.

## 2. 공용 규칙 `src/game/account/mail.ts`

```ts
export type MailKind = "gift" | "market_sold" | "market_bought" | "market_returned";
export interface Mail {
  id: string;            // 컬렉션 행 id
  kind: MailKind;
  at: number;            // 도착 시각(ms)
  gold: number; gems: number;
  items: MailItem[];     // 거래 속성 전환 전에는 { id: ItemId; n: number } 뿐
  params: Record<string, string | number>; // 문구 구멍(상품 이름, 가격 등). gift는 { gift: <GIFTS id> }
}
export const MAIL_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
export const MAILBOX_SHOWN = 50;
export function readMail(row: unknown): Mail | null;
export function mailExpired(mail: Mail, now: number): boolean;
export function daysLeft(mail: Mail, now: number): number;
// 가방에 다 들어가는지(재료·물약 한 줄 99개, 장비 칸 한도). 들어가지 않으면 받기를 거부한다.
export function mailFits(bag: …, mail: Mail): boolean;

export interface Gift { id: string; from: number; until: number; gold: number; gems: number; items: …[]; text: Record<Lang, { title: string; body: string }> }
export const GIFTS: readonly Gift[];
export function giftsDue(taken: readonly string[], now: number): Gift[];
```

- 첫 운영 우편: `2026-09-30-mailbox`, 큰 물약 10개, 기간 2주. 제목·본문은 5개 언어.
- `gift`가 아닌 우편의 제목·본문은 kind별 문구(문자열 표)에 `params`를 채워 화면이 만든다.

## 3. 서버

- 컬렉션 `mail`: 한 행이 우편 한 통 `{ account, kind, at, gold, gems, items, params }`. 받는 사람이 접속해 있지 않아도
  누구나(거래소 구매자의 요청 등) 넣을 수 있다.
- 운영 보상: 계정 state의 `giftsTaken: string[]`. 우편함을 읽을 때 `giftsDue`로 받을 것을 골라 `mail`에 넣고 id를
  `giftsTaken`에 더한다(`mail:<account>` 잠금 안에서, 한 번만).
- 원격 함수
  - `getMail()`: 만료 우편을 지우고, 운영 보상을 넣고, 최신순 최대 `MAILBOX_SHOWN`통.
  - `mailCount()`: 안 받은 우편 수(빨간 점용). 운영 보상도 넣은 뒤 센다.
  - `claimMail(id)`: `mail:<account>` 잠금 안에서 행을 읽고 → 가방에 들어가는지 확인 → **행을 먼저 지우고** → 골드는
    `$asset.mint`, 보석은 `changeGems`, 아이템은 플레이 중인 캐릭터 가방에 → 지급이 실패하면 행을 다시 넣는다. 아이템이 든
    우편은 캐릭터가 있어야 받는다(로비에서는 골드·보석만).
  - `claimAllMail()`: 들어가는 것만 차례로 받고, 받지 못한 수와 이유를 돌려준다.
- 오류: `no_mail`(없거나 남의 것), `bag_full`, `no_character`.

## 4. 화면

- `src/ui/MailPanel.tsx`: 최신순 목록(제목, 내용물 아이콘과 수, 남은 일수), 받기·모두 받기. 다른 패널과 같은 틀.
- 메뉴 그리드에 `우편` 버튼, 안 받은 우편이 있으면 빨간 점(소식과 같은 방식).
- 안 받은 수는 월드에 들어올 때와 1분마다(`mailCount`), 그리고 받기 뒤에 갱신.
- 문구는 문자열 표에 5개 언어로.

## 5. 테스트

- `mail.ts`: 만료 경계, 남은 일수, `mailFits`(99 경계), `giftsDue`(기간 밖·이미 받음), `readMail`이 망가진 행을 버림.
- 서버: 두 번 받기 불가(같은 id 연속 호출), 남의 우편 거부, 로비에서 아이템 우편 거부·골드 우편 허용, 가방이 가득 차면
  거부하고 우편은 남음, 운영 보상이 계정마다 한 번만, 30일 지난 우편 삭제.
