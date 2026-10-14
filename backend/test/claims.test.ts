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

test("toll, evacuation and 'still missing' phrasings", () => {
  assert.deepEqual(numbers("Death toll in Sulawesi earthquake rises to 7"), ["killed=7:unattributed"]);
  assert.deepEqual(numbers("Lusong toll climbs to 11; 9 still missing"), ["killed=11:unattributed", "missing=9:unattributed"]);
  assert.deepEqual(numbers("Searchers found five more bodies, raising the death toll from Hurricane Lorena to 11."), ["killed=11:unattributed"]);
  assert.deepEqual(numbers("Ridge fire forces the evacuation of about 15,000 residents, fire officials said"), ["evacuated=15000(about):official"]);
  assert.deepEqual(numbers("30,000 now under evacuation orders as the Ridge fire grows"), ["evacuated=30000:unattributed"]);
  assert.deepEqual(numbers("The fire has killed 2 and forced 30,000 to flee"), ["evacuated=30000:unattributed", "killed=2:unattributed"]);
  assert.deepEqual(numbers("A blast killed nine people and injured 112."), ["injured=112:unattributed", "killed=9:unattributed"]);
  assert.deepEqual(numbers("Police said one person died and 11 were wounded"), ["injured=11:official", "killed=1:official"]);
});

test("no number from 'dozens', 'no one', background years or corrected figures", () => {
  assert.deepEqual(numbers("Shelling kills dozens at market"), []);
  assert.deepEqual(numbers("Emergency services said no one was killed."), []);
  assert.deepEqual(numbers("At least nine people died. The town has suffered repeated blasts, including one in 2016 that killed 42 people."), ["killed=9(atLeast):unattributed"]);
  assert.deepEqual(numbers("Correction: no deaths in tram crash", "An earlier version of this article said two people died."), []);
});

test("attribution follows the speaker of the sentence", () => {
  assert.deepEqual(numbers("Protest", "Police fired tear gas and arrested at least 30 people in Nairobi, a Reuters witness said."), ["arrested=30(atLeast):witness"]);
  assert.deepEqual(numbers("Kenya fuel protests: Two killed as police clash with demonstrators"), ["killed=2:unattributed"]);
  assert.deepEqual(numbers("IOM: 41 migrants missing off Lampedusa"), ["missing=41:official"]);
  assert.deepEqual(numbers("Tram derails in Lisbon, injuring 20 - emergency services"), ["injured=20:official"]);
  assert.deepEqual(numbers("Lagos collapse", "Emergency workers pulled survivors out, and 12 people had died, LASEMA said."), ["killed=12:official"]);
  assert.deepEqual(numbers("Iran says it arrested 12 people spying for Israel"), ["arrested=12:official"]);
  // The hedge applies to the figure wherever it appears.
  assert.deepEqual(numbers("Floods: 4 dead", "At least four people drowned, local officials said."), ["killed=4(atLeast):official"]);
});

test("headline denials: contradictions count, references to an earlier denial don't; responsibility is flagged", () => {
  assert.equal(extractClaims("IMF says no agreement yet with Pakistan, contradicting finance minister").headlineDenial, true);
  assert.equal(extractClaims("Finance ministry clarifies minister's IMF remarks after Fund denial").headlineDenial, false);
  const side = extractClaims("Fukushima nuclear operator denies reports of leak after quake");
  assert.equal(side.deniedText, "reports of leak");
  assert.equal(extractClaims("RSF denies shelling El Fasher market, blames Sudanese army").responsibilityDenial, true);
  assert.equal(extractClaims("Nigeria denies petroleum minister has resigned").responsibilityDenial, false);
});
