// Server-side only. Import this ONLY from files under app/api/.
//
// The settings come from .env.local (git-ignored). None of the names start with
// NEXT_PUBLIC_, so Next.js never puts them in the JavaScript sent to the browser.
// The key is used only inside /api/relevance and /api/summary, which call Groq.
//
// To use another OpenAI-compatible provider or model, change LLM_BASE_URL and
// LLM_MODEL in .env.local. The values below are only the defaults.

export function getLlmConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY ?? "",
    baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    model: process.env.LLM_MODEL || "openai/gpt-oss-120b",
  };
}
