"""Ferrugem overlays: role (Caçador / Coletor) and progress, aligned with assets-src/sprites/dog_base.png (30x32)."""
from PIL import Image

OUTLINE = (30, 22, 30, 255)
STEEL, STEEL_HI = (150, 162, 182, 255), (214, 224, 236, 255)
RED, RED_D = (226, 58, 48, 255), (140, 30, 30, 255)
SACK, SACK_D, SACK_HI = (150, 112, 64, 255), (102, 72, 40, 255), (196, 156, 96, 255)
BRASS, BRASS_D, BRASS_HI = (214, 164, 58, 255), (140, 96, 32, 255), (255, 228, 140, 255)


def _paint(size, pixels: dict) -> Image.Image:
    out = Image.new('RGBA', size)
    px = out.load()
    for (x, y), c in pixels.items():
        if 0 <= x < size[0] and 0 <= y < size[1]:
            px[x, y] = c
    return out


def hunter(base: Image.Image) -> Image.Image:
    """Caçador: steel spikes on the collar and a red hunting eye."""
    px = {}
    for x in (15, 18, 21, 24):
        for y, c in ((16, STEEL), (15, STEEL), (14, STEEL_HI)):
            px[(x, y)] = c
        px[(x, 13)] = OUTLINE
        for y in (14, 15):
            px[(x - 1, y)] = OUTLINE
            px[(x + 1, y)] = OUTLINE
    px[(21, 8)] = RED
    px[(22, 9)] = RED_D
    px[(20, 10)] = RED
    return _paint(base.size, px)


def collector(base: Image.Image) -> Image.Image:
    """Coletor: a strapped scrap sack on the back."""
    px = {}
    for y in range(11, 17):
        for x in range(5, 12):
            edge = y in (11, 16) or x in (5, 11)
            px[(x, y)] = OUTLINE if edge else SACK_D if y == 15 or x == 10 else SACK_HI if (x, y) in ((6, 12), (7, 12)) else SACK
    for x in range(6, 11):
        px[(x, 13)] = SACK_D
    px[(8, 10)] = OUTLINE
    px[(8, 11)] = SACK_D
    return _paint(base.size, px)


def veteran(base: Image.Image) -> Image.Image:
    """Progress (level 5+): riveted brass plating on the rear flank."""
    px = {}
    for y in range(19, 24):
        for x in range(3, 9):
            if base.getpixel((x, y))[3] and not sum(base.getpixel((x, y))[:3]) < 150:
                px[(x, y)] = BRASS_D if y == 23 or x == 8 else BRASS
    for x, y in ((4, 20), (7, 20), (4, 22)):
        px[(x, y)] = BRASS_HI
    return _paint(base.size, px)


DOG_GEAR = {'hunter': hunter, 'collector': collector, 'veteran': veteran}
