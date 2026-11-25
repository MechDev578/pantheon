# Pantheon: The Bot Overlord

**Pantheon: The Bot Overlord** is a live, interactive multi-agent orchestration visualizer (**Bot Mind Map**) paired with custom Antigravity subagent definitions (`architect` and `coder`). It renders a dynamic hierarchical node graph where a parent orchestrator spawns nested child bots, transitions statuses in real time, and streams live execution logs into a side inspector panel.

---

## Features

- **Live Multi-Agent Node Graph (`@xyflow/react`):** Interactive canvas with pan, zoom, minimap, dot grid background, and automatic non-overlapping top-to-bottom tree layout.
- **Custom Bot Cards & Animated Connections:**
  - Displays each bot's name, role (`Orchestrator`, `Planner`, `Researcher`, `Architect`, `Coder`, `Reviewer`, `Tester`, `Synthesizer`), live status (`running`, `idle`, `done`), current task, depth level, child count, and log count.
  - Pulsing status indicator and animated cyan edges for active (`running`) connections.
  - Preserves manually dragged node positions across live ticks, with one-click **Auto-Layout** to re-center and fit the view.
- **Live Log Inspector Side Panel:** Click any bot node to inspect its full task description, metadata, timestamps (`Created` / `Updated`), clickable parent/child navigation chips, and an auto-scrolling monospace log stream (`INFO`, `WARN`, `SUCCESS`, `DEBUG`).
- **Interactive Controls:** Pause/Resume simulation, manually spawn child bots under any selected agent, Auto-Layout, and Reset.
- **Custom Antigravity Subagents:** Ships with workspace-scoped `.agents/agents/architect.md` and `.agents/agents/coder.md` definitions.

---

## Ways to Run & Use Pantheon

### 1. Inside Antigravity (Permanent Sidebar & Side-Pane UI Button)
Packaged as a global Antigravity MCP App plugin at `~/.gemini/config/plugins/bot-mind-map/`:
- **Left Sidebar:** Click **Bot Mind Map** for a full-page view.
- **Side Pane (`+` menu):** Dock **Bot Mind Map** right next to any chat.
- **Rebuild & sync plugin after edits:**
  ```bash
  npm run build:mcp
  cp dist-mcp/index.html ~/.gemini/config/plugins/bot-mind-map/dist/index.html
  ```

### 2. Hosted Web App on Netlify (Always Online + Mac Dock)
- **Live URL:** https://bot-mind-map-live.netlify.app
- **Install as a Mac Dock App:** Open the URL in **Safari** → *File → Add to Dock…* (or **Chrome** → *Install page as app*).

### 3. Standalone Offline macOS Desktop App (`.app`)
Compiled as a lightweight (~904 KB) native Apple Silicon Swift + `WKWebView` app with zero external browser or server required:
- **Bundle Location:** `release/Bot Mind Map.app`
- **Install permanently:** Drag `release/Bot Mind Map.app` into `/Applications`, or double-click it directly from Finder.
- **Rebuild after code changes:**
  ```bash
  npm run build:desktop
  ```

### 4. Local Development Server
```bash
npm install
npm run dev
```
Open http://localhost:5173/ in your browser.

---

## Project Structure

```text
01_Pantheon/
├── .agents/agents/
│   ├── architect.md              # Technical Architect subagent (model: pro)
│   └── coder.md                  # Software Engineer subagent (model: flash)
├── desktop/
│   ├── main.swift                # Native macOS Cocoa + WKWebView wrapper
│   ├── Info.plist                # macOS bundle metadata
│   └── build-app.sh              # Compiles release/Bot Mind Map.app
├── public/
│   ├── icon.svg                  # App icon
│   └── manifest.json             # PWA manifest for Add to Dock / Install
├── release/
│   └── Bot Mind Map.app          # Built standalone macOS desktop app
├── src/
│   ├── main.tsx                  # Entry point + MCP App host bridge init
│   ├── index.css                 # Dark observability theme tokens & React Flow styles
│   ├── App.tsx / App.css         # Root layout shell & state wiring
│   ├── types/
│   │   └── bot.ts                # Shared TypeScript contracts
│   ├── engine/
│   │   └── mockOrchestrator.ts   # Pure simulation tick engine & manual spawning
│   ├── hooks/
│   │   └── useBotSimulation.ts   # React simulation state & 1.4s tick loop
│   ├── utils/
│   │   ├── treeLayout.ts         # Deterministic recursive subtree-width TB layout
│   │   └── mcpAppBridge.ts       # @modelcontextprotocol/ext-apps host bridge
│   └── components/
│       ├── graph/                # BotGraphCanvas, BotNode, BotEdge
│       ├── header/               # HeaderToolbar (live badge, stats, controls)
│       └── inspector/            # LogInspectorPanel (metadata, links, live logs)
├── index.html
├── netlify.toml                  # Netlify build & SPA redirect config
├── package.json
├── PLAN.md                       # Architecture blueprint written by architect subagent
├── README.md
├── tsconfig.json
├── vite.config.ts                # Standard web build config
└── vite.mcp.config.ts            # Single-file HTML build for MCP App & macOS app
```

---

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check (`tsc --noEmit`) and build the web bundle to `dist/` |
| `npm run build:mcp` | Build a self-contained single-file HTML bundle to `dist-mcp/index.html` |
| `npm run build:desktop` | Build `dist-mcp/index.html` and compile `release/Bot Mind Map.app` |
| `npm run preview` | Preview the production `dist/` build locally |
