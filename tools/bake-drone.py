"""Paints the Drone Faísca: 4-frame hover sheet (spinning rotors, blinking beacon) and a 24x24 icon.

Outputs public/sprites/drone.png (4 frames of 24x22) and public/sprites/drone-icon.png. Needs Pillow.
"""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'sprites'
W, H = 24, 22

OUTLINE = (30, 24, 36, 255)
IRON, SLATE, STEEL = (58, 63, 76, 255), (94, 107, 130, 255), (169, 180, 198, 255)
COPPER_D, COPPER, BRASS = (150, 70, 34, 255), (215, 131, 59, 255), (240, 192, 96, 255)
TEAL_D, TEAL, WHITE = (46, 140, 150, 255), (95, 208, 216, 255), (255, 255, 255, 255)
RED, RED_D = (232, 67, 58, 255), (110, 40, 40, 255)
BLADE = (196, 201, 207, 170)


def paint(frame: int) -> Image.Image:
    img = Image.new('RGBA', (W, H))
    px = img.load()

    def put(x: int, y: int, c) -> None:
        if 0 <= x < W and 0 <= y < H:
            px[x, y] = c

    # rotor arms and hubs
    for x in range(4, 20):
        put(x, 7, IRON)
    for hx in (4, 19):
        for dx in (-1, 0, 1):
            put(hx + dx, 5, SLATE)
            put(hx + dx, 6, IRON)
        put(hx, 5, STEEL)
    # copper hull: ellipse lit from the top-left
    cx, cy, rx, ry = 11.5, 11.5, 7.0, 5.0
    for y in range(H):
        for x in range(W):
            nx, ny = (x - cx) / rx, (y - cy) / ry
            if nx * nx + ny * ny <= 1:
                shade = nx * 0.6 + ny
                put(x, y, BRASS if shade < -0.75 else COPPER if shade < 0.45 else COPPER_D)
    # riveted belly plate (attachments hang below it)
    for x in range(8, 16):
        put(x, 15, SLATE)
        put(x, 16, IRON)
    put(9, 15, STEEL)
    put(14, 15, STEEL)
    # alchemical eye
    for y in range(8, 13):
        for x in range(9, 15):
            d = (x - 11.5) ** 2 + (y - 10.5) ** 2
            if d <= 6.5:
                put(x, y, TEAL_D if d > 3.2 else TEAL)
    put(11, 9, WHITE)
    # beacon on top blinks every other frame
    put(11, 6, RED if frame % 2 == 0 else RED_D)
    put(12, 6, RED_D)
    # outline everything solid
    solid = [[px[x, y][3] == 255 for x in range(W)] for y in range(H)]
    for y in range(H):
        for x in range(W):
            if solid[y][x]:
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and solid[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = OUTLINE
    # rotor blades on top of the outline: long / short alternate to read as spinning
    span = (5, 2, 4, 1)[frame]
    for hx in (4, 19):
        for dx in range(-span, span + 1):
            put(hx + dx, 4, BLADE)
        put(hx, 4, STEEL)
    return img


def outline(img: Image.Image, skip=None) -> Image.Image:
    """Adds a 1px dark outline around solid pixels (skip: pixels already owned by the hull)."""
    px = img.load()
    solid = [[px[x, y][3] == 255 for x in range(W)] for y in range(H)]
    for y in range(H):
        for x in range(W):
            if solid[y][x] or (skip and skip[x, y][3]):
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and solid[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = OUTLINE
    return img


def part(pixels: dict, hull: Image.Image) -> Image.Image:
    img = Image.new('RGBA', (W, H))
    px = img.load()
    for (x, y), c in pixels.items():
        if 0 <= x < W and 0 <= y < H:
            px[x, y] = c
    return outline(img, hull.load())


def claw(_f: int) -> dict:
    return {(x, y): STEEL for x, y in ((9, 17), (9, 18), (10, 19), (14, 17), (14, 18), (13, 19), (11, 17), (12, 17))}


def magnet(_f: int) -> dict:
    """Red horseshoe magnet with steel tips under the hull."""
    red, red_d = (214, 60, 52, 255), (140, 34, 34, 255)
    px = {}
    for y in range(17, 21):
        px[(8, y)] = red_d if y > 18 else red
        px[(9, y)] = red
        px[(14, y)] = red
        px[(15, y)] = red_d if y > 18 else red
    for x in range(8, 16):
        px[(x, 17)] = red
    for x in (8, 9, 14, 15):
        px[(x, 21)] = STEEL
    return px


def cargo(_f: int) -> dict:
    """A riveted cargo crate strapped on the right side of the hull."""
    wood, wood_d, strap = (176, 120, 62, 255), (120, 78, 40, 255), (58, 63, 76, 255)
    px = {}
    for y in range(10, 16):
        for x in range(19, 23):
            px[(x, y)] = wood_d if y == 15 or x == 22 else wood
    for y in range(10, 16):
        px[(20, y)] = strap
    px[(19, 10)] = BRASS
    return px


def servos(f: int) -> dict:
    """Calibrated servos: brass rings around both rotor hubs that spin with the blades."""
    px = {}
    for hx in (4, 19):
        for dx in (-2, 2):
            px[(hx + dx, 6)] = BRASS
        px[(hx, 7)] = COPPER if f % 2 else BRASS
    return px


def bay(f: int) -> dict:
    """Drone bay upgrade: teal running lights on both flanks that pulse."""
    on, off = TEAL, TEAL_D
    return {(5, 11): on if f % 2 == 0 else off, (5, 12): off, (18, 11): off if f % 2 == 0 else on, (18, 12): off}


PARTS = {'claw': claw, 'magnet': magnet, 'cargo': cargo, 'servos': servos, 'bay': bay}


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    frames = [paint(f) for f in range(4)]
    sheet = Image.new('RGBA', (W * 4, H))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * W, 0))
    sheet.save(OUT / 'drone.png')
    for name, paint_part in PARTS.items():
        strip = Image.new('RGBA', (W * 4, H))
        for i, f in enumerate(frames):
            strip.alpha_composite(part(paint_part(i), f), (i * W, 0))
        strip.save(OUT / f'drone-{name}.png')
    icon = Image.new('RGBA', (24, 24))
    icon.alpha_composite(frames[0], (0, 1))
    icon.alpha_composite(part(claw(0), frames[0]), (0, 1))
    icon.save(OUT / 'drone-icon.png')
    print('drone 4 frames', (W, H))
