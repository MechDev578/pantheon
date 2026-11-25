# Pantheon v2: The Bot Overlord

**Pantheon v2** is a real, live multi-agent **Bot Manager & Deep Web Research Control Plane** modeled after Greek Mythology. Deploy a mission to **Zeus**, choose whether Zeus asks clarifying questions first or autonomously assumes context, and watch an Olympian swarm (**Athena**, **Artemis**, **Hermes**, **Iris**, **Themis**, **Apollo**, and more) spawn in parallel, search the web, recursively deep-crawl websites, and synthesize cited reports in real time on an interactive Mind Map.

> **Versioning:**
> - **`v1.0.0` (`main` branch / tag `v1.0.0`):** Pure frontend Bot Mind Map visualizer (offline mock simulator).
> - **`v2` (`v2` branch):** Real multi-provider AI orchestration engine, Ask-First vs. Auto-Assume context modes, live web search & recursive website deep-crawling, Greek mythology bot personas, Local Mac Engine + Netlify Cloud streaming backend.
> - **`v3` (Planned Roadmap):** Action-capable bots with human-in-the-loop approvals — hotel & restaurant reservations, automated itinerary booking, landlord email outreach, calendar sync, and OAuth integrations.

---

## Key Capabilities in v2

- **Greek Mythology Olympian Roster:**
  - **Zeus** (*Orchestrator*) — Analyzes goals, asks clarifying questions or records assumptions, decomposes missions into parallel tracks, and coordinates the swarm.
  - **Athena** (*Planner*) — Designs evaluation rubrics and research strategies.
  - **Artemis** (*Researcher*) — Hunts authoritative websites, direct booking pages, reviews, and docs across multiple search angles.
  - **Hermes / Iris / Odysseus / Poseidon** (*Deep Scrapers*) — Fetch and recursively crawl websites (`deep_crawl`), extracting headings, Markdown tables, pricing, policies, and sub-links.
  - **Daedalus** (*Architect*) & **Hephaestus** (*Coder*) — Design technical blueprints, itineraries, schemas, and code.
  - **Themis** (*Reviewer*) & **Cerberus** (*Tester*) — Fact-check claims across scraped sources and audit edge cases.
  - **Apollo** (*Synthesizer*) — Compiles all sub-agent findings and scraped websites into a final Markdown Mission Report with clickable citations.
- **Smart Context Strategy Toggle:**
  - **Ask First:** Zeus inspects your goal and pauses in a `waiting` state with targeted clarifying questions + clickable quick-options if anything is ambiguous (with a 1-click *Skip & Assume* override).
  - **Auto-Assume:** Zeus infers practical defaults, logs every assumption transparently, and deploys specialist bots immediately.
- **Deep Web Search & Multi-Page Crawling (`engine/webTools.ts`):**
  - Works out of the box with zero search API keys (built-in DuckDuckGo HTML/Lite + Wikipedia fallback), plus optional **Tavily** or **Brave Search** API keys in Settings.
  - `scrape_url` & `deep_crawl` parse live HTML with `cheerio` into clean Markdown (preserving tables, headings, lists, and pricing) and follow relevance-scored sub-links up to configurable crawl depths (`Quick`, `Deep`, `Abyssal`).
- **Multi-Provider AI Brain (`engine/llmClient.ts`):**
  - Supports **Google Gemini**, **OpenAI**, and **Anthropic Claude** with native parallel tool calling.
  - Configure keys via local `.env` **or** directly in the Pantheon UI **Settings** modal (stored strictly in browser `localStorage`, never committed to Git).
- **Live Interactive Bot Mind Map & 3-Tab Inspector:**
  - Real-time node graph showing active tool tickers (`Deep crawling...`, `Searching web...`, `Awaiting Hermes...`), scraped page counts, and nested child spawns.
  - Click any Olympian node to view **Live Telemetry Logs**, **Scraped Sources** (clickable URLs, word counts, crawl depth), and **Bot Output** — plus deploy custom follow-up sub-bots directly under any node.
  - Includes a built-in **Demo Mode** toggle so visitors without an API key can still explore the Greek mythology swarm live.

---

## Quick Start

### 1. Local Full-Power Mode (Recommended — Unlimited Runtime & Deepest Crawls)
```bash
git clone -b v2 https://github.com/MechDev578/pantheon.git
cd pantheon
npm install
cp .env.example .env   # Optional: add GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY (or paste in UI Settings)
npm run dev
```
- Opens the **React UI** at `http://localhost:5173` and the **Local Pantheon Engine** at `http://127.0.0.1:8787` (automatically proxied via `/api`).
- Missions persist locally in `.pantheon-data/` (gitignored; API keys are never written to disk).

### 2. Cloud Mode on Netlify
Deploy the `v2` branch to Netlify:
- Netlify builds the Vite frontend (`dist/`) and bundles `netlify/functions/pantheon.mts` at `/api/cloud/*`.
- Add `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` as Netlify environment variables (or let users bring their own key in the UI Settings modal).

### 3. Standalone Offline macOS Desktop App (`.app`)
```bash
npm run build:desktop
```
Outputs `release/Bot Mind Map.app`.

---

## Project Structure (v2)

```text
pantheon/
├── engine/                       # Shared runtime-agnostic multi-agent core
│   ├── types.ts                  # Canonical Mission, Bot, Source, Stream contracts
│   ├── pantheonRoster.ts         # Greek mythology deities, personas & depth presets
│   ├── llmClient.ts              # Unified Gemini / OpenAI / Anthropic tool-calling client
│   ├── webTools.ts               # Web search, SSRF-safe HTML scraper & recursive deep crawler
│   ├── agentRunner.ts            # ReAct tool-calling loop with parallel sub-agent spawning
│   └── missionOrchestrator.ts    # Zeus Context Analyzer -> Parallel Swarm -> Apollo Report
├── server/
│   └── index.ts                  # Local Mac Node.js HTTP + SSE engine (:8787)
├── netlify/functions/
│   └── pantheon.mts              # Netlify Cloud Function (/api/cloud/*) with SSE streaming
├── src/
│   ├── hooks/usePantheon.ts      # Unified Local Engine + Netlify Cloud + Demo state manager
│   └── components/
│       ├── graph/                # BotGraphCanvas, BotNode (Greek deity cards), BotEdge
│       ├── header/               # HeaderToolbar (runtime switcher, stats, controls)
│       ├── inspector/            # 3-tab Log/Sources/Output Inspector + Sub-Bot deployer
│       ├── mission/              # MissionLauncher, ClarificationModal, MissionReportModal
│       └── settings/             # Multi-provider AI & Search key configuration modal
├── desktop/                      # Native macOS Swift + WKWebView wrapper
├── .env.example                  # Optional environment variable template
├── netlify.toml                  # Netlify build & Functions config
└── package.json
```

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Run both the Local Pantheon Engine (`:8787`) and Vite UI (`:5173`) |
| `npm run dev:ui` | Run the Vite frontend only |
| `npm run server` | Run the Local Pantheon Engine only (with hot reload) |
| `npm run typecheck` | Strictly type-check frontend, engine, server, and Netlify function |
| `npm run build` | Type-check everything and build the production bundle to `dist/` |
| `npm run build:mcp` | Build single-file HTML bundle for Antigravity MCP App |
| `npm run build:desktop` | Build standalone macOS `.app` bundle |
