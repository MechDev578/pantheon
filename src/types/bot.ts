import type { RefObject } from 'react';
import type { Theme } from '../hooks/useTheme';

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
  MissionState,
  MissionSummary,
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
  focusRequest: number;
  onSelectBot: (botId: string | null) => void;
  onAutoLayout: () => void;
}

export interface HeaderToolbarProps {
  runtimeMode: EngineRuntime;
  detectedBackend: 'local' | 'cloud' | null;
  activeMission: MissionState | null;
  isBusy: boolean;
  isDemoSimulating: boolean;
  elapsedLabel: string;
  selectedBotName: string | null;
  isSidebarOpen: boolean;
  theme: Theme;
  hasReport: boolean;
  hasKeyReady: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onSwitchRuntime: (mode: EngineRuntime) => void;
  onToggleDemoSimulation: () => void;
  onSpawnDemoBot: () => void;
  onResetDemo: () => void;
  onToggleLauncher: () => void;
  onOpenClarification: () => void;
  onAbortMission: () => void;
  onOpenReport: () => void;
  onOpenSettings: () => void;
}

export interface AgentSidebarProps {
  bots: Record<string, BotEntity>;
  rootId: string;
  selectedBotId: string | null;
  stats: SimulationStats;
  isOpen: boolean;
  filterInputRef: RefObject<HTMLInputElement>;
  missionHistory: MissionSummary[];
  activeMissionId: string | null;
  onSelectBot: (botId: string) => void;
  onSelectMission: (missionId: string) => void;
  onDeleteMission: (missionId: string) => void;
  onClose: () => void;
}

export interface DetailsDrawerProps {
  bot: BotEntity | null;
  bots: Record<string, BotEntity>;
  rootId: string;
  now: number;
  isActiveRun: boolean;
  runtimeMode: EngineRuntime;
  canSpawnLiveChild: boolean;
  hasMissionReport: boolean;
  onSelectBot: (botId: string | null) => void;
  onSpawnChild: (parentId: string, role?: BotRole, task?: string) => void;
  onCenterOnMap: () => void;
  onOpenReport: () => void;
}
