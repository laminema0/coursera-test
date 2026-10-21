# DESIGN.md — Visual Design System

All numbers are for the master resolution **1080 × 1920 (9:16)**.
Values were measured from the reference (512 × 910) and scaled ×2.11.

## 1. Canvas & layout

```
 y=0     ┌────────────────────────┐
         │                        │  TOP WHITE  (title card lives here
         │                        │  in the final shot only)
 y≈595   ├────────────────────────┤  ← picture band top   (31% of height)
         │                        │
         │   PICTURE BAND 3:2     │  1080 × ~720 — all the art
         │   (the "screen")       │
         │                        │
 y≈1320  ├────────────────────────┤  ← picture band bottom (69%)
 y≈1350  │   Subtitle line 1      │  ← subtitle baseline zone (70–76%)
 y≈1430  │   Subtitle line 2      │
         │                        │  BOTTOM WHITE (end-card tagline only)
 y=1920  └────────────────────────┘
```

| Token | Value |
|---|---|
| `canvas` | 1080 × 1920, 9:16 |
| `band.top` | 595 px (31%) |
| `band.bottom` | 1320 px (69%) |
| `band.aspect` | 3:2 (art is composed as a landscape shot) |
| `band.edge` | **No border.** The band is implied — art simply stops. Lines may run off the side edges; the top/bottom of the art fade into white (no hard frame line). |
| `subtitle.top` | 1345 px |
| `subtitle.lineGap` | 1.25 × font size |
| `safe.sides` | 60 px for subtitles; art may bleed fully |

The outer white is part of the look: it makes a landscape cartoon read as a
"phone screenshot" with captions — do not fill it.

## 2. Color

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FFFFFF` | Everything. Background of every frame. |
| `ink.character` | `#1A1A1A` | Character outlines, faces, props they hold |
| `ink.fill` | `#0D0D0D` | Open mouths, pupils, nostril holes — solid |
| `ink.background` | `#808080` (range #7D–#8C) | Rooms, furniture, buildings, cars |
| `ink.bgDetail` | `#A6A6A6` | Smudges, specks, floor dirt, wall marks |
| `ink.subtitle` | `#000000` | Subtitle text |

No other colors. No gradients, no gray fills, no drop shadows.

**Animal markings** (added v1.1): an animal's natural black markings
(panda ears, eye patches, limbs) may be solid `ink.fill`. Keep them to the
markings that make the animal readable, and keep the face tiny inside them.
(One exception allowed: the title card lettering may be drawn in
`ink.background` gray outlines.)

## 3. Line

| Token | @1080 wide | Notes |
|---|---|---|
| `line.character.wide` | 3 px | Character in a wide shot |
| `line.character.close` | 4–5 px | Character in a close-up (lines do NOT scale up much) |
| `line.background` | 2–3 px | Gray, a bit thinner than characters |
| `line.detail` | 1.5–2 px | Fur scribbles, cracks, specks, text on clothes |

Line rules:
- **Pressure brush**, slight taper at both ends, roughly uniform in the
  middle. (Procreate "Studio Pen"/"Technical Pen" with jitter, Clip Studio
  "G-pen" low stabilization, Toon Boom pencil w/ pressure.)
- **Hand wobble is required.** Straight edges (counters, door frames,
  shelves) are drawn freehand, slightly bowed, and often **doubled** — two
  near-parallel lines 4–8 px apart for thickness instead of shading.
- **Gaps are fine.** Lines don't always close; corners can overshoot by a
  few px.
- **Background clutter = tiny marks**: dots, little "v"/"u" scribbles,
  crumbs, drips. Sprinkle 5–15 per background, gray.
- **No hatching, no shading, no cast shadows.** Volume comes from overlap
  only.
- Lines are **static** within a shot: no boil/jitter between frames.

## 4. Perspective & backgrounds

- Real, fairly detailed perspective (one- or two-point) for rooms and
  exteriors — the world is "normal" and tidy-ish; the characters are odd.
- Wide shots are straight-on and eye-level: counters, sofas and shop fronts
  run horizontally across the band.
- Background props tell the joke (mess, spills, smoke, scratched curtains).
- Mess is drawn as drippy blobs (sauce, smoke curls, scribble clouds).
- Backgrounds are one static drawing per camera setup, reused every time
  that angle returns.

## 5. Typography

**Subtitles**
| Token | Value |
|---|---|
| `font` | Arial / Helvetica (Regular), fallback Liberation Sans |
| `size` | 40 px (cap height ≈ 29 px) |
| `color` | `#000000` |
| `align` | centered |
| `maxLines` | 2; break at ~32 characters |
| `style` | no outline, no box, no shadow, sentence case, keep punctuation like "man!?" and "..." |
| `timing` | appears with the first mouth frame, stays until the line ends; blank during silent beats |

**Title card (end of episode)**
- Hand-lettered, **outlined block capitals** (hollow letters), slightly
  uneven baselines, letter sizes vary.
- Layout: `SHOW NAME` large on top white (y≈260–360), small connector word
  ("and") in smaller caps, episode subtitle in thin single-line caps
  between tildes: `~EPISODE NAME~`.
- Optional tagline at bottom white (y≈1500–1700) in single-line
  hand-written caps, ends with the show's verbal tic
  (e.g. "FULL EPISODE IN PRODUCTION, MAN.").
- The lettering fades in over the last establishing shot; the picture
  keeps playing behind it.
