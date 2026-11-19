"""Bakes hero and dog sprite sheets from the pixelized reference art.

Inputs: assets-src/sprites/hero_base.png (49x64) and dog_base.png (30x32), made with tools/pixelize-ref.py.
Outputs: public/sprites/hero.png, dog.png, hero-portrait.png. Needs Pillow: `python tools/bake-sprites.py`.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'sprites'
OUT = ROOT / 'public' / 'sprites'

HERO_FRAME = (64, 72)
HERO_AT = (11, 6)  # where the base art sits inside a frame
WRENCH_PIVOT = (35 + HERO_AT[0], 36 + HERO_AT[1])

DOG_FRAME = (32, 34)
DOG_AT = (1, 2)


def region(img: Image.Image, keep) -> Image.Image:
    out = Image.new('RGBA', img.size)
    src, dst = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            if keep(x, y):
                dst[x, y] = src[x, y]
    return out


def place(layer: Image.Image, frame: tuple[int, int], at: tuple[int, int]) -> Image.Image:
    canvas = Image.new('RGBA', frame)
    canvas.alpha_composite(layer, at)
    return canvas


def compose(frame: tuple[int, int], parts: list) -> Image.Image:
    """parts: (layer already in frame space, dx, dy, angle, pivot) drawn in order."""
    out = Image.new('RGBA', frame)
    for layer, dx, dy, angle, pivot in parts:
        moved = layer
        if angle:
            moved = moved.rotate(angle, resample=Image.Resampling.NEAREST, center=pivot)
        shifted = Image.new('RGBA', frame)
        shifted.paste(moved, (dx, dy), moved)
        out.alpha_composite(shifted)
    return out


def hero_frames() -> list[Image.Image]:
    base = Image.open(SRC / 'hero_base.png').convert('RGBA')
    wrench = region(base, lambda x, y: x >= 34 and y <= 43)
    upper = region(base, lambda x, y: y < 50 and not (x >= 34 and y <= 43))
    leg_l = region(base, lambda x, y: y >= 50 and x < 21)
    leg_r = region(base, lambda x, y: y >= 50 and x >= 21)
    W, U, L, R = (place(p, HERO_FRAME, HERO_AT) for p in (wrench, upper, leg_l, leg_r))
    pv = WRENCH_PIVOT

    def pose(up=(0, 0), wr=(0, 0, 0), ll=(0, 0), lr=(0, 0)) -> Image.Image:
        return compose(HERO_FRAME, [
            (L, ll[0], ll[1], 0, None),
            (R, lr[0], lr[1], 0, None),
            (U, up[0], up[1], 0, None),
            (W, wr[0], wr[1], wr[2], pv),
        ])

    frames = [
        pose(),                                        # 0 idle
        pose(up=(0, 1), wr=(0, 1, 0)),                 # 1 idle breathe
        pose(up=(0, -1), wr=(0, -1, 4), ll=(0, -2)),   # 2 walk: left foot up
        pose(),                                        # 3 walk: pass
        pose(up=(0, -1), wr=(0, -1, -4), lr=(0, -2)),  # 4 walk: right foot up
        pose(up=(0, 1), wr=(0, 1, 0)),                 # 5 walk: pass low
        pose(up=(-1, 0), wr=(-1, 0, 28)),              # 6 attack windup (wrench back)
        pose(up=(1, 1), wr=(2, 1, -72)),               # 7 attack impact (wrench forward/down)
        pose(up=(1, 0), wr=(1, 0, -40)),               # 8 attack follow-through
        pose(up=(0, 3), wr=(1, 3, -62)),               # 9 collect: crouch, wrench strikes
        pose(up=(0, 2), wr=(0, 2, -18)),               # 10 collect: lift
        pose(up=(-2, 1), wr=(-2, 1, 16), ll=(-1, 0), lr=(-1, 0)),  # 11 hurt recoil
        pose(up=(1, 1), wr=(1, 1, -30)),               # 12 dash lean (rotated below)
        pose(up=(0, -1), wr=(0, -3, 12)),              # 13 cast: raise the focus
        pose(up=(0, -1), wr=(0, -4, 6)),               # 14 cast: hold
    ]
    frames[12] = frames[12].rotate(-10, resample=Image.Resampling.NEAREST, center=(32, 70))
    return frames


def dog_frames() -> list[Image.Image]:
    base = Image.open(SRC / 'dog_base.png').convert('RGBA')
    head = region(base, lambda x, y: x >= 12 and y <= 15)
    body = region(base, lambda x, y: y < 25 and not (x >= 12 and y <= 15))
    back = region(base, lambda x, y: y >= 25 and x <= 11)
    front = region(base, lambda x, y: y >= 25 and x >= 12)
    H, B, K, F = (place(p, DOG_FRAME, DOG_AT) for p in (head, body, back, front))

    def pose(hd=(0, 0), bd=(0, 0), bk=(0, 0), fr=(0, 0)) -> Image.Image:
        return compose(DOG_FRAME, [
            (K, bk[0], bk[1], 0, None),
            (F, fr[0], fr[1], 0, None),
            (B, bd[0], bd[1], 0, None),
            (H, hd[0] + bd[0], hd[1] + bd[1], 0, None),
        ])

    return [
        pose(),                                               # 0 idle
        pose(hd=(0, 1)),                                      # 1 idle breathe
        pose(bd=(0, -1), bk=(-1, 0), fr=(1, -1)),             # 2 run: reach
        pose(bd=(0, -1)),                                     # 3 run: gather
        pose(bd=(0, 0), bk=(1, -1), fr=(-1, 0)),              # 4 run: push
        pose(),                                               # 5 run: land
        pose(hd=(2, 1), bd=(1, 0)),                           # 6 bite lunge
        pose(hd=(3, 2), bd=(1, 0), fr=(1, 0)),                # 7 bite snap
        pose(hd=(1, 4), bd=(0, 1)),                           # 8 fetch: nose down
    ]


def sheet(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        out.alpha_composite(f, (i * w, 0))
    return out


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    hero = hero_frames()
    sheet(hero).save(OUT / 'hero.png')
    sheet(dog_frames()).save(OUT / 'dog.png')
    hero[0].save(OUT / 'hero-portrait.png')
    print('hero', len(hero), 'frames', HERO_FRAME, '-> public/sprites/hero.png')
