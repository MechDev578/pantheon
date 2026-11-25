import { callLLM, type LLMMessage, type ToolCallRequest, type ToolDefinition } from './llmClient.ts';
import { pickMythologicalIdentity, PRIMARY_DEITIES } from './pantheonRoster.ts';
import type {
  BotEntity,
  BotLogEntry,
  BotRole,
  LogLevel,
  MissionConfig,
  MissionState,
  MissionStreamEvent,
  ScrapedSource,
} from './types.ts';
import { deepCrawlSite, scrapeUrl, searchWeb } from './webTools.ts';

const MAX_LOGS_PER_BOT = 160;

const SPAWNABLE_ROLES: readonly BotRole[] = [
  'Planner',
  'Researcher',
  'Scraper',
  'Architect',
  'Coder',
  'Reviewer',
  'Tester',
  'Synthesizer',
];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function appendBotLog(
  bot: BotEntity,
  level: LogLevel,
  message: string,
  detail?: string,
): void {
  const nowIso = new Date().toISOString();
  const entry: BotLogEntry = {
    id: makeId('log'),
    timestamp: nowIso,
    level,
    message,
    ...(detail ? { detail } : {}),
  };
  bot.logs = [...bot.logs, entry];
  if (bot.logs.length > MAX_LOGS_PER_BOT) {
    bot.logs = bot.logs.slice(bot.logs.length - MAX_LOGS_PER_BOT);
  }
  bot.updatedAt = nowIso;
}

export function cloneMissionSnapshot(mission: MissionState): MissionState {
  const clonedBots: Record<string, BotEntity> = {};
  for (const [id, b] of Object.entries(mission.bots)) {
    clonedBots[id] = {
      ...b,
      childIds: [...b.childIds],
      logs: [...b.logs],
      sources: [...b.sources],
      assumptions: b.assumptions ? [...b.assumptions] : undefined,
      tokenUsage: b.tokenUsage ? { ...b.tokenUsage } : undefined,
    };
  }
  return {
    ...mission,
    bots: clonedBots,
    questions: [...mission.questions],
    answers: { ...mission.answers },
    assumptions: [...mission.assumptions],
  };
}

export interface AgentRunContext {
  mission: MissionState;
  config: MissionConfig;
  apiKey: string;
  maxBots: number;
  maxDepth: number;
  workerSteps: number;
  maxCrawlPages: number;
  maxCrawlDepth: number;
  emit: (event: MissionStreamEvent) => void;
  signal?: AbortSignal;
}

function buildToolsForBot(bot: BotEntity, ctx: AgentRunContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: 'web_search',
      description:
        'Search the live web for websites, official pages, prices, documentation, reviews, or current facts. Returns titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Focused web search query',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (1-12, default 7)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'scrape_url',
      description:
        'Fetch and deeply parse a specific webpage into clean structured Markdown (headings, tables, lists, prices, details) plus discover sub-page links.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Full http(s) URL to scrape',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'deep_crawl',
      description:
        'Recursively crawl a website starting at start_url, automatically ranking and scraping relevant sub-pages (e.g. pricing, rooms, policies, amenities, docs, FAQ, contact) up to max_pages.',
      parameters: {
        type: 'object',
        properties: {
          start_url: {
            type: 'string',
            description: 'Starting http(s) URL of the website to crawl deeply',
          },
          focus_keywords: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Keywords that guide which sub-links to follow (e.g. ["pricing", "amenities", "cancellation", "rooms"])',
          },
          max_pages: {
            type: 'number',
            description: `Maximum total pages to scrape in this crawl (1-${ctx.maxCrawlPages})`,
          },
          max_depth: {
            type: 'number',
            description: `Link depth to follow from start_url (1-${ctx.maxCrawlDepth})`,
          },
        },
        required: ['start_url', 'focus_keywords'],
      },
    },
    {
      name: 'record_assumption',
      description:
        'Explicitly record an assumption made when context was not specified by the user so it is visible in the mission log.',
      parameters: {
        type: 'object',
        properties: {
          assumption: {
            type: 'string',
            description: 'Clear one-sentence description of the assumption',
          },
        },
        required: ['assumption'],
      },
    },
  ];

  const remainingSlots = ctx.maxBots - Object.keys(ctx.mission.bots).length;
  if (bot.depth < ctx.maxDepth && remainingSlots > 0 && bot.role !== 'Synthesizer') {
    tools.push({
      name: 'spawn_sub_agent',
      description:
        'Spawn a real specialized Greek-mythology child bot under your command to work in parallel on a focused subtask (e.g. Planner/Athena, Researcher/Artemis, Scraper/Hermes, Architect/Daedalus, Coder/Hephaestus, Reviewer/Themis, Tester/Cerberus). Multiple spawn_sub_agent calls in the same turn execute in parallel!',
      parameters: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: SPAWNABLE_ROLES,
            description: 'Specialist role for the spawned Olympian bot',
          },
          task: {
            type: 'string',
            description: 'Clear, specific mission subtask and target URLs/questions for this child bot',
          },
          name: {
            type: 'string',
            description: 'Optional preferred Greek mythology name (e.g. Hermes, Iris, Artemis, Athena, Odysseus)',
          },
          extra_context: {
            type: 'string',
            description: 'Optional URLs, constraints, or findings to hand off to the child bot',
          },
        },
        required: ['role', 'task'],
      },
    });
  }

  return tools;
}

function buildSystemPrompt(bot: BotEntity, ctx: AgentRunContext): string {
  const persona = PRIMARY_DEITIES[bot.role];
  const today = new Date().toISOString().slice(0, 10);
  const canSpawn =
    bot.depth < ctx.maxDepth &&
    Object.keys(ctx.mission.bots).length < ctx.maxBots &&
    bot.role !== 'Synthesizer';

  const roleDirectives: string[] = [
    persona.systemGuidance,
    `Your mythological identity in Pantheon is ${bot.name} (${bot.epithet ?? persona.epithet}), Role: ${bot.role}, Hierarchy Depth: L${bot.depth}.`,
    `Today's date is ${today}.`,
    'CRITICAL RULES:',
    '- Use real web_search, scrape_url, and deep_crawl tools to gather verified, up-to-date information. Never invent URLs, prices, reviews, or facts.',
    '- When you discover a promising official website, go DEEP with deep_crawl or scrape_url on sub-pages instead of stopping at search snippets.',
    '- Include exact source URLs inline for every major fact, price, policy, or recommendation.',
    '- If a site blocks scraping or returns an error, acknowledge it honestly and pivot to alternative sources.',
  ];

  if (bot.role === 'Orchestrator') {
    roleDirectives.push(
      '- As Zeus (Orchestrator), you MUST decompose this mission into 2–4 distinct parallel workstreams and call spawn_sub_agent in parallel (for example: Athena to strategize/structure, Artemis to discover top sources, Hermes/Iris to deep-crawl specific sites, or Hephaestus/Daedalus for technical design).',
      '- After your Olympian sub-agents report back, verify whether any critical gaps remain (spawn a follow-up bot if needed), and then present a thorough summary of all findings with exact citations.',
    );
  } else if (canSpawn && (bot.role === 'Researcher' || bot.role === 'Planner' || bot.role === 'Scraper')) {
    roleDirectives.push(
      `- You may call spawn_sub_agent (up to depth L${ctx.maxDepth}) when you uncover multiple rich websites or distinct sub-angles that benefit from parallel deep crawling.`,
    );
  }

  if (ctx.mission.contextMode === 'auto') {
    roleDirectives.push(
      '- Context Mode is AUTO-ASSUME: do not ask the user questions. If any minor detail is unspecified, call record_assumption and proceed confidently.',
    );
  }

  return roleDirectives.join('\n');
}

function emitBotAndMission(bot: BotEntity, ctx: AgentRunContext): void {
  ctx.mission.updatedAt = new Date().toISOString();
  ctx.emit({
    type: 'bot_updated',
    missionId: ctx.mission.id,
    bot: {
      ...bot,
      childIds: [...bot.childIds],
      logs: [...bot.logs],
      sources: [...bot.sources],
    },
  });
}

function createChildBot(
  parent: BotEntity,
  role: BotRole,
  task: string,
  requestedName: string | undefined,
  ctx: AgentRunContext,
): BotEntity {
  const usedNames = new Set(Object.values(ctx.mission.bots).map((b) => b.name));
  const identity = pickMythologicalIdentity(role, usedNames, requestedName);
  const nowIso = new Date().toISOString();
  const childId = makeId(`bot-${identity.name.toLowerCase()}`);

  const child: BotEntity = {
    id: childId,
    name: identity.name,
    epithet: identity.epithet,
    role,
    status: 'running',
    currentTask: task,
    activeTool: null,
    parentId: parent.id,
    childIds: [],
    depth: parent.depth + 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    logs: [],
    sources: [],
    modelUsed: ctx.config.model,
  };

  appendBotLog(
    child,
    'info',
    `Summoned by ${parent.name} (${parent.role}) at depth L${child.depth}.`,
  );
  appendBotLog(child, 'debug', `Assigned directive: ${task}`);

  parent.childIds = [...parent.childIds, child.id];
  parent.updatedAt = nowIso;
  ctx.mission.bots[child.id] = child;
  ctx.mission.updatedAt = nowIso;

  appendBotLog(
    parent,
    'success',
    `Deployed ${child.name} (${child.role}): ${task.slice(0, 140)}`,
  );

  ctx.emit({
    type: 'mission_updated',
    mission: cloneMissionSnapshot(ctx.mission),
  });

  return child;
}

export async function runOlympianAgent(
  botId: string,
  taskPrompt: string,
  maxSteps: number,
  ctx: AgentRunContext,
): Promise<{ output: string; sources: ScrapedSource[] }> {
  const bot = ctx.mission.bots[botId];
  if (!bot) {
    throw new Error(`Bot ${botId} not found in mission`);
  }

  bot.status = 'running';
  bot.modelUsed = ctx.config.model;
  emitBotAndMission(bot, ctx);

  const systemPrompt = buildSystemPrompt(bot, ctx);
  const messages: LLMMessage[] = [{ role: 'user', content: taskPrompt }];

  let finalOutput = '';

  try {
    for (let step = 1; step <= maxSteps; step++) {
      if (ctx.signal?.aborted) {
        throw new Error('Mission aborted by operator');
      }

      const tools = buildToolsForBot(bot, ctx);
      bot.activeTool = step === 1 ? 'Reasoning...' : `Step ${step}/${maxSteps}`;
      emitBotAndMission(bot, ctx);

      const response = await callLLM({
        provider: ctx.config.provider,
        model: ctx.config.model,
        apiKey: ctx.apiKey,
        systemPrompt,
        messages,
        tools,
        temperature: 0.35,
        maxTokens: bot.role === 'Synthesizer' ? 4096 : 3000,
        signal: ctx.signal,
      });

      if (response.usage) {
        bot.tokenUsage = {
          input: (bot.tokenUsage?.input ?? 0) + response.usage.input,
          output: (bot.tokenUsage?.output ?? 0) + response.usage.output,
        };
      }

      if (response.text) {
        const preview =
          response.text.length > 220
            ? `${response.text.slice(0, 220)}…`
            : response.text;
        appendBotLog(
          bot,
          response.toolCalls.length > 0 ? 'thought' : 'info',
          preview,
        );
      }

      messages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
      });

      if (response.toolCalls.length === 0) {
        finalOutput = response.text;
        break;
      }

      // Separate spawn_sub_agent calls so we can execute all child spawns in true parallel!
      const spawnCalls: ToolCallRequest[] = [];
      const otherCalls: ToolCallRequest[] = [];
      for (const tc of response.toolCalls) {
        if (tc.name === 'spawn_sub_agent') {
          spawnCalls.push(tc);
        } else {
          otherCalls.push(tc);
        }
      }

      const toolResultsByCallId = new Map<string, string>();

      // Execute non-spawn tools (web_search, scrape_url, deep_crawl, record_assumption) in parallel
      if (otherCalls.length > 0) {
        await Promise.all(
          otherCalls.map(async (tc) => {
            const result = await executeLocalTool(bot, tc, ctx);
            toolResultsByCallId.set(tc.id, result);
          }),
        );
      }

      // Execute spawned sub-agents in parallel while marking parent as 'waiting' on children
      if (spawnCalls.length > 0) {
        const spawnedTasks: Array<{
          tc: ToolCallRequest;
          child?: BotEntity;
          error?: string;
        }> = [];

        for (const tc of spawnCalls) {
          const remaining = ctx.maxBots - Object.keys(ctx.mission.bots).length;
          if (bot.depth >= ctx.maxDepth || remaining <= 0) {
            spawnedTasks.push({
              tc,
              error: `Spawn skipped: bot cap (${ctx.maxBots}) or max depth (L${ctx.maxDepth}) reached. Complete this work directly using web_search/deep_crawl instead.`,
            });
            appendBotLog(
              bot,
              'warn',
              `Spawn limit reached (bots: ${Object.keys(ctx.mission.bots).length}/${ctx.maxBots}, depth: L${bot.depth}/L${ctx.maxDepth}).`,
            );
            continue;
          }

          const rawRole = String(tc.args.role ?? 'Researcher');
          const validRole: BotRole = SPAWNABLE_ROLES.includes(rawRole as BotRole)
            ? (rawRole as BotRole)
            : 'Researcher';
          const childTask = String(tc.args.task ?? 'Assist parent mission').trim();
          const requestedName =
            typeof tc.args.name === 'string' ? tc.args.name : undefined;

          const child = createChildBot(bot, validRole, childTask, requestedName, ctx);
          spawnedTasks.push({ tc, child });
        }

        const activeChildren = spawnedTasks.filter((s) => s.child);
        if (activeChildren.length > 0) {
          const childNames = activeChildren.map((s) => s.child!.name).join(', ');
          bot.status = 'waiting';
          bot.activeTool = `Awaiting ${childNames}`;
          emitBotAndMission(bot, ctx);
        }

        await Promise.all(
          spawnedTasks.map(async (item) => {
            if (!item.child) {
              toolResultsByCallId.set(
                item.tc.id,
                JSON.stringify({ ok: false, message: item.error }),
              );
              return;
            }

            const extraContext =
              typeof item.tc.args.extra_context === 'string'
                ? item.tc.args.extra_context
                : '';

            const childPrompt = [
              `## Overall Mission Goal`,
              ctx.mission.goal,
              ctx.mission.contextSummary
                ? `\n## Context Summary\n${ctx.mission.contextSummary}`
                : '',
              Object.keys(ctx.mission.answers).length > 0
                ? `\n## User Clarifications\n${Object.entries(ctx.mission.answers)
                    .map(([k, v]) => `- ${k}: ${v}`)
                    .join('\n')}`
                : '',
              ctx.mission.assumptions.length > 0
                ? `\n## Active Assumptions\n${ctx.mission.assumptions
                    .map((a) => `- ${a}`)
                    .join('\n')}`
                : '',
              `\n## Your Specific Directive from ${bot.name} (${bot.role})`,
              item.child.currentTask,
              extraContext ? `\n## Additional Context & URLs\n${extraContext}` : '',
              `\nDeliver structured, fact-dense findings with exact source URLs for every claim.`,
            ]
              .filter(Boolean)
              .join('\n');

            try {
              const childResult = await runOlympianAgent(
                item.child.id,
                childPrompt,
                ctx.workerSteps,
                ctx,
              );
              toolResultsByCallId.set(
                item.tc.id,
                JSON.stringify({
                  ok: true,
                  botName: item.child.name,
                  role: item.child.role,
                  sourcesScraped: childResult.sources.length,
                  topUrls: childResult.sources
                    .filter((s) => s.status === 'ok')
                    .slice(0, 10)
                    .map((s) => ({ title: s.title, url: s.url })),
                  findings: childResult.output.slice(0, 7000),
                }),
              );
            } catch (childErr) {
              const msg =
                childErr instanceof Error ? childErr.message : 'Sub-agent failed';
              toolResultsByCallId.set(
                item.tc.id,
                JSON.stringify({
                  ok: false,
                  botName: item.child.name,
                  error: msg,
                }),
              );
            }
          }),
        );

        if (!ctx.signal?.aborted) {
          bot.status = 'running';
          bot.activeTool = 'Integrating child findings';
          appendBotLog(
            bot,
            'info',
            `Received reports from ${activeChildren.length} Olympian sub-agent(s).`,
          );
          emitBotAndMission(bot, ctx);
        }
      }

      // Append tool results in the exact order of response.toolCalls
      for (const tc of response.toolCalls) {
        messages.push({
          role: 'tool',
          toolCallId: tc.id,
          toolName: tc.name,
          content: toolResultsByCallId.get(tc.id) ?? JSON.stringify({ ok: false }),
        });
      }
    }

    // If loop hit maxSteps without a final text turn, ask for a crisp closing synthesis
    if (!finalOutput && !ctx.signal?.aborted) {
      bot.activeTool = 'Synthesizing findings...';
      emitBotAndMission(bot, ctx);
      messages.push({
        role: 'user',
        content:
          'You have reached your tool-call step budget. Now synthesize everything you and your sub-agents discovered into a clear, structured, well-cited Markdown response with exact URLs.',
      });
      const closing = await callLLM({
        provider: ctx.config.provider,
        model: ctx.config.model,
        apiKey: ctx.apiKey,
        systemPrompt,
        messages,
        tools: [],
        temperature: 0.3,
        maxTokens: 3200,
        signal: ctx.signal,
      });
      if (closing.usage) {
        bot.tokenUsage = {
          input: (bot.tokenUsage?.input ?? 0) + closing.usage.input,
          output: (bot.tokenUsage?.output ?? 0) + closing.usage.output,
        };
      }
      finalOutput = closing.text || 'Completed assigned research steps.';
    }

    bot.output = finalOutput;
    bot.status = 'done';
    bot.activeTool = null;
    appendBotLog(
      bot,
      'success',
      `Completed directive (${bot.sources.length} page${bot.sources.length === 1 ? '' : 's'} scraped).`,
    );
    emitBotAndMission(bot, ctx);

    return { output: finalOutput, sources: bot.sources };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent execution error';
    bot.status = ctx.signal?.aborted ? 'idle' : 'error';
    bot.activeTool = null;
    appendBotLog(bot, 'error', message);
    emitBotAndMission(bot, ctx);
    throw err;
  }
}

async function executeLocalTool(
  bot: BotEntity,
  tc: ToolCallRequest,
  ctx: AgentRunContext,
): Promise<string> {
  if (tc.name === 'web_search') {
    const query = String(tc.args.query ?? '').trim();
    const maxResults =
      typeof tc.args.max_results === 'number' ? tc.args.max_results : 7;
    bot.activeTool = `Searching: ${query.slice(0, 42)}`;
    appendBotLog(bot, 'tool', `Searching web: "${query}"`);
    emitBotAndMission(bot, ctx);

    const results = await searchWeb(query, {
      maxResults,
      searchProvider: ctx.config.searchProvider,
      searchApiKey: ctx.config.searchApiKey,
      signal: ctx.signal,
    });

    appendBotLog(
      bot,
      results.length > 0 ? 'info' : 'warn',
      results.length > 0
        ? `Found ${results.length} web results for "${query}".`
        : `No direct search results for "${query}" — try broadening terms.`,
    );
    emitBotAndMission(bot, ctx);

    return JSON.stringify({
      query,
      resultCount: results.length,
      results,
    });
  }

  if (tc.name === 'scrape_url') {
    const url = String(tc.args.url ?? '').trim();
    bot.activeTool = `Scraping ${safeHost(url)}`;
    appendBotLog(bot, 'tool', `Scraping page: ${url}`);
    emitBotAndMission(bot, ctx);

    const scraped = await scrapeUrl(url, { depth: 0, signal: ctx.signal });
    bot.sources = [...bot.sources, scraped.source];

    appendBotLog(
      bot,
      scraped.source.status === 'ok' ? 'success' : 'warn',
      scraped.source.status === 'ok'
        ? `Scraped ${scraped.source.domain} (${scraped.source.wordCount} words, ${scraped.source.linksFound} links)`
        : `Failed to scrape ${url}: ${scraped.source.error}`,
    );
    emitBotAndMission(bot, ctx);

    return JSON.stringify({
      url: scraped.source.url,
      title: scraped.source.title,
      status: scraped.source.status,
      wordCount: scraped.source.wordCount,
      markdown: scraped.markdown.slice(0, 7500),
      discoveredLinks: scraped.links.slice(0, 20),
    });
  }

  if (tc.name === 'deep_crawl') {
    const startUrl = String(tc.args.start_url ?? '').trim();
    const rawKeywords = Array.isArray(tc.args.focus_keywords)
      ? tc.args.focus_keywords.map((k) => String(k))
      : [];
    const reqPages =
      typeof tc.args.max_pages === 'number' ? tc.args.max_pages : ctx.maxCrawlPages;
    const reqDepth =
      typeof tc.args.max_depth === 'number' ? tc.args.max_depth : ctx.maxCrawlDepth;

    const maxPages = Math.min(Math.max(reqPages, 1), ctx.maxCrawlPages);
    const maxDepth = Math.min(Math.max(reqDepth, 1), ctx.maxCrawlDepth);

    bot.activeTool = `Deep crawling ${safeHost(startUrl)}`;
    appendBotLog(
      bot,
      'tool',
      `Deep crawling ${startUrl} (up to ${maxPages} pages, depth ${maxDepth}, focus: ${rawKeywords.join(', ') || 'general'})`,
    );
    emitBotAndMission(bot, ctx);

    const crawl = await deepCrawlSite(startUrl, {
      focusKeywords: rawKeywords,
      maxPages,
      maxDepth,
      signal: ctx.signal,
      onPageScraped: (src) => {
        bot.sources = [...bot.sources, src];
        appendBotLog(
          bot,
          src.status === 'ok' ? 'info' : 'warn',
          src.status === 'ok'
            ? `[Crawl d${src.depth}] ${src.title.slice(0, 65)} (${src.wordCount}w) — ${src.url}`
            : `[Crawl d${src.depth}] Failed ${src.url}: ${src.error}`,
        );
        emitBotAndMission(bot, ctx);
      },
    });

    const okCount = crawl.sources.filter((s) => s.status === 'ok').length;
    appendBotLog(
      bot,
      okCount > 0 ? 'success' : 'warn',
      `Deep crawl finished on ${safeHost(startUrl)}: ${okCount}/${crawl.pagesCrawled} pages extracted.`,
    );
    emitBotAndMission(bot, ctx);

    return JSON.stringify({
      startUrl: crawl.startUrl,
      pagesCrawled: crawl.pagesCrawled,
      successfulPages: okCount,
      urlsScraped: crawl.sources.map((s) => ({
        url: s.url,
        title: s.title,
        status: s.status,
        wordCount: s.wordCount,
      })),
      dossier: crawl.combinedDossier.slice(0, 11_000),
    });
  }

  if (tc.name === 'record_assumption') {
    const assumption = String(tc.args.assumption ?? '').trim();
    if (assumption) {
      bot.assumptions = [...(bot.assumptions ?? []), assumption];
      if (!ctx.mission.assumptions.includes(assumption)) {
        ctx.mission.assumptions.push(assumption);
      }
      appendBotLog(bot, 'warn', `Assumed context: ${assumption}`);
      emitBotAndMission(bot, ctx);
    }
    return JSON.stringify({ ok: true, recorded: assumption });
  }

  return JSON.stringify({ ok: false, error: `Unknown tool: ${tc.name}` });
}

function safeHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl.slice(0, 32);
  }
}
