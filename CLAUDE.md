# CLAUDE.md

Rules for AI coding agents working in this repository. Read this before changing anything.

## What this project is

TickerWhy is a Next.js prototype for a university HCI assignment (Intelligent Interactive Systems, Assignment 2). It is judged on design reasoning and honest evidence, not on feature count.

It is an **unofficial redesign concept** of the news section on the Google Finance quote page for AAPL. The page must always show the "Concept" badge and the footer "Unofficial redesign concept, not affiliated with or endorsed by Google". Write "Google Finance" as plain text. Never use Google's logo or other brand assets.

User flow: **stock page > company news list > article view with a "Why you're seeing this" panel.**

- For each article an LLM returns JSON: `relevance` (`direct`, `indirect` or `unrelated`), `confidence` (0 to 1), `reason` and `matched_terms`. The shape and its checkers are in `lib/relevance.ts`.
- **Only `reason` is shown.** It states only the evidence the article was collected on: which quoted words are in the headline or summary and how often, the source, and the date. It must not say what the article is about, which company it concerns, whether it belongs, or how it affects Apple. Same format and similar length (2 to 3 sentences, 35 to 50 words) for every article.
- **Relevance is hidden.** `relevance`, `confidence` and `matched_terms` are kept in the cache for evaluation only. Do not show badges, percentages or dimming, and do not pass these values to the pages: every article must look the same, so users in a test are not steered by the AI.
- The LLM never reads the article body (planned: redirect links, paywalls, copyright). It gets `title`, `summary`, `source` and `date` only. Google News RSS has no real summary, so `summary` is usually empty.
- Users can flag an article as **"Not relevant"**. The flag is saved in the browser only (`localStorage`); pressing again removes it. Nothing is sent to the server.
- Naming: `unrelated` is the AI's relevance value. "Not relevant" is only the user's flag button. Do not mix the two.
- **Cached outputs** in `data/cache/relevance-YYYY-MM-DD.json` let a reviewer see results without an API key. Pages read only the cache and never call the LLM.
- **Staff review** of flags is **simulated or planned**, not implemented. Never present it as working.

## Tech stack and structure

- Next.js (App Router) with TypeScript. Plain CSS in `app/globals.css`. No UI or chart libraries.
- Run with `npm install`, then `npm run dev`. Check with `npx tsc --noEmit` and `npm run build`.
- `app/page.tsx`: stock page (header, price, chart, news list). `app/news/[id]/page.tsx`: article view with the "Why you're seeing this" panel on the right (below the article on narrow screens), following the student's Figma frame.
- `app/api/`: server-side routes. Calls to outside services (stock prices, Groq) happen only here or in Server Components, never in the browser.
- `lib/stock.ts`: fetches AAPL prices from Yahoo Finance's public chart endpoint on the server. If that fails it returns `data/stock-fallback.json`, and the UI labels it as saved data.
- `data/news/YYYY-MM-DD.json`: daily news snapshots from Google News RSS, written by `npm run fetch-news` (`scripts/fetch-news.mjs`). Snapshots are named after the New York day that has just ended (the workflow runs at 05:00 UTC, midnight in New York). Each has 20 articles: 14 from the search `"Apple Inc" OR AAPL`, 3 from the broad search `Apple`, and the 3 spy articles, duplicates removed, shuffled before saving. Do not edit snapshots by hand.
- `data/news/spy-articles.json`: 3 real public articles the student picked to test filtering (`spy_promo`, `spy_mention`, `spy_fruit`). Each must have "Apple" in its headline or summary. The same three go into every snapshot. Never invent a spy article and never swap one without the student choosing it.
- Answer-key fields: `source_query` (regular articles) and `spy_type` and `expected_relevance` (spy articles) are kept **only for checking answers later**. Never show them in the UI and never send them to the LLM. `lib/news.ts` and `scripts/analyze-news.mjs` copy only `id`, `title`, `summary`, `link`, `source` and `date`, so read news only through them. Do not change the LLM prompt just to make a spy article pass without telling the student.
- `lib/news.ts`: returns a snapshot plus its cached LLM answers for the pages (server-side only). It picks the newest snapshot that has a cache file, because the daily workflow adds snapshots without calling the LLM. If there is no snapshot, it returns the example articles.
- `npm run analyze-news` (`scripts/analyze-news.mjs`): needs `npm run dev` running with a key. It posts each article of the newest snapshot to `/api/relevance` and writes the cache with the model name and time. Articles already in the cache are skipped.
- `.github/workflows/fetch-news.yml`: runs `npm run fetch-news` every day at 05:00 UTC (and on manual run) and commits a new snapshot. It must not call Groq or need any secret.
- `data/example-news.ts`: example articles, shown only when there is no snapshot; their reason text is built in code by `exampleReason()`. These are **simulated** and labelled so in the UI.
- The panel shows only the heading, the reason paragraph and the "Not relevant" button. If an article has no valid cached answer, it says so and shows nothing else. Example articles (shown only when there is no snapshot) get a reason built in code and keep the "simulated" tag.
- Left and right panels are out of scope on the stock page: only the centre column is redesigned there. Do not add them or placeholders for them. The article view has exactly one right-hand panel, "Why you're seeing this".
- `next.config.ts` sets `agentRules: false` so `next dev` does not create an `AGENTS.md`. This file is the only agent rules file.

## LLM setup

Status: **implemented**. `app/api/relevance/route.ts` takes one article (`title`, `summary`, `source`, `date`) and returns the checked result.

- Send the LLM only `title`, `summary`, `source` and `date`. Never send the answer-key fields.
- The route also rejects an answer whose `matched_terms` are not really in the headline or summary.

- Call Groq only from `app/api/relevance/route.ts`, reading settings through `lib/llm.ts`. Never import `lib/llm.ts` from a file marked `"use client"`, and never give these variables a `NEXT_PUBLIC_` prefix. The key must not reach the browser.

- Provider: Groq, model `openai/gpt-oss-120b`, through the OpenAI-compatible API.
- Read all settings from environment variables. Never hard-code them:
  - `GROQ_API_KEY`
  - `LLM_BASE_URL` (Groq: `https://api.groq.com/openai/v1`)
  - `LLM_MODEL` (default `openai/gpt-oss-120b`)
- Keep the client generic (OpenAI-compatible) so the same code can point at another provider, such as LM Studio, or a smaller model such as `openai/gpt-oss-20b`, by changing only `.env.local`.
- Requests use `temperature: 0`, a fixed `seed`, and `response_format` with a JSON schema and `"strict": true`.
  - In strict mode every field must be `required` and every object must set `"additionalProperties": false`.
  - Groq converts temperature 0 to 1e-8. Groq's docs do not confirm that `seed` is honoured. Do not claim outputs are fully deterministic. The cache is what makes results reproducible.
  - Structured outputs do not support streaming or tool use on Groq. Do not add either to these calls.
- Validate every LLM response against the schema. If it fails, show a clear fallback message. Never invent a result.

## Hard rules

1. **Never commit API keys or secrets.** The key lives in `.env.local`. `.env` and `.env.*` are git-ignored. Only `.env.example`, with empty values, is committed. If you see a key in code or a diff, stop and tell the user.
2. **Public news only.** Use only publicly available articles. Do not scrape paywalled or private content. Snapshots store only the headline, link, source and date from Google News RSS, not article text.
3. **Label feature status honestly.** Every feature is **implemented** (works in code), **simulated** (shown in the UI but faked or hard-coded), or **planned** (not built). Mark simulated parts in the UI and in the README. Never describe simulated or planned features as implemented.
4. **Record meaningful changes** in the README "Development record" table: what changed, why, how it was checked, and the commit link.
5. **Record AI help** in the README "AI assistance" table: tool, what was asked, what the human changed, how it was checked.
6. **Keep changes small and explainable.** Prefer the simplest code the student can understand and defend. Do not add features, frameworks or dependencies the user did not ask for.
7. Keep the README short. It must not become a second report.
