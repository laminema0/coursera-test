"""inkline — hand-drawn-looking line rendering for the Deadpan Line style.

Draws wobbly, pressure-tapered strokes and wobbly fills with PIL on a
supersampled canvas. Every stroke is seeded, so the same drawing renders
identically on every frame (the style forbids line boil).
"""
import math
import zlib

import numpy as np
from PIL import ImageDraw


def seed_of(name):
    return zlib.crc32(str(name).encode())


def catmull(pts, n=10, closed=False):
    P = [np.asarray(p, float) for p in pts]
    if len(P) < 2:
        return np.array(P)
    P = ([P[-1]] + P + [P[0], P[1]]) if closed else ([P[0]] + P + [P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[1] if closed else P[-2])
    return np.array(out)


def densify(pts, n=6):
    pts = np.asarray(pts, float)
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(a + (b - a) * t)
    return np.array(out)


def ellipse(cx, cy, rx, ry, a0=0, a1=360, steps=28, rot=0):
    ts = np.radians(np.linspace(a0, a1, steps))
    x, y = rx * np.cos(ts), ry * np.sin(ts)
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return np.stack([cx + x * c - y * s, cy + x * s + y * c], 1)


def _arclen(p):
    return np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))])


def _normals(p):
    d = np.gradient(p, axis=0)
    d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
    return np.stack([-d[:, 1], d[:, 0]], 1)


def wobble(p, amp, seed):
    if amp <= 0 or len(p) < 3:
        return p
    rng = np.random.default_rng(seed)
    s = _arclen(p)
    ph = rng.uniform(0, 2 * np.pi, 2)
    off = amp * (0.65 * np.sin(s / 45 + ph[0]) + 0.35 * np.sin(s / 12 + ph[1]))
    return p + _normals(p) * off[:, None]


class Ink:
    """Draw onto a supersampled PIL image using unscaled coordinates."""

    def __init__(self, img, ss=2):
        self.d = ImageDraw.Draw(img)
        self.ss = ss

    def _poly(self, p, color):
        self.d.polygon([(float(x) * self.ss, float(y) * self.ss) for x, y in p], fill=color)

    def _ribbon(self, p, w, color, taper, seed):
        if len(p) < 2:
            return
        s = _arclen(p)
        u = s / (s[-1] or 1)
        k = np.ones_like(u)
        if taper > 0:
            k = np.clip(np.minimum(u, 1 - u) / taper, 0, 1)
            k = 0.3 + 0.7 * k * k * (3 - 2 * k)
        rng = np.random.default_rng(seed + 7)
        hw = w / 2 * k * (1 + 0.12 * np.sin(s / 30 + rng.uniform(0, 6.28)))
        n = _normals(p)
        self._poly(np.vstack([p + n * hw[:, None], (p - n * hw[:, None])[::-1]]), color)

    def path(self, pts, smooth=True, closed=False, amp=1.0, seed=0, n=8):
        p = np.asarray(pts, float)
        if closed:
            p = catmull(p, n, closed=True) if smooth else np.vstack([p, p[:1]])
        elif smooth and len(p) > 2:
            p = catmull(p, n)
        else:
            p = densify(p)
        return wobble(p, amp, seed)

    def line(self, pts, w=3, color="#1A1A1A", smooth=True, amp=1.0, seed=0,
             taper=0.15, overshoot=0.0):
        p = self.path(pts, smooth=smooth, amp=amp, seed=seed)
        if overshoot:
            rng = np.random.default_rng(seed + 3)
            a, b = rng.uniform(0, overshoot, 2)
            d0 = p[0] - p[1]
            d1 = p[-1] - p[-2]
            p = np.vstack([p[0] + d0 / (np.linalg.norm(d0) + 1e-9) * a, p,
                           p[-1] + d1 / (np.linalg.norm(d1) + 1e-9) * b])
        self._ribbon(p, w, color, taper, seed)
        return p

    def shape(self, pts, w=3, color="#1A1A1A", fill="#FFFFFF", smooth=True,
              amp=1.0, seed=0, outline=True):
        """Closed wobbly shape: fill, then a stroke that overlaps its start a bit."""
        p = self.path(pts, smooth=smooth, closed=True, amp=amp, seed=seed)
        if fill:
            self._poly(p, fill)
        if outline and w > 0:
            extra = max(2, len(p) // 25)
            self._ribbon(np.vstack([p, p[1:extra]]), w, color, 0.03, seed)
        return p

    def blob(self, cx, cy, rx, ry, color="#0D0D0D", rot=0, seed=0, amp=0.6):
        return self.shape(ellipse(cx, cy, rx, ry, 0, 360, 18, rot)[:-1], w=0,
                          fill=color, amp=amp, seed=seed, outline=False)

    def seg(self, a, b, w=2.5, color="#808080", seed=0, amp=1.3, overshoot=3):
        return self.line([a, b], w=w, color=color, amp=amp, seed=seed,
                         taper=0.08, overshoot=overshoot)

    def rect(self, x0, y0, x1, y1, w=2.5, color="#808080", seed=0, amp=1.3):
        for i, (a, b) in enumerate((((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                                    ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0)))):
            self.seg(a, b, w, color, seed + i, amp)


# ---- hand-lettered capitals (strokes in a 1-tall box; "s" = smooth stroke) ----
_P = [(0, 1), (0, 0), (0.45, 0), (0.62, 0.12), (0.62, 0.36), (0.45, 0.5), (0, 0.5)]
LETTERS = {
    "A": (0.7, [[(0, 1), (0.35, 0), (0.7, 1)], [(0.15, 0.62), (0.55, 0.62)]]),
    "B": (0.66, [[(0, 0), (0, 1), (0.5, 1), (0.66, 0.86), (0.66, 0.64), (0.5, 0.5), (0, 0.5)],
                 [(0, 0), (0.45, 0), (0.6, 0.12), (0.6, 0.36), (0.45, 0.5)]]),
    "D": (0.66, [[(0, 0), (0, 1), (0.4, 1), (0.66, 0.75), (0.66, 0.25), (0.4, 0), (0, 0)]]),
    "E": (0.58, [[(0.58, 0), (0, 0), (0, 1), (0.58, 1)], [(0, 0.5), (0.45, 0.5)]]),
    "H": (0.62, [[(0, 0), (0, 1)], [(0.62, 0), (0.62, 1)], [(0, 0.5), (0.62, 0.5)]]),
    "I": (0.12, [[(0.06, 0), (0.06, 1)]]),
    "L": (0.55, [[(0, 0), (0, 1), (0.55, 1)]]),
    "M": (0.82, [[(0, 1), (0, 0), (0.41, 0.6), (0.82, 0), (0.82, 1)]]),
    "N": (0.66, [[(0, 1), (0, 0), (0.66, 1), (0.66, 0)]]),
    "O": (0.7, [("s", [(0.35, 0), (0.68, 0.25), (0.66, 0.78), (0.33, 1), (0.02, 0.75), (0.03, 0.22), (0.36, 0.01)])]),
    "P": (0.62, [_P]),
    "R": (0.66, [_P, [(0.3, 0.5), (0.66, 1)]]),
    "S": (0.62, [("s", [(0.6, 0.1), (0.32, 0), (0.05, 0.18), (0.3, 0.48), (0.6, 0.72), (0.38, 1), (0, 0.9)])]),
    "T": (0.7, [[(0, 0), (0.7, 0)], [(0.35, 0), (0.35, 1)]]),
    "U": (0.62, [("s", [(0, 0), (0.01, 0.75), (0.31, 1), (0.61, 0.75), (0.62, 0)])]),
    "V": (0.7, [[(0, 0), (0.35, 1), (0.7, 0)]]),
    "C": (0.62, [("s", [(0.62, 0.12), (0.35, 0), (0.04, 0.22), (0.02, 0.75), (0.32, 1), (0.62, 0.9)])]),
    "F": (0.55, [[(0.55, 0), (0, 0), (0, 1)], [(0, 0.5), (0.42, 0.5)]]),
    "G": (0.66, [("s", [(0.62, 0.12), (0.35, 0), (0.04, 0.22), (0.02, 0.75), (0.32, 1), (0.64, 0.85)]),
                 [(0.64, 0.85), (0.64, 0.55), (0.38, 0.55)]]),
    "K": (0.62, [[(0, 0), (0, 1)], [(0.6, 0), (0, 0.55)], [(0.2, 0.42), (0.62, 1)]]),
    "W": (0.9, [[(0, 0), (0.2, 1), (0.45, 0.35), (0.7, 1), (0.9, 0)]]),
    "X": (0.62, [[(0, 0), (0.62, 1)], [(0.62, 0), (0, 1)]]),
    "Y": (0.66, [[(0, 0), (0.33, 0.5), (0.66, 0)], [(0.33, 0.5), (0.33, 1)]]),
    "Z": (0.6, [[(0, 0), (0.6, 0), (0, 1), (0.6, 1)]]),
    "~": (0.5,[("s", [(0, 0.58), (0.13, 0.46), (0.27, 0.58), (0.4, 0.5), (0.5, 0.44)])]),
    ",": (0.12, [[(0.08, 0.86), (0.02, 1.08)]]),
    ".": (0.12, [[(0.05, 0.95), (0.07, 0.97)]]),
    "!": (0.12, [[(0.06, 0), (0.06, 0.72)], [(0.05, 0.95), (0.07, 0.97)]]),
    " ": (0.4, []),
}


def text_width(text, h, spacing=0.22):
    return sum((LETTERS[c][0] + spacing) * h for c in text) - spacing * h


def letter_strokes(text, x, y, h, spacing=0.22, seed=0):
    """Yield (pts, smooth, seed) per stroke, in canvas coordinates."""
    rng = np.random.default_rng(seed)
    for i, ch in enumerate(text):
        width, strokes = LETTERS[ch]
        sh = h * rng.uniform(0.92, 1.06)
        dy = rng.uniform(-0.04, 0.04) * h
        for j, st in enumerate(strokes):
            smooth = isinstance(st, tuple)
            pts = st[1] if smooth else st
            yield ([(x + px * sh, y + dy + (py - 1) * sh + h) for px, py in pts],
                   smooth, seed + i * 31 + j)
        x += (width + spacing) * h


def letters(ink, text, x, y, h, w=3, color="#333333", hollow=False, seed=0):
    strokes = list(letter_strokes(text, x, y, h, seed=seed))
    passes = [(w, color), (w * 0.45, "#FFFFFF")] if hollow else [(w, color)]
    for pw, pc in passes:
        for pts, smooth, sd in strokes:
            ink.line(pts, w=pw, color=pc, smooth=smooth, amp=0.8, seed=sd, taper=0.1 if not hollow else 0.0)
