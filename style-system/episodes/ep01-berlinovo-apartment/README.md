# EP01 — Berlinovo Apartment

41 s, 1080×1920, 24 fps. Panda + bird-that-becomes-a-chair.

| Time | Shot | What happens |
|---|---|---|
| 0.0–3.0 | Butt CU (back) | Panda scratches butt — scratch SFX, no voice |
| 3.0–8.85 | CU face | Blank stare, then starts talking |
| 8.85–14.0 | Mid, flat | Talking |
| 14.0–20.0 | CU face | Talking, glance |
| 20.0–26.6 | Mid, flat | Talking, arm gesture |
| 26.6–32.2 | Medium | Bird flies in, lands on shoulder, chirps, POOF → chair |
| 32.2–37.0 | Mid, flat | Last line with chair on shoulder; chair tweets |
| 37.0–41.0 | Exterior | Berlinovo block + title card "PANDA ~BERLINOVO APARTMENT~" |

## Build
```
# put the recording here as voice.m4a (git-ignored: repo is public)
python3 build.py            # → ep01-berlinovo-apartment.mp4 (git-ignored)
```
Needs ffmpeg (with rubberband), numpy, Pillow. Timings at the top of build.py.

## Subtitles
`subs.json` holds the 7 line timings (seconds in the original recording).
Fill in `"text"` and rebuild — subtitles appear automatically.
