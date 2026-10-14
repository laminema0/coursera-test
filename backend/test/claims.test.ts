import assert from "node:assert/strict";
import { test } from "node:test";
import { extractClaims, speakerKeyOf } from "../src/analysis/claims.ts";

const numbers = (title: string, summary?: string) =>
  extractClaims(title, summary).numbers.map((n) => `${n.kind}=${n.value}${n.qualifier === "exact" ? "" : `(${n.qualifier})`}:${n.attribution}`).sort();

test("casualty counts with qualifiers and attribution", () => {
  assert.deepEqual(numbers("Earthquake in eastern Turkey kills at least 12", "A 6.1 magnitude earthquake struck Malatya province on Tuesday, killing at least 12 people, Reuters reported."), [
    "killed=12(atLeast):media", "magnitude=6.1:media",
  ]);
  assert.deepEqual(numbers("Turkey earthquake: death toll rises to 14 as rescuers search Malatya rubble", "Turkey's disaster agency AFAD said 14 people had died and 120 were injured after the quake in Malatya."), [
    "injured=120:official", "killed=14:official",
  ]);
  assert.deepEqual(numbers("3 killed, 7 injured in shooting at Ohio mall", "Columbus police said three people were killed and seven wounded at Easton Town Center; a suspect is in custody."), [
    "injured=7:official", "killed=3:official",
  ]);
  assert.deepEqual(numbers("Columbus mall shooting: 4 killed at Easton Town Center", "Four people were killed in a shooting at the Easton Town Center mall in Columbus, Ohio, witnesses said."), [
    "killed=4:witness",
  ]);
});

test("same number in a later, attributed sentence keeps the first match only", () => {
  const claims = extractClaims("Police: 3 dead, 8 injured in Columbus mall shooting; suspect arrested", "Columbus police chief said three people died and eight were injured.");
  assert.deepEqual(claims.numbers.map((n) => [n.kind, n.value, n.attribution]), [["killed", 3, "official"], ["injured", 8, "official"]]);
});

test("more patterns: thousands separators, word numbers, evacuations, missing", () => {
  assert.deepEqual(numbers("More than 1,200 people evacuated as wildfire spreads", "Officials said nearly forty people are missing."), [
    "evacuated=1200(moreThan):unattributed", "missing=40(about):official",
  ]);
  assert.deepEqual(numbers("Arsenal beat Chelsea 2-1"), []);
});

test("statements, denials and retractions", () => {
  const claim = extractClaims("Ruritania finance minister Karl Weber says country will default on its debt");
  assert.deepEqual(claim.statements, [{ speakerKey: "weber", speaker: "Ruritania finance minister Karl Weber", verb: "says", stance: "asserts" }]);
  assert.equal(claim.denial, false);

  const denial = extractClaims("Ruritania finance ministry denies minister Weber said country would default on debt", "The finance ministry denied reports, calling the radio quote false.");
  assert.equal(denial.denial, true);
  assert.ok(denial.statements.some((s) => s.speakerKey === "finance ministry" && s.stance === "denies"));

  assert.equal(extractClaims("Correction: earlier report misidentified the suspect").retraction, true);
  assert.equal(extractClaims("Newspaper retracts story on minister").retraction, true);
});

test("speaker keys match the same speaker across different phrasings", () => {
  assert.equal(speakerKeyOf("minister Weber"), "weber");
  assert.equal(speakerKeyOf("Finance minister Karl Weber"), "weber");
  assert.equal(speakerKeyOf("The finance ministry"), "finance ministry");
  assert.equal(speakerKeyOf("Columbus police chief"), "columbus police");
});

test("verb-first and 'lives' phrasings", () => {
  assert.deepEqual(numbers("Gunman killed at least 5 people at a festival, police said"), ["killed=5(atLeast):official"]);
  assert.deepEqual(numbers("Floods have claimed 12 lives across the region"), ["killed=12:unattributed"]);
  assert.deepEqual(numbers("More than 20 people have lost their lives in the storm, the agency said"), ["killed=20(moreThan):official"]);
  assert.deepEqual(numbers("Suspect was killed 2 days ago in a raid"), []);
  assert.deepEqual(numbers("Attack wounded 30 civilians"), ["injured=30:unattributed"]);
});
