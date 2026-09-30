"""Draws each path's fourth-skill icon from the picture its third skill uses (the path's own where it has
one, the class's otherwise), gilded: a gold rim round the picture's shape, gold brackets in the corners
and a little more warmth, so the great skill reads as the third's stronger kin. Writes
public/assets/ui/icons/<path>_3.png (kept on develop only, like every game asset).

    python scripts/fourth-skill-icons.py
"""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ICONS = Path(__file__).resolve().parent.parent / "public" / "assets" / "ui" / "icons"
PATHS = {
    "berserker": "warrior", "guardian": "warrior", "sniper": "ranger", "tracker": "ranger",
    "elementalist": "wizard", "warder": "wizard", "high_priest": "cleric", "paladin": "cleric",
    "assassin": "rogue", "scout": "rogue", "fist_master": "monk", "iron_monk": "monk",
}
GOLD = (255, 204, 64, 255)
GOLD_DARK = (170, 110, 20, 255)
BRACKET = 7


def gild(src: Image.Image) -> Image.Image:
    size = src.size
    art = ImageEnhance.Color(src).enhance(1.25)
    art = ImageEnhance.Brightness(art).enhance(1.08)
    # A gold rim one pixel outside the picture's shape.
    alpha = src.getchannel("A").point(lambda a: 255 if a > 40 else 0)
    rim = alpha.filter(ImageFilter.MaxFilter(3))
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", size, GOLD), (0, 0), rim)
    out.alpha_composite(art)
    # Corner brackets: gold with a dark edge inside.
    px = out.load()
    w, h = size
    for i in range(BRACKET):
        for (x, y) in ((i, 0), (0, i), (w - 1 - i, 0), (w - 1, i), (i, h - 1), (0, h - 1 - i), (w - 1 - i, h - 1), (w - 1, h - 1 - i)):
            px[x, y] = GOLD
        for (x, y) in ((i + 1, 1), (1, i + 1), (w - 2 - i, 1), (w - 2, i + 1), (i + 1, h - 2), (1, h - 2 - i), (w - 2 - i, h - 2), (w - 2, h - 2 - i)):
            if 0 < x < w - 1 and 0 < y < h - 1 and i < BRACKET - 1:
                px[x, y] = GOLD_DARK
    return out


for path, cls in PATHS.items():
    own = ICONS / f"{path}_2.png"
    src = Image.open(own if own.exists() else ICONS / f"{cls}_2.png").convert("RGBA")
    gild(src).save(ICONS / f"{path}_3.png")
    print(path)
