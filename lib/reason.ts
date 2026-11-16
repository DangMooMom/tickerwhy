// Builds the "Why you're seeing this" text from matched_rule, the record of which
// collection-rule words were found in the headline and the first paragraph.
// The text is made by code, not by the LLM, so it always matches the real rule.
// It only states the evidence; it never says what the article is about.

export type MatchedRule = {
  headline: Record<string, number>; // rule word -> times found
  first_paragraph: Record<string, number>;
};

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

// ["a", "b", "c"] -> "a, b and c"
function joinList(parts: string[]): string {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function describeCounts(counts: Record<string, number>): string {
  return joinList(Object.entries(counts).map(([term, n]) => `'${term}' ${times(n)}`));
}

function describeNone(terms: string[]): string {
  const quoted = terms.map((term) => `'${term}'`);
  if (quoted.length === 1) return `no ${quoted[0]}`;
  if (quoted.length === 2) return `neither ${quoted[0]} nor ${quoted[1]}`;
  return `none of ${joinList(quoted).replace(/ and ([^ ]+)$/, " or $1")}`;
}

// "on 16 November 2026" in New York time.
export function publishedOn(isoDate: string): string {
  const date = new Date(isoDate);
  const text = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York" }).format(date);
  return `on ${text}`;
}

// terms: the rule words used when the article was collected.
// when: for example "on 16 November 2026".
export function buildReason(matched: MatchedRule, terms: string[], source: string, when: string): string {
  const inHeadline = Object.keys(matched.headline).length > 0;
  const inParagraph = Object.keys(matched.first_paragraph).length > 0;

  let first: string;
  if (inHeadline && inParagraph) {
    first = `This article was collected because its headline contains ${describeCounts(matched.headline)}, and its first paragraph contains ${describeCounts(matched.first_paragraph)}.`;
  } else if (inHeadline) {
    first = `This article was collected because its headline contains ${describeCounts(matched.headline)}; its first paragraph contains ${describeNone(terms)}.`;
  } else {
    first = `This article was collected because its first paragraph contains ${describeCounts(matched.first_paragraph)}; its headline contains ${describeNone(terms)}.`;
  }
  return `${first} Published by ${source} ${when}.`;
}
