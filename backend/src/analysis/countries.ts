/** Names that show a story is about a country (for the state-media rule). Extend as sources are added. */
export const COUNTRY_TERMS: Record<string, string[]> = {
  QA: ["qatar", "qatari", "doha"],
  SG: ["singapore", "singaporean"],
  SA: ["saudi", "riyadh", "kingdom"],
  AE: ["emirates", "uae", "emirati", "abu dhabi", "dubai"],
  CN: ["china", "chinese", "beijing"],
  RU: ["russia", "russian", "kremlin", "moscow"],
  IR: ["iran", "iranian", "tehran"],
  TR: ["turkey", "türkiye", "turkish", "ankara"],
  IN: ["india", "indian", "new delhi"],
  US: ["united states", "u.s.", "washington", "white house", "american"],
  GB: ["britain", "british", "uk", "u.k.", "downing street", "london"],
  DE: ["germany", "german", "berlin"],
  FR: ["france", "french", "paris", "elysee", "élysée"],
};

export function mentionsCountry(text: string, country: string): boolean {
  const terms = COUNTRY_TERMS[country];
  if (!terms) return false;
  const lower = text.toLowerCase();
  return terms.some((term) => new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(lower));
}
