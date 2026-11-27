# Pantheon: The Bot Overlord (`v1`)

![Version](https://img.shields.io/badge/version-v1.0.0-fbbf24?style=flat-square)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite&logoColor=white)
![React Flow](https://img.shields.io/badge/React_Flow-v12-ff0072?style=flat-square)

**Pantheon v1** is an interactive, real-time multi-agent orchestration visualizer (**Bot Mind Map**) built with React, TypeScript, Vite, and `@xyflow/react`. It renders a dynamic hierarchical node graph where a root orchestrator spawns nested child agents, transitions statuses live, and streams execution telemetry into a side inspector panel.

> [!TIP]
> **Looking for real AI-powered bots & live web scraping?**
> Switch to the **[`v2` branch](https://github.com/MechDev578/pantheon/tree/v2)** for **Pantheon v2** — featuring real multi-provider AI orchestration (Gemini, OpenAI, Claude), Greek mythology Olympian bots, Ask-First vs. Auto-Assume context modes, live web search, recursive multi-page website scraping, and both Local + Netlify Cloud execution!

---

## Versions & Branches

| Version | Branch | Status | Summary |
| :--- | :--- | :--- | :--- |
| **v1.0.0** *(current)* | [`main`](https://github.com/MechDev578/pantheon/tree/main) | Stable | Frontend Bot Mind Map visualizer with interactive offline simulation, live log inspector, Netlify web deploy, Antigravity MCP App, and standalone macOS `.app` |
| **v2.0.0** | [`v2`](https://github.com/MechDev578/pantheon/tree/v2) | Active | Real multi-provider AI bot manager (Gemini / OpenAI / Claude), Greek mythology swarm, Ask-First vs. Auto-Assume context engine, deep website scraper & crawler, Local Engine + Netlify Cloud |
| **v3.0.0** | *Planned* | Roadmap | Action-capable bots with human-in-the-loop approvals — hotel & restaurant bookings, automated itineraries, landlord email outreach, and external integrations |

---

## What's Inside v1

- **Interactive Multi-Agent Node Graph (`@xyflow/react`):** Pan, zoom, minimap, dot grid canvas, and a deterministic top-to-bottom recursive subtree-width layout that prevents sibling branch overlaps at any depth.
- **Live Bot Cards & Animated Edges:**
  - Displays each bot's name, role (`Orchestrator`, `Planner`, `Researcher`, `Architect`, `Coder`, `Reviewer`, `Tester`, `Synthesizer`), live status (`running`, `idle`, `done`), current task, hierarchy depth (`L0`–`L4`), child count, and log count.
  - Pulsing status indicators and animated cyan edges for active (`running`) connections.
  - Preserves manually dragged node positions across live simulation ticks, with one-click **Auto-Layout** to reset and fit the graph.
- **Live Log Inspector Panel:** Click any node to view its full current task, timestamps (`Created` / `Updated`), clickable parent/child navigation chips, and an auto-scrolling monospace log stream (`INFO`, `WARN`, `SUCCESS`, `DEBUG`).
- **Simulation Controls:** Pause/Resume ticks, manually spawn child bots under any selected agent, Auto-Layout, and Reset.
- **Multi-Target Packaging:** Runs as a web app (local or Netlify), a single-file Antigravity MCP App bundle, or a lightweight native macOS Swift + `WKWebView` desktop `.app`.
- **Workspace Subagent Blueprints:** Includes `.agents/agents/architect.md` and `.agents/agents/coder.md` definitions.

> [!NOTE]
> `v1` runs on a local in-browser mock orchestrator ([`src/engine/mockOrchestrator.ts`](src/engine/mockOrchestrator.ts)) for instant zero-key visualization and UI exploration. For live LLM agents and real website scraping, check out the **[`v2` branch](https://github.com/MechDev578/pantheon/tree/v2)**.

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
Compile a lightweight native Apple Silicon Swift + `WKWebView` app requiring no browser or server:
```bash
npm run build:desktop
```
The compiled bundle is written to `release/Bot Mind Map.app` (drag it into `/Applications` or launch directly from Finder).

### 4. Antigravity MCP App Single-File Bundle
Build a self-contained single-file HTML bundle for embedding inside Antigravity's sidebar or side pane:
```bash
npm run build:mcp
```
Outputs `dist-mcp/index.html`.

---

## Project Structure (`v1`)

```text
pantheon/
├── .agents/agents/
│   ├── architect.md              # Technical Architect subagent prompt
│   └── coder.md                  # Software Engineer subagent prompt
├── desktop/
│   ├── main.swift                # Native macOS Cocoa + WKWebView wrapper
│   ├── Info.plist                # macOS app bundle metadata
│   └── build-app.sh              # Compiles release/Bot Mind Map.app
├── public/
│   ├── icon.svg                  # App icon
│   └── manifest.json             # PWA manifest
├── src/
│   ├── main.tsx                  # Entry point + MCP App host bridge init
│   ├── index.css                 # Dark and light theme tokens, shared controls
│   ├── App.tsx / App.css         # Root layout shell & state wiring
│   ├── types/bot.ts              # Shared TypeScript contracts
│   ├── engine/mockOrchestrator.ts# Pure simulation tick engine & manual spawning
│   ├── hooks/useBotSimulation.ts # React simulation state & 1.4s tick loop
│   ├── utils/
│   │   ├── treeLayout.ts         # Deterministic recursive subtree-width TB layout
│   │   └── mcpAppBridge.ts       # @modelcontextprotocol/ext-apps host bridge
│   └── components/
│       ├── common/               # StatusIcon, role icons
│       ├── details/              # DetailsDrawer (task, lineage, activity; resizable)
│       ├── graph/                # BotGraphCanvas, BotNode, BotEdge, map toolbar
│       ├── header/               # HeaderToolbar (run status, theme, run controls)
│       └── sidebar/              # AgentSidebar (filterable agent tree)
├── index.html
├── netlify.toml                  # Netlify build & SPA redirect config
├── package.json
├── PLAN.md                       # v1 implementation blueprint
├── tsconfig.json
├── vite.config.ts                # Standard web build config
└── vite.mcp.config.ts            # Single-file HTML build for MCP App & macOS app
```

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check (`tsc --noEmit`) and build the production web bundle to `dist/` |
| `npm run build:mcp` | Build a self-contained single-file HTML bundle to `dist-mcp/index.html` |
| `npm run build:desktop` | Build `dist-mcp/index.html` and compile `release/Bot Mind Map.app` |
| `npm run preview` | Preview the production `dist/` build locally |
