"""Adult take on the hero reference: smaller head, longer body, small eyes, weathered palette.

Pixelizes head, body and wrench of the reference separately at different cell sizes, composes
them into assets-src/sprites/hero_base.png (49x66) for tools/bake-sprites.py. Needs Pillow.
Usage: python tools/adultify-hero.py <reference.png>
"""
import colorsys
import importlib.util
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('pixelize', ROOT / 'tools' / 'pixelize-ref.py')
pixelize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pixelize)

TMP = ROOT / '.snapshots' / 'adult'
OUT = ROOT / 'assets-src' / 'sprites' / 'hero_base.png'
W, H = 49, 66


def weather(img: Image.Image) -> Image.Image:
    """Desaturates and warms the palette so the hero sits in the dusty yard."""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            s *= 0.72
            l = l * 0.94 + 0.02
            r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
            px[x, y] = (min(255, int(r2 * 255 + 6)), int(g2 * 255 + 2), max(0, int(b2 * 255 - 6)), 255)
    return img


def small_eyes(head: Image.Image) -> None:
    """Anime eyes (teal/white blocks in the face) become a dark dot plus skin."""
    px = head.load()
    for y in range(head.height // 2, head.height):
        for x in range(head.width):
            r, g, b, a = px[x, y]
            teal = a and g > 80 and b > 80 and r < 60
            white = a and r > 200 and g > 200 and b > 190
            if teal or white:
                px[x, y] = (40, 30, 40, 255) if teal else (226, 160, 120, 255)


def eye_dots(head: Image.Image) -> None:
    """Re-adds one dark pixel per eye where the old pupils sat (darkest pixel per side in the eye band)."""
    px = head.load()
    band = range(head.height // 2, head.height - 3)
    for side in (range(0, head.width // 2), range(head.width // 2, head.width)):
        best = None
        for y in band:
            for x in side:
                r, g, b, a = px[x, y]
                if a and r < 40 and g < 60 and b > 30 and (best is None or b > best[2]):
                    best = (x, y, b)
        if best:
            px[best[0], best[1]] = (30, 24, 34, 255)


def main(ref: str) -> None:
    TMP.mkdir(parents=True, exist_ok=True)
    src = Image.open(ref).convert('RGBA')
    ImageDraw.Draw(src).rectangle((780, 0, src.width, 290), fill=(0, 0, 0, 0))  # floating spell circle
    clean = TMP / 'clean.png'
    src.save(clean)
    pixelize.run(str(clean), (186, 219, 780, 625), 27, 18, 40, str(TMP / 'head.png'))
    pixelize.run(str(clean), (186, 625, 780, 1304), 35, 47, 40, str(TMP / 'body.png'))
    pixelize.run(str(clean), (780, 370, 1009, 1000), 14, 37, 40, str(TMP / 'wrench.png'))
    head = Image.open(TMP / 'head.png')
    eye_dots(head)
    small_eyes(head)
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(Image.open(TMP / 'body.png'), (0, 19))
    out.alpha_composite(head, (4, 1))
    out.alpha_composite(Image.open(TMP / 'wrench.png'), (34, 5))
    weather(out).save(OUT)
    out.resize((W * 6, H * 6), Image.Resampling.NEAREST).save(TMP / 'hero_base_x6.png')
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
