"""Palette-first downscale: quantize the big image, then take the modal palette index per cell."""
import sys
from collections import Counter
from PIL import Image


def run(path: str, box: tuple[int, int, int, int], out_w: int, out_h: int, colors: int, dst: str) -> None:
    src = Image.open(path).convert('RGBA').crop(box)
    alpha = src.getchannel('A')
    q = src.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()
    qp, ap = q.load(), alpha.load()
    bw, bh = src.width / out_w, src.height / out_h
    out = Image.new('RGBA', (out_w, out_h))
    op = out.load()
    for j in range(out_h):
        for i in range(out_w):
            votes: Counter = Counter()
            opaque = total = 0
            for y in range(int((j + 0.25) * bh), int((j + 0.75) * bh) + 1):
                for x in range(int((i + 0.25) * bw), int((i + 0.75) * bw) + 1):
                    if x >= src.width or y >= src.height:
                        continue
                    total += 1
                    if ap[x, y] > 128:
                        opaque += 1
                        votes[qp[x, y]] += 1
            if not total or opaque * 2 < total:
                continue
            k = votes.most_common(1)[0][0]
            op[i, j] = (pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2], 255)
    out.save(dst)
    out.resize((out_w * 8, out_h * 8), Image.Resampling.NEAREST).save(dst.replace('.png', '_x8.png'))


if __name__ == '__main__':
    b = tuple(int(v) for v in sys.argv[2].split(','))
    run(sys.argv[1], b, int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6])
