# Deadpan Line — Style System

A complete, editable rulebook for making vertical, hand-drawn, deadpan
comedy shorts in the style of the reference video (frames studied:
1,093 samples = every 4th frame of a ~4,367-frame, ~2:25 clip, 512×910 px).

## Files

| File | What it controls |
|---|---|
| `DESIGN.md` | Canvas, safe areas, line weights, colors, subtitles, title cards |
| `tokens.json` | Same values as `DESIGN.md`, machine-readable |
| `CHARACTER_DESIGN.md` | Character construction rules, face kit, turnarounds, checklist |
| `ANIMATION.md` | FPS, holds, lip-flap mouth chart, blinks, gestures, cuts, sound |
| `STORY_AND_DIALOGUE.md` | Humor, voice, shot grammar, episode structure |
| `reference/SOURCE_ANALYSIS.md` | What was measured in the reference video (shot list, timings) |
| `characters/_TEMPLATE.md` | Character bible template (copy per character) |
| `episodes/_TEMPLATE/` | Script + shot list template (copy per episode) |
| `templates/frame_1080x1920.svg` | Blank frame with picture band + subtitle guides |
| `templates/mouth_chart.svg` | The 6 standard mouth shapes |
| `tools/compose_frame.py` | Puts art + subtitle onto a correct 1080×1920 frame |
| `CHANGELOG.md` | Every approved change to the style, dated |

## The 10 golden rules (memorize these)

1. **White page, black line.** No color, no gray fills, no shading, no texture.
   Only solid black is allowed as a fill (open mouths, pupils, nostrils).
2. **Characters dark, world pale.** Character lines are near-black (#1A1A1A);
   backgrounds are thinner mid-gray (#7D7D7D–#8C8C8C) lines.
3. **Wobbly, single-pass line.** Hand-drawn, slightly shaky, open-ended
   strokes. Never vector-perfect, never sketchy multi-stroke.
4. **Blob bodies, tiny faces.** Heads are one big simple shape (tube, cone,
   bean). Eyes are tiny; the face sits low or off to one side.
5. **Vertical 9:16 canvas, 3:2 picture band in the middle**, white above and
   below; subtitles sit just under the picture.
6. **Limited animation.** Mostly holds. Only the mouth, eyelids and one
   gesture move. Lines do not boil.
7. **Hard cuts only.** No camera moves, no zooms, no transitions.
   ~3–4 s average shot.
8. **Plain subtitles for every line.** Black Arial/Helvetica, centered,
   max 2 lines, no outline, no box.
9. **Deadpan, mundane, sweary.** Small domestic problems treated with
   flat, tired exasperation. Lines end in a verbal tic ("man").
10. **End on a hand-lettered title card** over the final establishing shot.

## Workflow when the user asks for something

- **"Make a character"** → follow `CHARACTER_DESIGN.md` §Checklist, fill
  `characters/_TEMPLATE.md`, produce a turnaround + expression sheet, log in
  `CHANGELOG.md`.
- **"Make an episode / scene"** → copy `episodes/_TEMPLATE/`, write script
  per `STORY_AND_DIALOGUE.md`, break into shots per `ANIMATION.md`.
- **"Change the style"** → edit the rule file + `tokens.json`, log it.
