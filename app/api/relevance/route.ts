// POST /api/relevance
// Body: { title, summary, source, date } for one article (summary may be "").
// Asks the LLM (Groq) for a short "why you're seeing this" reason plus a hidden
// relevance label, and returns { model, result }. The key stays on the server.
//
// Only the four fields above are sent to the LLM. Anything else in the body
// (for example source_query or spy_type) is ignored and never reaches it.
// The article body is never read: the LLM sees the headline and summary only.
//
// `npm run analyze-news` calls this route and saves the answers to data/cache/.
// The pages read that cache; they do not call this route.

import { getLlmConfig } from "@/lib/llm";
import { parseRelevanceResult, RELEVANCE_SCHEMA, termsAppearIn } from "@/lib/relevance";

const SYSTEM_PROMPT = `You help with a news page for Apple Inc. (NASDAQ: AAPL). Articles are collected by keyword search, so some may not be about Apple Inc. For one article you get JSON with: title (the headline), summary (may be empty), source and date. You never see the article body.

Return four fields.

1. matched_terms
Every distinct word in the headline or summary that contains "Apple" or "AAPL" (for example "Apple", "Apple's", "Apples", "AAPL", "AAPL.US"), copied exactly as written. Use an empty list if there is none.

2. reason
A note for the reader that states ONLY the evidence this article was collected on. Use this exact format for every article, 2 to 3 sentences, 35 to 50 words in total:
- Sentence 1: This article was collected for the Apple (AAPL) news page because its headline contains "<term>" <once / twice / N times>. Name every matched term in the headline with its own count.
- Sentence 2: if the summary is empty, write: No summary was provided, so the match is based on the headline alone. Otherwise say which matched terms the summary contains and how many times.
- Sentence 3: It was published by <source> on <Month D, YYYY>.
If no matched term is in the headline, sentence 1 is instead: This article was returned by a news search for Apple (AAPL), although its headline contains neither "Apple" nor "AAPL". If the summary is also empty, sentence 2 is then: No summary was provided, so the matching words are not visible here.

Rules for reason:
- Put each matched term in double quotes and count carefully.
- Do NOT say what the article is about, which company or product it concerns, or what kind of article it is.
- Do NOT say whether it belongs on the page, how relevant it is, or how it could affect Apple.
- No opinions and no words from the headline other than the quoted matched terms.
- Use the sentences above word for word. Do not add extra words (such as "clearly" or "specifically") to make the text longer.

3. relevance (kept for evaluation, not shown to the reader)
- "direct": the article is mainly about Apple Inc., its products, services, finances, leadership or stock.
- "indirect": the article is mainly about something else (a supplier, competitor, regulator, market or sector), but it plausibly affects Apple Inc.
- "unrelated": the article is not about Apple Inc. For example the fruit, Apple Records, "Big Apple", or an unrelated company or topic.

4. confidence
A number from 0 to 1 for how sure you are of the relevance label.`;

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { title, source, date } = body ?? {};
  const summary = body?.summary ?? "";
  if ([title, source, date].some((value) => typeof value !== "string" || value === "") || typeof summary !== "string") {
    return fail(400, "Send title, source and date as text. summary is optional text.");
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
          { role: "user", content: JSON.stringify({ title, summary, source, date }) },
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
  if (!termsAppearIn(result.matched_terms, `${title} ${summary}`)) {
    return fail(502, "The LLM quoted a word that is not in the headline or summary, so the answer was not used.");
  }

  return Response.json({ model, result });
}
