import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MODELS } from '../../engine/pantheonRoster';
import {
  advanceSimulationTick,
  createInitialSimulationState,
  createManualChildBot,
} from '../engine/mockOrchestrator';
import type {
  BotEntity,
  BotRole,
  BotSimulationState,
  ContextMode,
  EngineRuntime,
  MissionState,
  MissionStreamEvent,
  MissionSummary,
  PantheonSettings,
  ResearchDepth,
  ServerCapabilities,
  SimulationStats,
} from '../types/bot';

const SETTINGS_STORAGE_KEY = 'pantheon.v2.settings';
const CLOUD_MISSIONS_STORAGE_KEY = 'pantheon.v2.cloudMissions';
const DEMO_TICK_MS = 1400;

const DEFAULT_SETTINGS: PantheonSettings = {
  provider: 'gemini',
  model: DEFAULT_MODELS.gemini,
  apiKeys: {
    gemini: '',
    openai: '',
    anthropic: '',
  },
  searchProvider: 'auto',
  searchApiKey: '',
  defaultContextMode: 'ask',
  defaultDepth: 'deep',
};

const DEPRECATED_GEMINI_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.0-flash']);

function loadSettings(): PantheonSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PantheonSettings>;
    const merged: PantheonSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiKeys: {
        ...DEFAULT_SETTINGS.apiKeys,
        ...(parsed.apiKeys ?? {}),
      },
    };
    if (merged.provider === 'gemini' && DEPRECATED_GEMINI_MODELS.has(merged.model)) {
      merged.model = DEFAULT_MODELS.gemini;
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadCloudMissions(): MissionState[] {
  try {
    const raw = localStorage.getItem(CLOUD_MISSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MissionState[];
  } catch {
    return [];
  }
}

function saveCloudMissions(list: MissionState[]): void {
  try {
    localStorage.setItem(CLOUD_MISSIONS_STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // ignore storage quota issues
  }
}

function summarizeLocalMission(m: MissionState): MissionSummary {
  const bots = Object.values(m.bots);
  return {
    id: m.id,
    title: m.title,
    goal: m.goal,
    status: m.status,
    contextMode: m.contextMode,
    depth: m.depth,
    provider: m.provider,
    model: m.model,
    botCount: bots.length,
    sourceCount: bots.reduce((acc, b) => acc + b.sources.length, 0),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function usePantheon() {
  const [settings, setSettingsState] = useState<PantheonSettings>(loadSettings);
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<EngineRuntime>('demo');

  // Demo simulation state (v1 upgraded with Greek mythology bots)
  const [demoState, setDemoState] = useState<BotSimulationState>(() =>
    createInitialSimulationState(),
  );

  // Live mission state (Local Engine or Netlify Cloud)
  const [activeMission, setActiveMission] = useState<MissionState | null>(null);
  const [missionHistory, setMissionHistory] = useState<MissionSummary[]>([]);
  const [cloudMissionCache, setCloudMissionCache] = useState<MissionState[]>(loadCloudMissions);

  const [selectedBotId, setSelectedBotId] = useState<string | null>('bot-zeus');
  const [layoutVersion, setLayoutVersion] = useState<number>(0);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const cloudAbortRef = useRef<AbortController | null>(null);

  const updateSettings = useCallback((updater: (prev: PantheonSettings) => PantheonSettings) => {
    setSettingsState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
  }, []);

  const refreshLocalHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/missions');
      if (!res.ok) return;
      const data = (await res.json()) as { missions?: MissionSummary[] };
      if (Array.isArray(data.missions)) {
        setMissionHistory(data.missions);
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-detect Local Engine (:8787 proxy) or Netlify Cloud Function (/api/cloud/health)
  useEffect(() => {
    let cancelled = false;

    async function probeBackend() {
      // 1. Check local Node engine first
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const caps = (await res.json()) as ServerCapabilities;
          if (!cancelled && caps.runtime === 'local') {
            setCapabilities(caps);
            setRuntimeMode('local');
            await refreshLocalHistory();
            return;
          }
        }
      } catch {
        // local engine not running
      }

      // 2. Check Netlify Cloud function
      try {
        const res = await fetch('/api/cloud/health', { cache: 'no-store' });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const caps = (await res.json()) as ServerCapabilities;
          if (!cancelled && caps.runtime === 'cloud') {
            setCapabilities(caps);
            setRuntimeMode('cloud');
            setMissionHistory(loadCloudMissions().map(summarizeLocalMission));
            return;
          }
        }
      } catch {
        // cloud function unavailable (e.g. standalone offline desktop app)
      }

      if (!cancelled) {
        setCapabilities(null);
        setRuntimeMode('demo');
      }
    }

    void probeBackend();
    return () => {
      cancelled = true;
    };
  }, [refreshLocalHistory]);

  // Demo mode simulation tick loop
  useEffect(() => {
    if (runtimeMode !== 'demo' || !demoState.isSimulating) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setDemoState((prev) => (prev.isSimulating ? advanceSimulationTick(prev) : prev));
    }, DEMO_TICK_MS);
    return () => window.clearInterval(id);
  }, [runtimeMode, demoState.isSimulating]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      cloudAbortRef.current?.abort();
    };
  }, []);

  const persistCloudMission = useCallback((mission: MissionState) => {
    setCloudMissionCache((prev) => {
      const next = [mission, ...prev.filter((m) => m.id !== mission.id)].slice(0, 20);
      saveCloudMissions(next);
      setMissionHistory(next.map(summarizeLocalMission));
      return next;
    });
  }, []);

  const applyStreamEvent = useCallback(
    (ev: MissionStreamEvent, isCloud: boolean) => {
      if (ev.type === 'snapshot' || ev.type === 'mission_updated' || ev.type === 'done') {
        setActiveMission(ev.mission);
        if (isCloud) {
          persistCloudMission(ev.mission);
        } else if (ev.type === 'done' || ev.type === 'mission_updated') {
          void refreshLocalHistory();
        }
        if (ev.type === 'done') {
          setIsDeploying(false);
        }
      } else if (ev.type === 'bot_updated') {
        setActiveMission((prev) => {
          if (!prev || prev.id !== ev.missionId) return prev;
          const updated: MissionState = {
            ...prev,
            updatedAt: ev.bot.updatedAt,
            bots: {
              ...prev.bots,
              [ev.bot.id]: ev.bot,
            },
          };
          if (isCloud) {
            persistCloudMission(updated);
          }
          return updated;
        });
      } else if (ev.type === 'questions') {
        setIsDeploying(false);
      } else if (ev.type === 'error') {
        setBannerError(ev.message);
        setIsDeploying(false);
      }
    },
    [persistCloudMission, refreshLocalHistory],
  );

  const connectLocalStream = useCallback(
    (missionId: string) => {
      eventSourceRef.current?.close();
      const es = new EventSource(`/api/missions/${encodeURIComponent(missionId)}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as MissionStreamEvent;
          applyStreamEvent(ev, false);
        } catch {
          // ignore malformed event
        }
      };

      es.onerror = () => {
        // EventSource auto-reconnects; ignore transient drops
      };
    },
    [applyStreamEvent],
  );

  const streamCloudExecution = useCallback(
    async (
      mission: MissionState,
      answers?: Record<string, string>,
      skipAndAssume?: boolean,
    ) => {
      cloudAbortRef.current?.abort();
      const ctrl = new AbortController();
      cloudAbortRef.current = ctrl;
      setIsDeploying(true);
      setBannerError(null);

      try {
        const res = await fetch('/api/cloud/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            mission,
            apiKey: settings.apiKeys[settings.provider] || undefined,
            searchProvider: settings.searchProvider,
            searchApiKey: settings.searchApiKey || undefined,
            answers,
            skipAndAssume,
          }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || `Cloud execution failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('Streaming response body unavailable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const line = frame
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (!line) continue;
            const jsonText = line.slice(5).trim();
            if (!jsonText) continue;
            try {
              const ev = JSON.parse(jsonText) as MissionStreamEvent;
              applyStreamEvent(ev, true);
            } catch {
              // ignore partial frame
            }
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setBannerError(err instanceof Error ? err.message : 'Cloud mission failed');
        }
      } finally {
        setIsDeploying(false);
      }
    },
    [settings, applyStreamEvent],
  );

  const hasKeyReady = useMemo(() => {
    const userKey = settings.apiKeys[settings.provider]?.trim();
    const serverKey = capabilities?.configuredProviders[settings.provider];
    return Boolean(userKey || serverKey);
  }, [settings.apiKeys, settings.provider, capabilities]);

  const deployMission = useCallback(
    async (
      goal: string,
      opts: { contextMode: ContextMode; depth: ResearchDepth },
    ): Promise<boolean> => {
      const cleanGoal = goal.trim();
      if (!cleanGoal) return false;

      if (!capabilities) {
        setBannerError(
          'No live backend detected. Start locally with `npm run dev` or open the Netlify deployment to run real AI bots.',
        );
        return false;
      }

      setBannerError(null);
      setIsDeploying(true);
      const targetRuntime = capabilities.runtime;
      setRuntimeMode(targetRuntime);

      const userKey = settings.apiKeys[settings.provider]?.trim() || undefined;

      try {
        if (targetRuntime === 'local') {
          const res = await fetch('/api/missions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal: cleanGoal,
              provider: settings.provider,
              model: settings.model,
              apiKey: userKey,
              searchProvider: settings.searchProvider,
              searchApiKey: settings.searchApiKey || undefined,
              contextMode: opts.contextMode,
              depth: opts.depth,
            }),
          });

          const data = (await res.json()) as { mission?: MissionState; error?: string };
          if (!res.ok || !data.mission) {
            throw new Error(data.error || `Failed to deploy mission (${res.status})`);
          }

          setActiveMission(data.mission);
          setSelectedBotId(data.mission.rootId);
          setLayoutVersion((v) => v + 1);
          connectLocalStream(data.mission.id);
          await refreshLocalHistory();
          return true;
        }

        // Netlify Cloud Mode: Step 1 fast analyze -> Step 2 SSE stream
        const analyzeRes = await fetch('/api/cloud/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: cleanGoal,
            provider: settings.provider,
            model: settings.model,
            apiKey: userKey,
            contextMode: opts.contextMode,
            depth: opts.depth,
          }),
        });

        const analyzeData = (await analyzeRes.json()) as {
          mission?: MissionState;
          pausedForQuestions?: boolean;
          error?: string;
        };

        if (!analyzeRes.ok || !analyzeData.mission) {
          throw new Error(analyzeData.error || `Context analysis failed (${analyzeRes.status})`);
        }

        setActiveMission(analyzeData.mission);
        setSelectedBotId(analyzeData.mission.rootId);
        setLayoutVersion((v) => v + 1);
        persistCloudMission(analyzeData.mission);

        if (analyzeData.pausedForQuestions) {
          setIsDeploying(false);
          return true;
        }

        void streamCloudExecution(analyzeData.mission);
        return true;
      } catch (err) {
        setBannerError(err instanceof Error ? err.message : 'Mission deployment failed');
        setIsDeploying(false);
        return false;
      }
    },
    [
      capabilities,
      settings,
      connectLocalStream,
      refreshLocalHistory,
      persistCloudMission,
      streamCloudExecution,
    ],
  );

  const submitClarifications = useCallback(
    async (answers: Record<string, string>, skipAndAssume = false) => {
      if (!activeMission) return;
      setBannerError(null);
      setIsDeploying(true);

      const userKey = settings.apiKeys[settings.provider]?.trim() || undefined;

      if (runtimeMode === 'local') {
        try {
          const res = await fetch(
            `/api/missions/${encodeURIComponent(activeMission.id)}/answer`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                answers,
                skipAndAssume,
                apiKey: userKey,
                searchApiKey: settings.searchApiKey || undefined,
              }),
            },
          );
          const data = (await res.json()) as { mission?: MissionState; error?: string };
          if (!res.ok || !data.mission) {
            throw new Error(data.error || 'Failed to submit clarifications');
          }
          setActiveMission(data.mission);
          connectLocalStream(data.mission.id);
        } catch (err) {
          setBannerError(err instanceof Error ? err.message : 'Failed to resume mission');
          setIsDeploying(false);
        }
        return;
      }

      if (runtimeMode === 'cloud') {
        const updatedMission: MissionState = {
          ...activeMission,
          answers: skipAndAssume ? activeMission.answers : answers,
          contextMode: skipAndAssume ? 'auto' : activeMission.contextMode,
          status: 'running',
        };
        setActiveMission(updatedMission);
        void streamCloudExecution(updatedMission, answers, skipAndAssume);
      }
    },
    [activeMission, runtimeMode, settings, connectLocalStream, streamCloudExecution],
  );

  const abortMission = useCallback(async () => {
    if (!activeMission) return;
    if (runtimeMode === 'local') {
      try {
        const res = await fetch(
          `/api/missions/${encodeURIComponent(activeMission.id)}/abort`,
          { method: 'POST' },
        );
        if (res.ok) {
          const data = (await res.json()) as { mission: MissionState };
          setActiveMission(data.mission);
        }
      } catch {
        // ignore
      }
    } else if (runtimeMode === 'cloud') {
      cloudAbortRef.current?.abort();
      setActiveMission((prev) => (prev ? { ...prev, status: 'aborted' } : null));
    }
    setIsDeploying(false);
  }, [activeMission, runtimeMode]);

  const selectMission = useCallback(
    async (missionId: string) => {
      setBannerError(null);
      if (capabilities?.runtime === 'local') {
        setRuntimeMode('local');
        try {
          const res = await fetch(`/api/missions/${encodeURIComponent(missionId)}`);
          if (!res.ok) return;
          const data = (await res.json()) as { mission: MissionState };
          setActiveMission(data.mission);
          setSelectedBotId(data.mission.rootId);
          setLayoutVersion((v) => v + 1);
          if (
            data.mission.status === 'running' ||
            data.mission.status === 'analyzing' ||
            data.mission.status === 'waiting_for_input'
          ) {
            connectLocalStream(data.mission.id);
          } else {
            eventSourceRef.current?.close();
          }
        } catch {
          // ignore
        }
        return;
      }

      const found = cloudMissionCache.find((m) => m.id === missionId);
      if (found) {
        setRuntimeMode('cloud');
        setActiveMission(found);
        setSelectedBotId(found.rootId);
        setLayoutVersion((v) => v + 1);
      }
    },
    [capabilities, cloudMissionCache, connectLocalStream],
  );

  const deleteMission = useCallback(
    async (missionId: string) => {
      if (activeMission?.id === missionId) {
        eventSourceRef.current?.close();
        setActiveMission(null);
      }
      if (capabilities?.runtime === 'local') {
        await fetch(`/api/missions/${encodeURIComponent(missionId)}`, {
          method: 'DELETE',
        }).catch(() => {});
        await refreshLocalHistory();
      } else {
        setCloudMissionCache((prev) => {
          const next = prev.filter((m) => m.id !== missionId);
          saveCloudMissions(next);
          setMissionHistory(next.map(summarizeLocalMission));
          return next;
        });
      }
    },
    [activeMission, capabilities, refreshLocalHistory],
  );

  const spawnChildBot = useCallback(
    async (parentId: string, role?: BotRole, task?: string) => {
      if (runtimeMode === 'demo' || !activeMission) {
        setDemoState((prev) => createManualChildBot(prev, parentId, role, task));
        return;
      }

      if (runtimeMode === 'local') {
        setBannerError(null);
        try {
          const res = await fetch(
            `/api/missions/${encodeURIComponent(activeMission.id)}/spawn`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parentId,
                role: role ?? 'Scraper',
                task,
                apiKey: settings.apiKeys[settings.provider]?.trim() || undefined,
                searchApiKey: settings.searchApiKey || undefined,
              }),
            },
          );
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            throw new Error(data.error || 'Failed to spawn follow-up Olympian');
          }
          connectLocalStream(activeMission.id);
        } catch (err) {
          setBannerError(err instanceof Error ? err.message : 'Spawn failed');
        }
      }
    },
    [runtimeMode, activeMission, settings, connectLocalStream],
  );

  const switchRuntime = useCallback(
    (mode: EngineRuntime) => {
      setBannerError(null);
      setRuntimeMode(mode);
      setLayoutVersion((v) => v + 1);
      if (mode === 'demo') {
        setSelectedBotId(demoState.rootId);
      } else if (activeMission) {
        setSelectedBotId(activeMission.rootId);
      }
    },
    [demoState.rootId, activeMission],
  );

  const toggleDemoSimulation = useCallback(() => {
    setDemoState((prev) => ({ ...prev, isSimulating: !prev.isSimulating }));
  }, []);

  const resetDemo = useCallback(() => {
    setDemoState((prev) => ({
      ...createInitialSimulationState(),
      layoutVersion: prev.layoutVersion + 1,
    }));
    setLayoutVersion((v) => v + 1);
    setSelectedBotId('bot-zeus');
  }, []);

  const triggerAutoLayout = useCallback(() => {
    setLayoutVersion((v) => v + 1);
  }, []);

  // Derive active graph data (Live Mission if selected & not in Demo Mode, else Demo Graph)
  const showingLiveMission = runtimeMode !== 'demo' && activeMission !== null;
  const bots: Record<string, BotEntity> = showingLiveMission
    ? activeMission.bots
    : demoState.bots;
  const rootId = showingLiveMission ? activeMission.rootId : demoState.rootId;

  const selectedBot = useMemo<BotEntity | null>(() => {
    if (!selectedBotId) return null;
    return bots[selectedBotId] ?? null;
  }, [bots, selectedBotId]);

  const stats = useMemo<SimulationStats>(() => {
    const list = Object.values(bots);
    let running = 0;
    let waiting = 0;
    let idle = 0;
    let done = 0;
    let error = 0;
    let sourcesScraped = 0;

    for (const b of list) {
      if (b.status === 'running') running += 1;
      else if (b.status === 'waiting') waiting += 1;
      else if (b.status === 'idle') idle += 1;
      else if (b.status === 'done') done += 1;
      else if (b.status === 'error') error += 1;
      sourcesScraped += b.sources.length;
    }

    return {
      total: list.length,
      running,
      waiting,
      idle,
      done,
      error,
      sourcesScraped,
    };
  }, [bots]);

  const isMissionActive = Boolean(
    showingLiveMission &&
      (activeMission.status === 'running' || activeMission.status === 'analyzing'),
  );

  return {
    settings,
    updateSettings,
    capabilities,
    runtimeMode,
    switchRuntime,
    showingLiveMission,
    activeMission,
    missionHistory,
    bots,
    rootId,
    selectedBotId,
    selectedBot,
    selectBot: setSelectedBotId,
    stats,
    layoutVersion,
    triggerAutoLayout,
    bannerError,
    clearBannerError: () => setBannerError(null),
    isDeploying,
    isMissionActive,
    hasKeyReady,
    isDemoSimulating: demoState.isSimulating,
    toggleDemoSimulation,
    resetDemo,
    deployMission,
    submitClarifications,
    abortMission,
    selectMission,
    deleteMission,
    spawnChildBot,
  };
}
