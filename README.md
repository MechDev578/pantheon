# Pantheon: The Bot Overlord (`v1.2`)

![Version](https://img.shields.io/badge/version-v1.2.0-fbbf24?style=flat-square)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite&logoColor=white)
![React Flow](https://img.shields.io/badge/React_Flow-v12-ff0072?style=flat-square)

**Pantheon v1.2** is an interactive multi-agent orchestration visualizer (**Mind Map**) featuring a calm neutral Graphite UI with full **dark and light themes**, a collapsible **agent hierarchy sidebar**, smooth animated map transitions, and a **resizable bottom details drawer** with searchable, filterable live logs.

> [!TIP]
> **Looking for real AI-powered bots & live web scraping?**
> Switch to the **[`v2` branch](https://github.com/MechDev578/pantheon/tree/v2)** for **Pantheon `v2.2.1`** — built right on top of this Graphite UI with real multi-provider AI orchestration (Gemini 3.8, OpenAI, Claude), Greek mythology Olympian bots, Ask-First vs. Auto-Assume context modes, live web search, recursive multi-page website scraping, and Local + Netlify Cloud execution!

---

## Versions & Branches

| Version | Branch | Status | Summary |
| :--- | :--- | :--- | :--- |
| **v1.0.0** | Tag `v1.0.0` | Archive | Initial Bot Mind Map visualizer prototype |
| **v1.2.0** *(current)* | [`main`](https://github.com/MechDev578/pantheon/tree/main) | Stable | Graphite UI redesign (#1): neutral dark & light themes, collapsible agent tree sidebar, compact smooth-animated nodes, resizable bottom details drawer, keyboard shortcuts |
| **v2.2.1** | [`v2`](https://github.com/MechDev578/pantheon/tree/v2) | Active | Built over `v1.2` Graphite UI: real Gemini/OpenAI/Claude orchestration engine, Greek mythology Olympian swarm, Ask-First vs. Auto-Assume context modes, recursive deep web scraper, Local Engine + Netlify Cloud |
| **v3.0.0** | *Planned* | Roadmap | Action-capable bots with human-in-the-loop approvals — hotel & restaurant bookings, automated itineraries, landlord outreach, and external integrations |

---

## What's Inside `v1.2`

- **Neutral Dark & Light Themes:** Role-token color system on `<html data-theme>` synced with Antigravity MCP App host theme changes, with zero flash on load.
- **Three-Surface Layout:**
  - **Collapsible Agent Sidebar (Left):** Indented agent hierarchy tree mirroring the map, instant name/role filter (`⌘K` / `Ctrl+K`), and live status breakdown bar.
  - **Interactive Mind Map (Center):** Compact `184×52` agent cards with shape-coded accessible status icons (rotating arc = running, dashed ring = idle, filled check = done), smooth 420ms layout easing, parent-origin spawn animations, drag-safe node merging, and a floating map toolbar (**Tidy up**, zoom controls, **Fit** `F`).
  - **Resizable Bottom Details Drawer:** Drag the top edge (or use `ArrowUp`/`ArrowDown`), double-click to reset, inspect current task, parent/children lineage, and filterable/searchable monospace logs with level counts, copy-on-hover, and smart `Latest` auto-follow.
- **Keyboard Shortcuts:** `[` Toggle agent list · `⌘K` / `Ctrl+K` Find agent · `F` Fit map · `N` New agent · `Esc` Clear selection.
- **Multi-Target Packaging:** Runs locally, on Netlify, as a single-file Antigravity MCP App bundle, or as a standalone macOS Swift + `WKWebView` `.app`.

> [!NOTE]
> `v1.2` runs on a local in-browser simulation engine ([`src/engine/mockOrchestrator.ts`](src/engine/mockOrchestrator.ts)) for instant zero-key exploration. For live AI agents and real web scraping, switch to the **[`v2` branch](https://github.com/MechDev578/pantheon/tree/v2)**.

---

## Quick Start

### 1. Local Development Server
```bash
git clone https://github.com/MechDev578/pantheon.git
cd pantheon
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 2. Hosted Web App (Netlify + Mac Dock)
- **Live Demo:** https://bot-mind-map-live.netlify.app
- **Add to macOS Dock:** Open the live URL in **Safari** → *File → Add to Dock…* (or **Chrome** → *Install page as app*).

### 3. Standalone Offline macOS Desktop App (`.app`)
```bash
npm run build:desktop
```
Outputs `release/Bot Mind Map.app`.

### 4. Antigravity MCP App Single-File Bundle
```bash
npm run build:mcp
```
Outputs `dist-mcp/index.html`.

---

## Project Structure (`v1.2`)

```text
pantheon/
├── .agents/agents/               # Antigravity architect & coder subagent prompts
├── desktop/                      # Native macOS Cocoa + WKWebView wrapper
├── public/                       # App icon & PWA manifest
├── src/
│   ├── main.tsx                  # Entry point + MCP App host bridge init
│   ├── index.css                 # Dark & light role tokens, shared controls
│   ├── App.tsx / App.css         # Root layout shell & keyboard shortcuts
│   ├── types/bot.ts              # Shared TypeScript contracts
│   ├── engine/mockOrchestrator.ts# Pure simulation tick engine & manual spawning
│   ├── hooks/
│   │   ├── useBotSimulation.ts   # React simulation state & 1.4s tick loop
│   │   ├── useTheme.ts           # Dark/light theme hook synced with data-theme
│   │   └── useNow.ts             # 1-second ticking clock for elapsed & relative times
│   ├── utils/
│   │   ├── treeLayout.ts         # Deterministic recursive subtree-width TB layout
│   │   ├── format.ts             # Clock, duration, elapsed & relative time helpers
│   │   ├── keyboard.ts           # Typing-target guard for global shortcuts
│   │   └── mcpAppBridge.ts       # @modelcontextprotocol/ext-apps host bridge
│   └── components/
│       ├── common/               # StatusIcon (shape-coded accessible glyphs)
│       ├── details/              # Resizable DetailsDrawer (task, lineage, logs)
│       ├── graph/                # BotGraphCanvas, BotNode, BotEdge, MapToolbar
│       ├── header/               # HeaderToolbar (status, theme, run controls)
│       └── sidebar/              # AgentSidebar (filterable indented agent tree)
├── index.html
├── netlify.toml
├── package.json
├── PLAN.md
├── tsconfig.json
├── vite.config.ts
└── vite.mcp.config.ts
```

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check (`tsc --noEmit`) and build production bundle to `dist/` |
| `npm run build:mcp` | Build self-contained single-file HTML bundle to `dist-mcp/index.html` |
| `npm run build:desktop` | Build `dist-mcp/index.html` and compile `release/Bot Mind Map.app` |
| `npm run preview` | Preview the production `dist/` build locally |
