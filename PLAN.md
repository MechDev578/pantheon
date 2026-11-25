# Bot Mind Map — Implementation Blueprint

A live multi-agent orchestration visualizer built with React, TypeScript, Vite, and React Flow (`@xyflow/react`). An active parent orchestrator dynamically spawns nested child bots, transitions statuses, updates tasks, and streams real-time logs into a side inspector panel.

---

## 1. Tech Stack & Folder Structure

### Tech Stack
- **Build & Runtime:** Vite (`^6.0.5`), React (`^18.3.1`), TypeScript (`^5.6.3`, strict mode)
- **Graph Engine:** `@xyflow/react` (`^12.4.4`)
- **Icons:** `lucide-react` (`^0.469.0`)
- **Styling:** Pure CSS with shared design tokens in `src/index.css` and component-scoped `.css` files (zero Tailwind/PostCSS config overhead, zero cross-task CSS merge conflicts)

### Folder Structure
```text
01_Main/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── PLAN.md
└── src/
    ├── main.tsx
    ├── index.css                               # Global reset, dark-theme CSS variables, React Flow overrides
    ├── App.tsx                                 # Root layout & state-to-UI wiring
    ├── App.css
    ├── types/
    │   └── bot.ts                              # Shared domain, hook & component prop contracts
    ├── engine/
    │   └── mockOrchestrator.ts                 # Pure simulation tick engine, seed state & manual spawn
    ├── hooks/
    │   └── useBotSimulation.ts                 # React state + interval loop + action handlers
    ├── utils/
    │   └── treeLayout.ts                       # Deterministic top-to-bottom (TB) hierarchical layout
    └── components/
        ├── graph/
        │   ├── BotGraphCanvas.tsx              # ReactFlowProvider + canvas, minimap, controls, layout sync
        │   ├── BotGraphCanvas.css
        │   ├── BotNode.tsx                     # Custom node card (name, role, status pulse, task, counts)
        │   ├── BotNode.css
        │   ├── BotEdge.tsx                     # Custom SmoothStep edge (animated when child is running)
        │   └── BotEdge.css
        ├── header/
        │   ├── HeaderToolbar.tsx               # Live/Paused badge, stats, Pause/Resume, Spawn, Auto-Layout, Reset
        │   └── HeaderToolbar.css
        └── inspector/
            ├── LogInspectorPanel.tsx           # Side panel: metadata, parent/child links, live streaming logs
            └── LogInspectorPanel.css
```

---

## 2. Shared TypeScript Contracts (`src/types/bot.ts`)

Create `src/types/bot.ts` verbatim during Phase 0 so Tasks A, B, and C compile against identical interfaces with zero drift.

```ts
export type BotStatus = 'running' | 'idle' | 'done';

export type LogLevel = 'info' | 'warn' | 'success' | 'debug';

export type BotRole =
  | 'Orchestrator'
  | 'Planner'
  | 'Researcher'
  | 'Architect'
  | 'Coder'
  | 'Reviewer'
  | 'Tester'
  | 'Synthesizer';

export interface BotLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  level: LogLevel;
  message: string;
}

export interface BotEntity {
  id: string;
  name: string;
  role: BotRole;
  status: BotStatus;
  currentTask: string;
  parentId: string | null;
  childIds: string[];
  depth: number;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  logs: BotLogEntry[];
}

export interface SimulationStats {
  total: number;
  running: number;
  idle: number;
  done: number;
}

export interface BotSimulationState {
  bots: Record<string, BotEntity>;
  rootId: string;
  selectedBotId: string | null;
  isSimulating: boolean;
  tickCount: number;
  layoutVersion: number;
}

export interface BotSimulationActions {
  toggleSimulation: () => void;
  selectBot: (botId: string | null) => void;
  spawnManualBot: (parentId?: string) => void;
  resetSimulation: () => void;
  triggerAutoLayout: () => void;
}

export type UseBotSimulationResult = BotSimulationState &
  BotSimulationActions & {
    stats: SimulationStats;
    selectedBot: BotEntity | null;
  };

export interface BotGraphCanvasProps {
  bots: Record<string, BotEntity>;
  rootId: string;
  selectedBotId: string | null;
  layoutVersion: number;
  onSelectBot: (botId: string | null) => void;
}

export interface HeaderToolbarProps {
  isSimulating: boolean;
  stats: SimulationStats;
  selectedBotName: string | null;
  onToggleSimulation: () => void;
  onSpawnBot: () => void;
  onReset: () => void;
  onAutoLayout: () => void;
}

export interface LogInspectorPanelProps {
  bot: BotEntity | null;
  parentBot: BotEntity | null;
  childBots: BotEntity[];
  onSelectBot: (botId: string | null) => void;
  onSpawnChild: (parentId: string) => void;
}
```

---

## 3. Execution Plan

### Phase 0 — Shared Foundation (Sequential Bootstrap, before parallel tasks)
Run this setup once before launching Tasks A, B, and C in parallel:
1. Create `package.json`:
   - Dependencies: `"react": "^18.3.1"`, `"react-dom": "^18.3.1"`, `"@xyflow/react": "^12.4.4"`, `"lucide-react": "^0.469.0"`
   - DevDependencies: `"@types/react": "^18.3.12"`, `"@types/react-dom": "^18.3.1"`, `"@vitejs/plugin-react": "^4.3.4"`, `"typescript": "^5.6.3"`, `"vite": "^6.0.5"`
   - Scripts: `"dev": "vite"`, `"build": "tsc -b && vite build"` (or `"tsc --noEmit && vite build"`), `"preview": "vite preview"`
2. Create `tsconfig.json` (`strict: true`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noEmit: true`), `vite.config.ts` (`plugins: [react()]`), and `index.html` (title `"Bot Mind Map"`, `#root` mount).
3. Create `src/types/bot.ts` with the exact contract in Section 2.
4. Create `src/index.css` defining dark observability CSS variables (`--bg-canvas: #0b0f17`, `--bg-surface: #111827`, `--bg-elevated: #1a2234`, `--border-subtle: #253047`, `--text-primary: #f1f5f9`, `--text-secondary: #94a3b8`, `--status-running: #22d3ee`, `--status-idle: #f59e0b`, `--status-done: #10b981`, `--font-sans`, `--font-mono`), `html, body, #root { height: 100%; margin: 0; }`, and base scrollbar/React Flow theme overrides.
5. Create `src/main.tsx` importing `'@xyflow/react/dist/style.css'` before `'./index.css'`, rendering `<App />`.
6. Run `npm install`.

---

### Parallel Workstreams (Disjoint File Ownership)

#### Task A — Mock Agent Simulation Engine & Hook
**Owned Files:**
- `src/engine/mockOrchestrator.ts`
- `src/hooks/useBotSimulation.ts`

**Implementation Spec:**
1. **`src/engine/mockOrchestrator.ts`** (pure TypeScript, no React imports):
   - Export `createInitialSimulationState(): BotSimulationState`:
     - Seeds a multi-level starter graph (`selectedBotId: 'bot-root'`, `isSimulating: true`, `tickCount: 0`, `layoutVersion: 0`) so the app looks alive immediately on load:
       - Depth 0 (`bot-root`): `Atlas` (`Orchestrator`, `running`)
       - Depth 1: `Sage` (`Planner`, `done`), `Nova` (`Researcher`, `running`), `Vektor` (`Architect`, `running`)
       - Depth 2 (under `Vektor` / `Nova`): `Forge` (`Coder`, `running`), `Lens` (`Reviewer`, `idle`)
     - Each starter bot has 3–5 realistic initial `logs` and accurate `childIds` / `createdAt` / `updatedAt`.
   - Export `advanceSimulationTick(state: BotSimulationState): BotSimulationState`:
     - Appends 1 realistic log entry (with varied `LogLevel`: `info`, `debug`, `warn`, `success`) to active `running` bots (cap `logs` per bot at 120 entries).
     - Periodically rotates `currentTask` for `running` bots using role-specific task pools.
     - Dynamically spawns new child bots (auto-spawn cap e.g. `AUTO_MAX_BOTS = 22`, `MAX_DEPTH = 3`) from eligible `running` parents when active count is low or by probability, assigning child roles logically (e.g., `Orchestrator` -> `Planner`/`Researcher`/`Architect`; `Architect` -> `Coder`/`Reviewer`; `Coder` -> `Tester`; `Researcher` -> `Synthesizer`). Appends a delegation log on the parent.
     - Transitions statuses cleanly:
       - `running` -> `done` (after work completes and once any running children finish, or occasionally `running` -> `idle` waiting on subtask).
       - `idle` -> `running` (resumes with a new task & log entry).
       - Keeps orchestration lively: if active running bots drop below 2 and `total < AUTO_MAX_BOTS`, wakes `bot-root` (or an idle branch) to spawn a new child wave.
   - Export `createManualChildBot(state: BotSimulationState, preferredParentId?: string): BotSimulationState`:
     - Resolves parent in order: `preferredParentId` (if exists) -> `state.selectedBotId` (if exists) -> first `running` bot -> `state.rootId`.
     - Allows manual spawning up to a higher safety cap (e.g. `40` bots, depth up to `4`) so the toolbar **Spawn Bot** button always succeeds in normal usage.
     - Adds new child (`status: 'running'`), wakes parent to `'running'` if it was `'done'`/`'idle'`, logs delegation on parent, and sets `selectedBotId: newBot.id`.
2. **`src/hooks/useBotSimulation.ts`**:
   - Export `useBotSimulation(): UseBotSimulationResult`.
   - Uses `useState<BotSimulationState>(() => createInitialSimulationState())`.
   - `useEffect` interval (~`1400ms`) runs `advanceSimulationTick` whenever `state.isSimulating` is `true`.
   - Exposes memoized `stats` (`total`, `running`, `idle`, `done`), `selectedBot`, and actions (`toggleSimulation`, `selectBot`, `spawnManualBot`, `resetSimulation`, `triggerAutoLayout`). Note: `resetSimulation` should increment `layoutVersion` as well so the canvas clears dragged pins and re-fits the view.

---

#### Task B — React Flow Canvas, Tree Layout, Custom Node & Animated Edges
**Owned Files:**
- `src/utils/treeLayout.ts`
- `src/components/graph/BotNode.tsx`
- `src/components/graph/BotNode.css`
- `src/components/graph/BotEdge.tsx`
- `src/components/graph/BotEdge.css`
- `src/components/graph/BotGraphCanvas.tsx`
- `src/components/graph/BotGraphCanvas.css`

**Implementation Spec:**
1. **`src/utils/treeLayout.ts`**:
   - Export `computeTreeLayout(bots: Record<string, BotEntity>, rootId: string): Record<string, { x: number; y: number }>`.
   - Pure deterministic top-to-bottom (`TB`) recursive subtree-width layout (`NODE_WIDTH = 264`, `NODE_HEIGHT = 122`, `H_GAP = 44`, `V_GAP = 86`).
   - Computes each subtree's pixel width bottom-up so sibling branches across arbitrary nesting levels never overlap; centers each parent above its children's span.
2. **`src/components/graph/BotNode.tsx` & `BotNode.css`**:
   - Define React Flow node data as a **`type` alias** (not `interface`, to satisfy `@xyflow/react` v12's `Record<string, unknown>` constraint):
     `export type BotFlowNodeData = { bot: BotEntity; isSelected: boolean };`
     `export type BotFlowNode = Node<BotFlowNodeData, 'botNode'>;`
   - Render top `Handle` (`type="target"`, `position={Position.Top}`) and bottom `Handle` (`type="source"`, `position={Position.Bottom}`).
   - Display:
     - Role icon (`lucide-react`), **bot name**, **role chip**, and **status badge** (`running` / `idle` / `done`).
     - **Subtle pulse animation** (`@keyframes bot-pulse`) on status dot/ring and soft border glow when `status === 'running'`.
     - **Current task** (2-line clamped text with full `title` tooltip).
     - Compact footer: depth (`L{bot.depth}`), child count, and log count.
     - Distinct selected state border/shadow when `isSelected` is true.
3. **`src/components/graph/BotEdge.tsx` & `BotEdge.css`**:
   - Define `export type BotFlowEdgeData = { isActive: boolean; targetStatus: BotStatus };`
   - `export type BotFlowEdge = Edge<BotFlowEdgeData, 'botEdge'>;`
   - Render `BaseEdge` using `getSmoothStepPath`.
   - When `data?.isActive` (`targetStatus === 'running'`), render an animated dashed cyan stroke (`stroke-dasharray` CSS keyframe flow); when `done`/`idle`, render a calm solid/muted slate stroke.
4. **`src/components/graph/BotGraphCanvas.tsx` & `BotGraphCanvas.css`**:
   - Implement `export function BotGraphCanvas(props: BotGraphCanvasProps)` wrapping an inner component with `<ReactFlowProvider>`.
   - Maintain `pinnedPositionsRef` (`Record<string, XYPosition>`) updated in `onNodeDragStop` so user-dragged nodes stay put during live ticks while newly spawned bots receive fresh `computeTreeLayout` coordinates.
   - When `layoutVersion` changes, clear `pinnedPositionsRef`, apply `computeTreeLayout`, and call `fitView({ padding: 0.2, duration: 350 })`.
   - Define `nodeTypes` and `edgeTypes` outside component (or `useMemo`) to prevent React Flow node re-mounts.
   - Wire `onNodeClick={(_, node) => onSelectBot(node.id)}` and `onPaneClick={() => onSelectBot(null)}`.
   - Render `<Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />`, `<Controls />`, and `<MiniMap />`.
   - Ensure wrapper container has `width: 100%; height: 100%;` so React Flow always has non-zero dimensions.

---

#### Task C — Header Toolbar, Side Log Inspector Panel & App Shell
**Owned Files:**
- `src/components/header/HeaderToolbar.tsx`
- `src/components/header/HeaderToolbar.css`
- `src/components/inspector/LogInspectorPanel.tsx`
- `src/components/inspector/LogInspectorPanel.css`
- `src/App.tsx`
- `src/App.css`

**Implementation Spec:**
1. **`src/components/header/HeaderToolbar.tsx` & `HeaderToolbar.css`**:
   - Implement `export function HeaderToolbar(props: HeaderToolbarProps)`.
   - Left: Bot Mind Map logo (`Cpu` / `GitBranch` icon), title `"Bot Mind Map"`, and status pill (`Live` pulsing dot vs `Paused`).
   - Center/Right: Status summary pills (`Running`, `Idle`, `Done`, `Total`) + action buttons:
     - **Pause / Resume** (`Pause` / `Play` icon)
     - **Spawn Bot** (`Plus` icon; shows target context in `title` e.g. selected bot name)
     - **Auto-Layout** (`Network` / `Workflow` icon)
     - **Reset** (`RotateCcw` icon)
2. **`src/components/inspector/LogInspectorPanel.tsx` & `LogInspectorPanel.css`**:
   - Implement `export function LogInspectorPanel(props: LogInspectorPanelProps)`.
   - Hidden/collapsed smoothly (or unmounted) when `bot === null`; opens/updates whenever a bot is clicked (`bot !== null`).
   - Header: Bot name, role pill, status badge, `+ Child` button (`onSpawnChild(bot.id)`), and Close (`X`) button (`onSelectBot(null)`).
   - Metadata section:
     - **Role**, **Status**, **Current Task** (full text)
     - **Parent** (clickable chip calling `onSelectBot(parentBot.id)` when `parentBot` exists, or `"Root Agent"` if `null`)
     - **Timestamps:** `Created` and `Updated` formatted timestamps (`HH:MM:SS`) + depth indicator
     - **Children:** clickable mini-chips for each `childBots` item to jump directly to spawned child bots
   - Live Streaming Logs section:
     - Log count badge + `Auto-scroll` toggle (default `true`; auto-scrolls log viewport to bottom when `bot.logs.length` changes or `bot.id` switches, unless user toggles it off or scrolls up).
     - Monospace log list showing timestamp (`HH:MM:SS`), level badge (`INFO`, `WARN`, `SUCCESS`, `DEBUG`), and message.
3. **`src/App.tsx` & `src/App.css`**:
   - Calls `useBotSimulation()`.
   - Derives `parentBot` (`selectedBot?.parentId ? bots[selectedBot.parentId] ?? null : null`) and `childBots` (`selectedBot?.childIds.map(id => bots[id]).filter(Boolean) ?? []`).
   - Renders full-height shell (`100vw × 100vh`, `display: flex; flex-direction: column; overflow: hidden`):
     - `<HeaderToolbar ... />` (`height: 56px`, `flex-shrink: 0`)
     - `<main className="app-workspace">` (`flex: 1; display: flex; min-height: 0;`)
       - `<div className="canvas-pane">` (`flex: 1; min-width: 0; height: 100%;`) -> `<BotGraphCanvas ... />`
       - `<LogInspectorPanel ... />` (`width: 400px` when open)

---

## 4. Verification & Local Run Commands

Run from the project root directory:

```bash
# 1. Install dependencies (during Phase 0)
npm install

# 2. Type-check and verify zero TypeScript errors across all 3 parallel tasks
npx tsc --noEmit

# 3. Production build check (verifies Vite bundling, CSS, and TypeScript)
npm run build

# 4. Run locally for interactive browser verification
npm run dev
```

### Functional Smoke Checklist
- Initial load renders a multi-level bot tree with `Bot Mind Map` header, active pulsing `running` nodes, animated cyan edges on active links, and the root bot open in the Log Inspector.
- Over ~5–10 seconds, new child bots spawn automatically at deeper levels without overlapping existing nodes, statuses transition (`running` / `idle` / `done`), and logs stream in real time.
- Clicking any node opens/updates the Log Inspector with that bot's logs, metadata, parent/child navigation links, and timestamps.
- Toolbar buttons work as expected: **Pause/Resume** halts/resumes ticks, **Spawn Bot** immediately adds a child under the selected (or active) bot, **Auto-Layout** reorganizes dragged nodes and fits the view, and **Reset** restores the starter tree.
