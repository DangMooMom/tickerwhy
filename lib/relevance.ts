// The LLM's relevance judgement for one article, the JSON schema sent to the LLM,
// and a checker for it. No secrets here, so any file may import this.
//
// The judgement is saved in data/cache/ for checking against the answer key
// later, and stock_relevant and category are used to pick the test list
// (scripts/select-test-set.mjs). It is NOT shown in the UI, so that users in a test are not steered by
// the AI. The "Why you're seeing this" text comes from the collection rule
// instead (lib/reason.ts).

// The AI value is called "unrelated" so it is not confused with the user's own
// "Not relevant" button, which is a separate thing.
export type RelevanceLevel = "direct" | "indirect" | "unrelated";

export const CATEGORIES = [
  "earnings",
  "product_launch",
  "legal_regulation",
  "analyst_rating",
  "supply_chain",
  "leadership",
  "market_move",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type RelevanceResult = {
  relevance: RelevanceLevel;
  confidence: number; // 0 to 1, the model's own estimate (not a measured accuracy)
  stock_relevant: boolean; // could an investor see this as moving the AAPL price? Used to pick the test list
  category: Category;
};

// JSON schema for Groq structured outputs. Strict mode needs every field in
// "required" and "additionalProperties": false on every object.
export const RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    relevance: { type: "string", enum: ["direct", "indirect", "unrelated"] },
    confidence: { type: "number" },
    stock_relevant: { type: "boolean" },
    category: { type: "string", enum: [...CATEGORIES] },
  },
  required: ["relevance", "confidence", "stock_relevant", "category"],
  additionalProperties: false,
};

// Returns the result if it matches the schema, or null. Used for every LLM
// response, so a bad value is never saved.
export function parseRelevanceResult(value: unknown): RelevanceResult | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.relevance !== "direct" && v.relevance !== "indirect" && v.relevance !== "unrelated") return null;
  if (typeof v.confidence !== "number" || !(v.confidence >= 0 && v.confidence <= 1)) return null;
  if (typeof v.stock_relevant !== "boolean") return null;
  if (!CATEGORIES.includes(v.category as Category)) return null;
  return { relevance: v.relevance, confidence: v.confidence, stock_relevant: v.stock_relevant, category: v.category as Category };
}
