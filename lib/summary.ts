// The AI summary of one article: the JSON schema sent to the LLM and the checks
// every answer must pass. No secrets here, so any file may import this.
//
// The summary helps the reader decide whether to read the long excerpt. It only
// describes what the excerpt says. It must never judge whether the article is
// about Apple Inc., how important it is, or whether it could move the stock.
// That judgement is left to the user (and the "Why you're seeing this" panel
// only states the collection rule).

import { findTerm, splitExcerpt } from "@/lib/sentences";

export type Keyword = { term: string; sentence_index: number };
export type SummaryResult = { summary: string; keywords: Keyword[] };

// JSON schema for Groq structured outputs. Strict mode needs every field in
// "required" and "additionalProperties": false on every object.
export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    keywords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          sentence_index: { type: "integer" },
        },
        required: ["term", "sentence_index"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "keywords"],
  additionalProperties: false,
};

// Phrases that judge relevance, importance or the effect on the stock. A summary
// that uses one is rejected and asked again.
const JUDGEMENT =
  /\b(relevan\w*|irrelevan\w*|important|importance|significan\w*|noteworthy|implications?|unrelated|investors? should|(?:stock|shares|share price) (?:could|may|might|will|would)|could (?:boost|hurt|lift|weigh on|affect|impact)|for (?:Apple(?:'s|’s)? )?(?:investors|shareholders))\b/i;

const COMPANY_NAME = /^(?:Apple|Apple Inc\.?|Apple's|Apple’s|AAPL|\$AAPL)$/i;

// Numbers in the summary that are not in the excerpt, such as "5" when the excerpt
// says "$5.2 trillion". Commas are ignored ("200,000" = "200000").
const numbersIn = (text: string) => (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
export function unknownNumbers(summary: string, excerpt: string): string[] {
  const known = new Set(numbersIn(excerpt));
  return numbersIn(summary).filter((n) => !known.has(n));
}

export function judgementWords(summary: string): string[] {
  return [...summary.matchAll(new RegExp(JUDGEMENT.source, "gi"))].map((m) => m[0]);
}

// Checks one LLM answer against the excerpt. Returns the cleaned result and the
// keywords that were dropped, or an error message.
// - The summary must have 2 or 3 sentences, no judgement phrase and no number
//   that is not in the excerpt.
// - A keyword is kept only if it is in the excerpt (whole words) and in the
//   summary (so it can be shown in bold). If the sentence number is wrong, it is
//   set to the first excerpt sentence that contains the term.
// - At least 3 keywords must remain. At most 5 are kept.
export function checkSummary(
  value: unknown,
  excerpt: string,
): { result: SummaryResult; dropped: string[] } | { error: string } {
  const v = value as { summary?: unknown; keywords?: unknown } | null;
  if (typeof v?.summary !== "string" || !Array.isArray(v.keywords)) return { error: "wrong shape" };
  // The model sometimes writes a non-breaking hyphen (Wi‑Fi). Use the plain one, as in the excerpt.
  const summary = v.summary.replace(/[‐‑]/g, "-").replace(/\s+/g, " ").trim();
  const count = splitExcerpt(summary).flat().length;
  if (count < 2 || count > 3) return { error: `summary has ${count} sentences` };
  const judged = judgementWords(summary);
  if (judged.length > 0) return { error: `summary judges the article (${judged.join(", ")})` };
  const unknown = unknownNumbers(summary, excerpt);
  if (unknown.length > 0) return { error: `summary has numbers that are not in the excerpt (${unknown.join(", ")})` };

  const sentences = splitExcerpt(excerpt).flat();
  const keywords: Keyword[] = [];
  const dropped: string[] = [];
  for (const k of v.keywords as { term?: unknown; sentence_index?: unknown }[]) {
    const term = typeof k?.term === "string" ? k.term.trim() : "";
    if (!term || keywords.some((kept) => kept.term.toLowerCase() === term.toLowerCase())) continue;
    // The company name alone is not a keyword: it would be bold in almost every summary
    // and could make an article look more related to Apple than it is.
    if (COMPANY_NAME.test(term)) {
      dropped.push(term);
      continue;
    }
    const given = sentences.find((s) => s.index === k.sentence_index);
    const sentence = given && findTerm(given.text, term) !== -1 ? given : sentences.find((s) => findTerm(s.text, term) !== -1);
    if (!sentence || findTerm(summary, term) === -1) {
      dropped.push(term);
      continue;
    }
    keywords.push({ term, sentence_index: sentence.index });
  }
  if (keywords.length < 3) return { error: `only ${keywords.length} keywords are in both the excerpt and the summary` };
  return { result: { summary, keywords: keywords.slice(0, 5) }, dropped };
}
