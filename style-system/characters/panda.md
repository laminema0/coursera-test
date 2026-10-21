# Panda

- **Status**: draft (EP01)
- **Created**: 2026-10-21   **Last changed**: 2026-10-21
- **Art**: drawn in code — `episodes/ep01-berlinovo-apartment/build.py` → `panda()`

## Concept
A tired, deadpan panda in a Berlin flat who calls everyone "brother" and
doesn't react when a bird turns into a chair on his shoulder.

## Silhouette
- Base shape: **pear/bean**, small sloped "shoulder" bumps at v≈0.9
- Height: 2.53 head-widths body + 0.2 legs
- Signature odd feature: **droopy teardrop eye patches** hanging outward

## Construction (units of W = body width at eye level, origin = top centre)
| Part | Rule |
|---|---|
| Body | `BODY_R` outline in build.py, mirrored; top leans 0.04W to the right |
| Ears | solid black circles r 0.12W at (±0.3, 0.07), behind body |
| Eye patches | solid black droopy teardrops centred (±0.18, 0.56) |
| Eyes | tiny white half-ellipse (half-lid) rx 0.042W inside patch, black dot pupil; blink = sliver → white line |
| Nose | small black blob at (0, 0.69) |
| Mouth | at (0.025, 0.8) — slightly off-centre; M0–M5 |
| Arms | solid black noodles 0.1W thick from (±0.74, 0.98), 3 sausage fingers |
| Legs | solid black ovals at (±0.33, 2.6) |
| Back view | two-cheek butt bottom (`BACK`), fluffy white tail at (0, 2.12), crease |
| Fur | three tiny "v" scribbles on the chest at v 1.15 |

## Personality & voice
- Role: the weird calm one
- Default expression: half-lidded, unimpressed
- Voice: user's recording pitched +5 semitones (×1.335)
- Verbal tic: **"brother"**

## Acting notes
- Typical gestures: butt scratch (back view), one arm raised palm-up while talking
- Never does: big reactions; eyes only slide toward the weird thing, then a slow blink

## Change log
- 2026-10-21 — human-form variant removed (EP02 man is Tiger, see tiger.md)
- 2026-10-21 — created for EP01
