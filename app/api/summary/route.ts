// POST /api/summary
// Body: { title, excerpt } for one article.
// Asks the LLM (Groq) for a 2-3 sentence summary of the excerpt and 3-5 keywords,
// each with the number of the excerpt sentence it comes from. Returns
// { model, result: { summary, keywords }, dropped } or an error. The key stays on the server.
//
// Only the title and the excerpt (split into numbered sentences) are sent.
// The answer is checked by lib/summary.ts. `npm run summarize-news` saves it in
// data/cache/, and the article page reads only that cache.

import { getLlmConfig } from "@/lib/llm";
import { splitExcerpt } from "@/lib/sentences";
import { checkSummary, SUMMARY_SCHEMA } from "@/lib/summary";

const SYSTEM_PROMPT = `You write a short summary of a news article so a reader can decide whether to read the full excerpt.

You get JSON with the article's title and its excerpt as numbered sentences. Use only those.

summary: 2 or 3 plain English sentences, at most 60 words in total. Say only what the excerpt says, in a neutral tone. If the writer gives an opinion, report it as the writer's ("The writer argues ...").
Never judge or comment on whether the article is related or relevant to Apple Inc., how important it is, or whether it could affect a share price, investors or a company. Do not add facts that are not in the excerpt.

keywords: 3 to 5 key terms of one to three words each. Do not use the company name "Apple" alone as a keyword. Every term must appear letter for letter both in your summary and in the excerpt. sentence_index is the number of the excerpt sentence where the term appears.`;

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { title, excerpt } = body ?? {};
  if ([title, excerpt].some((value) => typeof value !== "string" || value === "")) {
    return fail(400, "Send title and excerpt as text.");
  }

  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) {
    return fail(503, "No API key on the server. Add GROQ_API_KEY to .env.local. Cached summaries still work without it.");
  }

  const sentences = splitExcerpt(excerpt).flat().map((s) => `[${s.index}] ${s.text}`);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        // Low temperature and a fixed seed make answers more stable, not identical. The cache is what is repeatable.
        temperature: 0,
        seed: 1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ title, sentences }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "article_summary", strict: true, schema: SUMMARY_SCHEMA },
        },
      }),
    });
  } catch {
    return fail(502, "Could not reach the LLM provider.");
  }

  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    return fail(status, `The LLM provider returned HTTP ${response.status}.`);
  }

  // Check the answer. If it fails, return an error instead of a made-up result.
  let checked: ReturnType<typeof checkSummary>;
  try {
    const data = await response.json();
    checked = checkSummary(JSON.parse(data.choices[0].message.content), excerpt);
  } catch {
    checked = { error: "not valid JSON" };
  }
  if ("error" in checked) return fail(502, `The LLM answer was not used: ${checked.error}.`);

  return Response.json({ model, ...checked });
}
