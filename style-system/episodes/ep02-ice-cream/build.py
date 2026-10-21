#!/usr/bin/env python3
"""EP02 "Ice Cream" — sad man at the platform edge / kid licking an ice cream.

    python3 build.py [OUT.mp4]

No dialogue: real recorded sound effects from ../../sounds (credits in sounds/CREDITS.md). Everything
disturbing happens off-screen — we only hear it and see the splash land.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import sfx  # noqa: E402
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
DURATION = 28.5

# ---------------------------------------------------------------- timeline
SHOTS = [
    (0.0, 6.5, "platform"),
    (6.5, 10.5, "kid"),
    (10.5, 15.5, "platform"),
    (15.5, 24.5, "kid"),
    (24.5, DURATION, "title"),
]
PUSH_IN = {0: (1.0, 1.3), 2: (1.3, 1.6)}     # shot index -> zoom from, to
FOCUS = (540, 450)
TRAIN1 = 3.2                                  # first train front leaves the tunnel
TRAIN_SPEED = 150                             # px per frame (on ones — it's fast)
TRAIN_LEN = 3 * 900 + 2 * 24
FLUTTER = [(3.1, 4.6), (14.6, 15.5)]          # coat blown by the trains
HEADLIGHT = 13.6                              # second train's light in the tunnel
SPLASH = 16.0
BLINKS_KID = [(8.3, 2), (17.3, 2), (21.5, 2)]
LICK_CYCLE = ["closed"] * 4 + ["open"] * 2 + ["out"] * 2 + ["up"] * 4 + ["up2"] * 2 + ["open"] * 2 + ["closed"] * 2
TITLE_FADE = (24.8, 25.4)

# man: (cx, feet_y, W)   kid: (cx, top, W)
MAN = (540, 572, 130)
KID = (430, 110, 400)


def shot_at(t):
    for i, (a, b, name) in enumerate(SHOTS):
        if a <= t < b:
            return i, name, a, b
    a, b, name = SHOTS[-1]
    return len(SHOTS) - 1, name, a, b


# ---------------------------------------------------------------- sound
SCREAMS = [(16.2, "scream_female1", 1.0, 0.8), (16.35, "scream_1", 1.0, 0.7), (16.6, "scream_female3", 1.05, 0.7),
           (16.9, "scream_male1", 1.0, 0.6), (17.2, "scream_female2", 0.95, 0.6), (17.5, "scream_2", 1.0, 0.5),
           (17.9, "scream_old1", 1.0, 0.45), (18.3, "scream_female1", 1.08, 0.4), (18.8, "scream_3", 0.97, 0.35),
           (19.4, "scream_female3", 0.92, 0.25)]


def build_audio(path):
    """Real recordings from ../../sounds (see sounds/CREDITS.md)."""
    SR = sfx.SR
    tr = sfx.Track(DURATION)
    wind = sfx.fade(sfx.band(sfx.load("wind"), 0, 700), 0.4, 0.4)
    for t in np.arange(0, 24.5, len(wind) / SR - 0.4):               # station draft
        tr.add(t, wind, 0.15)
    # train 1 rushes past: the passby reversed is its approach, then the real passby (cut before it slows)
    pas = sfx.load("train_passby_slowing")
    fast = sfx.fade(sfx.pitch(pas[: int(1.6 * SR)], 1.1), 0, 0.6)
    approach = sfx.fade(sfx.band(pas[: int(2.0 * SR)][::-1], 0, 1500), 1.2, 0)
    tr.add(TRAIN1 - 0.1 - len(approach) / SR, approach, 0.7)
    tr.add(TRAIN1 - 0.1, fast, 1.0)
    # licks
    slurp = sfx.load("slurp")
    for a, b, name in SHOTS:
        if name == "kid":
            for k, t in enumerate(np.arange(a + 6 / FPS, b, len(LICK_CYCLE) / FPS)):
                tr.add(t, sfx.pitch(slurp, (0.92, 1.0, 1.06)[k % 3]), 1.3)
    # train 2 approaches ... everything happens off-screen
    slow_app = sfx.load("train_passby_slowing", tempo=0.55)[::-1]
    slow_app = sfx.fade(sfx.band(slow_app, 0, 1200), 2.0, 0)
    tr.add(15.95 - len(slow_app) / SR, slow_app, 0.9)
    tr.add(13.5, sfx.fade(sfx.load("wind"), 1.0, 0.3), 0.35)
    horn = sfx.load("train_horn_departure")
    tr.add(15.55, sfx.fade(horn[: int(1.3 * SR)], 0.02, 0.3), 0.7)
    tr.add(SPLASH - 0.02, sfx.load("crash"), 0.8)
    splat = sfx.load("splat")
    tr.add(SPLASH + 0.02, splat, 1.0)
    tr.add(SPLASH + 0.09, sfx.pitch(splat, 0.85), 0.6)
    tr.add(SPLASH, pas, 0.7)                                          # the train braking to a stop
    for t, name, ratio, gain in SCREAMS:
        tr.add(t, sfx.pitch(sfx.load(name), ratio), gain)
    # the train tries to start again, twice
    dep = sfx.load("metro_departure")
    tr.add(19.6, sfx.fade(dep[: int(1.3 * SR)], 0, 0.2), 0.6)
    tr.add(21.5, sfx.fade(dep[: int(1.0 * SR)], 0, 0.15), 0.5)
    return tr.write(path)


# ---------------------------------------------------------------- backgrounds
TUNNEL = [(0, 175), (70, 185), (130, 230), (160, 300), (165, 420), (165, 540)]


def platform_bg(ink):
    for x in (200, 540, 880):                                       # ceiling lamps
        ink.rect(x - 70, 22, x + 70, 38, 2.5, BGC, seed=x)
        ink.seg((x - 50, -5), (x - 50, 22), 2, BGC, seed=x + 1)
        ink.seg((x + 50, -5), (x + 50, 22), 2, BGC, seed=x + 2)
    for k in range(11):                                             # wall tiles
        y = 70 + k * 35
        ink.seg((160, y), (1085, y), 2, BGC, seed=500 + k)
        if k < 10:
            for j, x in enumerate(range(160 + (k % 2) * 35, 1080, 70)):
                ink.seg((x, y + 2), (x, y + 33), 1.75, BGD, seed=600 + k * 20 + j, overshoot=0)
    ink.shape([(360, 120), (760, 120), (760, 185), (360, 185)], 2.5, BGC, WHITE, smooth=False, seed=40)
    t = "ROSENTHALER PLATZ"
    letters(ink, t, 560 - text_width(t, 26) / 2, 140, 26, 2.5, BGC, seed=41)
    for y, sd in ((420, 1), (428, 2), (445, 3)):                    # far platform
        ink.seg((150, y), (1085, y), 2.5, BGC, seed=sd)
    for y, sd in ((478, 4), (485, 5), (512, 6), (519, 7), (532, 8)):   # rails
        ink.seg((150, y), (1085, y), 2.5 if y != 532 else 2, BGC, seed=sd)
    for j, x in enumerate(range(175, 1080, 45)):
        ink.seg((x, 470), (x - 6, 528), 1.75, BGD, seed=700 + j, overshoot=0)
    ink.seg((-5, 548), (1085, 548), 2.5, BGC, seed=9)              # our edge
    ink.seg((-5, 560), (1085, 560), 2.5, BGC, seed=10)
    for j, x in enumerate(range(10, 1080, 22)):
        ink.blob(x, 585, 2.2, 2.2, BGD, seed=800 + j, amp=0)
    for j, x in enumerate(range(0, 1080, 60)):
        ink.seg((x, 602), (x + 34, 602), 2, BGD, seed=900 + j, overshoot=0)
    ink.line(TUNNEL, 3, BGC, seed=11, taper=0.05)                   # tunnel mouth
    ink.line([(0, 205), (55, 212), (105, 250), (130, 310), (135, 420), (135, 532)], 1.75, BGD, seed=12)
    for k in range(4):
        y = 300 + k * 50
        ink.line([(20, y), (60, y + 8), (95, y + 4)], 1.75, BGD, seed=13 + k)
    rng = np.random.default_rng(4)
    for k in range(14):
        ink.blob(rng.uniform(0, 1080), rng.uniform(615, 715), 1.7, 1.7, BGD, seed=1000 + k, amp=0)


def kid_bg(ink):
    for k in range(14):
        y = 30 + k * 40
        ink.seg((-5, y), (1085, y), 2, BGC, seed=50 + k)
        for j, x in enumerate(range((k % 2) * 40, 1080, 80)):
            ink.seg((x, y + 2), (x, y + 38), 1.75, BGD, seed=100 + k * 20 + j, overshoot=0)
    ink.shape([(30, -5), (130, -5), (130, 600), (30, 600)], 2.5, BGC, WHITE, smooth=False, seed=20)  # pillar
    ink.seg((20, 560), (140, 560), 2.5, BGC, seed=21)
    ink.seg((-5, 600), (1085, 600), 2.5, BGC, seed=22)
    ink.seg((-5, 607), (1085, 607), 2.5, BGC, seed=23)
    ink.shape([(860, 450), (960, 450), (950, 640), (870, 640)], 2.5, BGC, WHITE, smooth=False, seed=24)  # bin
    ink.seg((852, 450), (968, 450), 2.5, BGC, seed=25)
    ink.seg((852, 440), (968, 440), 2.5, BGC, seed=26)
    ink.shape([(700, 70), (1090, 70), (1090, 130), (700, 130)], 2.5, BGC, WHITE, smooth=False, seed=27)
    letters(ink, "ROSENTHALER", 725, 86, 28, 2.5, BGC, seed=28)
    rng = np.random.default_rng(6)
    for k in range(10):
        ink.blob(rng.uniform(0, 1080), rng.uniform(620, 715), 1.7, 1.7, BGD, seed=1100 + k, amp=0)


def exterior_bg(ink):
    for bx, w, sd in ((-20, 360, 1), (720, 380, 2)):                # buildings
        ink.rect(bx, 60, bx + w, 600, 2.5, BGC, seed=sd * 50)
        for r in range(6):
            for c in range(int(w // 70)):
                x, y = bx + 30 + c * 70, 90 + r * 75
                ink.rect(x, y, x + 36, y + 40, 1.75, BGC, seed=sd * 1000 + r * 10 + c, amp=0.8)
    ink.seg((-5, 600), (1085, 600), 2.5, BGC, seed=3)
    ink.seg((-5, 640), (1085, 640), 2.5, BGC, seed=4)
    ink.seg((-5, 700), (1085, 700), 2.5, BGC, seed=5)
    ink.shape([(380, 470), (700, 470), (700, 600), (380, 600)], 2.5, BGC, WHITE, smooth=False, seed=6)  # stairs
    for k, y in enumerate((490, 512, 530, 546, 559, 570, 580, 589)):
        ink.seg((390, y), (690, y), 1.75, BGD, seed=60 + k, overshoot=0)
    for x, sd in ((370, 7), (710, 8)):                                # railings
        ink.seg((x, 420), (x, 600), 2.5, BGC, seed=sd)
    ink.seg((370, 420), (710, 420), 2.5, BGC, seed=9)
    ink.seg((370, 450), (710, 450), 2, BGC, seed=10)
    ink.seg((640, 600), (640, 300), 2.5, BGC, seed=11)               # U sign
    ink.shape([(590, 220), (690, 220), (690, 310), (590, 310)], 2.5, BGC, WHITE, smooth=False, seed=12)
    letters(ink, "U", 618, 240, 50, 4, BGC, seed=13)
    rng = np.random.default_rng(8)
    for k in range(12):
        ink.blob(rng.uniform(0, 1080), rng.uniform(610, 715), 1.7, 1.7, BGD, seed=1200 + k, amp=0)


# ---------------------------------------------------------------- characters
COAT_R = [(0.12, 0.62), (0.26, 0.72), (0.33, 0.92), (0.36, 1.4), (0.38, 1.85), (0.28, 1.93), (0, 1.94)]
COAT = [(-u, v) for u, v in COAT_R[:-1]] + [(0, 1.94)] + [(u, v) for u, v in reversed(COAT_R[:-1])]


def man_back(ink, cx, feet, W, slump=0, flutter=0):
    """Tiger in human form, from behind: thin, slumped, long coat, hat, striped head and tail."""
    top = feet - 2.32 * W

    def P(u, v):
        return (cx + (u - 0.05 * (1 - v / 1.94)) * W, top + v * W)

    lw = 3
    for sx in (-1, 1):                                               # thin legs + feet
        ink.line([P(sx * 0.1, 1.9), P(sx * 0.11, 2.27)], lw, CHAR, seed=10 + sx)
        ink.blob(*P(sx * 0.13, 2.29), 0.08 * W, 0.04 * W, FILL, seed=12 + sx)
    tail = [P(0.12, 1.86), P(0.3, 2.05), P(0.42, 2.0), P(0.47, 1.86)]  # tail hangs out under the coat
    ink.line(tail, 0.065 * W, CHAR, seed=14, taper=0.05)
    ink.line(tail, 0.065 * W - 2 * lw, WHITE, seed=14, taper=0.05)
    for k, (u, v) in enumerate(((0.24, 1.97), (0.36, 2.03), (0.44, 1.95))):
        ink.line([P(u - 0.025, v - 0.03), P(u + 0.02, v + 0.03)], 2.5, CHAR, seed=15 + k, taper=0.3)
    hv = 0.44 + slump * 0.025                                        # head hangs low, droops on out-breath
    for sx in (-1, 1):                                               # rounded ears under the brim
        ink.shape(ellipse(*P(sx * 0.22, hv - 0.14), 0.07 * W, 0.075 * W, 0, 360, 14)[:-1], lw, CHAR, WHITE,
                  seed=20 + sx)
    ink.shape(ellipse(*P(0, hv), 0.23 * W, 0.24 * W, 0, 360, 22)[:-1], lw, CHAR, WHITE, seed=seed_of("thead"))
    for k, u in enumerate((-0.09, 0.0, 0.09)):                       # three head stripes
        ink.line([P(u * 1.1, hv - 0.05), P(u, hv + 0.08)], 3, CHAR, seed=23 + k, taper=0.35)
    coat = list(COAT)
    if flutter:
        coat = [(u + (0.07 if (v > 1.6 and u > 0) else 0) * flutter, v + (0.03 if v > 1.85 else 0)) for u, v in coat]
    ink.shape([P(u, v) for u, v in coat], lw, CHAR, WHITE, seed=seed_of("coat"))
    ink.line([P(-0.15, 0.68), P(0.0, 0.72), P(0.15, 0.68)], lw, CHAR, seed=26)   # collar
    by = hv - 0.17                                                   # hat: brim droops at the sides
    ink.shape([P(-0.34, by + 0.04), P(-0.2, by - 0.03), P(0.0, by - 0.04), P(0.2, by - 0.03), P(0.34, by + 0.04),
               P(0.2, by + 0.03), P(0.0, by + 0.02), P(-0.2, by + 0.03)], lw, CHAR, WHITE, seed=27)
    ink.shape([P(-0.18, by), P(-0.17, by - 0.2), P(0.0, by - 0.23), P(0.17, by - 0.2), P(0.18, by)],
              lw, CHAR, WHITE, seed=28)
    for sx in (-1, 1):                                               # thin sleeves + small hands
        pts = [P(sx * 0.28, 0.78), P(sx * 0.38, 1.15), P(sx * 0.39, 1.55)]
        ink.line(pts, 0.11 * W, CHAR, seed=40 + sx, taper=0.03)
        ink.line(pts, 0.11 * W - 2 * lw, WHITE, seed=40 + sx, taper=0.03)
        ink.shape(ellipse(*P(sx * 0.39, 1.6), 0.05 * W, 0.055 * W, 0, 360, 12)[:-1], lw, CHAR, WHITE, seed=44 + sx)


def train(ink, front, frame):
    top, bot = 195, 530
    for i in range(3):
        x1 = front - i * 924
        x0 = x1 - 900
        if x1 < -50 or x0 > 1130:
            continue
        if i == 0:
            body = [(x0, top), (x1 - 70, top), (x1 - 20, top + 25), (x1, top + 110), (x1, bot), (x0, bot)]
        else:
            body = [(x0, top), (x1, top), (x1, bot), (x0, bot)]
        ink.shape(body, 3.5, CHAR, WHITE, smooth=False, seed=300 + i)
        for k in range(7):
            wx = x0 + 50 + k * 120
            if wx + 80 < x1 - 30:
                ink.rect(wx, 240, wx + 80, 330, 2.5, CHAR, seed=310 + i * 10 + k, amp=0.6)
        for dx in (210, 640):
            ink.rect(x0 + dx, 228, x0 + dx + 90, bot - 6, 2.5, CHAR, seed=340 + i * 3 + dx, amp=0.6)
            ink.seg((x0 + dx + 45, 228), (x0 + dx + 45, bot - 6), 2, CHAR, seed=350 + i + dx, overshoot=0)
        ink.seg((x0, 382), (x1, 382), 2.5, CHAR, seed=360 + i)
        if i == 0:
            ink.blob(x1 - 28, 455, 12, 12, FILL, seed=370, amp=0)
    rng = np.random.default_rng(frame)                               # speed lines (they flicker)
    for k in range(10):
        y = rng.uniform(190, 540)
        x = rng.uniform(front - TRAIN_LEN, front)
        ink.seg((x, y), (x - rng.uniform(150, 400), y), 2, BGC, seed=int(rng.integers(1e6)), overshoot=0)


def headlight(ink, k):
    for j in range(4 + int(k * 5)):
        a = -0.35 + j * 0.09
        r0, r1 = 40, 120 + 520 * k
        ink.seg((70 + r0 * math.cos(a), 440 + r0 * math.sin(a)),
                (70 + r1 * math.cos(a), 440 + r1 * math.sin(a)), 2, BGC, seed=400 + j, overshoot=0)


SCOOPS = ((0.37, 0.97, 0.15), (0.36, 0.73, 0.14), (0.35, 0.5, 0.12))
SPLATS = [(0.33, 0.47, .03), (0.4, 0.55, .018), (0.3, 0.73, .028), (0.42, 0.78, .022), (0.38, 0.98, .028),
          (0.37, 1.18, .018), (-0.2, 0.62, .022), (0.0, 0.43, .014), (-0.3, 0.42, .018), (-0.1, 0.12, .02),
          (-0.45, 1.25, .028), (-0.2, 1.4, .02), (0.2, 0.05, .018), (0.12, 0.85, .012)]
WALL_SPLATS = [(70, 200, 14), (160, 120, 8), (95, 330, 10), (210, 430, 6), (40, 480, 9)]


def kid(ink, cx, top, W, lick, eye, splash):
    """A human child: round head, hair, ears, neck, striped t-shirt, 3-scoop cone."""
    def P(u, v):
        return (cx + u * W, top + v * W)

    lw = 4.5
    body = [(-0.13, 0.9), (-0.42, 0.98), (-0.6, 1.12), (-0.68, 1.45), (-0.7, 1.8),
            (0.7, 1.8), (0.68, 1.45), (0.6, 1.12), (0.42, 0.98), (0.13, 0.9)]
    ink.shape([P(u, v) for u, v in body], lw, CHAR, WHITE, smooth=True, seed=seed_of("kidbody"))
    for k, v in enumerate((1.22, 1.38, 1.54)):                       # t-shirt stripes
        hw = 0.64 + (v - 1.2) * 0.15
        ink.line([P(-hw, v), P(hw, v + 0.01)], 2.5, CHAR, seed=3 + k)
    ink.line([P(-0.15, 0.94), P(0.0, 1.0), P(0.15, 0.94)], 2.5, CHAR, seed=6)          # neckline
    ink.shape([P(-0.12, 0.8), P(-0.12, 0.95), P(0.12, 0.95), P(0.12, 0.8)], lw, CHAR, WHITE,
              smooth=False, seed=7)                                                     # neck
    for sx in (-1, 1):                                                                  # ears
        ink.shape(ellipse(*P(sx * 0.42, 0.5), 0.06 * W, 0.09 * W, 0, 360, 14)[:-1], lw, CHAR, WHITE, seed=8 + sx)
        ink.line(ellipse(*P(sx * 0.425, 0.5), 0.025 * W, 0.045 * W, -80 if sx > 0 else 100,
                         80 if sx > 0 else 260, 8), 2, CHAR, seed=11 + sx)
    ink.shape(ellipse(*P(0, 0.45), 0.42 * W, 0.44 * W, 0, 360, 26)[:-1], lw, CHAR, WHITE, seed=seed_of("kidhead"))
    hair = []                                                                           # messy hair cap
    for j, a in enumerate(np.linspace(math.pi * 1.02, math.pi * 1.98, 14)):
        r = 0.45 + (0.035 if j % 2 else 0)
        hair.append((math.cos(a) * r * 0.97, 0.45 + math.sin(a) * r))
    fringe = [(0.4, 0.3), (0.28, 0.26), (0.2, 0.32), (0.08, 0.24), (-0.04, 0.31), (-0.16, 0.23),
              (-0.28, 0.3), (-0.4, 0.28)]
    ink.shape([P(u, v) for u, v in hair + fringe], lw, CHAR, WHITE, seed=14)
    ink.line([P(0.0, 0.01), P(0.04, -0.09), P(0.11, -0.08), P(0.08, -0.02)], 2.5, CHAR, seed=15)  # cowlick
    for ex in (-0.15, 0.08):                                                            # eyes
        x, y = P(ex, 0.5)
        if eye == "c":
            ink.line([(x - 0.04 * W, y), (x + 0.04 * W, y + 2)], 3, CHAR, seed=16)
        else:
            ry = 0.045 * W if eye == "o" else 0.018 * W
            ink.shape(ellipse(x, y, 0.038 * W, ry, 0, 360, 14)[:-1], 3, CHAR, WHITE, seed=17)
            ink.blob(x + 0.006 * W, y + (0.006 * W if eye == "o" else 0), 0.016 * W, min(0.016 * W, ry * 0.8),
                     FILL, seed=18, amp=0)
    ink.line([P(-0.02, 0.55), P(-0.04, 0.62), P(0.01, 0.63)], 2.5, CHAR, seed=19)     # nose
    mx, my = P(0.07, 0.72)
    if lick == "closed":
        ink.line([(mx - 0.03 * W, my), (mx + 0.03 * W, my + 2)], 3.5, CHAR, seed=20)
    else:
        ink.blob(mx, my, 0.035 * W, 0.028 * W, FILL, seed=21)
    ink.shape([P(0.22, 1.08), P(0.52, 1.08), P(0.37, 1.6)], lw, CHAR, WHITE, smooth=False, seed=22)   # cone
    for k in range(3):
        ink.line([P(0.26 + k * 0.08, 1.1), P(0.35 + k * 0.05, 1.36)], 2, CHAR, seed=23 + k)
        ink.line([P(0.5 - k * 0.08, 1.1), P(0.41 - k * 0.05, 1.36)], 2, CHAR, seed=26 + k)
    for k, (u, v, r) in enumerate(SCOOPS):
        x, y = P(u, v)
        pts = ellipse(x, y, r * W, r * W * 0.92, 0, 360, 20)[:-1]
        pts = [(px, py + (0.025 * W * (j % 2) if py > y + r * W * 0.5 else 0)) for j, (px, py) in enumerate(pts)]
        ink.shape(pts, lw, CHAR, WHITE, seed=30 + k)
    for sx, start, mid, hand in ((-1, (-0.62, 1.3), (-0.1, 1.4), (0.26, 1.24)),        # arms + hands
                                 (1, (0.64, 1.3), (0.6, 1.36), (0.46, 1.3))):
        pts = [P(*start), P(*mid), P(*hand)]
        ink.line(pts, 0.1 * W, CHAR, seed=40 + sx, taper=0.03)
        ink.line(pts, 0.1 * W - 2 * lw, WHITE, seed=40 + sx, taper=0.03)
        ink.shape(ellipse(*P(*hand), 0.055 * W, 0.05 * W, 0, 360, 12)[:-1], lw, CHAR, WHITE, seed=44 + sx)
    if lick in ("out", "up", "up2"):                                                    # tongue
        tip = {"out": (0.22, 0.73), "up": (0.23, 0.66), "up2": (0.24, 0.62)}[lick]
        pts = [P(0.07, 0.725), P(0.15, 0.735), P(*tip)]
        ink.line(pts, 0.075 * W, CHAR, seed=50, taper=0.0)
        ink.line(pts, 0.075 * W - 2 * 3.5, WHITE, seed=50, taper=0.0)
        ink.line([P(0.09, 0.727), P(tip[0] - 0.03, (tip[1] + 0.735) / 2)], 2, CHAR, seed=51, taper=0.3)
    if splash:
        for k, (u, v, s) in enumerate(SPLATS):
            splat(ink, *P(u, v), s * W, splash, k)


def splat(ink, x, y, r, stage, k):
    rng = np.random.default_rng(k + 77)
    if stage == 1:                                                    # flying in from the left
        ink.line([(x - 6 * r, y - 1.5 * r), (x - r, y - 0.2 * r)], r * 0.9, FILL, seed=500 + k, taper=0.4)
        return
    ink.blob(x, y, r * rng.uniform(1.0, 1.35), r * rng.uniform(0.75, 1.0), FILL, rot=rng.uniform(-30, 30),
             seed=600 + k, amp=r * 0.15)
    for j in range(rng.integers(1, 4)):
        a = rng.uniform(-0.8, 0.8)
        d = r * rng.uniform(1.6, 2.6)
        ink.blob(x + d * math.cos(a), y + d * math.sin(a), r * 0.28, r * 0.28, FILL, seed=650 + k * 5 + j, amp=0)


# ---------------------------------------------------------------- rendering
_bg = {}


def bg(name):
    if name not in _bg:
        img = Image.new("RGB", (BW * SS, BH * SS), WHITE)
        {"platform": platform_bg, "kid": kid_bg, "title": exterior_bg}[name](Ink(img, SS))
        _bg[name] = img
    return _bg[name]


_mask = None


def tunnel_mask():
    global _mask
    if _mask is None:
        _mask = Image.new("L", (BW * SS, BH * SS), 0)
        ImageDraw.Draw(_mask).polygon([(x * SS, y * SS) for x, y in TUNNEL + [(0, 540)]], fill=255)
    return _mask


def blink(t, table):
    for bt, per in table:
        d = (t - bt) * FPS
        if 0 <= d < per or 2 * per <= d < 3 * per:
            return "q"
        if per <= d < 2 * per:
            return "c"
    return "o"


def smooth(k):
    k = min(1, max(0, k))
    return k * k * (3 - 2 * k)


def render_platform(f, idx, a, b):
    t = f / FPS
    tq = (f - f % 2) / FPS
    img = bg("platform").copy()
    ink = Ink(img, SS)
    if idx == 0:
        front = -50 + (f - TRAIN1 * FPS) * TRAIN_SPEED
        if 0 <= front - (-50) and front - TRAIN_LEN < 1130:
            train(ink, front, f)
            img.paste(bg("platform"), (0, 0), tunnel_mask())
    if idx == 2 and tq >= HEADLIGHT:
        headlight(ink, min(1, (tq - HEADLIGHT) / (b - HEADLIGHT)))
    flutter = 0
    for fa, fb in FLUTTER:
        if fa <= tq < fb:
            flutter = 1 if int(tq * FPS / 2) % 2 == 0 else -1
    slump = int(tq / 1.2) % 2
    man_back(ink, *MAN, slump=slump, flutter=flutter)
    z0, z1 = PUSH_IN[idx]
    z = z0 + (z1 - z0) * smooth((t - a) / (b - a))
    cw, ch = BW * SS / z, BH * SS / z
    x0 = min(max(FOCUS[0] * SS - cw / 2, 0), BW * SS - cw)
    y0 = min(max(FOCUS[1] * SS - ch / 2, 0), BH * SS - ch)
    return img.resize((BW, BH), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch))


def kid_state(f, a):
    tq = (f - f % 2) / FPS
    lick = LICK_CYCLE[(f - int(a * FPS)) % len(LICK_CYCLE)]
    splash = 0 if tq < SPLASH else (1 if tq < SPLASH + 2 / FPS else 2)
    return lick, blink(tq, BLINKS_KID), splash


def render_kid(state):
    lick, eye, splash = state
    img = bg("kid").copy()
    ink = Ink(img, SS)
    if splash == 2:
        for k, (x, y, r) in enumerate(WALL_SPLATS):
            splat(ink, x, y, r, 2, 100 + k)
    kid(ink, *KID, lick, eye, splash)
    return img.resize((BW, BH), Image.LANCZOS)


def title_layer():
    img = Image.new("RGB", (FW * SS, FH * SS), WHITE)
    ink = Ink(img, SS)
    for text, y, h, w, hollow in (("ICE CREAM", 250, 110, 16, True), ("~ROSENTHALER PLATZ~", 400, 34, 3, False)):
        letters(ink, text, (FW - text_width(text, h)) / 2, y, h, w, "#555555", hollow=hollow, seed=seed_of(text))
    return np.asarray(img.resize((FW, FH), Image.LANCZOS)).astype(np.float32)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "ep02-ice-cream.mp4")
    mix = build_audio(os.path.join(tempfile.mkdtemp(), "mix.wav"))
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
        idx, name, a, b = shot_at(t)
        if name == "platform":
            band = render_platform(f, idx, a, b)
        elif name == "kid":
            key = kid_state(f, a)
            if key != last_key:
                band, last_key = render_kid(key), key
        elif last_key != "title":
            band, last_key = bg("title").resize((BW, BH), Image.LANCZOS), "title"
        frame = Image.new("RGB", (FW, FH), WHITE)
        frame.paste(band, (0, BAND_Y))
        if name == "title":
            k = np.clip((t - TITLE_FADE[0]) / (TITLE_FADE[1] - TITLE_FADE[0]), 0, 1)
            if k > 0:
                fr = np.asarray(frame).astype(np.float32)
                frame = Image.fromarray(np.minimum(fr, fr * (1 - k) + title * k).astype(np.uint8))
        enc.stdin.write(frame.tobytes())
        if f % 96 == 0:
            print(f"frame {f}/{nf}", flush=True)
    enc.stdin.close()
    enc.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()
