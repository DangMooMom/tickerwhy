# CLAUDE.md

Rules for AI coding agents working in this repository. Read this before changing anything.

## What this project is

TickerWhy is a Next.js prototype for a university HCI assignment (Intelligent Interactive Systems, Assignment 2). It is judged on design reasoning and honest evidence, not on feature count.

User flow: **stock page > company news list > article view with a "Why you're seeing this" panel.**

- **Collection rule.** News comes from the free RSS sources in `data/sources.json` (business and markets first, plus only two Apple sites, 9to5Mac and MacRumors; a source may have several feeds). An article is collected if its headline or its RSS summary (cut to 100 words) contains a word from `data/rules.json` (now "Apple" and "iPhone"; capital and small letters count the same). The rule is checked from the feed alone; only matching articles are opened to fetch the excerpt, with at most one request every 3 seconds to the same site. Keep the rule simple on purpose; the student edits the word list. Each article stores `matched_rule`: which word was found, in the headline or the summary, and how many times.
- **"Why you're seeing this" is built by code from `matched_rule`** (`lib/reason.ts`), not by the LLM, so it always matches the real rule. Same short format for every article: "Collected because the headline contains 'Apple' once[, and the summary contains ...]. Published by [source] on [date]." Name only the words found. No "neither ... nor", no semicolons or colons. It must not say what the article is about, which company it concerns, whether it belongs, or how it affects Apple.
- **The LLM only judges** relevance (`direct`, `indirect` or `unrelated`, plus `confidence`), `stock_relevant` and `category`, for checking against the answer key and for suggesting the test list. The answers are saved in `data/cache/` and are **hidden in the UI**: no badges, percentages or dimming, and do not pass them to the pages. Every article must look the same, so users in a test are not steered by the AI.
- **Excerpts, never full text.** The collector saves only the first 2 to 3 paragraphs (at most 100 words) as `excerpt`. Never save or commit a full article body: the repo is public and the articles are copyrighted. An article without an excerpt is not collected. The page shows the excerpt, then "..." and a "Continue reading at [source]" link. Do not try to get around paywalls or blocks; drop such sources instead.
- The LLM gets `title`, `excerpt`, `source` and `date` only.
- **Fixed dataset.** Only the New York days 2026-11-16 and 2026-11-17 are collected, so every test participant sees the same articles. `fetch-news` does nothing on other days. `lib/news.ts` joins those two snapshots; `data/news/dev.json` (made with `npm run fetch-news -- --dev`) is shown only while neither dataset file exists.
- **The app shows only the test list** in `data/news/test-set.json`: 16 stock-related + 4 spy articles (8:2, the student's design), in the saved order. `npm run select-test-set` suggests it from the LLM's `stock_relevant` and `category` (categories mixed, at most 3 per source, 2 collected deal articles plus the planted spy_mention and spy_fruit as spies, spies spread out); the student checks and may edit it. Every listed article must satisfy the collection rule. If the file is missing, `display` in `data/rules.json` is the fallback. Never delete the other collected articles.
- `test-set.json` is an answer key: `role`, `category`, `stock_relevant` and `spy_type` are never shown in the UI and never sent to the LLM. `lib/news.ts` reads only the ids and the order.
- **Old Google News data** is kept in `data/dev-google-news/` for development history only. Do not delete it and do not use it in the app.
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
- `data/news/YYYY-MM-DD.json`: one snapshot per dataset day, written by `npm run fetch-news` (`scripts/collect.mjs`, with helpers in `scripts/lib/`). Named after the New York day that has just ended (the workflow runs at 05:00 UTC, midnight in New York). Each article has `id`, `title`, `link`, `source`, `date`, `excerpt` and `matched_rule`; the snapshot also records the rule words used and a per-source report. Shuffled before saving. Do not edit snapshots by hand.
- `data/sources.json`: the RSS sources and why each was chosen (checked item counts and excerpt success), plus the rejected candidates. `data/rules.json`: the collection rule words.
- `data/news/spy-articles.json`: 2 real public articles the student picked to test filtering (`spy_mention`, `spy_fruit`), mixed into every snapshot. The old `spy_promo` is retired in `data/dev-google-news/`; deal spies now come from the collection. Each must have an excerpt and match the rule. Never invent a spy article and never swap one without the student choosing it. The student may remove them later.
- Answer-key fields: `spy_type` and `expected_relevance` (spy articles) are kept **only for checking answers later**. Never show them in the UI and never send them to the LLM. `lib/news.ts` and `scripts/analyze-news.mjs` copy only the public fields, so read news only through them. Do not change the LLM prompt just to make a spy article pass without telling the student.
- `lib/news.ts`: returns the fixed dataset (the two dataset days joined) with a reason built for each article (server-side only). It does not read the LLM cache. If there is no snapshot at all, it returns the example articles.
- `npm run analyze-news` (`scripts/analyze-news.mjs`): needs `npm run dev` running with a key. It posts each article of every snapshot to `/api/relevance` and writes one cache file per snapshot with the model name and time. Articles already in a cache are skipped. The student runs it once after both dataset days are collected.
- `.github/workflows/fetch-news.yml`: runs `npm run fetch-news` every day at 05:00 UTC (and on manual run) and commits a new snapshot. It must not call Groq or need any secret.
- `data/example-news.ts`: example articles, shown only when there is no snapshot; their reason text is built in code by `exampleReason()`. These are **simulated** and labelled so in the UI.
- The panel shows only the heading, the reason paragraph and the "Not relevant" button. Example articles (shown only when there is no snapshot) keep the "simulated" tag.
- Left and right panels are out of scope on the stock page: only the centre column is redesigned there. Do not add them or placeholders for them. The article view has exactly one right-hand panel, "Why you're seeing this".
- `next.config.ts` sets `agentRules: false` so `next dev` does not create an `AGENTS.md`. This file is the only agent rules file.

## LLM setup

Status: **implemented**. `app/api/relevance/route.ts` takes one article (`title`, `excerpt`, `source`, `date`) and returns `{ relevance, confidence }` after checking it against the schema. Send the LLM only those four fields; never the answer-key fields or `matched_rule`.

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
2. **Public news only.** Use only publicly available articles. Do not scrape paywalled or private content. Snapshots store the headline, link, source, date and a short excerpt (at most 100 words), never the full article text.
3. **Label feature status honestly.** Every feature is **implemented** (works in code), **simulated** (shown in the UI but faked or hard-coded), or **planned** (not built). Mark simulated parts in the UI and in the README. Never describe simulated or planned features as implemented.
4. **Record meaningful changes** in the README "Development record" table: what changed, why, how it was checked, and the commit link.
5. **Record AI help** in the README "AI assistance" table: tool, what was asked, what the human changed, how it was checked.
6. **Keep changes small and explainable.** Prefer the simplest code the student can understand and defend. Do not add features, frameworks or dependencies the user did not ask for.
7. Keep the README short. It must not become a second report.
