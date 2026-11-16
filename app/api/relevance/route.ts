// POST /api/relevance
// Body: { title, source, date, link } for one article.
// Asks the LLM (Groq) how relevant the article is to Apple Inc. (AAPL) and
// returns { model, result }. The key stays on the server.
//
// Only the four fields above are sent to the LLM. Anything else in the body
// (for example source_query) is ignored and never reaches it.
//
// `npm run analyze-news` calls this route and saves the answers to data/cache/.
// The pages read that cache; they do not call this route.

import { getLlmConfig } from "@/lib/llm";
import { parseRelevanceResult, RELEVANCE_SCHEMA } from "@/lib/relevance";

const SYSTEM_PROMPT = `You judge how relevant a news article is to Apple Inc. (NASDAQ: AAPL), the technology company, for someone reading that company's stock page.

You only see the article's title, source, date and link. Judge from those. Do not guess facts that they do not support.

relevance:
- "direct": the article is mainly about Apple Inc., its products, services, finances, leadership or stock.
- "indirect": the article is mainly about something else (a supplier, competitor, regulator, market or sector), but it plausibly affects Apple Inc.
- "not_relevant": the article is not about Apple Inc. For example the fruit, Apple Records, "Big Apple", or an unrelated company or topic.

confidence: a number from 0 to 1 for how sure you are of the relevance label.

why (short phrases; write "None" or "Unclear from the title" when it applies):
- company: the main company or organisation the article is about.
- event: what happened.
- topic: the general subject area.
- product_service: the Apple product or service involved, if any.
- source_signal: what the source and the wording of the title suggest about relevance.

explanation: one or two plain sentences saying why this article does or does not matter to Apple Inc.`;

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { title, source, date, link } = body ?? {};
  if ([title, source, date, link].some((value) => typeof value !== "string" || value === "")) {
    return fail(400, "Send title, source, date and link as text.");
  }

  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) {
    return fail(503, "No API key on the server. Add GROQ_API_KEY to .env.local. Cached results still work without it.");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        // Low temperature and a fixed seed make answers more stable, but they do
        // not guarantee the same answer every time. The cache is what is repeatable.
        temperature: 0,
        seed: 1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          // Only these four fields go to the LLM.
          { role: "user", content: JSON.stringify({ title, source, date, link }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "article_relevance", strict: true, schema: RELEVANCE_SCHEMA },
        },
      }),
    });
  } catch {
    return fail(502, "Could not reach the LLM provider.");
  }

  if (!response.ok) {
    // Pass 429 (rate limit) through so the caller knows to wait and retry.
    const status = response.status === 429 ? 429 : 502;
    return fail(status, `The LLM provider returned HTTP ${response.status}.`);
  }

  // Check the answer against the schema. If it does not match, return an error
  // instead of a made-up result.
  let result = null;
  try {
    const data = await response.json();
    result = parseRelevanceResult(JSON.parse(data.choices[0].message.content));
  } catch {
    result = null;
  }
  if (!result) return fail(502, "The LLM answer did not match the expected format, so it was not used.");

  return Response.json({ model, result });
}
