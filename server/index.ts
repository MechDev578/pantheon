import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeMissionContext,
  createMission,
  runMissionExecution,
  spawnFollowUpBotOnMission,
} from '../engine/missionOrchestrator.ts';
import { appendBotLog, cloneMissionSnapshot } from '../engine/agentRunner.ts';
import { DEFAULT_MODELS } from '../engine/pantheonRoster.ts';
import type {
  AIProvider,
  BotRole,
  MissionConfig,
  MissionState,
  MissionStreamEvent,
  MissionSummary,
  ResearchDepth,
  ServerCapabilities,
} from '../engine/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, '.pantheon-data');
const MISSIONS_FILE = path.join(DATA_DIR, 'missions.json');

/* -------------------------------------------------------------------------- */
/* Zero-dependency .env loader                                                */
/* -------------------------------------------------------------------------- */

function loadDotEnv(): void {
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env) && val) {
        process.env[key] = val;
      }
    }
  }
}

loadDotEnv();

const PORT = Number(process.env.PANTHEON_PORT ?? 8787);

/* -------------------------------------------------------------------------- */
/* In-Memory Store + JSON Persistence (API keys are NEVER written to disk)    */
/* -------------------------------------------------------------------------- */

const missions = new Map<string, MissionState>();
const missionConfigs = new Map<string, MissionConfig>(); // held in memory only for answer resume
const activeAborts = new Map<string, AbortController>();
const sseClients = new Map<string, Set<http.ServerResponse>>();

function loadPersistedMissions(): void {
  try {
    if (!fs.existsSync(MISSIONS_FILE)) return;
    const raw = fs.readFileSync(MISSIONS_FILE, 'utf-8');
    const list = JSON.parse(raw) as MissionState[];
    for (const m of list) {
      if (m && m.id) {
        // Any mission left running from a previous server crash is marked aborted
        if (m.status === 'running' || m.status === 'analyzing') {
          m.status = 'aborted';
          for (const b of Object.values(m.bots)) {
            if (b.status === 'running') b.status = 'idle';
          }
        }
        missions.set(m.id, m);
      }
    }
  } catch (err) {
    console.warn('[Pantheon] Failed to load persisted missions:', err);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const list = Array.from(missions.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40);
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Pantheon] Failed to persist missions:', err);
    }
  }, 500);
}

loadPersistedMissions();

function resolveProviderKey(provider: AIProvider, suppliedKey?: string): string {
  if (suppliedKey?.trim()) return suppliedKey.trim();
  if (provider === 'gemini') return process.env.GEMINI_API_KEY?.trim() ?? '';
  if (provider === 'openai') return process.env.OPENAI_API_KEY?.trim() ?? '';
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  return '';
}

function resolveSearchKey(suppliedKey?: string): string | undefined {
  if (suppliedKey?.trim()) return suppliedKey.trim();
  return (
    process.env.TAVILY_API_KEY?.trim() ||
    process.env.BRAVE_SEARCH_API_KEY?.trim() ||
    undefined
  );
}

function broadcastEvent(missionId: string, event: MissionStreamEvent): void {
  schedulePersist();
  const clients = sseClients.get(missionId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

function summarizeMission(m: MissionState): MissionSummary {
  const botValues = Object.values(m.bots);
  const sourceCount = botValues.reduce((acc, b) => acc + b.sources.length, 0);
  return {
    id: m.id,
    title: m.title,
    goal: m.goal,
    status: m.status,
    contextMode: m.contextMode,
    depth: m.depth,
    provider: m.provider,
    model: m.model,
    botCount: botValues.length,
    sourceCount,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 2_000_000) {
      throw new Error('Request payload too large');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  return (raw ? JSON.parse(raw) : {}) as T;
}

/* -------------------------------------------------------------------------- */
/* HTTP Router                                                                */
/* -------------------------------------------------------------------------- */

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  try {
    // 1. Health & capabilities
    if (method === 'GET' && pathname === '/api/health') {
      const caps: ServerCapabilities = {
        runtime: 'local',
        version: '2.2.1',
        configuredProviders: {
          gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
          openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
        },
        configuredSearch: {
          brave: Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim()),
          tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
        },
        defaultModels: DEFAULT_MODELS,
      };
      return sendJson(res, 200, caps);
    }

    // 2. List all saved & active missions
    if (method === 'GET' && pathname === '/api/missions') {
      const list = Array.from(missions.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(summarizeMission);
      return sendJson(res, 200, { missions: list });
    }

    // 3. Create & start a new mission
    if (method === 'POST' && pathname === '/api/missions') {
      const body = await readJsonBody<{
        goal?: string;
        provider?: AIProvider;
        model?: string;
        apiKey?: string;
        searchProvider?: MissionConfig['searchProvider'];
        searchApiKey?: string;
        contextMode?: MissionConfig['contextMode'];
        depth?: ResearchDepth;
        maxBots?: number;
        maxDepth?: number;
      }>(req);

      const goal = body.goal?.trim();
      if (!goal) {
        return sendJson(res, 400, { error: 'Mission goal is required.' });
      }

      const provider: AIProvider = body.provider ?? 'gemini';
      const model = body.model?.trim() || DEFAULT_MODELS[provider];
      const apiKey = resolveProviderKey(provider, body.apiKey);

      if (!apiKey) {
        return sendJson(res, 400, {
          error: `No API key configured for ${provider}. Add it in Settings or set it in your .env file.`,
        });
      }

      const config: MissionConfig = {
        provider,
        model,
        apiKey,
        searchProvider: body.searchProvider ?? 'auto',
        searchApiKey: resolveSearchKey(body.searchApiKey),
        contextMode: body.contextMode ?? 'ask',
        depth: body.depth ?? 'deep',
        maxBots: body.maxBots,
        maxDepth: body.maxDepth,
      };

      const mission = createMission(goal, config);
      missions.set(mission.id, mission);
      missionConfigs.set(mission.id, config);
      schedulePersist();

      const abortController = new AbortController();
      activeAborts.set(mission.id, abortController);

      // Run analysis + optional auto-execution asynchronously so client can connect to SSE stream immediately
      void (async () => {
        const emit = (ev: MissionStreamEvent) => broadcastEvent(mission.id, ev);
        try {
          const analysis = await analyzeMissionContext(
            mission,
            config,
            apiKey,
            emit,
            abortController.signal,
          );
          if (!analysis.pausedForQuestions && !abortController.signal.aborted) {
            await runMissionExecution(mission, config, apiKey, emit, {
              signal: abortController.signal,
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Mission failed';
          mission.status = abortController.signal.aborted ? 'aborted' : 'failed';
          mission.error = message;
          const zeus = mission.bots[mission.rootId];
          if (zeus) {
            zeus.status = abortController.signal.aborted ? 'idle' : 'error';
            zeus.activeTool = null;
            appendBotLog(zeus, 'error', message);
          }
          emit({ type: 'error', missionId: mission.id, message });
          emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });
        } finally {
          if (mission.status !== 'waiting_for_input') {
            activeAborts.delete(mission.id);
          }
        }
      })();

      return sendJson(res, 201, { mission: cloneMissionSnapshot(mission) });
    }

    // Mission-specific routes: /api/missions/:id(/action)
    const missionMatch = pathname.match(/^\/api\/missions\/([^/]+)(?:\/([^/]+))?$/);
    if (missionMatch) {
      const missionId = decodeURIComponent(missionMatch[1]);
      const action = missionMatch[2];
      const mission = missions.get(missionId);

      if (!mission) {
        return sendJson(res, 404, { error: 'Mission not found' });
      }

      // GET /api/missions/:id
      if (method === 'GET' && !action) {
        return sendJson(res, 200, { mission: cloneMissionSnapshot(mission) });
      }

      // DELETE /api/missions/:id
      if (method === 'DELETE' && !action) {
        activeAborts.get(missionId)?.abort();
        activeAborts.delete(missionId);
        missions.delete(missionId);
        missionConfigs.delete(missionId);
        schedulePersist();
        return sendJson(res, 200, { ok: true });
      }

      // GET /api/missions/:id/stream (SSE)
      if (method === 'GET' && action === 'stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });

        let clientSet = sseClients.get(missionId);
        if (!clientSet) {
          clientSet = new Set();
          sseClients.set(missionId, clientSet);
        }
        clientSet.add(res);

        // Immediately send full current snapshot
        const snapEvent: MissionStreamEvent = {
          type: 'snapshot',
          mission: cloneMissionSnapshot(mission),
        };
        res.write(`data: ${JSON.stringify(snapEvent)}\n\n`);

        const pingTimer = setInterval(() => {
          try {
            res.write(': ping\n\n');
          } catch {
            clearInterval(pingTimer);
          }
        }, 15_000);

        req.on('close', () => {
          clearInterval(pingTimer);
          clientSet?.delete(res);
          if (clientSet && clientSet.size === 0) {
            sseClients.delete(missionId);
          }
        });
        return;
      }

      // POST /api/missions/:id/answer
      if (method === 'POST' && action === 'answer') {
        const body = await readJsonBody<{
          answers?: Record<string, string>;
          skipAndAssume?: boolean;
          apiKey?: string;
          searchApiKey?: string;
        }>(req);

        const storedConfig = missionConfigs.get(missionId);
        const provider = storedConfig?.provider ?? mission.provider;
        const apiKey = resolveProviderKey(
          provider,
          body.apiKey ?? storedConfig?.apiKey,
        );

        if (!apiKey) {
          return sendJson(res, 400, {
            error: `Missing API key for ${provider} to resume mission.`,
          });
        }

        const config: MissionConfig = storedConfig
          ? {
              ...storedConfig,
              apiKey,
              searchApiKey: resolveSearchKey(body.searchApiKey ?? storedConfig.searchApiKey),
            }
          : {
              provider,
              model: mission.model,
              apiKey,
              searchApiKey: resolveSearchKey(body.searchApiKey),
              contextMode: body.skipAndAssume ? 'auto' : mission.contextMode,
              depth: mission.depth,
            };

        const zeus = mission.bots[mission.rootId];
        if (body.skipAndAssume) {
          mission.contextMode = 'auto';
          appendBotLog(
            zeus,
            'warn',
            'Operator chose to skip questions — switching to Auto-Assume mode.',
          );
        } else {
          mission.answers = { ...(body.answers ?? {}) };
          appendBotLog(
            zeus,
            'success',
            `Received operator clarifications (${Object.keys(mission.answers).length} answered). Deploying Pantheon!`,
          );
        }

        const abortController = new AbortController();
        activeAborts.set(missionId, abortController);
        mission.status = 'running';
        zeus.status = 'running';
        zeus.activeTool = 'Deploying Olympians...';
        schedulePersist();

        void (async () => {
          const emit = (ev: MissionStreamEvent) => broadcastEvent(mission.id, ev);
          try {
            await runMissionExecution(mission, config, apiKey, emit, {
              signal: abortController.signal,
            });
          } finally {
            activeAborts.delete(missionId);
          }
        })();

        return sendJson(res, 200, { mission: cloneMissionSnapshot(mission) });
      }

      // POST /api/missions/:id/abort
      if (method === 'POST' && action === 'abort') {
        const ctrl = activeAborts.get(missionId);
        if (ctrl) {
          ctrl.abort();
          activeAborts.delete(missionId);
        }
        mission.status = 'aborted';
        mission.updatedAt = new Date().toISOString();
        for (const b of Object.values(mission.bots)) {
          if (b.status === 'running' || b.status === 'waiting') {
            b.status = 'idle';
            b.activeTool = null;
          }
        }
        broadcastEvent(missionId, {
          type: 'mission_updated',
          mission: cloneMissionSnapshot(mission),
        });
        return sendJson(res, 200, { mission: cloneMissionSnapshot(mission) });
      }

      // POST /api/missions/:id/spawn (deploy an extra live Olympian under any bot!)
      if (method === 'POST' && action === 'spawn') {
        const body = await readJsonBody<{
          parentId?: string;
          role?: BotRole;
          task?: string;
          apiKey?: string;
          searchApiKey?: string;
        }>(req);

        const storedConfig = missionConfigs.get(missionId);
        const provider = storedConfig?.provider ?? mission.provider;
        const apiKey = resolveProviderKey(
          provider,
          body.apiKey ?? storedConfig?.apiKey,
        );
        if (!apiKey) {
          return sendJson(res, 400, {
            error: `Missing API key for ${provider} to deploy a follow-up bot.`,
          });
        }

        const config: MissionConfig = storedConfig ?? {
          provider,
          model: mission.model,
          apiKey,
          searchApiKey: resolveSearchKey(body.searchApiKey),
          contextMode: mission.contextMode,
          depth: mission.depth,
        };

        const parentId = body.parentId || mission.rootId;
        const role: BotRole = body.role || 'Scraper';
        const task =
          body.task?.trim() ||
          `Perform deeper follow-up research and website scraping to expand on ${mission.title}`;

        const abortController = activeAborts.get(missionId) ?? new AbortController();
        activeAborts.set(missionId, abortController);

        void spawnFollowUpBotOnMission(
          mission,
          parentId,
          role,
          task,
          config,
          apiKey,
          (ev) => broadcastEvent(mission.id, ev),
          abortController.signal,
        ).catch((err) => {
          broadcastEvent(mission.id, {
            type: 'error',
            missionId: mission.id,
            message: err instanceof Error ? err.message : 'Follow-up bot failed',
          });
        });

        return sendJson(res, 202, { ok: true, mission: cloneMissionSnapshot(mission) });
      }
    }

    return sendJson(res, 404, { error: `Unknown endpoint: ${method} ${pathname}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n⚡ Pantheon v2 Local Engine online at http://127.0.0.1:${PORT}`);
  console.log(
    `   Env keys detected — Gemini: ${Boolean(process.env.GEMINI_API_KEY)} | OpenAI: ${Boolean(
      process.env.OPENAI_API_KEY,
    )} | Anthropic: ${Boolean(process.env.ANTHROPIC_API_KEY)}\n`,
  );
});
