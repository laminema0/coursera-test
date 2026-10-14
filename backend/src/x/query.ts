/** Only original posts that link somewhere: the ones that can point to a news article. */
export const NEWS_FILTER = "has:links -is:retweet -is:reply";

/**
 * Packs accounts into as few search queries as possible:
 * `(from:a OR from:b ...) has:links -is:retweet -is:reply`, each at most `maxLength` characters.
 * One query covering many accounts returns only matching posts, so we pay for nothing we throw away.
 */
export function buildQueries(accounts: string[], maxLength: number): string[] {
  const usernames = [...new Set(accounts.map((a) => a.trim().replace(/^@/, "")).filter(Boolean))];
  const queries: string[] = [];
  let current: string[] = [];

  const render = (names: string[]) => `(${names.map((n) => `from:${n}`).join(" OR ")}) ${NEWS_FILTER}`;

  for (const name of usernames) {
    if (render([name]).length > maxLength) {
      throw new RangeError(`Account "${name}" alone exceeds the query length limit`);
    }
    if (current.length > 0 && render([...current, name]).length > maxLength) {
      queries.push(render(current));
      current = [];
    }
    current.push(name);
  }
  if (current.length > 0) queries.push(render(current));
  return queries;
}
