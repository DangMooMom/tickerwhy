# CLAUDE.md

Rules for AI coding agents working in this repository. Read this before changing anything.

## What this project is

TickerWhy is a Next.js prototype for a university HCI assignment (Intelligent Interactive Systems, Assignment 2). It is judged on design reasoning and honest evidence, not on feature count.

It is an **unofficial redesign concept** of the news section on the Google Finance quote page for AAPL. The page must always show the "Concept" badge and the footer "Unofficial redesign concept, not affiliated with or endorsed by Google". Write "Google Finance" as plain text. Never use Google's logo or other brand assets.

User flow: **stock page > company news list > article view with a "Why this matters" panel.**

- An LLM judges how relevant each article is to the company and returns JSON: `relevance` (`direct`, `indirect` or `not_relevant`), `confidence` (0 to 1), `why` (company, event, topic, product_service, source_signal) and a short `explanation`. The shape and its checker are in `lib/relevance.ts`.
- Users can flag an article as **"Not relevant"**. The flag is saved in the browser only (`localStorage`); pressing again removes it. Nothing is sent to the server.
- **Cached outputs** in `data/cache/relevance-YYYY-MM-DD.json` let a reviewer see results without an API key. Pages read only the cache and never call the LLM.
- Articles judged `not_relevant` are dimmed in the list, never hidden: the user decides.
- **Staff review** of flags is **simulated or planned**, not implemented. Never present it as working.

## Tech stack and structure

- Next.js (App Router) with TypeScript. Plain CSS in `app/globals.css`. No UI or chart libraries.
- Run with `npm install`, then `npm run dev`. Check with `npx tsc --noEmit` and `npm run build`.
- `app/page.tsx`: stock page (header, price, chart, news list). `app/news/[id]/page.tsx`: article view with the "Why this matters" panel.
- `app/api/`: server-side routes. Calls to outside services (stock prices, Groq) happen only here or in Server Components, never in the browser.
- `lib/stock.ts`: fetches AAPL prices from Yahoo Finance's public chart endpoint on the server. If that fails it returns `data/stock-fallback.json`, and the UI labels it as saved data.
- `data/news/YYYY-MM-DD.json`: daily news snapshots from Google News RSS, written by `npm run fetch-news` (`scripts/fetch-news.mjs`). Each has 20 articles: 16 from the search `"Apple Inc" OR AAPL` and 4 from the broad search `Apple`, duplicates removed, shuffled before saving. Do not edit snapshots by hand.
- `source_query` in a snapshot records which search an article came from. It is kept **only for checking answers later**. Never show it in the UI and never send it to the LLM. `lib/news.ts` removes it when the app reads a snapshot, so read news only through `lib/news.ts`.
- `lib/news.ts`: returns a snapshot plus its cached LLM answers for the pages (server-side only). It picks the newest snapshot that has a cache file, because the daily workflow adds snapshots without calling the LLM. If there is no snapshot, it returns the example articles.
- `npm run analyze-news` (`scripts/analyze-news.mjs`): needs `npm run dev` running with a key. It posts each article of the newest snapshot to `/api/relevance` and writes the cache with the model name and time. Articles already in the cache are skipped.
- `.github/workflows/fetch-news.yml`: runs `npm run fetch-news` every day at 07:00 UTC (and on manual run) and commits a new snapshot. It must not call Groq or need any secret.
- `data/example-news.ts`: example articles and hand-written "Why this matters" values, shown only when there is no snapshot. These are **simulated** and labelled so in the UI.
- The "Why this matters" panel shows the cached LLM answer with the tag "AI-generated (Groq, cached)". If an article has no valid cached answer, the panel says so and shows nothing else. Example articles keep the "simulated" tag.
- Left and right panels are out of scope: only the centre column is redesigned. Do not add them or placeholders for them.
- `next.config.ts` sets `agentRules: false` so `next dev` does not create an `AGENTS.md`. This file is the only agent rules file.

## LLM setup

Status: **implemented**. `app/api/relevance/route.ts` takes one article (`title`, `source`, `date`, `link`) and returns the checked result.

- Send the LLM only `title`, `source`, `date` and `link`. Never send `source_query`.

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
