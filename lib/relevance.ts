// The shape of one LLM relevance judgement, the JSON schema sent to the LLM,
// and a checker for it. No secrets here, so any file may import this.

// The AI value is called "unrelated" so it is not confused with the user's own
// "Not relevant" button, which is a separate thing.
export type RelevanceLevel = "direct" | "indirect" | "unrelated";

export type RelevanceResult = {
  relevance: RelevanceLevel;
  confidence: number; // 0 to 1, the model's own estimate (not a measured accuracy)
  why: {
    company: string;
    event: string;
    topic: string;
    product_service: string;
    source_signal: string;
  };
  explanation: string; // one or two sentences
};

export const RELEVANCE_LABELS: Record<RelevanceLevel, string> = {
  direct: "Direct",
  indirect: "Indirect",
  unrelated: "Unrelated",
};

const WHY_KEYS = ["company", "event", "topic", "product_service", "source_signal"] as const;

// JSON schema for Groq structured outputs. Strict mode needs every field in
// "required" and "additionalProperties": false on every object.
export const RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    relevance: { type: "string", enum: ["direct", "indirect", "unrelated"] },
    confidence: { type: "number" },
    why: {
      type: "object",
      properties: {
        company: { type: "string" },
        event: { type: "string" },
        topic: { type: "string" },
        product_service: { type: "string" },
        source_signal: { type: "string" },
      },
      required: [...WHY_KEYS],
      additionalProperties: false,
    },
    explanation: { type: "string" },
  },
  required: ["relevance", "confidence", "why", "explanation"],
  additionalProperties: false,
};

// Returns the result if it matches the schema, or null. Used for every LLM
// response and for every cache entry, so a bad value is never shown.
export function parseRelevanceResult(value: unknown): RelevanceResult | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  if (v.relevance !== "direct" && v.relevance !== "indirect" && v.relevance !== "unrelated") return null;
  if (typeof v.confidence !== "number" || !(v.confidence >= 0 && v.confidence <= 1)) return null;
  if (typeof v.explanation !== "string" || v.explanation.trim() === "") return null;
  if (typeof v.why !== "object" || v.why === null) return null;
  const why = v.why as Record<string, unknown>;
  if (WHY_KEYS.some((key) => typeof why[key] !== "string")) return null;

  return {
    relevance: v.relevance,
    confidence: v.confidence,
    why: {
      company: why.company as string,
      event: why.event as string,
      topic: why.topic as string,
      product_service: why.product_service as string,
      source_signal: why.source_signal as string,
    },
    explanation: v.explanation,
  };
}
