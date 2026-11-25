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
