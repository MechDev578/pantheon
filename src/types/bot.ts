import type { RefObject } from 'react';

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
  /** Bumped to pan the map to the selected agent. */
  focusRequest: number;
  onSelectBot: (botId: string | null) => void;
  onAutoLayout: () => void;
}

export interface HeaderToolbarProps {
  isSimulating: boolean;
  elapsedLabel: string;
  selectedBotName: string | null;
  isSidebarOpen: boolean;
  theme: 'dark' | 'light';
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onToggleSimulation: () => void;
  onSpawnBot: () => void;
  onReset: () => void;
}

export interface AgentSidebarProps {
  bots: Record<string, BotEntity>;
  rootId: string;
  selectedBotId: string | null;
  stats: SimulationStats;
  isOpen: boolean;
  filterInputRef: RefObject<HTMLInputElement>;
  onSelectBot: (botId: string) => void;
  onClose: () => void;
}

export interface DetailsDrawerProps {
  bot: BotEntity | null;
  bots: Record<string, BotEntity>;
  rootId: string;
  now: number;
  isSimulating: boolean;
  onSelectBot: (botId: string | null) => void;
  onSpawnChild: (parentId: string) => void;
  onCenterOnMap: () => void;
}
