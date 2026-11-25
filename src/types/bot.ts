export type {
  AIProvider,
  BotEntity,
  BotLogEntry,
  BotRole,
  BotStatus,
  ClarifyingQuestion,
  ContextMode,
  EngineRuntime,
  LogLevel,
  MissionConfig,
  MissionState,
  MissionStatus,
  MissionStreamEvent,
  MissionSummary,
  ResearchDepth,
  ScrapedSource,
  SearchProvider,
  ServerCapabilities,
} from '../../engine/types';

import type {
  AIProvider,
  BotEntity,
  BotRole,
  ContextMode,
  EngineRuntime,
  ResearchDepth,
  SearchProvider,
} from '../../engine/types';

export interface SimulationStats {
  total: number;
  running: number;
  waiting: number;
  idle: number;
  done: number;
  error: number;
  sourcesScraped: number;
}

export interface PantheonSettings {
  provider: AIProvider;
  model: string;
  apiKeys: Record<AIProvider, string>;
  searchProvider: SearchProvider;
  searchApiKey: string;
  defaultContextMode: ContextMode;
  defaultDepth: ResearchDepth;
}

export interface BotSimulationState {
  bots: Record<string, BotEntity>;
  rootId: string;
  selectedBotId: string | null;
  isSimulating: boolean;
  tickCount: number;
  layoutVersion: number;
}

export interface BotGraphCanvasProps {
  bots: Record<string, BotEntity>;
  rootId: string;
  selectedBotId: string | null;
  layoutVersion: number;
  onSelectBot: (botId: string | null) => void;
}

export interface HeaderToolbarProps {
  runtimeMode: EngineRuntime;
  detectedBackend: 'local' | 'cloud' | null;
  isBusy: boolean;
  isDemoSimulating: boolean;
  hasReport: boolean;
  hasKeyReady: boolean;
  stats: SimulationStats;
  onSwitchRuntime: (mode: EngineRuntime) => void;
  onToggleDemoSimulation: () => void;
  onAbortMission: () => void;
  onOpenReport: () => void;
  onOpenSettings: () => void;
  onAutoLayout: () => void;
  onResetDemo: () => void;
}

export interface LogInspectorPanelProps {
  bot: BotEntity | null;
  parentBot: BotEntity | null;
  childBots: BotEntity[];
  canSpawnLiveChild: boolean;
  hasMissionReport: boolean;
  onSelectBot: (botId: string | null) => void;
  onSpawnChild: (parentId: string, role?: BotRole, task?: string) => void;
  onOpenReport: () => void;
}
