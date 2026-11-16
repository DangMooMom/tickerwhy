// Builds the "Why you're seeing this" text from matched_rule, the record of which
// collection-rule words were found in the headline and the RSS summary.
// The text is made by code, not by the LLM, so it always matches the real rule.
// It only names the words that were found, and never says what the article is about.
//
// Example: "Collected because the headline contains 'Apple' once and 'iPhone' once.
// Published by MacRumors on 16 November 2026."

export type MatchedRule = {
  headline: Record<string, number>; // rule word -> times found
  summary: Record<string, number>;
};

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

// { Apple: 1, iPhone: 2 } -> "'Apple' once and 'iPhone' twice"
function describeCounts(counts: Record<string, number>): string {
  const parts = Object.entries(counts).map(([term, n]) => `'${term}' ${times(n)}`);
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

// "on 16 November 2026" in New York time.
export function publishedOn(isoDate: string): string {
  const text = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York" }).format(new Date(isoDate));
  return `on ${text}`;
}

// when: for example "on 16 November 2026".
export function buildReason(matched: MatchedRule, source: string, when: string): string {
  const places: string[] = [];
  if (Object.keys(matched.headline).length > 0) places.push(`the headline contains ${describeCounts(matched.headline)}`);
  if (Object.keys(matched.summary).length > 0) places.push(`the summary contains ${describeCounts(matched.summary)}`);
  return `Collected because ${places.join(", and ")}. Published by ${source} ${when}.`;
}
