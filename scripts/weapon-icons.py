"""Every class's weapon pictures past the first tier. A weapon is one item for all classes, drawn as the
looker's class wields it (see itemPicture in src/game/render/icons.ts): the pack's swords for a
warrior, and for the others a first-tier picture drawn with PixelLab (weapon_1_<kind>.png: a bow, a
wizard's staff, a cleric's staff, a dagger, a fist wrap). Each higher tier takes that picture in the
colours of the matching sword (the forest's green, the Mushroom King's violet, steel, the rockheart's
gold, frost, glacier): its light and shade laid onto a two-colour ramp and mixed with its own colours,
so wood still reads as wood; the dark outline stays. Writes public/assets/ui/items/weapon_<tier>_<kind>.png
(kept on develop only, like every game asset).

    python scripts/weapon-icons.py
"""
from pathlib import Path

from PIL import Image

ITEMS = Path(__file__).resolve().parent.parent / "public" / "assets" / "ui" / "items"
KINDS = ["bow", "staff", "holy", "dagger", "fist"]
# tier: (dark end of the ramp, light end)
TIERS = {
    2: ((24, 64, 30), (200, 245, 170)),
    3: ((52, 30, 86), (215, 175, 245)),
    4: ((40, 46, 62), (225, 230, 240)),
    5: ((96, 44, 10), (255, 222, 120)),
    6: ((26, 58, 96), (190, 235, 255)),
    7: ((70, 60, 120), (245, 250, 255)),
}
# How much of the tier's colour goes in (the rest is the picture's own).
MIX = 0.65
# Pixels darker than this are the outline, left as they are.
OUTLINE = 40


def recolour(src: Image.Image, dark: tuple, light: tuple) -> Image.Image:
    img = src.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < OUTLINE:
                continue
            k = min(1.0, max(0.0, (lum - OUTLINE) / (255 - OUTLINE)))
            tinted = [d + (l - d) * k for d, l in zip(dark, light)]
            px[x, y] = tuple(round(o + (t - o) * MIX) for o, t in zip((r, g, b), tinted)) + (a,)
    return img


if __name__ == "__main__":
    for kind in KINDS:
        base = Image.open(ITEMS / f"weapon_1_{kind}.png")
        for tier, (dark, light) in TIERS.items():
            recolour(base, dark, light).save(ITEMS / f"weapon_{tier}_{kind}.png")
        print(kind)
