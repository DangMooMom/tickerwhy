# TickerWhy

README prose word count: X  <!-- Count only prose sentences. Exclude headings, tables, code blocks and links. -->

<!-- One sentence: what this is. -->

Submitted version: [commit `xxxxxxx`](https://github.com/DangMooMom/tickerwhy/commit/xxxxxxx) <!-- or a release tag; fill in on submission day -->

## Project status

Status labels: **implemented** = works in this code; **simulated** = shown in the interface but faked or hard-coded; **planned** = designed, not built.

| Feature | Status |
|---|---|
| Stock page > company news list > article view | implemented |
| AAPL price and chart, fetched on the server, with saved data if the fetch fails | implemented |
| News articles | simulated (invented example articles) |
| "Why this matters" panel | simulated (hand-written values, not LLM output) |
| LLM relevance through Groq (JSON) | planned (`/api/relevance` is a stub) |
| "Not relevant" flag is recorded | simulated (button works, flag is not saved) |
| Cached outputs (view without an API key) | planned |
| Staff review of flags | planned |
| Left and right panels | planned (grey placeholders) |

<!-- One or two sentences on what is unfinished and why. -->

## Technology stack

- Next.js 16 (App Router), React 19, TypeScript, Node.js 20.9 or later
- Plain CSS and a hand-drawn SVG chart, no UI or chart libraries
- Stock prices: Yahoo Finance public chart endpoint (unofficial, no key), fetched on the server
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
| 2026-11-15 | Added README, CLAUDE.md, .gitignore, .env.example | Set up the repo and keep keys out of git | `.env` does not appear in the commit | [link]() |
| 2026-11-15 | Added `requirements.txt` (Streamlit 1.67.0) and an empty `app.py` | Starting point for the prototype | `streamlit run app.py` served the page (HTTP 200); `AppTest` ran the script with no exceptions | [`bc5d2d4`](https://github.com/DangMooMom/tickerwhy/commit/bc5d2d4) |
| 2026-11-15 | Replaced Streamlit with Next.js: stock page with live AAPL price and chart, example news list, article view with simulated "Why this matters" panel and "Not relevant" button, stub `/api/relevance` route | Plan changed to an unofficial redesign concept of the Google Finance news section; API routes keep the Groq key on the server | `npm run dev`: pages returned 200 and matched screenshots; price matched the reference quote; `STOCK_FORCE_SAVED=1` showed saved data; `npx tsc --noEmit` and `npm run build` passed | [`af9eeab`](https://github.com/DangMooMom/tickerwhy/commit/af9eeab) |

## AI assistance

| Tool | What I asked | What I changed | How I checked |
|---|---|---|---|
| Claude | Draft README, CLAUDE.md and .gitignore | <!-- what you edited --> | <!-- e.g. confirmed Groq base URL in Groq docs --> |
| Claude Code | Create `requirements.txt` and an empty Streamlit app, run it, commit | <!-- what you edited --> | Claude started the app and checked it loaded without errors |
| Claude Code | Rebuild as a Next.js app from my brief and reference screenshots: centre column, server-side price fetch with fallback, example news, simulated "Why this matters" panel | <!-- what you edited --> | Claude ran the app, requested each route, took screenshots, and tested the saved-data fallback |

## Additional files

- `CLAUDE.md`: rules for AI coding agents working in this repo.
- `.env.example`: settings template with no real key.
- `data/news.ts`: example articles (simulated).
- `data/stock-fallback.json`: saved AAPL prices, refreshed with `npm run save-stock` while the app is running.
