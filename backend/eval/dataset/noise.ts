import { a, ev, type LabeledEvent } from "../dsl.ts";

// Sports and business stories (numbers that are not casualties) and same-place-different-story hard negatives.
export const noise: LabeledEvent[] = [
  ev("clasico", "2026-10-11T21:00:00Z", "corroborated", [
    a("bbc-world", 0, "Real Madrid 3-1 Barcelona: Madrid go top of La Liga after Clasico win", ""),
    a("guardian-world", 20, "Real Madrid beat Barcelona 3-1 to move top of La Liga", ""),
    a("abc-us-intl", 60, "Real Madrid tops Barcelona in El Clasico, takes La Liga lead", ""),
  ]),

  ev("india-australia-test", "2026-10-12T10:00:00Z", "corroborated", [
    a("toi-world", 0, "India beat Australia by 6 wickets in second Test, level series 1-1", ""),
    a("hindu-intl", 30, "India level series with six-wicket win over Australia in Adelaide", ""),
    a("abc-au", 60, "Australia lose second Test to India by six wickets in Adelaide", "Australia's batting collapsed on day four as India chased down 241."),
  ]),

  ev("fed-rates", "2026-10-13T18:00:00Z", "corroborated", [
    a("npr-news", 0, "Federal Reserve holds interest rates steady, signals cuts later this year", ""),
    a("reuters-bluesky", 5, "Fed holds rates steady, sees two cuts in 2027", ""),
    a("nyt-home", 10, "Fed Leaves Rates Unchanged as Inflation Cools", ""),
    a("cbs-world", 30, "Fed keeps key interest rate unchanged at 4.25% to 4.5%", ""),
  ], "headlines share few words: 'holds steady' / 'leaves unchanged' / 'keeps unchanged'"),

  ev("vw-job-cuts", "2026-10-12T08:00:00Z", "corroborated", [
    a("dw-en", 0, "Volkswagen to cut 3,000 jobs at German plants", ""),
    a("reuters-bluesky", 30, "Volkswagen to cut 3,000 jobs in Germany as EV demand slows", "The carmaker said the cuts would be made through early retirement and attrition by 2028."),
    a("euronews", 60, "Volkswagen job cuts: 3,000 positions to go at German plants", ""),
    a("guardian-world", 90, "Volkswagen to axe 3,000 German jobs amid weak electric car sales", ""),
  ], "big numbers that are not casualties"),

  ev("cerro-verde-strike", "2026-10-12T14:00:00Z", "corroborated", [
    a("reuters-bluesky", 0, "Workers at Peru's Cerro Verde copper mine in Arequipa begin indefinite strike", "The union said about 1,800 workers walked out over wages."),
    a("mercopress", 60, "Peru: Cerro Verde miners strike over pay as copper prices rise", ""),
  ], "same place as peru-quake, same day, different story"),

  ev("lubbock-budget", "2026-10-13T02:00:00Z", "reported", [
    a("kxan", 0, "Lubbock city council approves budget with new police funding", "The Lubbock City Council voted 6-1 to approve a $1.2 billion budget that adds 40 police officers."),
  ], "same city as the school shooting hours later"),

  ev("mannheim-digital-summit", "2026-10-12T13:00:00Z", "corroborated", [
    a("dw-en", 0, "Mannheim hosts EU ministers for talks on AI and digital markets", ""),
    a("euronews", 30, "EU digital ministers meet in Mannheim to discuss AI rules", ""),
  ], "same city as the knife attack the same day"),

  ev("tallahassee-fsu", "2026-10-11T18:00:00Z", "corroborated", [
    a("fox-world", 0, "Florida State postpones home game in Tallahassee because of Hurricane Lorena", "The Seminoles' game against Clemson will be played on Sunday instead, the university said."),
    a("cbs-world", 20, "Florida State-Clemson game moved to Sunday after Hurricane Lorena", ""),
    a("ap-bluesky", 45, "Hurricane Lorena forces Florida State to move Clemson game to Sunday", ""),
  ], "a side story that mentions the hurricane: separate sports event"),
];
