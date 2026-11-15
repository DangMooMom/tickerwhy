// Server-side only. Import this ONLY from files under app/api/.
//
// The settings come from .env.local (git-ignored). None of the names start with
// NEXT_PUBLIC_, so Next.js never puts them in the JavaScript sent to the browser.
// The browser will call /api/relevance; that route calls Groq with the key.

export function getLlmConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY ?? "",
    baseUrl: process.env.LLM_BASE_URL ?? "",
    model: process.env.LLM_MODEL ?? "openai/gpt-oss-120b",
  };
}
