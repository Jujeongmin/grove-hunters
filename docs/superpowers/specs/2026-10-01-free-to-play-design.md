# Free to play, paid by gems (2026-10-01)

The 500 VX full game is gone (its Verse8 product was deleted before the public release, so no one
bought it). Everything opens to everyone, and the money comes from gems instead: a first-purchase
bonus, protection against breaking gear, VIP ranks, and a monthly pass.

## Stage 1: everything free

- Every zone is open to every account; zones keep their level floors (forest 2 from Lv10, the snow
  outpost from Lv38, …). The `paid` flag on zones goes, and with it the paid route in quest trips.
- All six classes may be made.
- The deer is every account's from the start (`ownedMounts` always includes it).
- Gone from the UI: the full game button, the purchase sheet (UpgradePanel), the locked portal's
  purchase prompt, the Lv10 "free fields end here" popup, the lobby's class lock.
- Gone from the server: the `full-game` purchase grant. An event for it is answered `unknown_product`.
- News entry, README and STORE.md say the whole game is free.

## Stage 2: gems

### First purchase doubled
Each gem product (`gems-100`, `gems-550`, `gems-1200`) gives double gems the first time an account
buys it. The account keeps `firstBought: string[]` of product ids. The stable's gem shop marks each
product not yet bought "first purchase ×2".

### Protection against breaking
At the smith, an attempt for +6 and above may be protected for gems: a failed protected attempt is a
plain failure, never a break. Cost per attempt by the + aimed at: +6 20, +7 30, +8 50, +9 80,
+10 120. Gems are taken with the attempt (before the roll) and are not returned on success or
failure. No item to buy or keep.

### VIP ranks
Points: gems bought through the shop (with the first-purchase bonus not counted twice: the points
are the product's own gems), and 600 for each monthly pass. Points never go down. Kept on the
account (`vipPoints`), so every character shares the rank.

| VIP | points |
|---|---|
| 1 | 100 |
| 2 | 550 |
| 3 | 1,200 |
| 4 | 3,000 |
| 5 | 6,000 |
| 6 | 12,000 |
| 7 | 25,000 |
| 8 | 50,000 |
| 9 | 100,000 |
| 10 | 200,000 |

Each rank adds 2% XP and 2% gold from hunting (VIP 10: +20%). From VIP 1 a "VIP n" mark shows by the
name over the head, in chat and in the ranking. Reaching VIP 5 or above is announced to every server.

### Monthly pass
A new Verse8 product, `monthly-pass` (the user creates it; 500 VX suggested). Buying it gives 300
gems at once, and for 30 days the first visit of each day brings 50 gems by mail; while it runs,
hunting gives +10% XP. Buying again adds 30 days to the end. The account keeps `passUntil` (ms) and
`passPaidDay` (the last day paid). Shown in the stable's gem shop with the days left.

## Testing

Rules (VIP rank from points, protection cost, pass days) in shared modules with unit tests; server
tests for the purchase hook (first-purchase double, VIP points, pass grant and extension, daily pass
mail once a day), protected enhancement, and the free game (paid zones reachable, all classes).
