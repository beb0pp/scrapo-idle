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
# base art (assets-src/sprites/hero_base.png, 49x66 from tools/adultify-hero.py) sits feet-down at frame row 70
HERO_AT = (11, 4)
HAND = (36, 27)  # where the hand grips the wrench in the base art
LEG_Y = 48  # first row of the legs in the base art
WRENCH_PIVOT = (HAND[0] + HERO_AT[0], HAND[1] + HERO_AT[1])

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


HAIR_DARK, HAIR_MID = (59, 49, 62, 255), (89, 78, 90, 255)


def back_view(base: Image.Image) -> Image.Image:
    """Seen from behind: the face area becomes the back of the hair, then the art is mirrored."""
    out = base.copy()
    px = out.load()
    for y in range(6, 25):
        for x in range(10, 31):
            r, g, b, a = px[x, y]
            if not a:
                continue
            skin = r > 170 and g > 110 and b < 175 and r - b > 60
            eye = (g > 140 and b > 140 and r < 140) or (r < 40 and b > r + 30)
            white = r > 190 and g > 170 and b > 150
            if skin or eye or white:
                px[x, y] = HAIR_MID if (x + y) % 3 else HAIR_DARK
    return out.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


SKIN = (226, 160, 120, 255)


def side_view(base: Image.Image) -> Image.Image:
    """Turned toward the wrench side: head shifted forward (hair stays behind), far eye hidden, torso narrowed."""
    out = Image.new('RGBA', base.size)
    torso = base.crop((0, 19, base.width, base.height))
    # drop 4 columns from the back of the torso so the body reads narrower in profile
    narrow = Image.new('RGBA', torso.size)
    narrow.alpha_composite(torso.crop((0, 0, 8, torso.height)), (4, 0))
    narrow.alpha_composite(torso.crop((12, 0, torso.width, torso.height)), (12, 0))
    out.alpha_composite(narrow, (0, 19))
    head = base.crop((0, 0, base.width, 19))
    out.alpha_composite(head, (0, 0))
    out.alpha_composite(head.crop((8, 0, 34, 19)), (10, 0))
    px = out.load()
    for y in range(11, 18):
        for x in range(14, 22):
            r, g, b, a = px[x, y]
            if a and r < 60 and g < 60 and b < 70:
                left, right = px[x - 1, y], px[x + 1, y]
                if left[0] > 180 or right[0] > 180:
                    px[x, y] = SKIN
    return out


def hero_frames(base: Image.Image | None = None) -> list[Image.Image]:
    """25 frames of the hero; with an overlay image (see hero_gear.py) the same poses for that item."""
    base = base if base is not None else Image.open(SRC / 'hero_base.png').convert('RGBA')
    front = build_hero(base)
    back = build_hero(back_view(base), wrench_side='left')
    side = build_hero(side_view(base))
    # 0-14 front set, 15-19 back set (idle, walk x4), 20-24 side set (idle, walk x4)
    return front + [back[0], back[2], back[3], back[4], back[5]] + [side[0], side[2], side[3], side[4], side[5]]


def build_hero(base: Image.Image, wrench_side: str = 'right') -> list[Image.Image]:
    in_wrench = (lambda x, y: x >= 34 and y <= 40) if wrench_side == 'right' else (lambda x, y: x <= 14 and y <= 40)
    wrench = region(base, in_wrench)
    upper = region(base, lambda x, y: y < LEG_Y and not in_wrench(x, y))
    mid = 21 if wrench_side == 'right' else 28
    leg_l = region(base, lambda x, y: y >= LEG_Y and x < mid)
    leg_r = region(base, lambda x, y: y >= LEG_Y and x >= mid)
    W, U, L, R = (place(p, HERO_FRAME, HERO_AT) for p in (wrench, upper, leg_l, leg_r))
    pv = WRENCH_PIVOT if wrench_side == 'right' else (49 - 1 - HAND[0] + HERO_AT[0], HAND[1] + HERO_AT[1])

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
    # one aligned overlay sheet (and portrait) per visible piece of gear
    from hero_gear import GEAR
    base = Image.open(SRC / 'hero_base.png').convert('RGBA')
    (OUT / 'gear').mkdir(exist_ok=True)
    for item, paint in GEAR.items():
        frames = hero_frames(paint(base))
        sheet(frames).save(OUT / 'gear' / f'{item}.png')
        frames[0].save(OUT / 'gear' / f'{item}-portrait.png')
    print('gear', len(GEAR), 'overlays -> public/sprites/gear/')
    print('hero', len(hero), 'frames', HERO_FRAME, '-> public/sprites/hero.png')
