# Project memory — "Deadpan Line" animation style system

This repo holds the style system for a deadpan, hand-drawn, black-line-on-white
vertical animation style (studied from reference frames of the short
"Kyle and Davey — Paul Returns"). We use it to design **our own original
characters and episodes** in that style.

## Always do this first
Before designing a character, a scene, a shot list, dialogue or any frame,
read these files (in order):

1. `style-system/README.md` — index, workflow, golden rules
2. `style-system/DESIGN.md` — canvas, layout, line, color, type tokens
3. `style-system/CHARACTER_DESIGN.md` — how characters are built
4. `style-system/ANIMATION.md` — timing, mouths, blinks, cuts
5. `style-system/STORY_AND_DIALOGUE.md` — tone, writing, shot grammar
6. `style-system/characters/` — every existing character bible

## Keep it alive
- When the user approves a change to the style, edit the relevant file
  **and** add a dated line to `style-system/CHANGELOG.md`.
- Every new character gets a bible in `style-system/characters/<name>.md`
  copied from `characters/_TEMPLATE.md`, plus art in `style-system/assets/`.
- Every new episode gets a folder `style-system/episodes/<slug>/` from
  `episodes/_TEMPLATE/`.
- Never copy the reference show's characters (walrus/tusk designs, names,
  catchphrases, logo). Borrow the *style*, not the *cast*.
