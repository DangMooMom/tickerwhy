# CLAUDE.md

Rules for AI coding agents working in this repository. Read this before changing anything.

## What this project is

TickerWhy is a Streamlit prototype for a university HCI assignment (Intelligent Interactive Systems, Assignment 2). It is judged on design reasoning and honest evidence, not on feature count.

User flow: **stock page > company news list > article view with a "Why this matters" panel.**

- An LLM judges how relevant each article is to the company and returns a short explanation as JSON. The explanation covers: relevance, company, event, topic, product/service, and source signal.
- Users can flag an article as **"Not relevant"**. The flag is recorded.
- **Cached outputs** let a reviewer see results without an API key. Planted example articles have their outputs fixed in the cache.
- **Staff review** of flags is **simulated or planned**, not implemented. Never present it as working.

## LLM setup

- Provider: Groq, model `openai/gpt-oss-120b`, through the OpenAI-compatible API.
- Read all settings from environment variables. Never hard-code them:
  - `GROQ_API_KEY`
  - `LLM_BASE_URL` (Groq: `https://api.groq.com/openai/v1`)
  - `LLM_MODEL` (default `openai/gpt-oss-120b`)
- Keep the client generic (OpenAI-compatible) so the same code can point at another provider, such as LM Studio, or a smaller model such as `openai/gpt-oss-20b`, by changing only `.env`.
- Requests use `temperature: 0`, a fixed `seed`, and `response_format` with a JSON schema and `"strict": true`.
  - In strict mode every field must be `required` and every object must set `"additionalProperties": false`.
  - Groq converts temperature 0 to 1e-8. Groq's docs do not confirm that `seed` is honoured. Do not claim outputs are fully deterministic. The cache is what makes results reproducible.
  - Structured outputs do not support streaming or tool use on Groq. Do not add either to these calls.
- Validate every LLM response against the schema. If it fails, show a clear fallback message. Never invent a result.

## Hard rules

1. **Never commit API keys or secrets.** `.env`, `.env.*` and `.streamlit/secrets.toml` are git-ignored. Only `.env.example`, with empty values, is committed. If you see a key in code or a diff, stop and tell the user.
2. **Public news only.** Use only publicly available articles. Do not scrape paywalled or private content.
3. **Label feature status honestly.** Every feature is **implemented** (works in code), **simulated** (shown in the UI but faked or hard-coded), or **planned** (not built). Mark simulated parts in the UI and in the README. Never describe simulated or planned features as implemented.
4. **Record meaningful changes** in the README "Development record" table: what changed, why, how it was checked, and the commit link.
5. **Record AI help** in the README "AI assistance" table: tool, what was asked, what the human changed, how it was checked.
6. **Keep changes small and explainable.** Prefer the simplest code the student can understand and defend. Do not add features, frameworks or dependencies the user did not ask for.
7. Keep the README short. It must not become a second report.
