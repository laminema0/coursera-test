# ANIMATION.md — Motion & Editing Rules

## 1. Frame rate & drawing rate

| Setting | Value |
|---|---|
| Project fps | **24** (30 also fine for social; the reference export was ~30) |
| Drawings | On **2s** (12 drawings/sec) for anything that moves; on 3s/4s for slow gestures |
| Holds | **Default state is a held frame.** In the reference ≈58% of 4-frame intervals were pixel-identical. |
| Line boil | **None.** One drawing is held perfectly still. |

Think "animated comic": a still drawing where only a few parts move.

## 2. What is allowed to move

Ranked by how often it happens:

1. **Mouth** (lip-flap) — only the speaking character.
2. **Eyelids / blinks** — both characters, randomly.
3. **Pupils** — a dart to look at the other character, or at camera.
4. **One gesture per line** — e.g. a hand comes up to rub the head, an arm
   swings out to point, hands lift a frying pan. 3–6 drawings, then HOLD.
5. **Head tilt** — rare; a 2-drawing pop (no in-betweens), e.g. tube head
   dips lower when annoyed.
6. **Ambient FX** — smoke curls, a fly buzzing, a dripping thing: simple
   2–4 drawing loops in gray line.

**Exception — slow push-in** (added v1.2, EP02): for dread/suspense the
camera may push in slowly (zoom ≤ 1.6× over a shot, eased). Still no pans,
no shakes, no zoom-outs.

Never: walking cycles on screen, other camera moves, squash & stretch,
anticipation/overshoot cartoon physics. If a character needs to travel,
**cut** to them already there.

## 3. Mouth chart (lip-flap, not full lip-sync)

Drawn as solid black (`ink.fill`) shapes; see `templates/mouth_chart.svg`.

| ID | Shape | Use |
|---|---|---|
| M0 | nothing / tiny dash | Closed, silent, listening |
| M1 | short thick black bar | Rest while talking, M/B/P, "mm" |
| M2 | small black oval | Most consonants, small vowels |
| M3 | large black blob (bean) | Open vowels: A, O, shouting |
| M4 | thin slit with one white tooth/notch line | E, S, T, "ee" |
| M5 | small round "o" | OO, W, "ooh" |

Lip-flap rules:
- Change mouth every **2–4 frames** (24fps), held randomly — don't
  phoneme-match precisely; just hit **M3 on stressed syllables** and **M1/M0
  on pauses**.
- The mouth sits slightly off the face's center line; it may "slide" a
  few px between shapes — that's on-style.
- Nothing else on the face moves while talking except occasional blinks.
- After the line ends: return to M0 and HOLD.

## 4. Blinks

- Every 3–6 s per character, at random; never both characters at once.
- 3 drawings: half-lid (2f) → closed line (2f) → half-lid (2f) → back.
- Add a blink right after a character is insulted / before a reply
  (deadpan "processing" beat).

## 5. Editing & shot rhythm

Measured in the reference (37 shots in ~145 s):

| Metric | Value |
|---|---|
| Average shot | **~3.9 s** |
| Median shot | ~2.8 s |
| Shortest | ~1.1 s (a reaction) |
| Longest | ~22 s (two-shot wide on the sofa, dialogue plays out) |
| Transitions | **Hard cuts only** (exception: title card fade-in) |

Patterns:
- **Shot / reverse-shot** for arguments: cut to whoever is speaking, often
  mid-sentence; a subtitle can carry across a cut.
- **Reaction cut**: cut to the listener for 1–2 s of silent blink/stare
  before they answer.
- **Over-the-shoulder wide**: listener's head huge and cropped at the side
  edge in foreground (lines still black), the scene behind in gray.
- **Wide two-shot**: both characters small on a big gray set; used for
  long stretches of eating/sitting dialogue.
- **Insert shot**: a static close-up of the object being discussed (e.g.
  the ruined curtains), with a tiny FX loop (a fly) — 3–4 s, no dialogue.
- **Establishing exterior** to change location/time (e.g. a shop front
  with a car pulling in) — the one shot where an object moves across frame.
- **Final shot** = establishing exterior + hand-lettered title card.

## 6. Sound (for the animatic)

- Natural, mumbled, under-acted voice performance; long pauses are kept.
- Room tone + one or two diegetic SFX (sizzle, fly buzz, car).
- No music during scenes; optional short sting under the title card.

## 7. Production pipeline (per shot)

1. Background (gray line) — reused per camera angle.
2. Character "body" drawing — held.
3. Face layer — eyes/lids swap set.
4. Mouth layer — M0–M5 swaps.
5. Gesture layer (if any) — 3–6 drawings.
6. Compose with `tools/compose_frame.py` (band + subtitle) or in the
   editor using `templates/frame_1080x1920.svg`.
