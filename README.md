# UnifyApps · Use Case Universe

One place for every UnifyApps use case. Paste a prototype link and a team of AI agents builds the profile for you: what it is, the use-case type, a one- or two-line summary (English and Arabic), the industries it serves, the expected ROI, and the customer's logo. You don't fill in any forms.

## What's inside

| Area | What it does |
|---|---|
| **Showcase** | A customer-facing landing page with a 3D hero, a "paste a link" bar, live agent progress, animated KPIs, filters (search, vertical, type, stage, customer, sort) and 3D-tilt cards. |
| **Use case profile** | Screenshot, summary, problem, capabilities, systems, personas, ROI panel with assumptions, customer logo, and **videos / decks / notes**: upload files or paste YouTube, Loom, Vimeo, Google Slides or PDF links, which play inline. Owners can edit any field, and edits are kept when the agents re-run. |
| **Control Tower** | Coverage by vertical, mix by type, maturity funnel, value by vertical, top systems, gaps to close, agent-fleet health, live activity, a full table and CSV export. |
| **Context Graph** | An interactive 3D graph linking use cases, verticals, types, customers and systems. You can orbit, zoom, filter and click through. |
| **Ask AI** | Enterprise search over everything in the catalogue. The agent calls search, detail, stats and graph tools, and cites the use cases it uses. |
| **Customer-facing controls** | One switch hides all customer names and logos. Names are replaced with labels like "Banking client" and scrubbed from free text and AI answers, on the server. You can also mark single use cases as confidential. |
| **English / العربية** | Full UI translation with right-to-left layout. The agents write Arabic titles, summaries and ROI headlines. |

## The agent workflow

```
link ──► Scout ──► Analyst ──► ROI agent ──► Brand agent ──► Graph indexer
        reads the   type, EN/AR    value, payback,   finds & stores     links verticals,
        page + 3D   summary,       metrics,          the customer       customers, systems
        screenshot  verticals,     assumptions       logo
                    customer
```

Each step is recorded on the use case and shown live in the UI. Interrupted runs resume when the server restarts. With `ANTHROPIC_API_KEY` set, the agents use Claude: structured outputs, the page screenshot as visual input, a tool-using Ask agent, and server-side refusal fallback. Without a key, everything still works in **keyword mode**, which uses heuristic classification and benchmark ROI.

## Run locally

```bash
npm install
cp .env.example .env    # add ANTHROPIC_API_KEY; leave ADMIN_TOKEN empty for single-user mode locally
npm run dev             # API on :8787, UI on http://localhost:5173
```

Production build: `npm run build && npm start` (serves everything on :8787).
Screenshots need Chromium through Playwright (`npm i playwright && npx playwright install chromium`). The Docker image already includes it.

## Deploy (live and persistent)

* **Render:** New → Blueprint → select this repo. `render.yaml` sets up a Docker service with a persistent disk at `/data`. Set `ANTHROPIC_API_KEY`. `ADMIN_TOKEN` is generated for you; enter it in **Settings** to unlock editing.
* **Any Docker host:** `docker build -t use-cases . && docker run -p 8787:8787 -v uc-data:/data -e ANTHROPIC_API_KEY=… -e ADMIN_TOKEN=… use-cases`

Data (`db.json`, screenshots, logos and uploads) lives in `DATA_DIR`. Writes are atomic, so keep that folder on a persistent volume and back it up.

## Access model

* Everyone with the link can **view** the showcase, the tower, the graph and Ask AI.
* Only holders of `ADMIN_TOKEN` can add, edit, delete, upload or change settings. They also see processing items and the activity log.
* The server blocks links to private network addresses (set `ALLOW_PRIVATE_URLS=true` for internal prototypes on a private deployment).

## Branding

The UnifyApps logo is at `client/public/brand/unifyapps-logo.svg`. Replace it with your official asset if needed.

## Private claude.ai edition (no server, no API key)

`artifact/` is the same platform packaged as a private claude.ai Artifact. claude.ai hosts it, stores the data, provides Claude (no API key) and handles access. Only the owner can open it until they share it from claude.ai.

* Build: `npm run build:artifact` → `artifact/dist/use-case-universe.html` (one self-contained page). Publish it with Claude Code's Artifact tool to the same URL to update it.
* Differences from the server edition: Claude can't open prototype links itself, so it builds each profile from the link, your notes and an optional screenshot. Customer logos are uploaded. Videos and decks are uploaded (up to 20 MB) or linked, and links open in a new tab because claude.ai doesn't allow embeds.
