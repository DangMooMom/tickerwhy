# TickerWhy

README prose word count: X  <!-- fill in on submission day -->

TickerWhy is an unofficial redesign concept of the Google Finance AAPL news section that explains why each article matters to the company. Unofficial redesign concept, not affiliated with or endorsed by Google.

Submitted version: [commit `xxxxxxx`](https://github.com/DangMooMom/tickerwhy/commit/xxxxxxx) <!-- fill in on submission day -->

## Project status

Status labels: **implemented** = works in this code; **simulated** = shown in the interface but faked or hard-coded; **planned** = designed, not built.

| Feature | Status |
|---|---|
| Stock page > company news list > article view | implemented |
| AAPL price and chart, fetched on the server, with saved data if the fetch fails | implemented |
| News articles | implemented (daily Google News RSS snapshot; 80/20 mix of Apple Inc and broad "Apple" queries, chosen by me for testing) |
| "Why this matters" panel | implemented for real headlines (shows cached LLM output, labelled AI-generated); the example articles shown when there is no snapshot stay simulated |
| LLM relevance through Groq (JSON) | implemented (cached output shown) |
| "Not relevant" flag is recorded | implemented (saved in the browser only) |
| Cached outputs (view without an API key) | implemented (`data/cache/`, made with `npm run analyze-news`) |
| Staff review of flags | planned |
| Left and right panels | out of scope: only the centre column is redesigned |

The LLM judges each article from its headline, source, date and link only, not the article text, and its answers are not guaranteed to be the same on every run; the cache is what a reviewer sees. Flags stay in the browser and nobody reviews them yet. The daily workflow does not call the LLM, so the app shows the newest snapshot that has a cache.

## Technology stack

- Next.js 16 (App Router), React 19, TypeScript, Node.js 20.9 or later
- Plain CSS and a hand-drawn SVG chart, no UI or chart libraries
- Stock prices: Yahoo Finance public chart endpoint (unofficial, no key), fetched on the server
- News: Google News RSS (public, no key), saved once a day by a GitHub Actions workflow
- LLM: Groq (`openai/gpt-oss-120b`) through its OpenAI-compatible API with a strict JSON schema, called only from the `/api/relevance` route

## Running or inspecting the work

**Without an API key:** run `npm install`, then `npm run dev`, and open http://localhost:3000. The pages show the cached LLM output in `data/cache/`, so no key is needed.

**Checking the saved price data:** run `STOCK_FORCE_SAVED=1 npm run dev`. The page then skips the live fetch and shows `data/stock-fallback.json`, labelled "Saved data".

**With your own API key (to analyse a snapshot again):**
1. Copy `.env.example` to `.env.local`.
2. Put your own key after `GROQ_API_KEY=`. Never commit `.env.local`.
3. Run `npm run dev`, then in a second terminal `npm run analyze-news`. It analyses articles that are not in the cache yet; delete the cache file to analyse all of them again.

**Switching model or provider:** change `LLM_BASE_URL` and `LLM_MODEL` in `.env.local`.

## Development record

| Date | Change | Why | How I checked | Commit |
|---|---|---|---|---|
| 2026-11-15 | Added README, CLAUDE.md, .gitignore, .env.example | Set up the repo and keep keys out of git | `.env` does not appear in the commit | [`80ba4a4`](https://github.com/DangMooMom/tickerwhy/commit/80ba4a4) |
| 2026-11-15 | Added `requirements.txt` (Streamlit 1.67.0) and an empty `app.py` | Starting point for the prototype | `streamlit run app.py` served the page (HTTP 200); `AppTest` ran the script with no exceptions | [`bc5d2d4`](https://github.com/DangMooMom/tickerwhy/commit/bc5d2d4) |
| 2026-11-15 | Replaced Streamlit with Next.js: stock page with live AAPL price and chart, example news list, article view with simulated "Why this matters" panel and "Not relevant" button, stub `/api/relevance` route | Needed design control for an unofficial redesign concept of the Google Finance news section; API routes keep the Groq key on the server | `npm run dev`: pages returned 200 and matched screenshots; price matched the reference quote; `STOCK_FORCE_SAVED=1` showed saved data; `npx tsc --noEmit` and `npm run build` passed | [`af9eeab`](https://github.com/DangMooMom/tickerwhy/commit/af9eeab) |
| 2026-11-16 | Removed the side placeholder panels and centred the main column | Keep the scope on the news interaction being evaluated | Checked the page in the browser | [`da96aa3`](https://github.com/DangMooMom/tickerwhy/commit/da96aa3) |
| 2026-11-16 | Price colours: green for up, red for down (was red up, blue down) | Green/red is the convention most reviewers expect | Screenshot of the stock page in `npm run dev` showed the rising 1D price in green | [`9213729`](https://github.com/DangMooMom/tickerwhy/commit/9213729) |
| 2026-11-16 | Added `npm run fetch-news`: saves 20 Google News RSS headlines to `data/news/YYYY-MM-DD.json` (16 from `"Apple Inc" OR AAPL`, 4 from `Apple`, duplicates removed, with `source_query`) | Real public news instead of invented articles; the broad query adds articles that may not be about Apple Inc., to test relevance | Ran it: file had 20 articles with unique ids; a second run and a run with the network call forced to fail changed nothing | [`a17d11c`](https://github.com/DangMooMom/tickerwhy/commit/a17d11c) |
| 2026-11-16 | News list and article view read the newest snapshot (shuffled order); example articles are the fallback; `source_query` is removed before the pages get the data | Show real news without revealing which search an article came from | `npm run dev`: list showed 20 headlines, article page returned 200, `source_query` was not in the HTML; with the snapshot moved away the example articles appeared; `npx tsc --noEmit` and `npm run build` passed | [`e19860f`](https://github.com/DangMooMom/tickerwhy/commit/e19860f) |
| 2026-11-16 | Added a GitHub Actions workflow that runs `npm run fetch-news` daily at 07:00 UTC or manually and commits a new snapshot; no Groq call, no API key | Collect a snapshot every day without manual work | YAML parsed without errors; after the push GitHub listed the workflow as active. Not run on GitHub yet: first scheduled run is 2026-11-17 07:00 UTC | [`3e8a999`](https://github.com/DangMooMom/tickerwhy/commit/3e8a999) |
| 2026-11-16 | `/api/relevance` now calls Groq (`openai/gpt-oss-120b`, strict JSON schema, temperature 0) and checks the answer against the schema; only title, source, date and link are sent | Replace the hand-written relevance values with a real LLM judgement while keeping the key on the server | Posted a test article: got valid JSON; a body with missing fields got 400; with an empty key the route returned 503; the key value was not in any tracked file or in the browser bundle | [`3971014`](https://github.com/DangMooMom/tickerwhy/commit/3971014) |
| 2026-11-16 | Added `npm run analyze-news` and the cache `data/cache/relevance-YYYY-MM-DD.json` (with model name and time); pages read the cache | Reviewers can see the LLM output without a key, and the cache is repeatable when the LLM is not | Ran it: 20 of 20 analysed (one rate-limit wait). Against `source_query`: company search 14 direct, 2 indirect; broad "Apple" search 4 direct; 0 not relevant, so this snapshot does not test the "not relevant" case. A production server started without a key still showed all 20 results | [`2b86a81`](https://github.com/DangMooMom/tickerwhy/commit/2b86a81) |
| 2026-11-16 | "Why this matters" shows the LLM output labelled "AI-generated (Groq, cached)" with a relevance badge; "not relevant" articles are dimmed in the list, not hidden | Show where the text comes from and leave the final judgement to the user | `npm run dev`: list showed 20 badges, panel showed the cached answer; with one cache entry changed by hand to `not_relevant` the item was dimmed, and an invalid entry showed the "no analysis" message (cache restored after); `npx tsc --noEmit` and `npm run build` passed | [`218c06b`](https://github.com/DangMooMom/tickerwhy/commit/218c06b) |
| 2026-11-16 | "Not relevant" flag is saved in the browser (`localStorage`); pressing again removes it; nothing is sent to the server | The flag should survive a reload; server storage and staff review are out of scope for now | Headless Chrome: click, reload (still flagged), other article (not flagged), click again, reload (not flagged) | [`218c06b`](https://github.com/DangMooMom/tickerwhy/commit/218c06b) |

## AI assistance

| Tool | What I asked | What I changed | How I checked |
|---|---|---|---|
| Claude | Draft README, CLAUDE.md and .gitignore | Renamed AGENTS.md to CLAUDE.md because I only use Claude Code | Confirmed `.env` is not tracked |
| Claude Code | Create `requirements.txt` and an empty Streamlit app, run it, commit | Kept the LLM library out until needed | Claude started the app and checked it loaded without errors |
| Claude Code | Rebuild as a Next.js app from my brief and reference screenshots: centre column, server-side price fetch with fallback, example news, simulated "Why this matters" panel | Changed the framing to a Google Finance redesign; asked for "simulated" labels on faked parts | Claude ran the app, requested each route, took screenshots, and tested the saved-data fallback; I viewed it in the browser |
| Claude Code | Remove the side placeholder panels and centre the main column | Decided to drop the panels instead of keeping placeholders | Claude checked screenshots of both pages |
| Claude Code | Write the news fetch script, connect the snapshot to the news list, add the daily workflow, update the docs | <!-- what you edited --> | Claude ran the script (success, re-run, forced failure), requested both pages, and ran the type check and build |
| Claude Code | Connect Groq in `/api/relevance`, add the cache script, show the cached output with badges, save the flag in the browser | <!-- what you edited --> | Claude ran the route and the script, tested the flag in headless Chrome, checked the key was not in git or the browser bundle, and ran the type check and build |

## Additional files

- `CLAUDE.md`: rules for AI coding agents working in this repo.
- `.env.example`: settings template with no real key.
- `data/news/`: daily news snapshots. `source_query` is kept only for checking answers later; it is never shown or sent to the LLM.
- `data/cache/`: cached LLM output for a snapshot, with the model name and time.
- `data/example-news.ts`: example articles (simulated), shown only if there is no snapshot.
- `.github/workflows/fetch-news.yml`: daily news fetch.
- `data/stock-fallback.json`: saved AAPL prices, refreshed with `npm run save-stock` while the app is running.