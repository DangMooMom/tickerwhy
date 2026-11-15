# TickerWhy

README prose word count: X  <!-- Count only prose sentences. Exclude headings, tables, code blocks and links. -->

<!-- One sentence: what this is. -->

Submitted version: [commit `xxxxxxx`](https://github.com/DangMooMom/tickerwhy/commit/xxxxxxx) <!-- or a release tag; fill in on submission day -->

## Project status

Status labels: **implemented** = works in this code; **simulated** = shown in the interface but faked or hard-coded; **planned** = designed, not built.

| Feature | Status |
|---|---|
| Stock page > company news list > article | <!-- implemented / simulated / planned --> |
| LLM relevance + "Why this matters" (JSON) | |
| "Not relevant" flag is recorded | |
| Cached outputs (view without an API key) | |
| Staff review of flags | simulated / planned |

<!-- One or two sentences on what is unfinished and why. -->

## Technology stack

<!-- Short list: Python version, Streamlit, OpenAI-compatible client, Groq (openai/gpt-oss-120b), GitHub Codespaces. -->

## Running or inspecting the work

**Without an API key:** <!-- How a reviewer opens the app and sees cached outputs. -->

**With your own API key:**
1. Copy `.env.example` to `.env`.
2. Put your own key after `GROQ_API_KEY=`. Never commit `.env`.
3. Run `pip install -r requirements.txt`, then `streamlit run app.py`.

**Switching model or provider:** change `LLM_BASE_URL` and `LLM_MODEL` in `.env`.

## Development record

| Date | Change | Why | How I checked | Commit |
|---|---|---|---|---|
| 2026-11-15 | Added README, CLAUDE.md, .gitignore, .env.example | Set up the repo and keep keys out of git | `.env` does not appear in the commit | [link]() |
| 2026-11-15 | Added `requirements.txt` (Streamlit 1.67.0) and an empty `app.py` | Starting point for the prototype | `streamlit run app.py` served the page (HTTP 200); `AppTest` ran the script with no exceptions | [`bc5d2d4`](https://github.com/DangMooMom/tickerwhy/commit/bc5d2d4) |

## AI assistance

| Tool | What I asked | What I changed | How I checked |
|---|---|---|---|
| Claude | Draft README, CLAUDE.md and .gitignore | <!-- what you edited --> | <!-- e.g. confirmed Groq base URL in Groq docs --> |
| Claude Code | Create `requirements.txt` and an empty Streamlit app, run it, commit | <!-- what you edited --> | Claude started the app and checked it loaded without errors |

## Additional files

- `CLAUDE.md`: rules for AI coding agents working in this repo.
- `.env.example`: settings template with no real key.
