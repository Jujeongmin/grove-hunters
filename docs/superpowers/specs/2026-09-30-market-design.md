# 거래소 — 설계

모든 서버가 함께 쓰는 거래소. **보석으로** 사고판다(탈것 뽑기의 그 보석). 결제하지 않는 유저도 거래 가능 장비·재료를
팔아 보석을 모을 수 있다. 선행: [우편](2026-09-30-mail-design.md), [장비 개체와 거래 속성](2026-09-30-tradable-items-design.md).

## 1. 규칙 (`src/game/account/market.ts`)

- 매물: 거래 가능 장비 **한 점**(그 plus 그대로), 또는 거래 가능 재료 **한 묶음**(1~99개, 묶음째로만 팔림).
- 가격: 보석 정수. 장비 최소 `MIN_GEAR_PRICE = 10`, 재료 묶음 최소 `MIN_BUNDLE_PRICE = 1`, 최대 `MAX_PRICE = 100000`.
- 수수료: `fee(price) = floor(price * 0.05)`. 판매자는 `price - fee`를 받는다(19보석 이하는 수수료 0). 수수료만큼 보석이 사라진다.
- 계정당 동시 매물 `MAX_LISTINGS = 10`. 등록 기간 `LISTING_MS = 48시간`.
- 등록 즉시 물건은 가방에서 빠져 매물에 담긴다. 취소·만료되면 `market_returned` 우편으로 돌아온다.
- 자기 매물은 살 수 없다.

## 2. 서버

- 컬렉션 `market`: 한 행이 매물 하나
  `{ seller, sellerName, kind: "gear" | "material", item, piece?, n, price, at, until, slot? , plus }`
  (검색용으로 `item`, `slot`(weapon/armor/material), `plus`, `price`를 행에 펼쳐 둔다).
- 원격 함수
  - `listMarket(filter)`: `{ slot?, item?, minPlus?, page }` → 싼 순, 페이지당 20. 읽기 전에 만료 매물을 정리한다(아래).
  - `myListings()`: 내 매물(만료 포함, 만료된 건 정리 뒤 사라짐).
  - `sellOnMarket(what, price)`: `what = { uid } | { item, n }`. 캐릭터 필요. 한도·가격·거래 가능 확인 → 가방에서 빼고 행 추가
    (행 추가가 실패하면 가방에 되돌림).
  - `buyFromMarket(listingId)`: `market:<id>` 잠금 안에서 행 확인 → 구매자 보석 차감(`changeGems`, 모자라면
    `not_enough_gems`) → **행 삭제** → 판매자에게 `market_sold`(보석 `price - fee`), 구매자에게 `market_bought`(물건).
    우편 넣기가 실패하면 보석을 돌려주고 행을 다시 넣는다.
  - `cancelListing(listingId)`: 내 것만, `market:<id>` 잠금 안에서 행 삭제 → `market_returned`.
- 만료 정리: `until`이 지난 행을 몇 개씩(`SWEEP = 20`) 읽어 각자 `market:<id>` 잠금 안에서 지우고 `market_returned`.
  `listMarket`·`myListings`가 부를 때마다 한다.
- 오류: `listing_gone`(이미 팔림·취소), `listing_limit`, `bad_price`, `not_tradable`, `own_listing`, `not_enough_gems`.

## 3. 화면 `src/ui/MarketPanel.tsx`

- 탭: `사기` / `팔기` / `내 매물`.
- 사기: 분류(무기·방어구·재료), 종류, 최소 강화 필터, 싼 순 목록(아이콘, `+N`, 개수, 가격, 판매자, 남은 시간), 구매 확인 창
  ("n보석을 씁니다"), 산 물건은 우편으로 온다는 안내.
- 팔기: 가방의 거래 가능 장비·재료만. 가격 입력, 수수료와 받을 보석 미리 보기, 재료는 개수 입력.
- 내 매물: 남은 시간, 취소.
- 메뉴 그리드에 `거래소` 버튼. 보석 잔액은 패널 위에.
- 문구 5개 언어.

## 4. 테스트

- `market.ts`: 수수료 경계(19·20), 가격 범위, 묶음 개수 범위, 등록 가능 판정(거래 불가·입은 장비 거부).
- 서버: 두 명이 같은 매물을 사면 한 명만 성공하고 보석은 한 번만, 자기 매물 구매 거부, 한도 10, 취소는 내 것만, 만료 정리 뒤
  우편으로 반환, 판매 대금 우편에 수수료가 빠짐, 거래 불가 조각 등록 거부.
