# TickerWhy

README prose word count: 528  <!-- Headings, tables, code blocks and links excluded. Recount on submission day -->

Submitted version: tag [`a2-submission`](https://github.com/DangMooMom/tickerwhy/tree/a2-submission). The commit hash is on the first page of the report.

Live version: https://stately-raindrop-54df43.netlify.app/

## Project status

Status labels. **implemented** = works in this code. **simulated** = shown in the interface but faked or hard-coded. **planned** = designed, not built.

| Feature | Status |
|---|---|
| Stock page > company news list > article view | implemented |
| AAPL price and chart, fetched on the server, with saved data if the fetch fails | implemented |
| News collection | implemented. 35 RSS sources and my scoring rule in `data/rules.json` and `data/entities.json`. An Apple name in the RSS headline or summary is required. An activity word, an AAPL ticker tag and the source type add points. An article is collected at 4 points and called a "Strong match" at 7 |
| Excerpts | implemented. Each collected article page is opened once for an excerpt of at most 200 words. Time stamps, writer bios and photo captions are removed |
| "Why you're seeing this" panel | implemented. Built by code from the rule match, not by the LLM. The match label and one short sentence per signal. It does not say what the article is about |
| Article view (excerpt, AI summary, reason panel, related news) | implemented. Follows my Figma frame |
| AI summary | implemented. 2 or 3 sentences made once by Groq and saved in `data/cache/`. Code rejects judgement words and numbers that are not in the excerpt. A rejected summary is asked again, up to 3 tries. If all fail, the article shows no summary |
| Related news | implemented. Other test-list articles that share headline words. It does not use relevance on purpose, so spy articles get related news too |
| "Not relevant" flag and Undo | implemented. Saved in the browser only. The button then reads "Undo" and removes the flag |
| Feedback dialog after a flag | **simulated**. It says a product manager will review the flag. Nothing is sent and no one reviews it |
| View without an API key | implemented. The pages never call the LLM |
| Hidden LLM relevance check through Groq | implemented for the earlier Google News collection only. Never shown to users. Not run on the current collection |
| Test list of 16 stock-related and 4 spy articles | implemented. `data/news/test-set.json`, chosen with Claude from the current collection and checked by me |
| News collection workflow (GitHub Actions) | implemented, manual run only. The daily schedule is switched off |
| Online version on Netlify | implemented. Uses the saved data, so it needs no API key |
| Staff review of flags | planned |

The left and right panels of the stock page are out of scope, and the article view has one right-hand panel. The collection is a 7-day development sample. LLM answers can change between runs, so the app shows only saved answers.

## News sources

Every candidate feed was opened once on 16 Nov 2026 (details in `data/sources.json`). Every working feed with recent items is used, 35 in total. The rule reads only the RSS headline and summary. A page with a paywall or a block gives no excerpt, so it cannot be in the test list.

| Kind | Sources |
|---|---|
| Official | Apple Newsroom |
| Stock-specific | Nasdaq (AAPL), Seeking Alpha (AAPL), Yahoo Finance (AAPL), Investor's Business Daily, Benzinga, MarketBeat |
| Business | CNBC, Fortune, Business Insider, Forbes, The Motley Fool, BBC Business, The Guardian Business, Financial Times |
| US news (business or technology sections) | NPR, ABC News, CBS News, NBC News, Fox Business, Los Angeles Times, The New York Times, The Wall Street Journal, The Washington Post |
| Technology | The Verge, TechCrunch, Engadget, Ars Technica, Wired, Bloomberg Technology |
| Apple news | 9to5Mac, MacRumors, AppleInsider, Cult of Mac, Macworld |

Left out: AP and Barron's (blocked), Reuters and Zacks (no feed), CNN Business and USA Today (no recent items).

## Technology stack

- Next.js 16 (App Router), React 19, TypeScript, Node.js 20.9 or later
- Plain CSS and a hand-drawn SVG chart, no UI or chart libraries
- Stock prices: Yahoo Finance public chart endpoint (unofficial, no key), fetched on the server
- News from 35 RSS sources (`data/sources.json`). A GitHub Actions workflow can run the collector by hand
- Excerpts made with `@mozilla/readability` and `jsdom`
- LLM: Groq (`openai/gpt-oss-120b`) through its OpenAI-compatible API with a strict JSON schema, called only from the `/api/relevance` and `/api/summary` routes
- Hosting: Netlify, serving the saved data

## Running or inspecting the work

**Online:** open the live version linked at the top. No setup is needed.

**Without an API key:** run `npm install`, then `npm run dev`, and open http://localhost:3000. Nothing on the pages needs a key.

**Collecting news.** `npm run fetch-news` saves matching articles from the last 7 days to `data/news/dev.json`. It then opens each one once for an excerpt. The last run took about 10 minutes.

**Checking the saved price data:** run `STOCK_FORCE_SAVED=1 npm run dev`. The page then skips the live fetch and shows `data/stock-fallback.json`, labelled "Saved data".

**With your own API key (to make the AI summaries):**
1. Copy `.env.example` to `.env.local`.
2. Put your own key after `GROQ_API_KEY=`. Never commit `.env.local`.
3. Run `npm run dev`, then in a second terminal `npm run summarize-news -- --test-list`. Only articles without a summary, or whose excerpt changed, are sent.

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
| 2026-11-16 | (h) Widened the sources to 34 (stock-specific, business, US news, technology, Apple news). An earlier step had moved to 8 business-first sources. Google Finance was left out because it has no RSS feed and because of its terms of use | Free business feeds carried almost no Apple articles, so stock news was missing | Opened 56 feeds. 34 sources work. AP and Barron's were blocked, Reuters and Zacks gave no feed, CNN Business and USA Today had no recent items | [`3497000`](https://github.com/DangMooMom/tickerwhy/commit/3497000) [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-16 | (i) New rule. A company word ("Apple", "iPhone") plus a company-activity word, using the Corporate activity categories of Google Finance. Only whole words match | Product news filled the list before. Whole-word matching stops false matches such as "grapple" | 110 articles in the last 7 days. "grapple" no longer matches, "Apple's" still does. Noisy words found (for example "outlook", "insider", "sales") | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-16 | (j) Hid the excerpt. The article view now shows headline, source, date and reason only, the same for every article | Paywalls meant only some articles had an excerpt, so the test would be unfair | The page HTML had no excerpt text. The excerpt code is kept and switched off | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-16 | Data pipeline fixes (rate-limit delay, missing npm script, faster RSS-only rule check, timeouts, HTML entity decoding) | Runs were slow or failed | Collection went from more than 20 minutes to about 10 seconds. Titles show no HTML codes | [`1bd9569`](https://github.com/DangMooMom/tickerwhy/commit/1bd9569) [`53a3c87`](https://github.com/DangMooMom/tickerwhy/commit/53a3c87) [`3497000`](https://github.com/DangMooMom/tickerwhy/commit/3497000) [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-16 | Collection schedule changes (US time, fixed date range, schedule switched off) | AAPL is a US stock. Every test participant should see the same articles. The collector was being rebuilt | The date rule was tested for five moments. The schedule is gone from the workflow file on GitHub | [`3063293`](https://github.com/DangMooMom/tickerwhy/commit/3063293) [`6d3b1a1`](https://github.com/DangMooMom/tickerwhy/commit/6d3b1a1) [`69275a2`](https://github.com/DangMooMom/tickerwhy/commit/69275a2) |
| 2026-11-17 | (k) Scoring rule (version 3). An Apple name is required. An activity word, an AAPL ticker tag from a feed and the source type (Apple Newsroom, Nasdaq AAPL feed) add points. Apple Newsroom was added as the 35th source for this. Copies of the same story are merged. Version 2 is kept in `data/archive/rss-v2/` | Each signal can be named in the panel, and the label shows how strong the match is | The last run collected 56 articles (3 strong, 53 partial) and listed 132 near misses | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-17 | (l) Showed excerpts again, up to 200 words and ending at a full sentence. Nasdaq stories use the original publisher page, found only through its robots.txt and sitemaps. This reverses row j | A headline alone was not enough to judge. Now there are enough excerpts to build a fair test list | 49 of 56 articles got an excerpt. The other 7 were not reached before the 5-minute limit. No excerpt is over 200 words | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-17 | (m) Cleaned excerpts. Removed time stamp lines, writer bios and photo captions. MacRumors excerpts read only the article body | MacRumors excerpts held previews of other stories. One Verge excerpt began with the writer's bio and one CNBC excerpt with a photo caption | The new filters were run on all 56 excerpts and caught only the intended lines | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-17 | (n) AI summary above the excerpt, labelled "AI Summary". It only describes the excerpt and never judges relevance, importance or stock impact. Code rejects judgement words and numbers that are not in the excerpt. Clickable keywords and an AI note were tried and removed | A summary helps the reader decide whether to read the long excerpt. Judging relevance is left to the user | I compared all 20 summaries with their excerpts. None judged relevance. Three had wrong facts. Two were made again and one article was replaced, which led to the number check | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-17 | (o) Article view follows my Figma frame. Date and author row, AI summary and excerpt on the left. "Why you're seeing this" and Related news on the right. The footer, the concept tag and the match badge were removed | Parts deleted in Figma are deleted in the app too | Screenshots at desktop and phone width. No sideways scroll at 390 px. Type check passed | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-17 | (p) Final test list of 16 stock-related and 4 spy articles (deal, film, history column, games). Stock-related excerpts have at least 140 words and spies at least 180. Each spy has a clue sentence in the answer key. 9to5Mac has 4 articles, a one-time exception | The Foxconn article was the only candidate that met the length and topic rules | Counted roles and sources. Every clue sentence is in its excerpt and none is in the page HTML | [`eb970b5`](https://github.com/DangMooMom/tickerwhy/commit/eb970b5) |
| 2026-11-22 | (q) "Not relevant" now opens a feedback dialog. It says the feedback was received and is waiting for a product manager's review. The dialog is labelled simulated | The flag gave no sign that it was received, and the review step was not visible to the user | The dialog opens only after a successful save, in code. Type check and build passed. I checked the dialog and Undo in a browser | [`5e7aab3`](https://github.com/DangMooMom/tickerwhy/commit/5e7aab3) |
| 2026-11-25 | Pre-submission check. Brought CLAUDE.md and code comments in line with the current code. Removed an unused key line from `.env.example`. The README status table now uses only the three labels | CLAUDE.md and four comments still described the old word rule, 100-word excerpts and a fixed two-day dataset | Compared each status row with the code. Searched all 57 commits for keys and found none. Type check passed. No code behaviour changed | [`d4d4530`](https://github.com/DangMooMom/tickerwhy/commit/d4d4530) [`5ab693d`](https://github.com/DangMooMom/tickerwhy/commit/5ab693d) |

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
| Claude Code | Add an AI summary with bold keywords that jump to the matching excerpt sentence | Removed the keyword links and the AI note. Kept only the label bold, joined to the summary text | Claude checked screenshots. I read the 20 summaries and the spy check |
| Claude Code | Match the article view to my Figma frame | Told Claude that parts deleted in Figma are deleted in the app. Kept related news by shared headline words for the test | Claude compared screenshots with the Figma frame |
| Claude Code | Write a 2 or 3 sentence AI summary for each test article | I found three wrong facts. One summary said $700 that was not in the excerpt. One added Touch ID. One said $5 trillion when the source said about $4.6 trillion. I asked for code that rejects numbers not in the excerpt, instead of fixing summaries by hand | Two summaries were made again and passed. The article with $5 trillion was replaced |
| Claude Code | Clean the excerpts and finish the test list | Asked to remove time stamps, writer bios and photo captions, to replace the podcast article, and to allow 4 9to5Mac articles once | Claude showed tables of word counts, first sentences and summary facts checked against each excerpt |
| Claude Code | Give feedback after a "Not relevant" flag | Asked for a dialog that says a product manager will review it, labelled simulated, shown only when the flag is saved | Type check and build passed. I checked it in a browser |
| Claude Code | Check that every status label matches the code and that no key is in the repo or its history, then fix what does not match | Chose "implemented, manual run only" for the workflow and moved the panels note out of the table. Kept the name CLAUDE.md, because the lecturer said to name the file for the agent used | I read the rewritten CLAUDE.md and the PR diff |
| Claude Code (Figma connector) | Help draw the system diagram in Figma | Claude said that 7 boxes had no status label. That was wrong, because the legend colour of each box shows its status, and I corrected it. The "Rule filter" box was reworded to match scoring rule version 3 | TODO |
| ChatGPT | Make the storyboard images from my prompts | TODO | TODO |

## Additional files

- `CLAUDE.md`. Rules for AI coding agents working in this repo.
- `.env.example`. Settings template with no real key.
- `data/sources.json`. The RSS sources, how each was checked, and the rejected ones.
- `data/rules.json`. The company words, the activity words by category, and the preview limits.
- `data/entities.json`. The Apple names, products and people the rule looks for, and the exclusion phrases.
- `data/news/dev.json`. The current collection (last 7 days), a development sample.
- `data/news/test-set.json`. The test list and its answer key (role, category, spy type, clue sentence). Only the ids and the order are used by the app.
- `data/cache/summaries-dev.json`. The saved AI summaries.
- `data/archive/rss-v1/`, `data/archive/rss-v2/`. Earlier RSS collections and their rules, kept for the record.
- `data/dev-google-news/`. The earlier Google News snapshot and its LLM cache, kept for the record.
- `scripts/archive/`. The earlier collectors, kept for the record.
- `data/example-news.ts`. Example articles (simulated), shown only if there is no collection.
- `.github/workflows/fetch-news.yml`. News collection workflow, manual run only.
- `data/stock-fallback.json`. Saved AAPL prices, refreshed with `npm run save-stock` while the app is running.
