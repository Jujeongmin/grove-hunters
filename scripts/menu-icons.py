"""Draws the menu icons for the news, mail, market and guild buttons as 34x34 pixel art in the look of
the 496 RPG icons pack the other menu icons come from (a dark outline, a lit left side, a shaded
right). Drawn here rather than taken from the pack, which has no bell, envelope, scales or banner in
that style. Writes public/assets/ui/icons/ui_<name>.png (kept on develop only, like every game asset).

    python scripts/menu-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 34
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "ui" / "icons"
OUTLINE = (26, 18, 16, 255)

GOLD = ((255, 229, 138, 255), (242, 182, 50, 255), (192, 122, 18, 255))
PAPER = ((250, 228, 196, 255), (232, 201, 160, 255), (190, 150, 106, 255))
RED = ((255, 120, 96, 255), (216, 64, 47, 255), (150, 36, 28, 255))
WOOD = ((196, 130, 80, 255), (150, 92, 52, 255), (104, 60, 32, 255))
GEM = ((200, 250, 255, 255), (96, 200, 230, 255), (40, 120, 170, 255))


def canvas():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outlined(img: Image.Image) -> Image.Image:
    """A one-pixel dark outline around everything drawn (the pack's look)."""
    px = img.load()
    out = img.copy()
    opx = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if px[x, y][3] > 0:
                continue
            near = any(
                0 <= x + dx < SIZE and 0 <= y + dy < SIZE and px[x + dx, y + dy][3] > 0
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)
            )
            if near:
                opx[x, y] = OUTLINE
    return out


def shade(img: Image.Image, colours, left: int, right: int) -> None:
    """Lights the left edge of each drawn row and shades the right edge, between x = left and right."""
    light, base, dark = colours
    px = img.load()
    for y in range(SIZE):
        xs = [x for x in range(left, right + 1) if px[x, y] == base]
        if len(xs) < 3:
            continue
        for x in xs[:2]:
            px[x, y] = light
        for x in xs[-3:]:
            px[x, y] = dark


def bell():
    img, d = canvas()
    light, base, dark = GOLD
    d.ellipse((14, 3, 19, 8), outline=base, width=2)
    d.polygon([(17, 6), (12, 9), (10, 14), (9, 20), (6, 24), (28, 24), (25, 20), (24, 14), (22, 9)], fill=base)
    d.rectangle((5, 24, 29, 27), fill=base)
    shade(img, GOLD, 0, SIZE - 1)
    d.line((6, 25, 28, 25), fill=light)
    d.line((6, 27, 28, 27), fill=dark)
    d.ellipse((14, 27, 20, 32), fill=dark)
    d.point((16, 28), fill=light)
    # A shine on the bell's shoulder.
    d.line((12, 12, 12, 17), fill=(255, 250, 220, 255))
    return outlined(img)


def envelope():
    img, d = canvas()
    light, base, dark = PAPER
    d.rectangle((4, 9, 29, 26), fill=base)
    shade(img, PAPER, 0, SIZE - 1)
    d.line((4, 9, 29, 9), fill=light)
    # The flap and the folds.
    d.polygon([(5, 10), (28, 10), (17, 19)], fill=light)
    d.line((5, 10, 17, 19), fill=dark)
    d.line((28, 10, 17, 19), fill=dark)
    d.line((5, 25, 13, 18), fill=dark)
    d.line((28, 25, 21, 18), fill=dark)
    # The red wax seal.
    r_light, r_base, r_dark = RED
    d.ellipse((13, 15, 21, 23), fill=r_base)
    d.arc((13, 15, 21, 23), 200, 340, fill=r_dark)
    d.point((15, 17), fill=r_light)
    d.point((16, 17), fill=r_light)
    return outlined(img)


def scales():
    img, d = canvas()
    light, base, dark = GOLD
    # The post, the base and the beam.
    d.rectangle((16, 6, 17, 27), fill=base)
    d.polygon([(11, 30), (22, 30), (19, 26), (14, 26)], fill=base)
    d.rectangle((5, 8, 28, 9), fill=base)
    d.ellipse((14, 3, 19, 8), fill=base)
    d.point((15, 4), fill=light)
    # The chains and the two pans.
    for cx in (8, 25):
        d.line((cx - 3, 10, cx - 4, 19), fill=dark)
        d.line((cx + 3, 10, cx + 4, 19), fill=dark)
        d.chord((cx - 6, 15, cx + 6, 25), 0, 180, fill=base)
    shade(img, GOLD, 0, SIZE - 1)
    d.line((5, 8, 28, 8), fill=light)
    # A gem on one pan, a coin on the other.
    g_light, g_base, g_dark = GEM
    d.polygon([(22, 19), (25, 15), (28, 19), (25, 21)], fill=g_base)
    d.point((24, 17), fill=g_light)
    d.line((25, 21, 28, 19), fill=g_dark)
    d.ellipse((5, 16, 10, 20), fill=light)
    d.point((9, 18), fill=dark)
    return outlined(img)


def banner():
    img, d = canvas()
    # The pole and its gold tip.
    w_light, w_base, w_dark = WOOD
    d.rectangle((7, 5, 9, 31), fill=w_base)
    d.line((7, 5, 7, 31), fill=w_light)
    d.line((9, 5, 9, 31), fill=w_dark)
    g_light, g_base, g_dark = GOLD
    d.polygon([(8, 1), (10, 5), (6, 5)], fill=g_base)
    d.point((7, 4), fill=g_light)
    # The cloth, with a swallowtail.
    r_light, r_base, r_dark = RED
    d.polygon([(10, 6), (28, 7), (28, 24), (22, 20), (16, 25), (10, 22)], fill=r_base)
    shade(img, RED, 10, SIZE - 1)
    d.line((10, 6, 28, 7), fill=r_light)
    # A gold leaf on it, the grove's sign.
    d.polygon([(19, 9), (23, 13), (19, 19), (15, 13)], fill=g_base)
    d.line((19, 10, 19, 18), fill=g_dark)
    d.point((17, 12), fill=g_light)
    return outlined(img)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, draw in {"news": bell, "mail": envelope, "market": scales, "guild": banner}.items():
        draw().save(OUT / f"ui_{name}.png")
        print(f"ui_{name}.png")
