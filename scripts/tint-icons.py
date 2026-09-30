"""The snow region's item pictures, recoloured from the pack's own (see docs/licenses): the tier 5 gear
frosted for tier 6 and glacier-pale for tier 7, and three materials from existing ones. Each picture's
light and shade are kept (its luminance) and laid onto a two-colour ramp; the dark outline stays dark.
Writes public/assets/ui/items/<id>.png (kept on develop only, like every game asset).

    python scripts/tint-icons.py
"""
from pathlib import Path

from PIL import Image

ITEMS = Path(__file__).resolve().parent.parent / "public" / "assets" / "ui" / "items"

# new picture: (from, dark end of the ramp, light end)
TINTS = {
    "weapon_6": ("weapon_5", (26, 58, 96), (190, 235, 255)),
    "armor_6": ("armor_5", (26, 58, 96), (190, 235, 255)),
    "weapon_7": ("weapon_5", (70, 60, 120), (245, 250, 255)),
    "armor_7": ("armor_5", (70, 60, 120), (245, 250, 255)),
    "frost_shard": ("core", (20, 70, 120), (200, 245, 255)),
    "snow_fur": ("silk", (90, 100, 115), (250, 252, 255)),
    "ever_ice": ("stone", (40, 90, 150), (235, 250, 255)),
}
# Pixels darker than this are the outline, left as they are.
OUTLINE = 40


def tint(src: Image.Image, dark: tuple, light: tuple) -> Image.Image:
    img = src.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (0.299 * r + 0.587 * g + 0.114 * b)
            if lum < OUTLINE:
                continue
            k = min(1.0, max(0.0, (lum - OUTLINE) / (255 - OUTLINE)))
            px[x, y] = tuple(round(d + (l - d) * k) for d, l in zip(dark, light)) + (a,)
    return img


if __name__ == "__main__":
    for name, (source, dark, light) in TINTS.items():
        tint(Image.open(ITEMS / f"{source}.png"), dark, light).save(ITEMS / f"{name}.png")
        print(f"{name}.png")
