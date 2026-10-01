import type { Announcement } from "../game/world/announce";
import { readItemId } from "../game/account/items";
import { readMountId } from "../game/account/mounts";
import { t, type Key } from "./lang";
import { gearName, serverName } from "./names";

// An announcement in the reader's own language.
export function announceText(a: Announcement): string {
  const p = a.params;
  const who = { name: String(p.name ?? ""), server: serverName(String(p.world ?? "")) };
  const mount = readMountId(p.mount);
  const mountName = mount ? t(`mount.name.${mount}` as Key) : "";
  switch (a.kind) {
    case "mount_legendary":
      return t("announce.legendary", { ...who, mount: mountName });
    case "mount_mythic":
      return t("announce.mythic", { ...who, mount: mountName });
    case "mount_star5":
      return t("announce.star5", { ...who, mount: mountName });
    case "enhance": {
      const item = readItemId(p.item);
      return t("announce.enhance", { ...who, item: item ? gearName({ id: item, plus: Number(p.plus) || 0 }) : "" });
    }
    case "guild_boss":
      return t("announce.guildBoss", { guild: String(p.guild ?? ""), boss: t(`boss.${String(p.boss)}` as Key) });
    case "power_top":
      return t("announce.powerTop", { ...who, n: (Number(p.power) || 0).toLocaleString() });
    case "vip":
      return t("announce.vip", { ...who, n: Number(p.vip) || 0 });
  }
}
