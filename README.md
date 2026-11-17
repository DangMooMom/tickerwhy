# TickerWhy

README prose word count: 578  <!-- counted on 16 Nov 2026. Headings, tables, code blocks and links excluded. Recount on submission day -->

Submitted version: [commit `xxxxxxx`](https://github.com/DangMooMom/tickerwhy/commit/xxxxxxx) <!-- fill in on submission day -->

## Project status

Status labels. **implemented** = works in this code. **simulated** = shown in the interface but faked or hard-coded. **planned** = designed, not built.

| Feature | Status |
|---|---|
| Stock page > company news list > article view | implemented |
| AAPL price and chart, fetched on the server, with saved data if the fetch fails | implemented |
| News collection | implemented. 34 RSS sources and my own rule in `data/rules.json`. The RSS headline or summary must contain "Apple" or "iPhone" and a company-activity word, as whole words. No article page is opened |
| "Why you're seeing this" panel | implemented. One short sentence built by code from the rule match. It does not say what the article is about |
| Article view shows headline, source, date and reason only | implemented. The excerpt code is kept but switched off |
| "Not relevant" flag | implemented (saved in the browser only) |
| View without an API key | implemented. The pages never call the LLM |
| LLM judgement through Groq (relevance, stock relevance, category) | implemented for the earlier collection. Not yet run on the current one, because the route still expects an excerpt |
| Test list of 16 stock-related and 4 spy articles | planned. Until it is chosen the app shows a preview of 20 articles, at most 3 per source |
| Daily automatic collection | switched off. The workflow can only be run by hand |
| Staff review of flags | planned |
| Left and right panels | out of scope on the stock page. The article view has one right-hand panel |

The current collection covers the last 7 days and is a development sample. LLM answers are not guaranteed to be the same on every run. Flags stay in the browser and nobody reviews them yet.

## News sources

Checked on 16 Nov 2026 by opening every candidate feed once (10-second limit) and counting its items and Apple items from the last 7 days (details in `data/sources.json`). Every source whose feed works and has recent items is used, 34 in total. Paywalled sites are allowed, because only the RSS headline and summary are used and no article page is opened. Google News is not used.

| Kind | Sources |
|---|---|
| Stock-specific | Nasdaq (AAPL), Seeking Alpha (AAPL), Yahoo Finance (AAPL), Investor's Business Daily, Benzinga, MarketBeat |
| Business | CNBC, Fortune, Business Insider, Forbes, The Motley Fool, BBC Business, The Guardian Business, Financial Times |
| US news (business or technology sections) | NPR, ABC News, CBS News, NBC News, Fox Business, Los Angeles Times, The New York Times, The Wall Street Journal, The Washington Post |
| Technology | The Verge, TechCrunch, Engadget, Ars Technica, Wired, Bloomberg Technology |
| Apple news | 9to5Mac, MacRumors, AppleInsider, Cult of Mac, Macworld |

Some were left out. AP and Barron's blocked their feeds (HTTP 403). Reuters and Zacks gave no feed at the addresses tried (HTTP 404). CNN Business and USA Today had no items from the last 7 days.

## Technology stack

- Next.js 16 (App Router), React 19, TypeScript, Node.js 20.9 or later
- Plain CSS and a hand-drawn SVG chart, no UI or chart libraries
- Stock prices: Yahoo Finance public chart endpoint (unofficial, no key), fetched on the server
- News from 34 RSS sources (`data/sources.json`), headline and summary only. A GitHub Actions workflow can run the collector by hand
- Excerpts made with `@mozilla/readability` and `jsdom`, used only by the archived version 1 collector
- LLM: Groq (`openai/gpt-oss-120b`) through its OpenAI-compatible API with a strict JSON schema, called only from the `/api/relevance` route

## Running or inspecting the work

**Without an API key:** run `npm install`, then `npm run dev`, and open http://localhost:3000. Nothing on the pages needs a key.

**Collecting news.** `npm run fetch-news` reads all RSS sources and saves the matching articles from the last 7 days to `data/news/dev.json`. It takes about 10 seconds. A feed that does not answer in 10 seconds is skipped, and the run stops after 5 minutes.

**Checking the saved price data:** run `STOCK_FORCE_SAVED=1 npm run dev`. The page then skips the live fetch and shows `data/stock-fallback.json`, labelled "Saved data".

**With your own API key (to judge relevance and build the test list):**
1. Copy `.env.example` to `.env.local`.
2. Put your own key after `GROQ_API_KEY=`. Never commit `.env.local`.
3. Run `npm run dev`, then in a second terminal `npm run analyze-news`, then `npm run select-test-set`. Check `data/news/test-set.json` and edit it by hand if needed. These two steps still expect excerpts and need an update for the current collection.

**Switching model or provider:** change `LLM_BASE_URL` and `LLM_MODEL` in `.env.local`.

## Development record

| Date | Change | Why | How I checked | Commit |
|---|---|---|---|---|
| 2026-11-15 | Added README, CLAUDE.md, .gitignore, .env.example | Set up the repo and keep keys out of git | `.env` does not appear in the commit | [`80ba4a4`](https://github.com/DangMooMom/tickerwhy/commit/80ba4a4) |
| 2026-11-15 | Added `requirements.txt` (Streamlit 1.67.0) and an empty `app.py` | Starting point for the prototype | `streamlit run app.py` served the page (HTTP 200); `AppTest` ran the script with no exceptions | [`bc5d2d4`](https://github.com/DangMooMom/tickerwhy/commit/bc5d2d4) |
| 2026-11-15 | Replaced Streamlit with Next.js: stock page with live AAPL price and chart, example news list, article view with simulated "Why this matters" panel and "Not relevant" button, stub `/api/relevance` route | Needed design control for an unofficial redesign concept of the Google Finance news section; API routes keep the Groq key on the server | `npm run dev`: pages returned 200 and matched screenshots; price matched the reference quote; `STOCK_FORCE_SAVED=1` showed saved data; `npx tsc --noEmit` and `npm run build` passed | [`af9eeab`](https://github.com/DangMooMom/tickerwhy/commit/af9eeab) |
| 2026-11-16 | Minor UI fixes (price colours, removed side panels, removed grey notice, renamed the AI value `not_relevant` to `unrelated`) | Common colour convention, focus on the news column, a clearer screen, no confusion with the "Not relevant" button | Checked screenshots and page HTML. Type check and build passed | [`da96aa3`](https://github.com/DangMooMom/tickerwhy/commit/da96aa3) [`9213729`](https://github.com/DangMooMom/tickerwhy/commit/9213729) [`3e2f0f5`](https://github.com/DangMooMom/tickerwhy/commit/3e2f0f5) [`786178c`](https://github.com/DangMooMom/tickerwhy/commit/786178c) |
| 2026-11-16 | First news pipeline. Google News RSS snapshot, daily workflow, Groq relevance route with a cache, "Not relevant" flag saved in the browser | Real public news instead of invented articles. The key stays on the server. The flag survives a reload | Ran each script. Posted test articles to the route. Tested the flag in headless Chrome. The key was not in git or the browser bundle | [`a17d11c`](https://github.com/DangMooMom/tickerwhy/commit/a17d11c) [`3e8a999`](https://github.com/DangMooMom/tickerwhy/commit/3e8a999) [`3971014`](https://github.com/DangMooMom/tickerwhy/commit/3971014) [`2b86a81`](https://github.com/DangMooMom/tickerwhy/commit/2b86a81) [`218c06b`](https://github.com/DangMooMom/tickerwhy/commit/218c06b) |
| 2026-11-16 | Showed an AI relevance badge and confidence in the list and dimmed "unrelated" articles. **Reversed later** (see row b) | First idea was to show where the judgement came from | The list showed 20 badges and a dimmed test article | [`218c06b`](https://github.com/DangMooMom/tickerwhy/commit/218c06b) |
| 2026-11-16 | (a) Replaced the "Why this matters" table of fields (company, event, topic, product, source signal) with one "Why you're seeing this" paragraph about the collection evidence. The panel follows my Figma frame | The fields made the LLM guess relationships it could not know from a headline | All 20 reasons followed one pattern and none said what the article was about. A screenshot matched the Figma frame | [`da2b634`](https://github.com/DangMooMom/tickerwhy/commit/da2b634) |
| 2026-11-16 | (b) Removed the relevance badges, the confidence and the dimming. Every article looks the same. The values stay in the cache only | Users in a test should not be pulled along by the AI's judgement | The page HTML had no relevance, confidence or category | [`da2b634`](https://github.com/DangMooMom/tickerwhy/commit/da2b634) |
| 2026-11-16 | (c) Spy articles. Real articles that a user should flag are mixed into the list. The answer key (`spy_type`, `expected_relevance`) is never shown in the UI or sent to the LLM | The broad "Apple" search gave almost no unrelated articles, so filtering could not be tested otherwise | The answer-key fields were not in the page HTML or the LLM input. The LLM caught the fruit article but judged the deal article as direct | [`e85b1a1`](https://github.com/DangMooMom/tickerwhy/commit/e85b1a1) [`3063293`](https://github.com/DangMooMom/tickerwhy/commit/3063293) |
| 2026-11-16 | (d) Showed a 100-word excerpt instead of the full article, with a link to the original. **Switched off later** (see row j) | A headline alone was not enough to judge. The full text is copyrighted | No excerpt was longer than 100 words. Only 6 of 20 excerpts could be fetched at first, 9 after a retry | [`786178c`](https://github.com/DangMooMom/tickerwhy/commit/786178c) [`7cd4415`](https://github.com/DangMooMom/tickerwhy/commit/7cd4415) [`1bd9569`](https://github.com/DangMooMom/tickerwhy/commit/1bd9569) |
| 2026-11-16 | (e) Replaced Google News with my own keyword rule on RSS feeds. The reason is now built by code from the rule match, not by the LLM | With Google News I could not know why an article was picked, so the explanation could not be accurate. With my own rule it matches the real reason | Every shown reason was checked against the stored rule match. Type check and build passed | [`f5fbb29`](https://github.com/DangMooMom/tickerwhy/commit/f5fbb29) [`e09ba7e`](https://github.com/DangMooMom/tickerwhy/commit/e09ba7e) |
| 2026-11-16 | (f) Kept the rule when many collected articles were shopping deals and adjusted only the test list | The deal articles are evidence of the problem the redesign addresses, so I did not filter them out | 6 of 67 collected headlines (9%) were deals. Two were used as spy articles | [`b495b1c`](https://github.com/DangMooMom/tickerwhy/commit/b495b1c) |
| 2026-11-16 | (g) Test list of 16 stock-related and 4 spy articles (a ratio of 8 to 2). The LLM suggests stock relevance and I check it | Most of the list should be news an investor cares about, with a few articles a user should flag | With the sources at that time only 12 stock-related articles fit the limit of 3 per source | [`b495b1c`](https://github.com/DangMooMom/tickerwhy/commit/b495b1c) |
| 2026-11-16 | (h) Widened the sources to 34 (stock-specific, business, US news, technology, Apple news). An earlier step had moved to 8 business-first sources. Google Finance was left out because it has no RSS feed and because of its terms of use | Free business feeds carried almost no Apple articles, so stock news was missing | Opened 56 feeds. 34 sources work. AP and Barron's were blocked, Reuters and Zacks gave no feed, CNN Business and USA Today had no recent items | [`3497000`](https://github.com/DangMooMom/tickerwhy/commit/3497000) [commit] |
| 2026-11-16 | (i) New rule. A company word ("Apple", "iPhone") plus a company-activity word, using the Corporate activity categories of Google Finance. Only whole words match | Product news filled the list before. Whole-word matching stops false matches such as "grapple" | 110 articles in the last 7 days. "grapple" no longer matches, "Apple's" still does. Noisy words found (for example "outlook", "insider", "sales") | [commit] |
| 2026-11-16 | (j) Hid the excerpt. The article view now shows headline, source, date and reason only, the same for every article | Paywalls meant only some articles had an excerpt, so the test would be unfair | The page HTML had no excerpt text. The excerpt code is kept and switched off | [commit] |
| 2026-11-16 | Data pipeline fixes (rate-limit delay, missing npm script, faster RSS-only rule check, timeouts, HTML entity decoding) | Runs were slow or failed | Collection went from more than 20 minutes to about 10 seconds. Titles show no HTML codes | [`1bd9569`](https://github.com/DangMooMom/tickerwhy/commit/1bd9569) [`53a3c87`](https://github.com/DangMooMom/tickerwhy/commit/53a3c87) [`3497000`](https://github.com/DangMooMom/tickerwhy/commit/3497000) [commit] |
| 2026-11-16 | Collection schedule changes (US time, fixed date range, schedule switched off) | AAPL is a US stock. Every test participant should see the same articles. The collector was being rebuilt | The date rule was tested for five moments. The schedule is gone from the workflow file on GitHub | [`3063293`](https://github.com/DangMooMom/tickerwhy/commit/3063293) [`6d3b1a1`](https://github.com/DangMooMom/tickerwhy/commit/6d3b1a1) [`69275a2`](https://github.com/DangMooMom/tickerwhy/commit/69275a2) |

## AI assistance

| Tool | What I asked | What I changed | How I checked |
|---|---|---|---|
| Claude | Draft README, CLAUDE.md and .gitignore | Renamed AGENTS.md to CLAUDE.md because I only use Claude Code | Confirmed `.env` is not tracked |
| Claude Code | Create `requirements.txt` and an empty Streamlit app, run it, commit | Kept the LLM library out until needed | Claude started the app and checked it loaded without errors |
| Claude Code | Rebuild as a Next.js app from my brief and reference screenshots: centre column, server-side price fetch with fallback, example news, simulated "Why this matters" panel | Changed the framing to a Google Finance redesign; asked for "simulated" labels on faked parts | Claude ran the app, requested each route, took screenshots, and tested the saved-data fallback; I viewed it in the browser |
| Claude Code | Remove the side placeholder panels and centre the main column | Decided to drop the panels instead of keeping placeholders | Claude checked screenshots of both pages |
| Claude Code | Generate a "Why this matters" panel with LLM fields such as company, event and topic | Asked that reasons describe only why an article was collected, not what it is about | Read every reason and checked that none described the content |
| Claude Code | Collect Apple news with Google News RSS and explain why each article is shown | Rejected relying on Google News because the reason it picked an article could not be known | Replaced it with my own rule and checked each reason against the stored rule match |
| Claude Code | List collected articles that do not look like Apple Inc. news | Kept promotion articles in the collection as evidence of the problem, instead of filtering them out | Counted the deal headlines and used two of them as spy articles |
| Claude Code | Collect articles whose headline or summary contains "Apple" or "iPhone" | Asked for whole-word matching after the rule matched "grapple" | Tested that "grapple" no longer matches and "Apple's" still does |
| Claude Code | Fetch article excerpts from the publishers with `npm run fetch-bodies` | Claude Code's safety check stopped the command that contacted outside sites, so I ran it myself in the terminal | 6 of 20 excerpts were saved and the failures were listed |

## Additional files

- `CLAUDE.md`. Rules for AI coding agents working in this repo.
- `.env.example`. Settings template with no real key.
- `data/sources.json`. The RSS sources, how each was checked, and the rejected ones.
- `data/rules.json`. The company words, the activity words by category, and the preview limits.
- `data/news/dev.json`. The current collection (last 7 days), a development sample.
- `data/archive/rss-v1/`. The earlier RSS collection, its test list, LLM cache and spy articles, kept for the record.
- `data/dev-google-news/`. The earlier Google News snapshot and its LLM cache, kept for the record.
- `scripts/archive/collect-v1.mjs`. The earlier collector, kept for the record.
- `data/example-news.ts`. Example articles (simulated), shown only if there is no collection.
- `.github/workflows/fetch-news.yml`. News collection workflow, manual run only.
- `data/stock-fallback.json`. Saved AAPL prices, refreshed with `npm run save-stock` while the app is running.
