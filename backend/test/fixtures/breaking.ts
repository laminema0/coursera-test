import { storyIdFor } from "../../src/news/url.ts";
import type { Article, NewsSource } from "../../src/sources/types.ts";

// Realistic (invented) breaking-news coverage used to test grouping, claims and scoring.

const src = (id: string, tier: NewsSource["tier"], owner: string, extra: Partial<NewsSource> = {}): NewsSource => ({
  id, name: id, url: `https://${id}.test/feed`, format: "rss", tier, owner, country: "XX", pollMinutes: 5, ...extra,
});

export const sources: NewsSource[] = [
  src("bbc-world", 1, "bbc"), src("bbc-top", 1, "bbc"), src("guardian", 1, "guardian"), src("npr", 1, "npr"),
  src("dw", 1, "dw"), src("cbc", 1, "cbc"), src("sky", 2, "sky"), src("independent", 2, "independent"),
  src("aljazeera", 2, "aljazeera", { stateFunded: true, country: "QA" }), src("fox", 2, "fox"), src("cbs", 2, "paramount"),
  src("usgs", "primary", "usgs", { format: "usgs-geojson" }), src("ukgov", "primary", "ukgov"),
  src("reddit", "signal", "reddit"),
];
export const sourceMap = new Map(sources.map((s) => [s.id, s]));

type Spec = { event: string; source: string; at: string; title: string; summary?: string };

const specs: Spec[] = [
  // Earthquake: official USGS report, independent outlets, two copies of one Reuters story.
  { event: "quake", source: "reddit", at: "2026-10-14T09:12:00Z", title: "Huge earthquake just hit Malatya, buildings down" },
  { event: "quake", source: "usgs", at: "2026-10-14T09:10:00Z", title: "M 6.1 earthquake – 20 km S of Malatya, Turkey", summary: "Magnitude 6.1 · 20 km S of Malatya, Turkey · PAGER alert: yellow" },
  { event: "quake", source: "bbc-world", at: "2026-10-14T09:40:00Z", title: "Turkey earthquake: Strong quake hits Malatya province", summary: "At least 5 people were killed when a magnitude 6.1 earthquake struck eastern Turkey, local officials said." },
  { event: "quake", source: "bbc-top", at: "2026-10-14T09:40:00Z", title: "Turkey earthquake: Strong quake hits Malatya province", summary: "At least 5 people were killed when a magnitude 6.1 earthquake struck eastern Turkey, local officials said." },
  { event: "quake", source: "npr", at: "2026-10-14T10:05:00Z", title: "Earthquake in eastern Turkey kills at least 12", summary: "A 6.1 magnitude earthquake struck Malatya province on Tuesday, killing at least 12 people, Reuters reported." },
  { event: "quake", source: "sky", at: "2026-10-14T10:07:00Z", title: "Earthquake in eastern Turkey kills at least 12", summary: "A 6.1 magnitude earthquake struck Malatya province on Tuesday, killing at least 12 people, Reuters reported." },
  { event: "quake", source: "guardian", at: "2026-10-14T10:30:00Z", title: "Turkey earthquake: death toll rises to 14 as rescuers search Malatya rubble", summary: "Turkey's disaster agency AFAD said 14 people had died and 120 were injured after the quake in Malatya." },
  { event: "quake", source: "aljazeera", at: "2026-10-14T10:45:00Z", title: "Malatya earthquake: Turkey says 14 dead, 120 injured", summary: "Turkey's disaster management agency says rescue teams are searching collapsed buildings in Malatya after the earthquake." },
  { event: "quake", source: "dw", at: "2026-10-14T11:10:00Z", title: "Turkey: Malatya earthquake death toll climbs to 15", summary: "Rescuers pulled more bodies from the rubble in Malatya, bringing the earthquake death toll to 15, officials said." },

  // Minister statement, then the ministry denies it.
  { event: "minister", source: "reddit", at: "2026-10-14T08:00:00Z", title: "Ruritania finance minister apparently said they will default on debt??" },
  { event: "minister", source: "fox", at: "2026-10-14T08:20:00Z", title: "Ruritania finance minister Karl Weber says country will default on its debt", summary: "Finance minister Karl Weber said Ruritania would default on its foreign debt payments, according to a local radio interview." },
  { event: "minister", source: "independent", at: "2026-10-14T08:50:00Z", title: "Ruritania minister Weber warns of debt default", summary: "Finance minister Karl Weber told local radio that Ruritania could default on foreign debt payments." },
  { event: "minister", source: "guardian", at: "2026-10-14T09:30:00Z", title: "Ruritania finance ministry denies minister Weber said country would default on debt", summary: "The finance ministry denied reports that minister Karl Weber said Ruritania would default, calling the radio quote false." },

  // Mall shooting with conflicting numbers.
  { event: "shooting", source: "reddit", at: "2026-10-14T15:02:00Z", title: "Shots fired at Easton mall in Columbus Ohio right now" },
  { event: "shooting", source: "cbs", at: "2026-10-14T15:30:00Z", title: "Shooting at Columbus, Ohio shopping mall leaves 3 dead, police say", summary: "Three people were killed and several injured in a shooting at Easton Town Center in Columbus, police said." },
  { event: "shooting", source: "fox", at: "2026-10-14T15:45:00Z", title: "Columbus mall shooting: 4 killed at Easton Town Center", summary: "Four people were killed in a shooting at the Easton Town Center mall in Columbus, Ohio, witnesses said." },
  { event: "shooting", source: "cbc", at: "2026-10-14T16:10:00Z", title: "3 killed, 7 injured in shooting at Ohio mall", summary: "Columbus police said three people were killed and seven wounded at Easton Town Center; a suspect is in custody." },
  { event: "shooting", source: "npr", at: "2026-10-14T16:40:00Z", title: "Police: 3 dead, 8 injured in Columbus mall shooting; suspect arrested", summary: "Columbus police chief said three people died and eight were injured in the shooting at Easton Town Center mall." },

  // UK flood warning from an official source plus coverage.
  { event: "flood", source: "ukgov", at: "2026-10-14T06:00:00Z", title: "Severe flood warnings issued for River Severn in Shropshire", summary: "The Environment Agency has issued severe flood warnings for the River Severn in Shropshire, meaning danger to life." },
  { event: "flood", source: "bbc-world", at: "2026-10-14T06:40:00Z", title: "Shropshire floods: Severe warnings for River Severn", summary: "Residents near the River Severn in Shropshire are urged to evacuate after severe flood warnings." },

  // Unrelated noise.
  { event: "iphone", source: "cbs", at: "2026-10-14T12:00:00Z", title: "Apple unveils new iPhone with longer battery life" },
  { event: "football", source: "sky", at: "2026-10-14T19:00:00Z", title: "Premier League: Arsenal beat Chelsea 2-1 at the Emirates" },
  { event: "turkey-economy", source: "dw", at: "2026-10-14T13:00:00Z", title: "Turkey's central bank holds interest rates steady", summary: "Turkey's central bank kept its main interest rate unchanged as inflation slowed." },
  { event: "other-quake", source: "usgs", at: "2026-10-13T02:00:00Z", title: "M 4.9 earthquake – 80 km W of Lima, Peru", summary: "Magnitude 4.9 · 80 km W of Lima, Peru" },
];

export const articles: Article[] = specs.map((s, i) => {
  const url = `https://${s.source}.test/${s.event}/${i}`;
  return {
    id: storyIdFor(url), url, title: s.title, summary: s.summary, publishedAt: new Date(s.at).toISOString(),
    fetchedAt: new Date(s.at).toISOString(), language: "en", sourceIds: [s.source],
  };
});

/** Expected event label for each article id. */
export const expectedEvent = new Map(articles.map((a, i) => [a.id, specs[i]!.event]));
