#!/usr/bin/env python3
"""EP01 "Berlinovo Apartment" — build the episode MP4 from the voice recording.

    python3 build.py [OUT.mp4]

Inputs (next to this file): voice.m4a, subs.json. Everything is drawn in code
following ../../DESIGN.md, ../../ANIMATION.md and ../../characters/panda.md.
"""
import json
import math
import os
import random
import subprocess
import sys
import tempfile
import textwrap
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from inkline import Ink, ellipse, letters, seed_of, text_width  # noqa: E402

TOK = json.load(open(os.path.join(ROOT, "tokens.json")))
COL = TOK["color"]
CHAR, FILL, BGC, BGD = COL["inkCharacter"], COL["inkFill"], COL["inkBackground"], COL["inkBgDetail"]
WHITE = "#FFFFFF"

FPS = 24
SS = 2
FW, FH = TOK["canvas"]["width"], TOK["canvas"]["height"]
BW, BH = 1080, 720
BAND_Y = TOK["band"]["top"] + 2
SR = 48000

OFFSET = 3.0       # silent butt-scratch intro before the voice starts
PITCH = 1.335      # +5 semitones
DURATION = 41.0

# ---------------------------------------------------------------- timeline
SHOTS = [
    (0.0, 3.0, "butt"),
    (3.0, 8.85, "cu"),
    (8.85, 14.0, "mid"),
    (14.0, 20.0, "cu"),
    (20.0, 26.6, "mid"),
    (26.6, 32.2, "bird"),
    (32.2, 37.0, "mid"),
    (37.0, DURATION, "title"),
]
SCRATCH = (0.3, 2.8, (1.45, 1.75))          # start, end, pause
GESTURE = (22.3, 25.4)                      # right arm up / down
BIRD_IN, BIRD_LAND, BIRD_BOB = 26.75, 28.15, 28.7
LOOK_AT_BIRD = 27.6
POOF = 30.3
CHAIR_FROM = POOF + 6 / FPS
TWEET = 35.2
TITLE_FADE = (37.3, 37.9)
BLINKS = [(3.7, 2), (7.3, 2), (10.2, 2), (13.1, 2), (17.8, 2), (21.0, 2),
          (24.8, 2), (31.0, 3), (33.5, 2), (36.0, 2)]
GLANCES = [(16.4, 17.3, -1)]

# camera per shot: panda (cx, top, W) in band px
CAM = {"butt": (540, -1310, 750), "cu": (540, 60, 560), "bird": (540, 60, 300), "mid": (520, 150, 180)}
ROOM_ANCHOR = (520, 150, 180)   # panda placement in room coordinates (mid shot)


def shot_at(t):
    for a, b, name in SHOTS:
        if a <= t < b:
            return name
    return SHOTS[-1][2]


# ---------------------------------------------------------------- audio
def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def read_wav(path):
    with wave.open(path, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x


def build_audio(tmp):
    pitched = os.path.join(tmp, "voice_pitched.wav")
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(HERE, "voice.m4a"),
         "-af", f"rubberband=pitch={PITCH}", "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", pitched])
    v = read_wav(pitched)
    n = int(DURATION * SR)
    voice = np.zeros(n, np.float32)
    i0 = int(OFFSET * SR)
    voice[i0:i0 + len(v)] = v[: n - i0]

    rng = np.random.default_rng(7)
    sfx = np.zeros(n, np.float32)

    def add(t, x, gain):
        i = int(t * SR)
        if i < n:
            sfx[i:i + len(x)] += (x[: n - i] * gain).astype(np.float32)

    def burst(dur, lp=1, hp=True, decay=6.0):
        m = int(dur * SR)
        x = rng.standard_normal(m)
        if hp:
            x = np.diff(x, prepend=0)
        if lp > 1:
            x = np.convolve(x, np.ones(lp) / lp, "same")
        e = np.exp(-np.linspace(0, decay, m)) * np.minimum(1, np.linspace(0, 40, m))
        return x * e / (np.abs(x).max() + 1e-9)

    def chirp(dur, f0, f1):
        m = int(dur * SR)
        f = np.linspace(f0, f1, m)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(m)

    # butt scratching, on twos
    a, b, (pa, pb) = SCRATCH
    for k, t in enumerate(np.arange(a, b, 2 / FPS)):
        if not pa <= t < pb:
            add(t, burst(0.06, lp=3), 0.22 if k % 2 else 0.15)
    # wing flaps
    for t in np.arange(BIRD_IN, BIRD_LAND, 4 / FPS):
        add(t, burst(0.07, lp=40, hp=False), 0.35)
    # landing chirps
    add(BIRD_LAND + 0.35, chirp(0.07, 2600, 3900), 0.22)
    add(BIRD_LAND + 0.47, chirp(0.09, 3000, 4300), 0.22)
    # poof
    add(POOF, burst(0.45, lp=8, hp=False, decay=5), 0.6)
    add(POOF, chirp(0.25, 220, 60) * np.hanning(int(0.25 * SR)), 0.7)
    # the chair tweets
    for k, t in enumerate((TWEET, TWEET + 0.11, TWEET + 0.24)):
        add(t, chirp(0.07, 2800 + 300 * k, 4200), 0.2)
    # room tone
    tone = np.convolve(rng.standard_normal(n), np.ones(30) / 30, "same") * 0.004

    mix = voice + sfx + tone
    mix *= 0.9 / (np.abs(mix).max() + 1e-9)
    out = os.path.join(tmp, "mix.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    return out, voice


def lip_flap(voice):
    """Mouth shape per frame from loudness, changed on twos (ANIMATION.md §3)."""
    nf = int(DURATION * FPS)
    hop = SR // FPS
    rms = np.array([np.sqrt(np.mean(voice[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(nf)])
    ref = np.percentile(rms[rms > rms.max() * 0.05], 90)
    mouths = []
    for f in range(nf):
        f2 = f - f % 2
        r = max(rms[f2], rms[min(f2 + 1, nf - 1)]) / ref
        pick = random.Random(f2)
        if r < 0.12:
            m = "M0"
        elif r < 0.25:
            m = "M1"
        elif r < 0.5:
            m = pick.choice(["M2", "M4"])
        elif r < 0.8:
            m = pick.choice(["M2", "M5", "M3"])
        else:
            m = "M3"
        mouths.append(m)
    return mouths


# ---------------------------------------------------------------- characters
BODY_R = [(0, 0), (0.3, 0.04), (0.47, 0.22), (0.53, 0.52), (0.57, 0.74), (0.74, 0.9),
          (0.83, 1.2), (0.86, 1.9), (0.78, 2.3), (0.45, 2.5), (0, 2.53)]
BODY = BODY_R + [(-u, v) for u, v in reversed(BODY_R[1:-1])]
BACK = BODY_R[:-2] + [(0.45, 2.52), (0.2, 2.56), (0.02, 2.49), (-0.02, 2.49), (-0.2, 2.56), (-0.45, 2.52)] \
    + [(-u, v) for u, v in reversed(BODY_R[1:-2])]       # two butt cheeks
PERCH = (0.655, 0.82)          # the "shoulder" where the bird lands
ARM_POSES = {0: ((0.92, 1.5), (0.93, 2.0)), 1: ((1.0, 1.35), (1.08, 1.55)), 2: ((1.05, 1.2), (1.12, 1.05))}


def lean(u, v):
    return u + 0.04 * (1 - v / 2.5)


def panda(ink, cx, top, W, st):
    """Draw the panda. st: view, mouth, eye, pupil, arm, scratch."""
    def P(u, v):
        return (cx + lean(u, v) * W, top + v * W)

    lw = min(5.0, max(3.0, W / 110))
    dw = max(1.75, lw * 0.5)
    back = st["view"] == "back"

    for sx in (-1, 1):                                            # legs
        ink.shape(ellipse(*P(sx * 0.33, 2.6), 0.17 * W, 0.14 * W, 0, 360, 16)[:-1], lw, CHAR, FILL,
                  seed=seed_of(f"leg{sx}"))
    for sx in (-1, 1):                                            # ears
        ink.shape(ellipse(*P(sx * 0.3, 0.07), 0.12 * W, 0.115 * W, 0, 360, 16)[:-1], lw, CHAR, FILL,
                  seed=seed_of(f"ear{sx}"))
    ink.shape([P(u, v) for u, v in (BACK if back else BODY)], lw, CHAR, WHITE, seed=seed_of("body"))

    if back:
        tail = [(0.0, 2.06), (0.04, 2.04), (0.07, 2.08), (0.09, 2.12), (0.07, 2.17), (0.03, 2.2),
                (-0.02, 2.19), (-0.06, 2.17), (-0.08, 2.12), (-0.06, 2.07), (-0.03, 2.05)]
        ink.shape([P(u, v) for u, v in tail], lw, CHAR, WHITE, seed=11)          # fluffy tail
        ink.line([P(0.0, 2.27), P(0.012, 2.38), P(0.0, 2.48)], lw, CHAR, seed=12)  # crease
        for sx in (-1, 1):                                                        # cheek folds
            ink.line([P(sx * 0.32, 2.47), P(sx * 0.18, 2.5), P(sx * 0.05, 2.47)], dw, CHAR, seed=13 + sx)
        arm(ink, P, W, -1, 0)
        dx, dy = ((-0.04, -0.02), (0.05, 0.03))[st.get("scratch", 0)]
        sh, hand = P(0.74, 0.98), P(0.25 + dx, 2.28 + dy)
        ink.line([sh, P(0.98, 1.7), hand], 0.12 * W, FILL, seed=13, taper=0.12)
        ink.blob(*hand, 0.075 * W, 0.06 * W, FILL, seed=14)
        for k in range(4):                                        # curled fingers
            fx, fy = hand[0] - 0.06 * W, hand[1] + (k - 1.5) * 0.03 * W
            ink.line([(fx + 0.04 * W, fy), (fx, fy + 0.01 * W)], 0.035 * W, FILL, seed=15 + k)
        if st.get("scratch"):
            for k in range(3):
                x, y = hand[0] - 0.2 * W, hand[1] + (k - 1) * 0.07 * W
                ink.line([(x, y), (x - 0.06 * W, y + 0.01 * W)], 2.5, BGC, seed=30 + k)
        return

    for k in range(3):                                            # chest fur
        x, y = P(-0.1 + k * 0.1, 1.15)
        ink.line([(x, y), (x + 0.02 * W, y + 0.025 * W), (x + 0.04 * W, y)], dw, CHAR, seed=40 + k)
    arm(ink, P, W, -1, 0)
    arm(ink, P, W, 1, st.get("arm", 0))

    for sx in (-1, 1):                                            # eye patches
        pcx, pcy = P(sx * 0.18, 0.56)
        patch = [(-0.07, -0.06), (0.04, -0.075), (0.09, -0.01), (0.09, 0.08), (0.06, 0.17),
                 (0.02, 0.19), (-0.03, 0.12), (-0.08, 0.03)]
        ink.shape([(pcx + sx * o * W, pcy + v * W) for o, v in patch], lw * 0.6, CHAR, FILL,
                  seed=seed_of(f"patch{sx}"))
        eye(ink, pcx + sx * 0.005 * W, pcy - 0.005 * W, W, st["eye"], st.get("pupil", 0), lw)
    nx, ny = P(0.0, 0.69)
    ink.blob(nx, ny, 0.045 * W, 0.028 * W, FILL, seed=50)
    mouth(ink, *P(0.025, 0.8), W, st["mouth"], lw)


def arm(ink, P, W, sx, pose):
    ctrl, hand = ARM_POSES[pose]
    S, C, H = P(sx * 0.74, 0.98), P(sx * ctrl[0], ctrl[1]), P(sx * hand[0], hand[1])
    ink.line([S, C, H], 0.1 * W, FILL, seed=60 + sx, taper=0.12)
    ink.blob(*H, 0.07 * W, 0.06 * W, FILL, seed=61 + sx)
    d = np.subtract(H, C)
    d = d / (np.linalg.norm(d) + 1e-9)
    nrm = np.array([-d[1], d[0]])
    for k in range(3):                                            # sausage fingers
        base = np.add(H, nrm * (k - 1) * 0.035 * W)
        ink.line([base, base + d * 0.08 * W + nrm * (k - 1) * 0.015 * W], 0.035 * W, FILL,
                 seed=62 + sx * 10 + k, taper=0.3)


def eye(ink, x, y, W, state, pupil, lw):
    rx, ry = 0.042 * W, 0.03 * W
    if state == "c":
        ink.line(ellipse(x, y, rx, ry * 0.4, 15, 165, 10), max(1.5, lw * 0.5), WHITE, seed=70, amp=0.3)
        return
    if state == "q":
        ink.blob(x, y + ry * 0.5, rx * 0.9, ry * 0.35, WHITE, seed=71, amp=0.3)
        return
    half = ellipse(x, y, rx, ry, 0, 180, 14)                      # half-lid: lower half white
    ink.shape(half, 0, fill=WHITE, amp=0.3, seed=72, outline=False)
    ink.blob(x + pupil * rx * 0.5, y + ry * 0.4, 0.016 * W, 0.016 * W, FILL, seed=73, amp=0.2)


def mouth(ink, x, y, W, m, lw):
    if m == "M0":
        ink.line([(x - 0.03 * W, y), (x + 0.03 * W, y + 0.004 * W)], lw * 0.8, CHAR, seed=80)
    elif m == "M1":
        ink.blob(x, y, 0.045 * W, 0.014 * W, FILL, seed=81)
    elif m == "M2":
        ink.blob(x, y, 0.035 * W, 0.028 * W, FILL, seed=82)
    elif m == "M3":
        ink.blob(x, y + 0.01 * W, 0.06 * W, 0.05 * W, FILL, rot=-5, seed=83)
    elif m == "M4":
        ink.blob(x, y, 0.055 * W, 0.016 * W, FILL, seed=84)
        ink.blob(x - 0.01 * W, y - 0.006 * W, 0.007 * W, 0.006 * W, WHITE, seed=85, amp=0)
    elif m == "M5":
        ink.blob(x, y, 0.028 * W, 0.036 * W, FILL, seed=86)
        ink.blob(x, y, 0.011 * W, 0.017 * W, WHITE, seed=87, amp=0.2)


def perch_point(cx, top, W):
    u, v = PERCH
    return cx + lean(u, v) * W, top + v * W


def bird(ink, x, y, s, wing, sitting, bob=False):
    ink.line([(x + 1.0 * s, y - 0.1 * s), (x + 1.8 * s, y - 0.6 * s)], 2.5, CHAR, seed=90)
    ink.line([(x + 1.0 * s, y + 0.1 * s), (x + 1.85 * s, y - 0.25 * s)], 2.5, CHAR, seed=91)
    if sitting:
        for k in (-1, 1):
            ink.line([(x + k * 0.25 * s, y + 0.9 * s), (x + k * 0.3 * s, y + 1.35 * s)], 2.5, CHAR, seed=92 + k)
    ink.shape(ellipse(x, y, 1.2 * s, s, 0, 360, 16)[:-1], 3, CHAR, WHITE, seed=93)
    hx, hy = x - 0.95 * s, y - 0.75 * s + (0.18 * s if bob else 0)
    r = 0.6 * s
    ink.shape(ellipse(hx, hy, r, r, 0, 360, 14)[:-1], 3, CHAR, WHITE, seed=94)
    ink.shape([(hx - 0.85 * r, hy - 0.15 * r), (hx - 1.7 * r, hy + 0.12 * r), (hx - 0.8 * r, hy + 0.35 * r)],
              2, CHAR, FILL, smooth=False, seed=95)
    ink.blob(hx - 0.3 * r, hy - 0.15 * r, 0.13 * r, 0.13 * r, FILL, seed=96, amp=0)
    if wing == "up":
        ink.shape([(x - 0.1 * s, y - 0.3 * s), (x + 0.3 * s, y - 1.7 * s), (x + 0.75 * s, y - 1.5 * s),
                   (x + 0.7 * s, y - 0.2 * s)], 3, CHAR, WHITE, seed=97)
    elif wing == "down":
        ink.shape([(x - 0.1 * s, y + 0.1 * s), (x + 0.3 * s, y + 1.5 * s), (x + 0.75 * s, y + 1.3 * s),
                   (x + 0.7 * s, y + 0.2 * s)], 3, CHAR, WHITE, seed=98)
    else:
        ink.line([(x - 0.2 * s, y - 0.1 * s), (x + 0.3 * s, y + 0.3 * s), (x + 0.8 * s, y + 0.1 * s)],
                 2.5, CHAR, seed=99)


def chair(ink, px, py, h, ang):
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))

    def T(u, v):
        return (px + (u * c - v * s) * h, py + (u * s + v * c) * h)

    lw = 3
    ink.shape([T(-0.3, -0.5), T(-0.32, -1.0), T(0.32, -1.0), T(0.3, -0.5)], 0, fill=WHITE,
              smooth=False, outline=False, seed=100)
    for k, (a, b) in enumerate([((-0.32, 0), (-0.3, -0.44)), ((0.3, 0), (0.28, -0.44)),
                                ((-0.29, -0.2), (0.28, -0.2)),
                                ((-0.3, -0.5), (-0.32, -1.0)), ((0.3, -0.5), (0.32, -1.0)),
                                ((-0.34, -1.0), (0.34, -1.0)), ((-0.32, -0.86), (0.32, -0.86))]):
        ink.line([T(*a), T(*b)], lw, CHAR, seed=110 + k, taper=0.1)
    ink.shape([T(-0.38, -0.42), T(0.38, -0.42), T(0.36, -0.52), T(-0.36, -0.52)], lw, CHAR, WHITE,
              smooth=False, seed=120)


def poof(ink, x, y, stage):
    def cloud(cx, cy, r, sd):
        pts = []
        for i in range(18):
            a = 2 * math.pi * i / 18
            rr = r * (1.15 if i % 2 else 0.92)
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a) * 0.85))
        ink.shape(pts, 3, CHAR, WHITE, seed=sd)

    if stage == 0:
        cloud(x, y, 40, 130)
    elif stage == 1:
        cloud(x, y, 85, 131)
        for k, (dx, dy) in enumerate(((-90, -40), (95, -20), (10, 85))):
            cloud(x + dx, y + dy, 28, 132 + k)
    else:
        for k, (dx, dy, r) in enumerate(((-100, -60, 22), (110, -50, 18), (-60, 70, 16), (90, 60, 20))):
            cloud(x + dx, y + dy, r, 140 + k)
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        r0 = 70 if stage == 0 else 120
        ink.line([(x + r0 * math.cos(a), y + r0 * math.sin(a)),
                  (x + (r0 + 30) * math.cos(a), y + (r0 + 30) * math.sin(a))], 2.5, BGC, seed=150 + k)


# ---------------------------------------------------------------- backgrounds
def room(ink, cam):
    cx, top, W = cam
    ax, ay, aW = ROOM_ANCHOR
    z = W / aW

    def M(x, y):
        return ((x - ax) * z + cx, (y - ay) * z + top)

    def seg(a, b, sd, w=2.5, col=BGC):
        ink.seg(M(*a), M(*b), w, col, seed=sd)

    def rect(x0, y0, x1, y1, sd, w=2.5):
        for i, (a, b) in enumerate((((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                                    ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0)))):
            seg(a, b, sd + i, w)

    seg((-400, 560), (860, 560), 1)
    seg((-400, 567), (860, 567), 2)
    seg((860, -300), (860, 560), 3)
    seg((867, -300), (867, 563), 4)
    seg((860, 560), (1200, 740), 5)
    rect(120, 100, 370, 400, 10)
    rect(132, 112, 358, 388, 20)
    seg((245, 112), (245, 388), 30)
    seg((132, 210), (358, 210), 31)
    seg((160, 300), (200, 260), 32, 1.75, BGD)
    seg((280, 350), (325, 305), 33, 1.75, BGD)
    rect(110, 400, 380, 414, 40)
    rect(140, 440, 350, 530, 50)
    for k, x in enumerate(range(160, 340, 20)):
        seg((x, 446), (x, 524), 60 + k, 1.75)
    seg((330, 530), (330, 560), 80)
    rect(600, 140, 770, 380, 90)
    seg((680, 365), (683, 230), 100)                     # Fernsehturm poster
    seg((690, 365), (687, 230), 103)
    ink.shape(ellipse(*M(685, 215), 15 * z, 15 * z, 0, 360, 14)[:-1], 2.5, BGC, WHITE, seed=101, amp=0.6)
    seg((685, 200), (685, 160), 102)
    seg((672, 250), (698, 250), 104)
    letters(ink, "BERLIN", *M(618, 352), 16 * z, 2.0, BGC, seed=105)
    rect(805, 300, 829, 336, 110, 2)
    seg((940, 600), (1000, 600), 120)
    seg((940, 600), (950, 650), 121)
    seg((1000, 600), (990, 650), 122)
    seg((950, 650), (990, 650), 123)
    for k, (dx, h) in enumerate(((-20, 90), (0, 120), (18, 100), (30, 70))):
        ink.line([M(970, 600), M(970 + dx * 0.5, 600 - h * 0.5), M(970 + dx * 1.6, 600 - h)], 2.5, BGC,
                 seed=124 + k)
    rng = np.random.default_rng(5)
    for k in range(14):
        x, y = rng.uniform(-200, 1100), rng.uniform(580, 760)
        if rng.random() < 0.5:
            ink.blob(*M(x, y), 1.6, 1.6, BGD, seed=200 + k, amp=0)
        else:
            ink.line([M(x, y), M(x + 4, y + 5), M(x + 8, y)], 1.75, BGD, seed=200 + k)


def exterior(ink):
    seg = ink.seg
    seg((140, 110), (940, 110), seed=1)
    seg((140, 102), (940, 102), seed=2)
    seg((150, 110), (150, 600), seed=3)
    seg((930, 110), (930, 600), seed=4)
    for r in range(6):
        for c in range(10):
            x, y = 190 + c * 72, 140 + r * 64
            if r == 5 and 4 <= c <= 5:
                continue
            ink.rect(x, y, x + 40, y + 36, 2.0, BGC, seed=1000 + r * 10 + c, amp=0.8)
            if (r * 7 + c * 3) % 5 == 0:
                seg((x - 6, y + 46), (x + 46, y + 46), 2.0, BGC, seed=2000 + r * 10 + c)
    ink.rect(500, 520, 580, 600, 2.5, BGC, seed=5)
    seg((490, 515), (590, 515), seed=6)
    letters(ink, "BERLINOVO", 470, 478, 14, 1.75, BGC, seed=7)
    seg((0, 600), (1080, 600), seed=8)
    seg((0, 640), (1080, 640), seed=9)
    seg((0, 700), (1080, 700), seed=10)
    seg((80, 600), (85, 470), seed=11)
    seg((96, 600), (99, 470), seed=12)
    pts = [(90 + 70 * math.cos(a) * (1.1 if i % 2 else 0.9), 410 + 60 * math.sin(a) * (1.1 if i % 2 else 0.9))
           for i, a in enumerate(np.linspace(0, 2 * math.pi, 16, endpoint=False))]
    ink.shape(pts, 2.5, BGC, WHITE, seed=13)
    seg((1000, 640), (1000, 380), seed=14)
    seg((1000, 380), (1040, 386), seed=15)
    rng = np.random.default_rng(9)
    for k in range(12):
        ink.blob(rng.uniform(0, 1080), rng.uniform(610, 715), 1.6, 1.6, BGD, seed=300 + k, amp=0)


# ---------------------------------------------------------------- state & render
def blink_state(t):
    for bt, per in BLINKS:
        d = (t - bt) * FPS
        if 0 <= d < per:
            return "q"
        if per <= d < 2 * per:
            return "c"
        if 2 * per <= d < 3 * per:
            return "q"
    return "o"


def state(f, mouths):
    t = f / FPS
    tq = (f - f % 2) / FPS
    shot = shot_at(t)
    st = {"shot": shot, "view": "back" if shot == "butt" else "front",
          "mouth": mouths[f] if t >= OFFSET else "M0", "eye": blink_state(tq), "pupil": 0, "arm": 0}
    for a, b, p in GLANCES:
        if a <= tq < b:
            st["pupil"] = p
    if shot == "butt":
        a, b, (pa, pb) = SCRATCH
        st["scratch"] = (f // 2) % 2 if (a <= t < b and not pa <= t < pb) else 0
    if GESTURE[0] <= tq < GESTURE[1] + 4 / FPS:
        d = tq - GESTURE[0]
        u = GESTURE[1] - tq
        st["arm"] = 1 if d < 2 / FPS else (2 if u > 0 else 1)
    if shot == "bird":
        if tq >= LOOK_AT_BIRD:
            st["pupil"] = 1
        if BIRD_IN <= tq < CHAIR_FROM:
            st["bird"] = (round(tq, 3),)
        if POOF <= tq < POOF + 10 / FPS:
            st["poof"] = min(2, int((tq - POOF) * FPS // 3))
    if tq >= CHAIR_FROM and shot in ("bird", "mid"):
        jig = 0
        if TWEET <= tq < TWEET + 0.4:
            jig = 4 if int((tq - TWEET) * FPS / 2) % 2 == 0 else -4
            st["tweet"] = 1
        st["chair"] = jig
        if tq >= TWEET + 0.1:
            st["pupil"] = 1
    return st


def bird_pos(t, cam):
    cx, top, W = cam
    px, py = perch_point(cx, top, W)
    s = 0.07 * W
    tx, ty = px, py - 1.3 * s
    if t < BIRD_LAND:
        k = (t - BIRD_IN) / (BIRD_LAND - BIRD_IN)
        e = 1 - (1 - k) ** 2
        x = 1150 + (tx - 1150) * e
        y = 40 + (ty - 40) * e - math.sin(k * math.pi * 3) * 25 * (1 - k)
        wing = "up" if int(t * FPS / 2) % 2 == 0 else "down"
        return x, y, s, wing, False, False
    bob = BIRD_BOB <= t < BIRD_BOB + 4 / FPS
    return tx, ty, s, "fold", True, bob


_bg_cache = {}


def background(shot):
    if shot not in _bg_cache:
        img = Image.new("RGB", (BW * SS, BH * SS), WHITE)
        ink = Ink(img, SS)
        if shot == "title":
            exterior(ink)
        else:
            room(ink, CAM[shot])
        _bg_cache[shot] = img
    return _bg_cache[shot]


def render_band(st):
    shot = st["shot"]
    img = background(shot).copy()
    if shot == "title":
        return img.resize((BW, BH), Image.LANCZOS)
    ink = Ink(img, SS)
    cx, top, W = CAM[shot]
    panda(ink, cx, top, W, st)
    if "chair" in st:
        px, py = perch_point(cx, top, W)
        chair(ink, px, py + 0.02 * W, 0.68 * W, 22 + st["chair"])
        if st.get("tweet"):
            for k in range(3):
                a = -1.2 + k * 0.35
                x0, y0 = px + 0.25 * W, py - 0.55 * W
                ink.line([(x0 + 20 * math.cos(a), y0 + 20 * math.sin(a)),
                          (x0 + 40 * math.cos(a), y0 + 40 * math.sin(a))], 2.5, BGC, seed=160 + k)
    if "bird" in st:
        bird(ink, *bird_pos(st["bird"][0], CAM[shot]))
    if "poof" in st:
        px, py = perch_point(cx, top, W)
        poof(ink, px + 0.05 * W, py - 0.25 * W, st["poof"])
    return img.resize((BW, BH), Image.LANCZOS)


def title_layer():
    img = Image.new("RGB", (FW * SS, FH * SS), WHITE)
    ink = Ink(img, SS)
    for text, y, h, w, col, hollow in (("PANDA", 250, 110, 16, "#555555", True),
                                       ("~BERLINOVO APARTMENT~", 400, 34, 3, "#555555", False),
                                       ("MORE SOON, BROTHER.", 1500, 46, 3.5, "#333333", False)):
        letters(ink, text, (FW - text_width(text, h)) / 2, y, h, w, col, hollow=hollow, seed=seed_of(text))
    return np.asarray(img.resize((FW, FH), Image.LANCZOS)).astype(np.float32)


def load_font(size):
    for path in ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "Arial.ttf",
                 "/System/Library/Fonts/Supplemental/Arial.ttf", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "ep01-berlinovo-apartment.mp4")
    subs = [s for s in json.load(open(os.path.join(HERE, "subs.json"))) if s["text"].strip()]
    s_tok = TOK["subtitle"]
    font = load_font(s_tok["size"])
    tmp = tempfile.mkdtemp()
    mix, voice = build_audio(tmp)
    mouths = lip_flap(voice)
    title = title_layer()

    nf = int(DURATION * FPS)
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{FW}x{FH}", "-r", str(FPS), "-i", "-", "-i", mix,
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", out],
                           stdin=subprocess.PIPE)
    last_key, band = None, None
    for f in range(nf):
        t = f / FPS
        st = state(f, mouths)
        key = json.dumps(st, sort_keys=True)
        if key != last_key:
            band, last_key = render_band(st), key
        frame = Image.new("RGB", (FW, FH), WHITE)
        frame.paste(band, (0, BAND_Y))
        vt = t - OFFSET
        for s in subs:
            if s["start"] <= vt < s["end"]:
                d = ImageDraw.Draw(frame)
                for i, line in enumerate(textwrap.wrap(s["text"], s_tok["maxCharsPerLine"])[: s_tok["maxLines"]]):
                    d.text((FW / 2, s_tok["top"] + i * s_tok["size"] * s_tok["lineHeight"]), line,
                           font=font, fill=COL["inkSubtitle"], anchor="mt")
        if shot_at(t) == "title":
            a = np.clip((t - TITLE_FADE[0]) / (TITLE_FADE[1] - TITLE_FADE[0]), 0, 1)
            if a > 0:
                fr = np.asarray(frame).astype(np.float32)
                fr = np.minimum(fr, fr * (1 - a) + title * a)
                frame = Image.fromarray(fr.astype(np.uint8))
        enc.stdin.write(frame.tobytes())
        if f % 96 == 0:
            print(f"frame {f}/{nf}", flush=True)
    enc.stdin.close()
    enc.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()
