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
| "Why this matters" panel | simulated (placeholders for real headlines, hand-written values for example articles; not LLM output) |
| LLM relevance through Groq (JSON) | planned (`/api/relevance` is a stub) |
| "Not relevant" flag is recorded | simulated (button works, flag is not saved) |
| Cached outputs (view without an API key) | planned |
| Staff review of flags | planned |
| Left and right panels | out of scope: only the centre column is redesigned |

The LLM is not connected yet, so real headlines have no relevance judgement or explanation. Connecting Groq and caching its output is the next step.

## Technology stack

- Next.js 16 (App Router), React 19, TypeScript, Node.js 20.9 or later
- Plain CSS and a hand-drawn SVG chart, no UI or chart libraries
- Stock prices: Yahoo Finance public chart endpoint (unofficial, no key), fetched on the server
- News: Google News RSS (public, no key), saved once a day by a GitHub Actions workflow
- Planned: Groq (`openai/gpt-oss-120b`) through an OpenAI-compatible client, called only from an API route

## Running or inspecting the work

**Without an API key:** run `npm install`, then `npm run dev`, and open http://localhost:3000. Nothing in the current version needs a key.

**Checking the saved price data:** run `STOCK_FORCE_SAVED=1 npm run dev`. The page then skips the live fetch and shows `data/stock-fallback.json`, labelled "Saved data".

**With your own API key (planned, not used yet):**
1. Copy `.env.example` to `.env.local`.
2. Put your own key after `GROQ_API_KEY=`. Never commit `.env.local`.

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

## AI assistance

| Tool | What I asked | What I changed | How I checked |
|---|---|---|---|
| Claude | Draft README, CLAUDE.md and .gitignore | Renamed AGENTS.md to CLAUDE.md because I only use Claude Code | Confirmed `.env` is not tracked |
| Claude Code | Create `requirements.txt` and an empty Streamlit app, run it, commit | Kept the LLM library out until needed | Claude started the app and checked it loaded without errors |
| Claude Code | Rebuild as a Next.js app from my brief and reference screenshots: centre column, server-side price fetch with fallback, example news, simulated "Why this matters" panel | Changed the framing to a Google Finance redesign; asked for "simulated" labels on faked parts | Claude ran the app, requested each route, took screenshots, and tested the saved-data fallback; I viewed it in the browser |
| Claude Code | Remove the side placeholder panels and centre the main column | Decided to drop the panels instead of keeping placeholders | Claude checked screenshots of both pages |
| Claude Code | Write the news fetch script, connect the snapshot to the news list, add the daily workflow, update the docs | <!-- what you edited --> | Claude ran the script (success, re-run, forced failure), requested both pages, and ran the type check and build |

## Additional files

- `CLAUDE.md`: rules for AI coding agents working in this repo.
- `.env.example`: settings template with no real key.
- `data/news/`: daily news snapshots. `source_query` is kept only for checking answers later; it is never shown or sent to the LLM.
- `data/example-news.ts`: example articles (simulated), shown only if there is no snapshot.
- `.github/workflows/fetch-news.yml`: daily news fetch.
- `data/stock-fallback.json`: saved AAPL prices, refreshed with `npm run save-stock` while the app is running.