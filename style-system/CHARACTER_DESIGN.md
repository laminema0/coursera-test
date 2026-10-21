# CHARACTER_DESIGN.md — Building Characters

## 1. What makes a character "fit" this style

Studied from the two reference leads:
- **Lead A (the "hook/tube")**: one continuous tube from torso to head that
  bends forward like a hook or a cane; face is on the *underside* of the
  bend, looking down; two thin short tusk-like lines hang from the face.
  Arms are long noodle tubes with tiny 4-finger hands.
- **Lead B (the "cone/bullet")**: a tall cone/bullet head that IS the body
  (no neck); heavy-lidded eyes set wide apart; two long drooping
  tube-shapes for a nose; a fringe of scribbled fur where head meets
  clothes.

Shared DNA (this is what we copy — the *rules*, not the designs):

| Rule | Detail |
|---|---|
| **One-shape silhouette** | Head + body read as ONE simple shape: tube, cone, bean, pear, sausage, egg, peanut, thumb. Recognizable from silhouette alone. |
| **Head ≥ 50% of height** | Heads are huge and tall; bodies are short sacks or simple clothes shapes. |
| **No neck, no shoulders** (or nearly) | The outline flows straight from head into body/clothes. |
| **Tiny face, placed oddly** | Face features occupy ≤ 25% of head width, sit low, or off to one side / on the underside. Lots of empty forehead. |
| **Eyes = tiny** | Small ovals/circles ~ 1/12 of head width, with a dot pupil. Default state: **half-closed lids** (tired, unimpressed). |
| **One weird facial "appendage"** | Each character gets ONE signature dangly/odd feature (droopy nose tubes, tusks, whisker, a single tooth, a drip, a stalk). Ours must be NEW — no walrus tusks or twin nose-tubes. |
| **Mouth only exists when needed** | Closed mouth = short line or nothing. Open mouth = solid black blob. |
| **Noodle limbs** | Arms are thin tubes, no elbows (they curve), tiny hands with 3–4 sausage fingers. Legs are short stubs or hidden. |
| **Minimal clothing, with text** | One garment: apron, vest, tank top, hoodie. Clothes can carry a hand-written slogan (e.g. "CHEFIN' IT UP MAN") — great joke slot. |
| **Texture by scribble** | Fur/hair is a row of tiny "w/v" scribbles along an edge, never a filled mass. |
| **Scale contrast** | Pair characters with very different heights/shapes (tall vs short, tube vs cone) — in the reference the cone character is about half the tube character's height in wide shots. Close-ups hide the size gap; wides reveal it (a free sight gag). |
| **No color identity** | Characters are told apart by SHAPE ONLY. |

## 1b. Humans (added v1.3)
Plain humans are allowed and must still look like this world:
- Separate round head on a short neck, simple shoulders — but keep the
  head big and the features tiny and simple (dot eyes, hook nose, line mouth).
- Hair = one wavy outline cap + fringe, never strands of detail.
- Same line weights, black + white only, no shading.
- A creature "in human form" (e.g. Tiger) = human body and clothes, but
  keep the animal head plus 1–2 tiny animal cues (stripes, a tail).
  Keep it simple: the fewer marks, the better.

## 2. Face kit

```
EYES (always small)        LIDS (emotion lives here)
  (•)  open, dot pupil       ‾(•)‾  half-lid  = default / bored
  (·)  tiny pupil = shock    ─(•)   one lid up = skeptical
  ──   closed = blink        ⌒   ⌒   lids down/curved = content, smug
  —•—  slit = suspicious     brow line above eye = worry/annoyance

BROWS: optional single thin line or 2–4 tiny wrinkle lines on forehead.
NO pupils highlights, NO eyelashes, NO iris detail.
```

Mouths: see `ANIMATION.md` §Mouth chart.

## 3. Proportion sheet (fill in per character)

Measure in "heads" where 1 head = the head shape's width.

| | Tall type | Short type |
|---|---|---|
| Total height | 4–5 widths | 1.5–2.5 widths |
| Face zone | lower-third / underside | middle-third, centered |
| Eye size | 1/12 head width | 1/8 head width |
| Arm length | reaches knees | reaches waist |

## 4. Deliverables for every new character

1. **Silhouette test** (solid black) — must differ from every existing
   character's silhouette.
2. **Turnaround**: front, 3/4, side (profile), back. Same line weight.
3. **Expression sheet**: neutral(half-lid), annoyed, shocked (tiny pupils,
   big black mouth), smug, sad, "dead inside" stare.
4. **Mouth set** in the character's own shape (6 shapes, see ANIMATION.md).
5. **Hand/gesture sheet**: point, palm-on-head (facepalm/rub head), shrug,
   holding a prop.
6. **Bible file** `characters/<name>.md` from `_TEMPLATE.md`.

## 5. Checklist (run before showing a design)

- [ ] Reads as one simple shape in silhouette
- [ ] Head ≥ half the total height
- [ ] Face tiny & off-center/low; lots of blank head
- [ ] Default eyes are half-lidded
- [ ] Exactly one signature odd feature, NOT tusks/nose-tubes
- [ ] Black + white only; only solid-black fills are mouth/pupils/nostrils
- [ ] Wobbly hand line, 3 px (wide) / 4–5 px (close) at 1080
- [ ] Noodle arms, tiny sausage fingers
- [ ] One garment max, optional hand-lettered slogan
- [ ] Distinct from all existing characters in shape AND height
