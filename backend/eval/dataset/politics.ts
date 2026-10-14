import { a, DENIAL, ev, RETRACTION, type LabeledEvent } from "../dsl.ts";

// Elections, statements and denials, corrections, official announcements, state media and rumours.
// Politicians named here are invented.
export const politics: LabeledEvent[] = [
  ev("kenya-election", "2026-10-11T08:00:00Z", "corroborated", [
    a("nation-ke", 0, "IEBC declares Wanjiru winner of presidential election", "The Independent Electoral and Boundaries Commission declared Grace Wanjiru the winner with 50.8 percent of the vote."),
    a("reuters-bluesky", 30, "Kenya's Wanjiru declared winner of presidential election", "Kenya's electoral commission declared Grace Wanjiru president-elect with 50.8% of the vote on Saturday."),
    a("bbc-world", 60, "Kenya election: Grace Wanjiru wins presidency", "Ms Wanjiru narrowly avoided a run-off, official results show."),
    a("aljazeera", 90, "Kenya opposition rejects Wanjiru's presidential election win", "Opposition candidate Peter Otieno said the results were 'doctored' and vowed to challenge them in the Supreme Court.", DENIAL),
    a("guardian-world", 120, "Kenya's opposition vows court challenge after Wanjiru declared president", ""),
    a("nation-ke", 200, "Wanjiru victory: Supporters celebrate in Nairobi and Nyeri", ""),
  ], "the loser rejecting a result is not evidence the result is false (needs stance understanding)"),

  ev("portugal-election", "2026-10-11T21:00:00Z", "corroborated", [
    a("euronews", 0, "Portugal election: centre-right AD wins most votes but falls short of majority", "Exit polls and early results showed the Democratic Alliance ahead with about 32% of the vote."),
    a("reuters-bluesky", 60, "Portugal's centre-right wins snap election, far right surges", "The Democratic Alliance won 89 of 230 seats, while the far-right Chega party came second with 60 seats, official results showed."),
    a("guardian-world", 100, "Portugal's far-right Chega becomes second largest party in snap election", ""),
    a("france24-en", 120, "Portugal votes: Matos's AD wins but needs allies to govern", "Prime Minister Rui Matos claimed victory but will need support in parliament."),
    a("dw-en", 150, "Portugal election: Far right surges as centre-right wins", ""),
    a("rte-news", 200, "Centre-right wins Portugal election as far-right Chega surges to second", ""),
  ]),

  ev("pakistan-imf", "2026-10-12T06:00:00Z", "disputed", [
    a("dawn", 0, "IMF staff-level agreement reached, says finance minister Mahmood", "Finance Minister Tariq Mahmood said Pakistan had reached a staff-level agreement with the IMF for a $1.1 billion tranche."),
    a("reddit-worldnews", 30, "Pakistan FM claims IMF deal done", ""),
    a("toi-world", 60, "Pakistan says it has reached IMF deal for $1.1 billion tranche", ""),
    a("reuters-bluesky", 120, "IMF says no agreement yet with Pakistan, contradicting finance minister", "The International Monetary Fund said talks with Pakistan were continuing and no staff-level agreement had been reached, contradicting earlier remarks by Finance Minister Tariq Mahmood.", DENIAL),
    a("arabnews", 150, "IMF denies Pakistan deal reached, says talks ongoing", "", DENIAL),
    a("dawn", 200, "Finance ministry clarifies minister's IMF remarks after Fund denial", "The finance ministry said the minister had meant that talks were in their final stage."),
  ], "minister's claim contradicted by the IMF"),

  ev("nigeria-minister-rumour", "2026-10-13T07:00:00Z", "disputed", [
    a("premiumtimes", 0, "Petroleum minister Abubakar resigns amid fuel scarcity, sources say", "Minister of State for Petroleum Resources Bala Abubakar has submitted his resignation letter to the President, sources in the presidency said."),
    a("reddit-worldnews", 40, "Nigeria's petroleum minister has resigned??", ""),
    a("africanews", 90, "Nigeria: Petroleum minister Abubakar reportedly resigns", ""),
    a("premiumtimes", 180, "Petroleum ministry dismisses reports of minister Abubakar's resignation as fake news", "The ministry said the minister remained in office and described the reports as 'false and mischievous'.", DENIAL),
    a("aljazeera", 220, "Nigeria denies petroleum minister has resigned", "Officials said Bala Abubakar was attending a meeting in Abuja.", DENIAL),
  ]),

  ev("uk-mp-arrest-retracted", "2026-10-12T22:00:00Z", "retracted", [
    a("telegraph", 0, "Conservative MP James Whitcombe arrested on suspicion of fraud", "The MP for North Wealdshire was arrested at his home on Tuesday morning, sources said."),
    a("reddit-news", 30, "Tory MP James Whitcombe arrested for fraud (Telegraph)", ""),
    a("independent-world", 60, "MP James Whitcombe arrested on suspicion of fraud, reports say", ""),
    a("bbc-top", 150, "Police say no MP has been arrested after reports about James Whitcombe", "Thames Valley Police said reports that the MP for North Wealdshire had been arrested were incorrect.", DENIAL),
    a("telegraph", 200, "Correction: James Whitcombe MP has not been arrested", "An earlier version of this article wrongly reported that Mr Whitcombe had been arrested. We apologise for the error.", RETRACTION),
  ]),

  ev("lisbon-tram", "2026-10-13T16:00:00Z", "corroborated", [
    a("euronews", 0, "Lisbon tram derails, injuring 20", "A historic tram derailed on a steep street in Lisbon's Alfama district, injuring 20 people, emergency services said.", "injured 20 official"),
    a("reuters-bluesky", 40, "Tram derails in Lisbon, injuring 20 - emergency services", "", "injured 20 official"),
    a("guardian-world", 90, "Lisbon tram crash: 2 dead, 20 injured in Alfama derailment", "Portuguese media said two people were killed when the tram left the tracks.", "killed 2 media", "injured 20"),
    a("guardian-world", 240, "Correction: Lisbon tram crash caused no deaths, 20 injured", "An earlier version of this article said two people died in the Lisbon tram derailment, citing Portuguese media. Emergency services said no one was killed.", "injured 20", RETRACTION),
    a("france24-en", 260, "Lisbon tram derailment injures 20 in Alfama district", "Officials said four of the injured were in serious condition.", "injured 20"),
  ], "a correction of one figure: the derailment itself stands"),

  ev("marburg-uganda", "2026-10-11T10:00:00Z", "confirmed", [
    a("who-news", 0, "Marburg virus disease - Uganda", "On 9 October 2026, the Ministry of Health of Uganda declared an outbreak of Marburg virus disease in Kasese district. As of 10 October, four confirmed cases, including two deaths, have been reported.", "killed 2"),
    a("reuters-bluesky", 120, "Uganda declares Marburg virus outbreak after two deaths", "Uganda's health ministry said on Thursday four cases of the Ebola-like Marburg virus had been confirmed in the western district of Kasese, two of them fatal.", "killed 2"),
    a("bbc-world", 180, "Marburg: Uganda confirms outbreak of deadly virus", "Health officials said two people had died and contacts were being traced in Kasese.", "killed 2 official"),
    a("un-news", 300, "WHO rushes support to Uganda as Marburg outbreak confirmed", "The World Health Organization is deploying experts and supplies to Kasese district, where four cases and two deaths have been confirmed.", "killed 2"),
    a("nation-ke", 400, "Uganda Marburg outbreak: Kenya steps up screening at border points", "Kenya's health ministry said travellers from western Uganda would be screened at the Busia and Malaba crossings."),
    a("who-news", 2800, "WHO: Marburg cases in Uganda rise to seven, three deaths", "As of 12 October, seven confirmed cases including three deaths have been reported in Kasese and Kampala.", "killed 3 official"),
  ], "two primary origins (WHO, UN); a neighbour's reaction belongs to the event"),

  ev("us-myanmar-sanctions", "2026-10-12T15:00:00Z", "confirmed", [
    a("us-state-press", 0, "Imposing Sanctions on Burma Military-Owned Gem Enterprises", "Today, the Department of State is designating three entities and five individuals connected to the Burmese military's gem and timber trade."),
    a("reuters-bluesky", 60, "US imposes sanctions on Myanmar military-linked gem firms", "The United States on Tuesday imposed sanctions on three companies and five people tied to Myanmar's military, the State Department said."),
    a("politico", 120, "Treasury and State hit Myanmar junta's gem trade with new sanctions", ""),
    a("thehill", 150, "US slaps new sanctions on Myanmar junta's gem and timber businesses", ""),
    a("aljazeera", 300, "US sanctions Myanmar military-linked firms as civil war rages", "Rights groups welcomed the move but said more pressure was needed on the military's revenue sources."),
  ], "official title ('Burma') shares few words with news headlines ('Myanmar')"),

  ev("uk-visa-rules", "2026-10-13T09:00:00Z", "confirmed", [
    a("ukgov-news", 0, "New rules to cut net migration: skilled worker salary threshold rises", "The Home Secretary has announced changes to the Skilled Worker visa route, raising the general salary threshold to £41,700 from April."),
    a("bbc-top", 60, "Skilled worker visa salary threshold to rise to £41,700", "The Home Office says the change will reduce net migration by around 100,000 a year."),
    a("guardian-world", 90, "Home Office raises skilled worker visa salary threshold in migration crackdown", "Care sector leaders warned the change could worsen staff shortages."),
    a("telegraph", 100, "Visa salary threshold raised to £41,700 to curb migration", ""),
    a("independent-world", 130, "Skilled worker visa: What the new salary rules mean for you", ""),
    a("sky-world", 140, "Migration: Salary threshold for skilled worker visas to rise by a third", "The Home Secretary said the changes would cut net migration significantly."),
  ]),

  ev("xinjiang-railway", "2026-10-12T02:00:00Z", "unverified", [
    a("xinhua", 0, "China opens high-speed railway linking Urumqi and Hotan in Xinjiang", "The new line cuts travel time between the two cities to under seven hours, China State Railway Group said."),
    a("cgtn", 30, "Xinjiang's first high-speed railway to southern Tarim Basin begins operation", ""),
    a("xinhua", 120, "Chinese premier hails Xinjiang railway as boost to development", ""),
  ], "only state media of the country involved"),

  ev("shanxi-mine", "2026-10-12T12:00:00Z", "corroborated", [
    a("xinhua", 0, "Coal mine collapse in north China's Shanxi traps 20 miners", "A coal mine collapsed in Lüliang, Shanxi Province, on Monday afternoon, trapping 20 miners, local authorities said."),
    a("cgtn", 60, "Rescue under way after Shanxi coal mine collapse; 11 dead", "Eleven miners were confirmed dead and nine remain trapped, according to the local emergency management bureau.", "killed 11 official"),
    a("reuters-bluesky", 120, "Coal mine collapse in China's Shanxi kills 11, state media says", "Nine miners remain trapped underground, state broadcaster CCTV reported.", "killed 11 official"),
    a("scmp-world", 200, "Shanxi mine disaster: 11 killed as safety concerns mount over coal output push", "", "killed 11"),
    a("xinhua", 600, "Death toll rises to 15 in Shanxi coal mine collapse", "", "killed 15"),
    a("bbc-world", 700, "China mine collapse: 15 dead in Shanxi", "Five miners are still missing, state media said.", "killed 15", "missing 5 official"),
  ], "state media first, then independent outlets"),

  ev("lagos-airport-rumour", "2026-10-12T20:00:00Z", "unverified", [
    a("reddit-worldnews", 0, "Reports of a large explosion near Murtala Muhammed airport in Lagos?", ""),
    a("reddit-news", 20, "Explosion at Lagos airport, video circulating", ""),
    a("reddit-worldnews", 45, "Lagos airport explosion - anyone have info? Smoke seen from Ikeja", ""),
  ], "social-only rumour in a city with another big story running"),

  ev("shark-video-hoax", "2026-10-11T03:00:00Z", "disputed", [
    a("reddit-news", 0, "Shark swimming in flooded street in Cedar Key after Hurricane Lorena (video)", ""),
    a("reddit-worldnews", 30, "Video shows shark in flooded Florida street during Hurricane Lorena", ""),
    a("afp-bluesky", 600, "Fact check: Video of shark in flooded Florida street is fake", "The clip circulating after Hurricane Lorena was digitally altered and has been shared online after previous storms, AFP Fact Check found.", DENIAL),
    a("fox-world", 700, "No, that viral shark video isn't from Hurricane Lorena", "The same clip has circulated after at least five hurricanes since 2017.", DENIAL),
  ], "a debunked viral claim riding on a real story"),

  ev("us-stopgap-bill", "2026-10-13T23:00:00Z", "reported", [
    a("thehill", 0, "Senate passes stopgap funding bill, averting shutdown", "The Senate voted 77-19 on Monday night to pass a stopgap bill that funds the government through Dec. 20, sending it to the president's desk."),
    a("axios", 40, "Senate passes stopgap funding bill, averting shutdown", "The Senate voted 77-19 on Monday night to pass a stopgap bill that funds the government through Dec. 20, sending it to the president's desk."),
    a("politico", 60, "Shutdown averted: Senate clears stopgap spending bill in bipartisan vote", ""),
  ], "an uncredited copy from another owner counts once; two tier-2 origins are not enough"),

  ev("brazil-forest-fund", "2026-10-11T15:00:00Z", "corroborated", [
    a("mercopress", 0, "Brazil launches $5 billion fund to pay countries to protect rainforests", ""),
    a("aljazeera", 30, "Brazil unveils fund to pay for keeping tropical forests standing", ""),
    a("scmp-world", 60, "Brazil's tropical forest fund draws pledges from Norway, Germany", ""),
  ], "three tier-2 origins"),
];
