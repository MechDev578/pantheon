export type BotStatus = 'running' | 'waiting' | 'idle' | 'done' | 'error';

export type LogLevel =
  | 'info'
  | 'warn'
  | 'success'
  | 'debug'
  | 'tool'
  | 'thought'
  | 'error';

export type BotRole =
  | 'Orchestrator'
  | 'Planner'
  | 'Researcher'
  | 'Scraper'
  | 'Architect'
  | 'Coder'
  | 'Reviewer'
  | 'Tester'
  | 'Synthesizer';

export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export type ContextMode = 'ask' | 'auto';

export type ResearchDepth = 'quick' | 'deep' | 'abyssal';

export type EngineRuntime = 'local' | 'cloud' | 'demo';

export type SearchProvider = 'auto' | 'duckduckgo' | 'brave' | 'tavily';

export interface BotLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  level: LogLevel;
  message: string;
  detail?: string;
}

export interface ScrapedSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  scrapedAt: string;
  wordCount: number;
  excerpt: string;
  linksFound: number;
  depth: number;
  status: 'ok' | 'error';
  error?: string;
}

export interface BotEntity {
  id: string;
  name: string;
  epithet?: string;
  role: BotRole;
  status: BotStatus;
  currentTask: string;
  activeTool?: string | null;
  parentId: string | null;
  childIds: string[];
  depth: number;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  logs: BotLogEntry[];
  sources: ScrapedSource[];
  output?: string;
  assumptions?: string[];
  modelUsed?: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  reason: string;
  suggestedOptions?: string[];
  required?: boolean;
}

export type MissionStatus =
  | 'analyzing'
  | 'waiting_for_input'
  | 'running'
  | 'completed'
  | 'failed'
  | 'aborted';

export interface MissionConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  searchProvider?: SearchProvider;
  searchApiKey?: string;
  contextMode: ContextMode;
  depth: ResearchDepth;
  maxBots?: number;
  maxDepth?: number;
}

export interface MissionState {
  id: string;
  goal: string;
  title: string;
  status: MissionStatus;
  contextMode: ContextMode;
  depth: ResearchDepth;
  provider: AIProvider;
  model: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  rootId: string;
  bots: Record<string, BotEntity>;
  questions: ClarifyingQuestion[];
  answers: Record<string, string>;
  assumptions: string[];
  contextSummary?: string;
  finalReport?: string;
  error?: string;
}

export interface MissionSummary {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  contextMode: ContextMode;
  depth: ResearchDepth;
  provider: AIProvider;
  model: string;
  botCount: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export type MissionStreamEvent =
  | { type: 'snapshot'; mission: MissionState }
  | { type: 'mission_updated'; mission: MissionState }
  | { type: 'bot_updated'; missionId: string; bot: BotEntity }
  | {
      type: 'questions';
      missionId: string;
      questions: ClarifyingQuestion[];
      contextSummary?: string;
    }
  | { type: 'done'; mission: MissionState }
  | { type: 'error'; missionId?: string; message: string };

export interface ServerCapabilities {
  runtime: 'local' | 'cloud';
  version: string;
  configuredProviders: Record<AIProvider, boolean>;
  configuredSearch: {
    brave: boolean;
    tavily: boolean;
  };
  defaultModels: Record<AIProvider, string>;
}
