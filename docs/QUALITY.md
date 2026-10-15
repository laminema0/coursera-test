# Analysis quality: benchmark, results, known failures

The engine (grouping → claims → status) was first tested only on a small hand-made fixture. This environment can't
reach real news sites, so quality is measured on an **offline benchmark** of realistic, hand-labelled articles.

```
cd backend
npm run eval                 # metrics for train / test / all, worst mistakes (train split), 20k-article perf check
npm run eval -- --show-test  # also list held-out mistakes (look only after tuning)
npm run eval -- --all-errors --json out.json
```

`test/eval.test.ts` runs the benchmark in `npm test` (and so in CI) with floors a little below today's results,
so a change that makes grouping, numbers or statuses worse fails the build.

## The benchmark (`backend/eval/`)

- **57 events, 314 English articles**, written in the style of each feed: USGS/GDACS machine titles, wire ledes
  (Reuters/AP/AFP on Bluesky), broadcasters, newspapers, government and UN releases, Chinese/Russian/Iranian/Qatari/Saudi
  state media, Reddit posts. Incidents are invented; places are real; politicians and private people are invented.
- Coverage: quakes (with rising tolls and USGS/GDACS reports), a 3-day hurricane, typhoon, floods, wildfire,
  explosions, a building collapse, plane/bus/ferry/train accidents, shootings and stabbings, a market shelling, drone
  strikes, an outbreak, sanctions, visa rules, elections, minister claims contradicted or denied, a retracted arrest
  report, a figure correction, a debunked viral video, a social-only rumour, sports and business noise.
- Hard cases on purpose: **same place, different story** (Sulawesi quake vs ferry sinking, Arequipa quake vs miners'
  strike, Lubbock shooting vs city budget, Mannheim attack vs EU summit, Nairobi election vs fuel protests, El Fasher
  shelling vs truce talks); **same type, different place** (four quakes, three US shootings, two drone attacks, two
  floods, two explosions within 36 h); **copies** (one AP story republished by three outlets, an uncredited copy across
  owners); **side denials** (a nuclear operator denies a leak rumour after a confirmed quake).
- Labels: each article's true event, every expected number (kind, value, qualifier, attribution) and whether its
  headline is a denial or retraction; each event's expected final status. Articles without number labels must yield
  no numbers. Labels are in a small readable DSL (`eval/dsl.ts`), e.g. `"killed >=4 official"`.
- Labelling rules: a figure repeated in headline and summary is one claim with the strongest attribution and its hedge
  ("4 dead" + "at least four" = `>=4`); attribution is who the sentence names as the source (police, agencies, UN
  bodies, hospitals, state media → official; witnesses, residents → witness; "local media said", "Reuters reported"
  → media); background figures ("one in 2016 that killed 42") and figures quoted only to correct them are not claims.
- **Train/test split**: a hash of the event id puts each event in train or test (22 of 57 events, 39%, are held out;
  the hash was fixed before any tuning and not changed after seeing results). Mistakes are only listed for the train
  split unless `--show-test` is passed. All tuning used train mistakes only.
- **Performance**: 20,000 synthetic articles (72 h of developing events plus one-off stories, seeded) must be analyzed
  in under 5 s. The generator knows which event each article came from, so a B³ score on it is printed as a sanity
  check at scale (its text is artificial, so treat that number as a trend, not a quality figure).

Status accuracy is measured two ways: on the engine's own grouping (what a reader sees) and on the **true grouping**,
which isolates the status rules from grouping mistakes.

## Results

"Before" is the original engine on the final benchmark. "After (held out)" is the state when the test split was first
looked at; after that, a few obvious grammar gaps it revealed were fixed ("Final"). Those fixes are general patterns
(see below) but the test numbers in the last column are no longer a clean held-out estimate for numbers/attribution.

| Metric | Before (train / test / all) | After, held out (train / test / all) | Final (train / test / all) |
|---|---|---|---|
| Grouping B³ precision | 96.5 / 92.1 / 94.6 | 96.6 / 94.3 / 95.7 | 96.6 / 94.3 / 95.7 |
| Grouping B³ recall | 82.5 / 92.2 / 86.6 | 90.9 / 92.4 / 91.5 | 90.9 / 92.4 / 91.5 |
| **Grouping B³ F1** | 88.9 / 92.1 / 90.5 | 93.7 / 93.4 / 93.6 | 93.7 / 93.4 / 93.6 |
| Merged / split events (all) | 3 / 19 | 3 / 13 | 3 / 13 |
| Numbers precision | 94.4 / 98.5 / 95.8 | 100 / 98.8 / 99.5 | 100 / 98.9 / 99.6 |
| Numbers recall | 86.0 / 71.3 / 80.0 | 99.3 / 90.4 / 95.7 | 99.3 / 94.7 / 97.4 |
| **Numbers F1** | 90.0 / 82.7 / 87.2 | 99.6 / 94.4 / 97.6 | 99.6 / 96.7 / 98.5 |
| Qualifier accuracy (all) | 98.4 | 100 | 100 |
| Attribution accuracy | 80.3 / 91.0 / 84.2 | 99.3 / 92.9 / 96.8 | 99.3 / 96.6 / 98.2 |
| Headline denial P / R (all) | 88.9 / 72.7 | 100 / 81.8 | 100 / 81.8 |
| Retraction P / R (all) | 100 / 100 | 100 / 100 | 100 / 100 |
| **Status accuracy** | 85.7 / 86.4 / 86.0 | 91.4 / 86.4 / 89.5 | 91.4 / 86.4 / 89.5 |
| Status on true grouping | 91.4 / 95.5 / 93.0 | 97.1 / 95.5 / 96.5 | 97.1 / 95.5 / 96.5 |
| 20k synthetic: time | 4.99 s | 4.26 s | ~3.6–4.0 s |
| 20k synthetic: B³ precision / recall | 43.6 / 99.9 | 71.3 / 98.1 | 71.4 / 98.1 |

Recall per kind (all), before → final: killed 86 → 99, injured 93 → 98, missing 52 → 95, arrested 40 → 100,
evacuated 21 → 79, displaced 75 → 100, magnitude 100 → 100. Precision is 98–100% for every kind.

Honest reading: the big, generalizing wins are in **claim extraction** (held-out numbers F1 82.7 → 94.4 before any
test-informed fix) and in **grouping recall** (train 82.5 → 90.9; test was already high). **Held-out status accuracy
did not move** (86.4%): its three test failures are a debunk merged into its parent story, an official flood-warning
release that didn't join the storm coverage, and an election result "rejected" by the loser (see below). Train status
went 85.7 → 91.4, partly from rules aimed at train failures, so expect real-world gains closer to the test column.
Thresholds (0.3 join / 0.4 merge) were left unchanged; the grid around them is flat (±1 F1 point), so they aren't
fitted to this set.

## What changed

**Grouping** (`text.ts`, `cluster.ts`)
- **Snowballing fixed.** Containment (fair to short posts) was measured against the whole event centroid; a big event
  contains every common word, so its score for *any* short article tended to 0.6 > threshold and events chained into
  1,000-article blobs on the synthetic load. Containment is now measured against the event's recent articles.
- **Incident kinds must not conflict**: a headline about a ferry capsizing doesn't join an earthquake on the same
  island; an attack doesn't join truce talks in the same city. Kinds: quake, weather, blast, violence, crash, sinking,
  volcano, election, protest, outbreak, attack, diplomacy, labour. Ambiguous words ("strike") are left out.
- **Headline-vs-headline containment** as an extra signal (summaries dilute matching headlines).
- **Names weigh 1.5×** (capitalized words in running text; Title Case headlines are ignored). Copy detection still
  compares the plain text, so different headlines about the same place aren't mistaken for copies.
- **Normalization**: USGS "M 6.8 - 41 km SW of …" and GDACS "Magnitude 6.8M" read as "magnitude 6.8"; decimals kept;
  feed boilerplate (SSW, depth, UTC, 35km) dropped; demonyms map to countries; synonym families (typhoon/hurricane/
  cyclone, blaze/wildfire/fire, evacuated/evacuation, knife/stabbing, protesters/demonstrators, shelling, bombing…).
- **Speed**: incremental centroid norms, candidates ranked by shared rare words (top 12 scored), expired events leave
  the index, the merge pass re-examines only events that grew, cached IDF, cheap keyword guards before costly regexes.

**Claims** (`claims.ts`)
- No more "dozens" = 12 or "no one was killed" = 1; background-year clauses and "an earlier version said…" skipped.
- New phrasings: "toll climbs to 8", "death toll in X rises to 7", "raising the death toll … to 11", "remain/still
  missing", "found/confirmed/shot dead", "drowned", "has killed 2", "…and injured 112.", evacuation orders ("ordered to
  evacuate", "under evacuation orders", "evacuation of", "forced 30,000 to flee"), arrests and displacements as verbs.
  After the held-out look: plural verbs ("Floods kill 5"), "six bodies had been recovered", "all 18 on board",
  "arrest of 12".
- **Attribution follows the speaker**: the phrase attached to the speech verb decides ("Police arrested 30 people,
  a Reuters witness said" → witness). Topic labels before a colon ("Kenya protests: two killed") are no longer
  speakers; headline credits ("… - USGS"), agency acronyms ("LASEMA said") and "Iran says/claims" are.

**Disputes** (`claims.ts`, `verify.ts`)
- "Contradicts" is a denial; the noun "denial" in a headline ("…after Fund denial") is not.
- A headline denial no longer disputes an event when it denies **responsibility** ("denies involvement", "rejects
  accusations", "…, blames the army") or a **side rumour** that no other article in the event reports ("operator denies
  reports of leak after quake").

## Known failure patterns

| Pattern | Example in the benchmark | What it would take |
|---|---|---|
| A side story or debunk riding on a big story is grouped into it | shark-video hoax and a postponed football game merge into Hurricane Lorena; the debunk then marks the hurricane "disputed" | Understanding what each article is *about* (topic/frame), not just shared words → local model |
| Same city, story without an incident word | miners' strike in Arequipa joins the Arequipa earthquake | Event-type classification beyond a keyword list → local model |
| Official notices and terse social posts don't join | Environment Agency flood-warning release vs "Storm Isla" coverage; "Just felt a strong earthquake in Sendai" | Entity linking (Cumbria ∈ England, Sendai near Fukushima) via a gazetteer (GeoNames, free) |
| Long gaps in a developing story | a WHO update 40 h after the last Marburg article starts a new event | Linking new events to recent ones with the same rare names, across the 36 h window |
| Denials that dispute a claim inside a true event | Kenyan opposition "rejects" the declared result → disputed; RSF denies shelling → handled only because the headline also "blames" someone | Stance detection: who denies what, and is it the event or a detail → local model |
| Corrections of one figure | "Correction: tram crash caused no deaths, 20 injured" retracts the whole event | Claim-level retraction (mark the figure, keep the event); the status model is event-level today |
| Negative statements as denials | "Police say no MP has been arrested"; "No, that viral video isn't from Hurricane Lorena" | Negation scope → local model |
| Figures without a count word nearby | "120,000 flee homes" (evacuated? displaced?), "41 migrants feared dead", "two injured workers die" | Semantic role labelling → local model |
| Attribution across sentences | "Death toll rises to 6" + "the agency said six bodies were recovered" works; "about 2,000 evacuated" + "residents were moved to shelters, authorities said" doesn't | Coreference between headline and summary → local model |
| Generic one-off headlines | on the synthetic load, unrelated "school board approves budget" stories in different towns merge (precision 71%) | Requiring a shared name/rare term once real feeds show how often this happens |

## What would need an AI model (free, local via Ollama)

Keep the rules as the fast first pass and call a small open-weights model (e.g. Llama 3.1 8B, Qwen 2.5 7B, Mistral 7B
via Ollama, free on a home machine) **only on the hard cases the rules can flag cheaply**:

1. **Is this article about the same incident?** For borderline joins (similarity within ±0.1 of the threshold, or an
   article sharing a rare name with an event but missing the threshold), ask "same incident: yes/no". Expected to fix
   side stories, debunks and terse official notices.
2. **What does this headline deny?** For every headline denial: the event itself, a detail, or who is responsible.
   Feeds the status ladder directly (Kenya-style results, El Fasher-style responsibility denials, side rumours).
3. **Correction scope**: whole story or one figure, and which figure.
4. **Number roles** for sentences where rules found a number but no kind, or a kind without a clear attribution.

Each call is a short prompt on a headline plus ≤300 characters, so even a CPU-only machine can handle the few hundred
borderline cases a day this would involve. The benchmark is the gate: a model step ships only if it improves the
held-out columns above without slowing the 20k check beyond budget (model calls run asynchronously, after the rule
pass).

## Limits of this benchmark

- Written by one person from knowledge of real feeds, not collected from them: real feeds will have phrasings no one
  thought of. Run `npm run analyze` on a real collection and add misclassified items to `eval/dataset/` (with labels)
  as they're found.
- 314 articles is small. IDF is compressed compared with a real 72 h store (10–20k articles), which makes grouping
  *harder* here than in production; the synthetic set covers scale but not language.
- One labeller; some labels are judgement calls (e.g. whether a neighbouring country's screening measures belong to the
  outbreak event: here yes; whether a UN aid release two days later belongs to the quake: here yes).

## Update: scoped corrections and denials

Changes, made using train-split mistakes only:
- **Corrections** retract an event only if they negate the core claim ("…has not been arrested") or fewer than two other
  independent sources remain. A correction of a detail ("crash caused no deaths, 20 injured") keeps the status and adds
  "One source corrected a detail of its earlier report" to the reason.
- **Denials** dispute an event only if at least half of the denied terms appear in the rest of the event and at most one
  denied term is new. "Viral video of shark in flooded street is fake" no longer disputes the hurricane story.
- Denied text is taken from before the denial word when nothing follows it ("… is fake").
- New phrasings: "police say no MP has been arrested" (denial), "120,000 flee homes", "moved to temporary shelters",
  "residents of Isabela and Cagayan were evacuated".
- Labour words (union, wage, miner, worker, pay) form their own incident type, so a mine strike in Arequipa stays apart
  from the Arequipa earthquake.

| Metric (train / test / all) | Before this update | After |
|---|---|---|
| Grouping B³ F1 | 93.7 / 93.4 / 93.6 | 94.6 / 93.4 / 94.1 |
| Numbers F1 | 99.6 / 96.7 / 98.5 | 100 / 96.7 / 98.7 |
| Attribution accuracy | 99.3 / 96.6 / 98.2 | 100 / 96.6 / 98.7 |
| Denial recall | — / — / 81.8 | 100 / 66.7 / 90.9 |
| Status accuracy | — / — / 89.5 | 97.1 / 86.4 / 93.0 |
| Status (true grouping) | — / — / — | 100 / 95.5 / 98.2 |

The remaining status error on the train split comes from a grouping merge: a hurricane story absorbed a related sports story and
a hoax story that are labelled as separate events. Fixing it means tuning on held-out events, so it was left alone.
