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
    # riveted belly plate and claw prongs
    for x in range(8, 16):
        put(x, 15, SLATE)
        put(x, 16, IRON)
    put(9, 15, STEEL)
    put(14, 15, STEEL)
    for x, y in ((9, 17), (9, 18), (10, 19), (14, 17), (14, 18), (13, 19)):
        put(x, y, STEEL)
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


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    frames = [paint(f) for f in range(4)]
    sheet = Image.new('RGBA', (W * 4, H))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * W, 0))
    sheet.save(OUT / 'drone.png')
    icon = Image.new('RGBA', (24, 24))
    icon.alpha_composite(frames[0], (0, 1))
    icon.save(OUT / 'drone-icon.png')
    print('drone 4 frames', (W, H))
