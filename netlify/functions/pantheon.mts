import type { Config, Context } from '@netlify/functions';
import {
  analyzeMissionContext,
  createMission,
  runMissionExecution,
} from '../../engine/missionOrchestrator.ts';
import { cloneMissionSnapshot } from '../../engine/agentRunner.ts';
import { DEFAULT_MODELS } from '../../engine/pantheonRoster.ts';
import type {
  AIProvider,
  MissionConfig,
  MissionState,
  MissionStreamEvent,
  ResearchDepth,
  ServerCapabilities,
} from '../../engine/types.ts';

function getEnv(name: string): string {
  try {
    return Netlify.env.get(name)?.trim() ?? '';
  } catch {
    return process.env[name]?.trim() ?? '';
  }
}

function resolveKey(provider: AIProvider, suppliedKey?: string): string {
  if (suppliedKey?.trim()) return suppliedKey.trim();
  if (provider === 'gemini') return getEnv('GEMINI_API_KEY');
  if (provider === 'openai') return getEnv('OPENAI_API_KEY');
  if (provider === 'anthropic') return getEnv('ANTHROPIC_API_KEY');
  return '';
}

function resolveSearchKey(suppliedKey?: string): string | undefined {
  if (suppliedKey?.trim()) return suppliedKey.trim();
  return getEnv('TAVILY_API_KEY') || getEnv('BRAVE_SEARCH_API_KEY') || undefined;
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const subpath = url.pathname.replace(/^\/api\/cloud\/?/, '');

  // GET /api/cloud/health
  if (req.method === 'GET' && (subpath === 'health' || subpath === '')) {
    const caps: ServerCapabilities = {
      runtime: 'cloud',
      version: '2.2.1',
      configuredProviders: {
        gemini: Boolean(getEnv('GEMINI_API_KEY')),
        openai: Boolean(getEnv('OPENAI_API_KEY')),
        anthropic: Boolean(getEnv('ANTHROPIC_API_KEY')),
      },
      configuredSearch: {
        brave: Boolean(getEnv('BRAVE_SEARCH_API_KEY')),
        tavily: Boolean(getEnv('TAVILY_API_KEY')),
      },
      defaultModels: DEFAULT_MODELS,
    };
    return Response.json(caps, {
      headers: { 'cache-control': 'no-store' },
    });
  }

  // POST /api/cloud/analyze — Fast context analysis pass (Ask-First vs Auto-Assume)
  if (req.method === 'POST' && subpath === 'analyze') {
    const body = (await req.json()) as {
      goal?: string;
      provider?: AIProvider;
      model?: string;
      apiKey?: string;
      contextMode?: MissionConfig['contextMode'];
      depth?: ResearchDepth;
    };

    const goal = body.goal?.trim();
    if (!goal) {
      return Response.json({ error: 'Mission goal is required.' }, { status: 400 });
    }

    const provider: AIProvider = body.provider ?? 'gemini';
    const model = body.model?.trim() || DEFAULT_MODELS[provider];
    const apiKey = resolveKey(provider, body.apiKey);

    if (!apiKey) {
      return Response.json(
        {
          error: `No API key available for ${provider}. Enter your API key in Settings to run Pantheon Cloud.`,
        },
        { status: 400 },
      );
    }

    const config: MissionConfig = {
      provider,
      model,
      contextMode: body.contextMode ?? 'ask',
      depth: body.depth ?? 'deep',
    };

    const mission = createMission(goal, config);
    const analysis = await analyzeMissionContext(
      mission,
      config,
      apiKey,
      () => {},
      req.signal,
    );

    return Response.json(
      {
        mission: cloneMissionSnapshot(mission),
        pausedForQuestions: analysis.pausedForQuestions,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  // POST /api/cloud/execute — Streams live multi-agent orchestration via SSE (up to 60s Netlify streaming)
  if (req.method === 'POST' && subpath === 'execute') {
    const body = (await req.json()) as {
      mission: MissionState;
      apiKey?: string;
      searchProvider?: MissionConfig['searchProvider'];
      searchApiKey?: string;
      answers?: Record<string, string>;
      skipAndAssume?: boolean;
    };

    if (!body.mission?.goal) {
      return Response.json({ error: 'Valid mission payload required.' }, { status: 400 });
    }

    const mission = cloneMissionSnapshot(body.mission);
    const provider = mission.provider;
    const apiKey = resolveKey(provider, body.apiKey);

    if (!apiKey) {
      return Response.json(
        {
          error: `No API key available for ${provider}. Enter your API key in Settings.`,
        },
        { status: 400 },
      );
    }

    if (body.answers) {
      mission.answers = { ...mission.answers, ...body.answers };
    }
    if (body.skipAndAssume) {
      mission.contextMode = 'auto';
    }

    const config: MissionConfig = {
      provider,
      model: mission.model || DEFAULT_MODELS[provider],
      searchProvider: body.searchProvider ?? 'auto',
      searchApiKey: resolveSearchKey(body.searchApiKey),
      contextMode: mission.contextMode,
      depth: mission.depth,
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: MissionStreamEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // stream closed
          }
        };

        try {
          await runMissionExecution(mission, config, apiKey, send, {
            signal: req.signal,
            cloudBudget: true,
          });
        } catch (err) {
          send({
            type: 'error',
            missionId: mission.id,
            message: err instanceof Error ? err.message : 'Cloud execution error',
          });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
      },
    });
  }

  return Response.json({ error: `Unknown cloud endpoint: ${subpath}` }, { status: 404 });
};

export const config: Config = {
  path: '/api/cloud/*',
};
