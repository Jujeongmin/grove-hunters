# Free to play, paid by gems (2026-10-01)

The 500 VX full game is gone (its Verse8 product was deleted before the public release, so no one
bought it). Everything opens to everyone, and the money comes from gems instead: a first-purchase
bonus, protection against breaking gear, VIP ranks, a monthly pass, and mounts to hatch.

Kept in step with the code (2026-10-02). The numbers live in `src/game/account/premium.ts` (VIP,
pass, protection), `src/game/account/mounts.ts` (gem packs, hatching) and
`src/game/account/forge.ts` (enhancing); the server side in `server/src/premium.ts`.

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

### Gem packs and the first purchase doubled
The packs are `gems-100`, `gems-550` and `gems-1200` (`GEM_PRODUCTS`). Each gives double gems the
first time an account buys it. The account keeps `firstBought: string[]` of product ids. The
stable's gem shop marks each pack not yet bought "first purchase ×2".

### Protection against breaking
At the smith, an attempt for +6 and above may be protected for gems: a failed protected attempt is a
plain failure, never a break. Cost per attempt by the + aimed at (`PROTECT_GEMS`):

| + | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|
| gems | 20 | 30 | 50 | 80 | 120 | 200 | 300 | 500 | 800 | 1,200 |

Gems are taken with the attempt (before the roll) and are not returned on success or failure. No
item to buy or keep.

### Enhancing to +15
Enhancing goes from +1 to +15 (`MAX_PLUS`). Each attempt costs 60 × the gear's tier × the + aimed at
in gold and that many enhancement stones. Odds (the + aimed at → success, then the chance a failure
breaks the gear):

| + | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| success | 100% | 95% | 90% | 80% | 70% | 60% | 50% | 40% | 30% | 20% | 15% | 10% | 7% | 4% | 2% |
| breaks | – | – | – | – | – | 10% | 15% | 20% | 25% | 30% | 35% | 40% | 45% | 50% | 50% |

Each + up to +10 adds one step of the gear's growth (weapon +4% power, armour +12 health and a
little guard); each + past +10 adds two (`PLUS_DOUBLED_FROM`). Reaching +8 or past is announced to
every server.

### VIP ranks
Points: gems bought through the shop (with the first-purchase bonus not counted twice: the points
are the pack's own gems), and 600 for each monthly pass. Points never go down. Kept on the account
(`vipPoints`), so every character shares the rank.

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

Each rank adds 20% to XP and gold from hunting (`VIP_BONUS`; VIP 10: +200%). From VIP 1 a "VIP n"
mark shows by the name over the head, in chat and in the ranking. Reaching VIP 5 or above is
announced to every server.

Each rank also brings a perk of its own, and keeps every perk of the ranks below it (of the daily
gems and the enhancing odds only the highest counts):

| VIP | perk |
|---|---|
| 1 | the VIP mark |
| 2 | 10 more pieces of gear in the bag |
| 3 | 10 gems a day |
| 4 | rising where you fell costs nothing |
| 5 | +10% damage and max health, and a golden name |
| 6 | 30 gems a day |
| 7 | enhancing succeeds 5 points likelier |
| 8 | no market fee |
| 9 | enhancing 10 points likelier, and 50 gems a day |
| 10 | the Celestial Dragon, a mythic mount of its own (never in the draw) |

The daily gems come by mail on the account's first visit to the world each day (Korean time;
`vipPaidDay`). The gem shop's VIP bar opens the table of perks.

### Monthly pass
A Verse8 product, `monthly-pass` (the user creates it; 500 VX suggested). Buying it gives 300 gems
at once, and for 30 days the first visit of each day brings 50 gems by mail; while it runs, hunting
gives +10% XP. Buying again adds 30 days to the end. The account keeps `passUntil` (ms) and
`passPaidDay` (the last day paid). Shown in the stable's gem shop with the days left.

### Hatching mounts
Gems hatch eggs at the stable: one for 100, ten for 900 (`PULL10_COST`). Each hatch picks a tier
by these odds, shown to the player as they are (as Korean law requires of paid draws), then one of
that tier's mounts, each as likely as the others:

| tier | common | rare | epic | legendary | mythic |
|---|---|---|---|---|---|
| chance | 60% | 30% | 9% | 0.9% | 0.1% |

- Ten at once promises a rare or better: when the first nine are all common, the tenth is rare or
  better.
- Pity (천장): the 100th draw since the last legendary or better is a legendary or better
  (`PITY`), and the 500th since the last mythic is a mythic (`MYTHIC_PITY`). Both counts are kept on
  the account.
- 21 mounts are in the draw (6 common, 5 rare, 5 epic, 3 legendary, 2 mythic: the Golden Dragon and
  the Void Emperor); the deer is everyone's and VIP 10's Celestial Dragon is never drawn.
- A mount drawn again gains a star, up to ★5 (see the mount stars design); past ★5 a repeat comes
  back as 30 gems. A new legendary, a new mythic and a ★5 are announced to every server.

### The power board
The ranking has two boards, by level and by 전투력 (`Board = "xp" | "power"`). A new first place on
the power board is announced to every server.

## Testing

Rules (VIP rank from points, perks by rank, protection cost, pass days, enhancing odds, hatching odds,
the ten-draw floor and both pities) in shared modules with unit tests; server tests for the purchase
hook (first-purchase double, VIP points, pass grant and extension, daily pass mail once a day),
protected enhancement, VIP perks (daily gems once a day from VIP 3, free rising from VIP 4, bag room
from VIP 2), and the free game (paid zones reachable, all classes).
