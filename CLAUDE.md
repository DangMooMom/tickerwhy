# CLAUDE.md

Rules for AI coding agents working in this repository. Read this before changing anything.

## What this project is

TickerWhy is a Next.js prototype for a university HCI assignment (Intelligent Interactive Systems, Assignment 2). It is judged on design reasoning and honest evidence, not on feature count.

User flow: **stock page > company news list > article view with a "Why you're seeing this" panel.**

- **Collection rule (scoring rule, version 3).** News comes from the 35 free RSS sources in `data/sources.json`. Each item is scored from its RSS headline, summary and tags only, with the rule in `data/rules.json` and the names in `data/entities.json`. An Apple name in the headline or summary is required. An activity word, an AAPL ticker tag from a feed and the source type add points. An article is collected at `collect_at` (4) points and labelled "Strong match" at `strong_match_at` (7), otherwise "Partial match". Copies of the same story are merged. Each article stores `matched_rule` (score, label, signals, excluded terms, duplicates). The student edits the rule files.
- **Excerpts, never full text.** After scoring, each collected article page is opened once, at most one request every 3 seconds to the same site, and the collector saves an `excerpt` of at most 200 words ending at a full sentence. Time stamps, writer bios and photo captions are removed. Never save or commit a full article body: the repo is public and the articles are copyrighted. Do not try to get around paywalls, blocks or robots.txt; such articles get no excerpt and cannot be in the test list.
- **"Why you're seeing this" is built by code from `matched_rule`** (`lib/reason.ts`), not by the LLM, so it always matches the real rule. It starts with the match label, has one short sentence per signal, and ends with the source and date. It must not say what the article is about, which company it concerns, whether it belongs, or how it affects Apple.
- **AI summary.** `app/api/summary/route.ts` asks the LLM for a 2 or 3 sentence summary of the excerpt. `lib/summary.ts` rejects judgement words and numbers that are not in the excerpt; `npm run summarize-news` asks again up to 3 times. Saved in `data/cache/summaries-dev.json`. If all tries fail, the article shows no summary. The summary only describes the excerpt and never judges relevance.
- **Hidden LLM relevance check.** `app/api/relevance/route.ts` returns `relevance` (`direct`, `indirect`, `unrelated`), `confidence`, `stock_relevant` and `category`. It was run only on the earlier Google News collection (`data/dev-google-news/`), not on the current collection. The answers are **hidden in the UI**: no badges, percentages or dimming, and do not pass them to the pages.
- **Current dataset.** `npm run fetch-news` saves the articles of the last 7 days to `data/news/dev.json`, a development sample. Do not edit it by hand.
- **The app shows only the test list** in `data/news/test-set.json`: 16 stock-related + 4 spy articles (8:2, the student's design), in the saved order. Spies are collected articles a user should flag (deal, film, history column, games). Every listed article must satisfy the collection rule and have an excerpt. If the file is missing, `display` in `data/rules.json` is the fallback. Never delete the other collected articles.
- `test-set.json` is an answer key: `role`, `category`, `spy_type` and `spy_clue` are never shown in the UI and never sent to the LLM. `lib/news.ts` reads only the ids and the order.
- **Related news** on the article view: other test-list articles that share headline words. It does not use relevance on purpose.
- Users can flag an article as **"Not relevant"**. The flag is saved in the browser only (`localStorage`); the button then reads "Undo" and removes it. Nothing is sent to the server.
- **Feedback dialog** after a flag is **simulated**: it says a product manager will review the flag, and it carries a "simulated" tag. **Staff review** of flags is **planned**, not implemented. Never present it as working.
- Naming: `unrelated` is the AI's relevance value. "Not relevant" is only the user's flag button. Do not mix the two.
- **Old data** is kept for development history only: `data/dev-google-news/`, `data/archive/rss-v1/`, `data/archive/rss-v2/` and `scripts/archive/`. Do not delete it and do not use it in the app.

## Tech stack and structure

- Next.js (App Router) with TypeScript. Plain CSS in `app/globals.css`. No UI or chart libraries.
- Run with `npm install`, then `npm run dev`. Check with `npx tsc --noEmit` and `npm run build`.
- `app/page.tsx`: stock page (header, price, chart, news list). `app/news/[id]/page.tsx`: article view following the student's Figma frame. Date and author, AI summary and excerpt on the left; "Why you're seeing this" and "Related news" on the right (below the article on narrow screens).
- `app/api/`: server-side routes (`stock`, `relevance`, `summary`). Calls to outside services (stock prices, Groq) happen only here or in Server Components, never in the browser.
- `lib/stock.ts`: fetches AAPL prices from Yahoo Finance's public chart endpoint on the server. If that fails it returns `data/stock-fallback.json`, and the UI labels it as saved data.
- `lib/news.ts`: returns the test list with a reason built for each article and the saved AI summary (server-side only). It does not read the relevance cache. If there is no collection at all, it returns the example articles.
- `scripts/collect.mjs` (`npm run fetch-news`), with helpers in `scripts/lib/`. `scripts/summarize-news.mjs` and `scripts/analyze-news.mjs` need `npm run dev` running with a key and post to the API routes. `scripts/select-test-set.mjs` suggests a test list; the student checks and may edit it.
- `.github/workflows/fetch-news.yml`: runs `npm run fetch-news` by hand only (the daily schedule is switched off) and commits the result. It must not call Groq or need any secret.
- `data/example-news.ts`: example articles, shown only when there is no collection; their reason text is built in code by `exampleReason()`. These are **simulated** and labelled so in the UI.
- Left and right panels are out of scope on the stock page: only the centre column is redesigned there. Do not add them or placeholders for them.
- The live version on Netlify serves the saved data and needs no API key.
- `next.config.ts` sets `agentRules: false` so `next dev` does not create an `AGENTS.md`. This file is the only agent rules file.

## LLM setup

Status: **implemented** for the AI summary and the hidden relevance check. Pages read only the cache in `data/cache/` and never call the LLM.

- Call Groq only from `app/api/relevance/route.ts` and `app/api/summary/route.ts`, reading settings through `lib/llm.ts`. Never import `lib/llm.ts` from a file marked `"use client"`, and never give these variables a `NEXT_PUBLIC_` prefix. The key must not reach the browser.
- The relevance route gets `title`, `excerpt`, `source` and `date` only. The summary route gets `title` and `excerpt` only. Never send answer-key fields or `matched_rule`.
- Provider: Groq, model `openai/gpt-oss-120b`, through the OpenAI-compatible API.
- Read all settings from environment variables. Never hard-code them:
  - `GROQ_API_KEY`
  - `LLM_BASE_URL` (Groq: `https://api.groq.com/openai/v1`)
  - `LLM_MODEL` (default `openai/gpt-oss-120b`)
- Keep the client generic (OpenAI-compatible) so the same code can point at another provider or model by changing only `.env.local`.
- Requests use `temperature: 0`, a fixed `seed`, and `response_format` with a JSON schema and `"strict": true`.
  - In strict mode every field must be `required` and every object must set `"additionalProperties": false`.
  - Groq converts temperature 0 to 1e-8. Groq's docs do not confirm that `seed` is honoured. Do not claim outputs are fully deterministic. The cache is what makes results reproducible.
  - Structured outputs do not support streaming or tool use on Groq. Do not add either to these calls.
- Validate every LLM response against the schema. If it fails, show a clear fallback message. Never invent a result.

## Hard rules

1. **Never commit API keys or secrets.** The key lives in `.env.local`. `.env` and `.env.*` are git-ignored. Only `.env.example`, with empty values, is committed. If you see a key in code or a diff, stop and tell the user.
2. **Public news only.** Use only publicly available articles. Do not scrape paywalled or private content. Store the headline, link, source, date and a short excerpt (at most 200 words), never the full article text.
3. **Label feature status honestly.** Every feature is **implemented** (works in code), **simulated** (shown in the UI but faked or hard-coded), or **planned** (not built). Mark simulated parts in the UI and in the README. Never describe simulated or planned features as implemented.
4. **Record meaningful changes** in the README "Development record" table: what changed, why, how it was checked, and the commit link.
5. **Record AI help** in the README "AI assistance" table: tool, what was asked, what the human changed, how it was checked.
6. **Keep changes small and explainable.** Prefer the simplest code the student can understand and defend. Do not add features, frameworks or dependencies the user did not ask for.
7. Keep the README short. It must not become a second report.
