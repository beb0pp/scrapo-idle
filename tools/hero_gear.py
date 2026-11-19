"""Gear overlays for the hero: each equippable item recolours (or adds) pixels of the base art.

An overlay is a 49x66 image aligned with assets-src/sprites/hero_base.png that holds only the item's
pixels; bake-sprites.py runs it through the same pose pipeline as the hero, so it follows every frame.
"""
import colorsys
from PIL import Image

OUTLINE = (30, 22, 30, 255)


def _lum(p) -> float:
    return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)[1]


def _hls(p):
    return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)


def _ramp(colors: list[tuple[int, int, int]], lum: float, lo: float, hi: float):
    t = 0 if hi <= lo else min(0.999, max(0.0, (lum - lo) / (hi - lo)))
    r, g, b = colors[int(t * len(colors))]
    return (r, g, b, 255)


def _is_outline(p) -> bool:
    return p[3] and p[0] < 50 and p[1] < 50 and p[2] < 60


def _is_skin(p) -> bool:
    return p[3] and p[0] > 190 and p[1] > 120 and p[2] < 175 and p[0] - p[2] > 50


def _is_steel(p) -> bool:
    h, l, s = _hls(p)
    return p[3] and s < 0.28 and l > 0.32 and not _is_outline(p)


def _recolor(base: Image.Image, box, pick, ramp) -> Image.Image:
    """Copies pixels inside box that pass `pick`, recoloured by luminance through `ramp`."""
    out = Image.new('RGBA', base.size)
    src, dst = base.load(), out.load()
    x0, y0, x1, y1 = box
    picked = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if pick(src[x, y], x, y)]
    if not picked:
        return out
    lums = [_lum(src[x, y]) for x, y in picked]
    lo, hi = min(lums), max(lums)
    for (x, y), l in zip(picked, lums):
        dst[x, y] = _ramp(ramp, l, lo, hi)
    return out


def _paint(size, pixels: dict) -> Image.Image:
    out = Image.new('RGBA', size)
    px = out.load()
    for (x, y), c in pixels.items():
        px[x, y] = c
    return out


def scrap_cap(base: Image.Image) -> Image.Image:
    """Riveted ochre work cap: a dome over the crown of the hair and a dark brim above the goggles."""
    dark, mid, light, brim = (98, 60, 32, 255), (150, 96, 46, 255), (200, 140, 66, 255), (56, 34, 22, 255)
    pixels = {}
    cx, cy, rx, ry = 20.0, 6.5, 9.5, 6.0
    for y in range(0, 7):
        for x in range(9, 32):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0:
                shade = (x - cx) / rx * 0.6 + (y - cy) / ry
                pixels[(x, y)] = light if shade < -0.7 else mid if shade < 0.1 else dark
            elif d <= 1.35:
                pixels[(x, y)] = OUTLINE
    for x in range(9, 32):
        pixels[(x, 7)] = brim
    pixels[(8, 7)] = OUTLINE
    pixels[(32, 7)] = OUTLINE
    for x, y in ((15, 4), (20, 2), (25, 4)):
        pixels[(x, y)] = (236, 204, 130, 255)
    return _paint(base.size, pixels)


def work_jacket(base: Image.Image) -> Image.Image:
    """Olive canvas jacket over the slate shirt, with brass buttons down the front."""
    cloth = lambda p, x, y: _is_steel(p) and not (x >= 33 and y <= 40)
    jacket = _recolor(base, (5, 21, 31, 34), cloth, [(62, 70, 40), (92, 102, 56), (128, 138, 76)])
    px = jacket.load()
    for y in (24, 28, 32):
        if px[18, y][3]:
            px[18, y] = (224, 180, 82, 255)
    return jacket


def grip_gloves(base: Image.Image) -> Image.Image:
    """Leather gloves on both hands (skin pixels below the face)."""
    hands = lambda p, x, y: _is_skin(p)
    right = _recolor(base, (32, 20, 41, 33), hands, [(48, 30, 22), (82, 52, 32), (122, 80, 46)])
    left = _recolor(base, (5, 33, 14, 40), hands, [(48, 30, 22), (82, 52, 32), (122, 80, 46)])
    right.alpha_composite(left)
    return right


def rail_boots(base: Image.Image) -> Image.Image:
    """Heavy iron-shod boots with a bright steel toe cap."""
    boot = lambda p, x, y: p[3] and not _is_outline(p)
    boots = _recolor(base, (7, 54, 33, 64), boot, [(46, 48, 58), (74, 80, 96), (120, 132, 152), (182, 192, 206)])
    px = boots.load()
    for x in range(8, 33):
        if px[x, 64][3]:
            px[x, 64] = (200, 210, 222, 255)
    return boots


def lucky_bolt(base: Image.Image) -> Image.Image:
    """A brass bolt pendant hanging at the chest."""
    gold, dark, hi = (214, 164, 58, 255), (130, 88, 30, 255), (255, 232, 150, 255)
    pixels = {(19, 21): dark, (19, 22): dark, (19, 23): dark}
    for x in range(17, 22):
        pixels[(x, 24)] = OUTLINE
        pixels[(x, 29)] = OUTLINE
    for y in range(25, 29):
        pixels[(16, y)] = OUTLINE
        pixels[(22, y)] = OUTLINE
        for x in range(17, 22):
            pixels[(x, y)] = hi if (x, y) in ((17, 25), (18, 25)) else dark if x == 21 or y == 28 else gold
    pixels[(19, 26)] = dark
    return _paint(base.size, pixels)


def reinforced_wrench(base: Image.Image) -> Image.Image:
    """Polished steel head with copper reinforcing bands."""
    steel = lambda p, x, y: _is_steel(p)
    tool = _recolor(base, (34, 2, 48, 40), steel, [(96, 112, 134), (150, 170, 196), (214, 226, 240)])
    px = tool.load()
    for y in (16, 19, 22, 25):
        for x in range(34, 48):
            if px[x, y][3]:
                px[x, y] = (232, 140, 60, 255)
    return tool


def hydraulic_pry(base: Image.Image) -> Image.Image:
    """Red hydraulic pry bar: the wrench recoloured with a piston band and a pressure gauge."""
    steel = lambda p, x, y: _is_steel(p)
    tool = _recolor(base, (34, 2, 48, 40), steel, [(120, 30, 30), (186, 52, 44), (236, 96, 72)])
    px = tool.load()
    for y in range(20, 24):
        for x in range(34, 48):
            if px[x, y][3]:
                px[x, y] = (170, 180, 196, 255) if y % 2 else (96, 104, 120, 255)
    return tool


GEAR = {
    'head_scrap_cap': scrap_cap,
    'body_work_jacket': work_jacket,
    'hands_grip_gloves': grip_gloves,
    'feet_rail_boots': rail_boots,
    'accessory_lucky_bolt': lucky_bolt,
    'tool_wrench_reinforced': reinforced_wrench,
    'tool_hydraulic_pry': hydraulic_pry,
}
