// Builds the "Why you're seeing this" text from matched_rule (version 3, the
// scoring rule). The text is made by code from a fixed template, not by the LLM,
// so it always matches the real rule. It never says what the article is about.
//
// It starts with the label, has one short sentence per signal, and ends with the
// source and date. Our own rule speaks as "The headline names ...", a feed's tag
// as "Nasdaq tagged ...", so it is clear who made each judgement.
//
// Example: "Strong match. The headline names Apple. It uses 'price target', an
// Analysts keyword. Nasdaq tagged this story with AAPL. Published by Zacks on 16 November 2026."

export type Signal =
  | { signal: "company"; term: string; kind: "company_name" | "product" | "person"; where: "title" | "summary"; points: number }
  | { signal: "activity"; term: string; category: string; where: "title" | "summary"; points: number }
  | { signal: "ticker_tag"; by: string; tickers: string[]; points: number }
  | { signal: "source_type"; type: string; points: number };

export type MatchedRule = {
  score: number;
  label: "Strong match" | "Partial match";
  signals: Signal[];
  excluded_terms: string[];
  duplicates: string[];
};

// "an Analysts keyword", "a Management keyword"
const keyword = (category: string) => `${/^[aeiou]/i.test(category) ? "an" : "a"} ${category} keyword`;

// ["CNBC", "Forbes", "WSJ"] -> "CNBC, Forbes and WSJ"
const joinNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

const SOURCE_TYPE_SENTENCE: Record<string, string> = {
  official: "It comes from Apple's own newsroom.",
  ticker_feed: "It comes from a news feed for the AAPL stock.",
};

// "on 16 November 2026" in New York time.
export function publishedOn(isoDate: string): string {
  const text = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York" }).format(new Date(isoDate));
  return `on ${text}`;
}

export function buildReason(matched: MatchedRule, source: string, when: string): string {
  const sentences: string[] = [`${matched.label}.`];
  const company = matched.signals.find((s) => s.signal === "company");

  for (const signal of matched.signals) {
    if (signal.signal === "company") {
      sentences.push(signal.where === "title" ? `The headline names ${signal.term}.` : `${signal.term} appears only in the summary.`);
    } else if (signal.signal === "activity") {
      // "It" when the word is in the same place as the company name, otherwise say where.
      const place = company && company.where === signal.where ? "It" : signal.where === "title" ? "The headline" : "The summary";
      sentences.push(`${place} uses '${signal.term}', ${keyword(signal.category)}.`);
    } else if (signal.signal === "ticker_tag") {
      const others = signal.tickers.length - 1;
      sentences.push(
        others === 0
          ? `${signal.by} tagged this story with AAPL.`
          : others <= 2
            ? `${signal.by} tagged this story with AAPL and ${others} other ${others === 1 ? "stock" : "stocks"}.`
            : `${signal.by} tagged AAPL among ${signal.tickers.length} stocks.`,
      );
    } else if (signal.signal === "source_type" && SOURCE_TYPE_SENTENCE[signal.type]) {
      sentences.push(SOURCE_TYPE_SENTENCE[signal.type]);
    }
  }
  if (matched.duplicates.length > 0) sentences.push(`Also reported by ${joinNames(matched.duplicates)}.`);
  sentences.push(`Published by ${source} ${when}.`);
  return sentences.join(" ");
}
