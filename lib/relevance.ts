// The shape of one LLM answer for an article, the JSON schema sent to the LLM,
// and checkers for it. No secrets here, so any file may import this.
//
// Only `reason` is shown in the UI ("Why you're seeing this").
// `relevance`, `confidence` and `matched_terms` are saved in the cache for
// checking answers later. They are hidden in the UI on purpose, so that users
// in a test are not steered by the AI's judgement.

// The AI value is called "unrelated" so it is not confused with the user's own
// "Not relevant" button, which is a separate thing.
export type RelevanceLevel = "direct" | "indirect" | "unrelated";

export type RelevanceResult = {
  relevance: RelevanceLevel; // hidden in the UI
  confidence: number; // 0 to 1, the model's own estimate; hidden in the UI
  reason: string; // shown: the evidence the article was collected on, nothing else
  matched_terms: string[]; // the words quoted in `reason`; hidden in the UI
};

// JSON schema for Groq structured outputs. Strict mode needs every field in
// "required" and "additionalProperties": false on every object.
export const RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    relevance: { type: "string", enum: ["direct", "indirect", "unrelated"] },
    confidence: { type: "number" },
    reason: { type: "string" },
    matched_terms: { type: "array", items: { type: "string" } },
  },
  required: ["relevance", "confidence", "reason", "matched_terms"],
  additionalProperties: false,
};

// Returns the result if it matches the schema, or null. Used for every LLM
// response and for every cache entry, so a bad value is never shown.
export function parseRelevanceResult(value: unknown): RelevanceResult | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  if (v.relevance !== "direct" && v.relevance !== "indirect" && v.relevance !== "unrelated") return null;
  if (typeof v.confidence !== "number" || !(v.confidence >= 0 && v.confidence <= 1)) return null;
  if (typeof v.reason !== "string" || v.reason.trim() === "") return null;
  if (!Array.isArray(v.matched_terms) || v.matched_terms.some((term) => typeof term !== "string")) return null;

  return {
    relevance: v.relevance,
    confidence: v.confidence,
    reason: v.reason.trim(),
    matched_terms: v.matched_terms as string[],
  };
}

// True if every matched term really is in the headline or summary. This catches
// an answer that quotes a word the article does not contain.
export function termsAppearIn(terms: string[], text: string): boolean {
  const lower = text.toLowerCase();
  return terms.every((term) => term.trim() !== "" && lower.includes(term.toLowerCase()));
}
