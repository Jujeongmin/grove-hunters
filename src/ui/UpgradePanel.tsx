import { CLASSES, CLASS_LABEL, WEAPONS, isFreeClass } from "../game/combat/classes";
import { iconFor, skillIconId } from "../game/render/icons";
import type { Offer } from "../game/account/purchase";
import { ZONES, ZONE_IDS } from "../game/world/zones";

// What buying opens, read from the game itself rather than written out here: the zones that ask for
// it, the classes it adds, and the level the free fields stop at.
export const LOCKED_ZONES = ZONE_IDS.filter((z) => ZONES[z].paid);
const LOCKED_CLASSES = CLASSES.filter((c) => !isFreeClass(c));
export const FREE_UNTIL = Math.min(...LOCKED_ZONES.map((z) => ZONES[z].minLevel));

// A class's weapon, without the class's own name in front of it: the cleric's staff is called
// after the cleric, which reads twice when it sits under the name.
function weaponOf(c: (typeof LOCKED_CLASSES)[number]): string {
  const name = WEAPONS[c].name;
  return name.replace(CLASS_LABEL[c], "").trim() || name;
}

// The day a sale ends, in the reader's own reckoning.
function saleEnds(at: number): string {
  return new Date(at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// Why the panel opened, which decides its first line.
export type UpgradeReason =
  | { kind: "portal"; zone: string }
  | { kind: "level"; level: number }
  | { kind: "menu" };

interface UpgradePanelProps {
  reason: UpgradeReason;
  // What the shop is asking, and what it is marked down from when the product itself says so.
  offer: Offer;
  // Where the purchase stands: waiting for the platform to confirm, or taking too long.
  state: "idle" | "confirming" | "late";
  // Opens Verse8's purchase dialog; null when there is no server to buy through.
  onBuy: (() => void) | null;
  onClose: () => void;
}

function opening(reason: UpgradeReason): string {
  switch (reason.kind) {
    case "portal":
      return `${reason.zone}(으)로 가는 길은 정식판부터예요.`;
    case "level":
      return `Lv ${reason.level} 달성! 무료로 갈 수 있는 곳은 여기까지예요.`;
    case "menu":
      return `무료로는 마을과 숲 필드 1을 Lv ${FREE_UNTIL}까지 즐길 수 있어요.`;
  }
}

// The one thing on sale, and what it opens. Shown at the locked portal, once when the free fields
// run out, from the menu, and when a locked class is picked.
export function UpgradePanel({ reason, offer, state, onBuy, onClose }: UpgradePanelProps) {
  return (
    <div className="upgrade-panel" role="dialog" onClick={onClose}>
      <div className="upgrade-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>정식판</h2>
        <p className="upgrade-lead">{opening(reason)}</p>

        <ul className="upgrade-list">
          <li className="big">
            <b>새 사냥터 {LOCKED_ZONES.length}곳</b>
            <span>{LOCKED_ZONES.map((z) => `${ZONES[z].name} (Lv ${ZONES[z].minLevel}~)`).join(" · ")}</span>
          </li>
          <li>
            <b>레벨 제한 해제</b>
            <span>Lv {FREE_UNTIL}에서 멈추지 않고 전직(Lv 30)까지</span>
          </li>
          <li>
            <b>버섯왕</b>
            <span>내려찍기와 부하를 부르는 보스, 그 전용 장비</span>
          </li>
        </ul>

        <div className="upgrade-classes">
          <b>직업 {LOCKED_CLASSES.length}개</b>
          <div className="upgrade-class-row">
            {LOCKED_CLASSES.map((c) => {
              const icon = iconFor(skillIconId(c, 0));
              return (
                <span key={c} className="upgrade-class">
                  {icon && <img src={icon} alt="" draggable={false} />}
                  <em>{CLASS_LABEL[c]}</em>
                  <i>{weaponOf(c)}</i>
                </span>
              );
            })}
          </div>
        </div>

        {offer.off !== null && (
          <p className="upgrade-sale">
            <b>{offer.off}% 할인</b>
            <s>{offer.listPrice} VX</s>
            {offer.endsAt !== null && <i>{saleEnds(offer.endsAt)}까지</i>}
          </p>
        )}

        {onBuy
          ? (
            <button type="button" className="brush-button buy-cta" onClick={onBuy} disabled={state === "confirming"}>
              {state === "confirming" ? "결제 확인 중…" : `정식판 구매 (${offer.price} VX)`}
            </button>
          )
          : <p className="note">지금은 구매할 수 없어요. 서버에 연결된 뒤 다시 시도해 주세요.</p>}
        {state === "late" && <p className="note">결제 확인이 늦어지고 있어요. 잠시 뒤 새로고침해 주세요.</p>}

        <button type="button" className="text-button" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
