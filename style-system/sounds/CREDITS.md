# Sound library — credits & licences

Real recorded sounds, taken from free/open-source game sound sets shipped in
Ubuntu. Credit them in the video description when publishing.

| File | Source | Original author(s) | Licence |
|---|---|---|---|
| `train_passby_slowing.ogg` | OpenSFX 1.0.3 "Monorail train station departure" | "Train passby (tape stop).wav" by Metzik, edited by Wuzzy | CC BY 3.0 |
| `metro_departure.ogg` | OpenSFX "Maglev train station departure" | "metro.wav" by Marec, edited by Janis Lukss | CC BY 3.0 |
| `train_horn_departure.ogg` | OpenSFX "Diesel electric train station departure" | "Locomotive 1 Distant horn.wav" by patchen, edited by Janis Lukss | CC BY 3.0 |
| `crash.ogg` | OpenSFX "Crash" | "crash.wav" by sagetyrtle, edited by Janis Lukss | CC BY 3.0 |
| `splat.ogg` | OpenSFX "Splat" | "splattt.mp3" by SlykMrByches, edited by Wuzzy | CC0 1.0 |
| `slurp.ogg` | OpenSFX "Toyland: Bubble slurped" | "Cartoon - Slurp!.wav" by Beviceps, edited by Wuzzy | CC BY 3.0 |
| `wind.ogg` | OpenSFX "Wind" | "wind1.wav" by Anton, edited by Janis Lukss | CC BY 3.0 |
| `scream_1/2/3.ogg` | Warzone 2100 (`audio/sfx/misc/scream*.ogg`) | Eidos Interactive / Warzone 2100 Project | GPL-2+ |
| `scream_female1/2/3.ogg`, `scream_male1.ogg`, `scream_old1.ogg` | Battle for Wesnoth 1.16 (`human-*-die-*.ogg`) | Wesnoth contributors | GPL-2+ |

OpenSFX: https://github.com/OpenTTD/OpenSFX — Warzone 2100: https://wz2100.net —
Wesnoth: https://www.wesnoth.org

## Adding sounds
Only add files whose licence allows reuse (CC0, CC BY, CC BY-SA, GPL) and
add a row here. Convert to mono 48 kHz Ogg Vorbis:
`ffmpeg -i in.wav -ac 1 -ar 48000 -c:a libvorbis -q:a 6 name.ogg`
