import {
  appendBotLog,
  cloneMissionSnapshot,
  runOlympianAgent,
  type AgentRunContext,
} from './agentRunner.ts';
import { callLLM, extractJsonBlock } from './llmClient.ts';
import { DEPTH_PRESETS, pickMythologicalIdentity, PRIMARY_DEITIES } from './pantheonRoster.ts';
import type {
  BotEntity,
  BotRole,
  ClarifyingQuestion,
  MissionConfig,
  MissionState,
  MissionStreamEvent,
} from './types.ts';

function makeMissionId(): string {
  return `mission-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createMission(goal: string, config: MissionConfig): MissionState {
  const nowIso = new Date().toISOString();
  const rootId = 'bot-zeus';
  const zeus: BotEntity = {
    id: rootId,
    name: PRIMARY_DEITIES.Orchestrator.name,
    epithet: PRIMARY_DEITIES.Orchestrator.epithet,
    role: 'Orchestrator',
    status: 'running',
    currentTask: 'Analyze mission goal and evaluate required context',
    activeTool: 'Evaluating context...',
    parentId: null,
    childIds: [],
    depth: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    logs: [],
    sources: [],
    modelUsed: config.model,
  };

  appendBotLog(
    zeus,
    'info',
    `Pantheon v2 mission initialized (${config.contextMode === 'ask' ? 'Ask-First' : 'Auto-Assume'} mode · ${config.depth.toUpperCase()} depth · ${config.provider}/${config.model}).`,
  );
  appendBotLog(zeus, 'debug', `Objective: ${goal}`);

  return {
    id: makeMissionId(),
    goal: goal.trim(),
    title: goal.trim().slice(0, 56) + (goal.trim().length > 56 ? '…' : ''),
    status: 'analyzing',
    contextMode: config.contextMode,
    depth: config.depth,
    provider: config.provider,
    model: config.model,
    createdAt: nowIso,
    updatedAt: nowIso,
    rootId,
    bots: { [rootId]: zeus },
    questions: [],
    answers: {},
    assumptions: [],
  };
}

interface ContextAnalysisJSON {
  title?: string;
  contextSummary?: string;
  needsClarification?: boolean;
  questions?: Array<{
    id?: string;
    question?: string;
    reason?: string;
    suggestedOptions?: string[];
  }>;
  assumptions?: string[];
  initialPlan?: string;
}

export async function analyzeMissionContext(
  mission: MissionState,
  config: MissionConfig,
  apiKey: string,
  emit: (event: MissionStreamEvent) => void,
  signal?: AbortSignal,
): Promise<{ pausedForQuestions: boolean }> {
  const zeus = mission.bots[mission.rootId];
  const today = new Date().toISOString().slice(0, 10);

  zeus.status = 'running';
  zeus.activeTool = 'Analyzing context...';
  mission.status = 'analyzing';
  emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });

  const systemPrompt = [
    'You are Zeus, Supreme Orchestrator of Pantheon (a multi-agent deep web research & execution system).',
    `Today's date is ${today}.`,
    'Your job right now is ONLY Step 1: evaluate the user goal and decide whether critical context is missing.',
    'Respond with STRICT JSON ONLY (no extra prose outside JSON) matching this exact shape:',
    `{
  "title": "Concise 4-7 word mission title",
  "contextSummary": "1-2 sentence synthesis of the mission scope",
  "needsClarification": true or false,
  "questions": [
    {
      "id": "q1",
      "question": "Clear, specific question",
      "reason": "Brief reason why this sharpens the research",
      "suggestedOptions": ["Option 1", "Option 2", "Option 3"]
    }
  ],
  "assumptions": ["Smart explicit default assumption if proceeding autonomously"],
  "initialPlan": "2-3 sentence summary of which Greek mythology bots you will deploy (e.g. Athena, Artemis, Hermes, Apollo)"
}`,
    mission.contextMode === 'ask'
      ? 'MODE = ASK-FIRST: If important parameters are missing or ambiguous (such as budget, dates, location, target criteria, audience, constraints, or preferred sources), set "needsClarification": true and provide 2 to 4 sharp, high-impact questions with 2-4 clickable suggestedOptions each. Only set "needsClarification": false if the user goal is already completely clear and self-contained.'
      : 'MODE = AUTO-ASSUME: ALWAYS set "needsClarification": false and "questions": []. Infer smart, practical defaults for any unspecified parameters and list every single assumption transparently in "assumptions".',
  ].join('\n');

  const response = await callLLM({
    provider: config.provider,
    model: config.model,
    apiKey,
    systemPrompt,
    messages: [{ role: 'user', content: `Mission Goal:\n${mission.goal}` }],
    temperature: 0.2,
    maxTokens: 1200,
    signal,
  });

  if (response.usage) {
    zeus.tokenUsage = {
      input: (zeus.tokenUsage?.input ?? 0) + response.usage.input,
      output: (zeus.tokenUsage?.output ?? 0) + response.usage.output,
    };
  }

  const parsed = extractJsonBlock<ContextAnalysisJSON>(response.text) ?? {};

  if (parsed.title?.trim()) {
    mission.title = parsed.title.trim();
  }
  if (parsed.contextSummary?.trim()) {
    mission.contextSummary = parsed.contextSummary.trim();
    appendBotLog(zeus, 'thought', `Context brief: ${mission.contextSummary}`);
  }
  if (parsed.initialPlan?.trim()) {
    appendBotLog(zeus, 'info', `Olympus strategy: ${parsed.initialPlan.trim()}`);
  }

  if (Array.isArray(parsed.assumptions) && parsed.assumptions.length > 0) {
    const cleanAssumptions = parsed.assumptions
      .map((a) => String(a).trim())
      .filter(Boolean);
    if (mission.contextMode === 'auto' || !parsed.needsClarification) {
      mission.assumptions = cleanAssumptions;
      zeus.assumptions = cleanAssumptions;
      for (const a of cleanAssumptions) {
        appendBotLog(zeus, 'warn', `Auto-assumed: ${a}`);
      }
    }
  }

  const questions: ClarifyingQuestion[] = Array.isArray(parsed.questions)
    ? parsed.questions
        .filter((q) => q && typeof q.question === 'string' && q.question.trim())
        .slice(0, 5)
        .map((q, idx) => ({
          id: q.id?.trim() || `q${idx + 1}`,
          question: q.question!.trim(),
          reason: q.reason?.trim() || 'Helps tailor the bots to your exact goal',
          suggestedOptions: Array.isArray(q.suggestedOptions)
            ? q.suggestedOptions.map((o) => String(o).trim()).filter(Boolean).slice(0, 4)
            : undefined,
        }))
    : [];

  if (mission.contextMode === 'ask' && parsed.needsClarification && questions.length > 0) {
    mission.questions = questions;
    mission.status = 'waiting_for_input';
    zeus.status = 'waiting';
    zeus.activeTool = 'Awaiting your answers';
    zeus.currentTask = `Waiting for clarification (${questions.length} question${questions.length === 1 ? '' : 's'}) before deploying Pantheon`;
    appendBotLog(
      zeus,
      'warn',
      `Paused for context clarification: ${questions.length} question(s) ready for operator.`,
    );
    mission.updatedAt = new Date().toISOString();

    emit({
      type: 'questions',
      missionId: mission.id,
      questions,
      contextSummary: mission.contextSummary,
    });
    emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });
    return { pausedForQuestions: true };
  }

  appendBotLog(
    zeus,
    'success',
    mission.contextMode === 'auto'
      ? 'Context auto-assumed. Deploying the Pantheon immediately.'
      : 'Context verified as sufficient. Deploying the Pantheon immediately.',
  );
  mission.updatedAt = new Date().toISOString();
  emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });
  return { pausedForQuestions: false };
}

export async function runMissionExecution(
  mission: MissionState,
  config: MissionConfig,
  apiKey: string,
  emit: (event: MissionStreamEvent) => void,
  options: {
    signal?: AbortSignal;
    cloudBudget?: boolean;
  } = {},
): Promise<MissionState> {
  const preset = DEPTH_PRESETS[config.depth];
  const cloud = Boolean(options.cloudBudget);

  const maxBots = Math.min(config.maxBots ?? preset.maxBots, cloud ? 8 : 24);
  const maxDepth = Math.min(config.maxDepth ?? preset.maxDepth, cloud ? 2 : 3);
  const orchestratorSteps = cloud ? Math.min(preset.orchestratorSteps, 4) : preset.orchestratorSteps;
  const workerSteps = cloud ? Math.min(preset.workerSteps, 3) : preset.workerSteps;
  const maxCrawlPages = cloud ? Math.min(preset.maxCrawlPages, 3) : preset.maxCrawlPages;
  const maxCrawlDepth = cloud ? 1 : preset.maxCrawlDepth;

  const zeus = mission.bots[mission.rootId];
  mission.status = 'running';
  zeus.status = 'running';
  zeus.currentTask = `Orchestrate Olympian swarm for: ${mission.title}`;
  emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });

  const ctx: AgentRunContext = {
    mission,
    config,
    apiKey,
    maxBots,
    maxDepth,
    workerSteps,
    maxCrawlPages,
    maxCrawlDepth,
    emit,
    signal: options.signal,
  };

  try {
    const clarificationBlock =
      Object.keys(mission.answers).length > 0
        ? [
            '## User Clarifications',
            ...mission.questions.map((q) => {
              const ans = mission.answers[q.id];
              return `- **${q.question}** -> ${ans || '(Not specified — assume best default)'}`;
            }),
          ].join('\n')
        : '';

    const assumptionsBlock =
      mission.assumptions.length > 0
        ? ['## Active Assumptions', ...mission.assumptions.map((a) => `- ${a}`)].join('\n')
        : '';

    const zeusPrompt = [
      `## Mission Goal`,
      mission.goal,
      mission.contextSummary ? `\n## Context Summary\n${mission.contextSummary}` : '',
      clarificationBlock ? `\n${clarificationBlock}` : '',
      assumptionsBlock ? `\n${assumptionsBlock}` : '',
      `\n## Deployment Instructions`,
      `- Research depth preset: **${config.depth.toUpperCase()}** (max ${maxBots} bots, max hierarchy depth L${maxDepth}, up to ${maxCrawlPages} crawled pages per deep_crawl).`,
      '- Spawn 2–4 specialized Olympian sub-agents in parallel right away (for example: Artemis to search & discover the strongest websites, Hermes/Iris to deep-crawl official sites for real details/pricing/policies, Athena to build comparison criteria, or Hephaestus/Daedalus if architecture/code is needed).',
      '- Encourage sub-agents to scrape real websites deeply instead of relying only on snippets.',
      '- Once your sub-agents finish, consolidate the highest-signal verified findings and exact URLs.',
    ]
      .filter(Boolean)
      .join('\n');

    const zeusResult = await runOlympianAgent(
      mission.rootId,
      zeusPrompt,
      orchestratorSteps,
      ctx,
    );

    // Collect all bots & sources across the entire Pantheon tree
    const allBots = Object.values(mission.bots);
    const workerBots = allBots.filter((b) => b.id !== mission.rootId && b.output);
    const alreadyHasSynthesizer = allBots.some(
      (b) => b.role === 'Synthesizer' && b.status === 'done' && b.output,
    );

    let finalReport = zeusResult.output;

    // Deploy Apollo (Synthesizer) to craft the definitive executive report if multiple workers ran
    if (!options.signal?.aborted && workerBots.length >= 1 && !alreadyHasSynthesizer) {
      const usedNames = new Set(Object.values(mission.bots).map((b) => b.name));
      const apolloIdentity = pickMythologicalIdentity('Synthesizer', usedNames, 'Apollo');
      const nowIso = new Date().toISOString();
      const apolloId = `bot-apollo-${Date.now()}`;

      const apollo: BotEntity = {
        id: apolloId,
        name: apolloIdentity.name,
        epithet: apolloIdentity.epithet,
        role: 'Synthesizer',
        status: 'running',
        currentTask: 'Fuse all Olympian findings & scraped sources into the final Mission Report',
        activeTool: 'Composing final dossier...',
        parentId: mission.rootId,
        childIds: [],
        depth: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        logs: [],
        sources: [],
        modelUsed: config.model,
      };
      appendBotLog(
        apollo,
        'info',
        `Summoned by Zeus to synthesize reports from ${workerBots.length} Olympian(s).`,
      );

      zeus.childIds = [...zeus.childIds, apollo.id];
      mission.bots[apollo.id] = apollo;
      emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });

      const allUniqueSources = new Map<string, { title: string; url: string; bot: string }>();
      for (const b of allBots) {
        for (const s of b.sources) {
          if (s.status === 'ok' && !allUniqueSources.has(s.url)) {
            allUniqueSources.set(s.url, { title: s.title, url: s.url, bot: b.name });
          }
        }
      }

      const synthesisPrompt = [
        `## Original Mission Goal`,
        mission.goal,
        clarificationBlock ? `\n${clarificationBlock}` : '',
        assumptionsBlock ? `\n${assumptionsBlock}` : '',
        `\n## Zeus's Orchestration Summary`,
        zeusResult.output.slice(0, 4500),
        `\n## Specialist Olympian Reports`,
        ...workerBots.map(
          (b) =>
            `### ${b.name} (${b.role} — ${b.epithet ?? ''})\nTask: ${b.currentTask}\n${(
              b.output ?? ''
            ).slice(0, 3500)}`,
        ),
        `\n## Verified Scraped Websites (${allUniqueSources.size})`,
        ...Array.from(allUniqueSources.values())
          .slice(0, 30)
          .map((s) => `- [${s.title}](${s.url}) *(scraped by ${s.bot})*`),
        `\nProduce the definitive, cleanly formatted Markdown Mission Report with:
1. **Executive Summary**
2. **Structured Comparison / Key Findings** (use Markdown tables where comparing options, prices, features, or ratings)
3. **Deep-Dive Details & Actionable Recommendations**
4. **Assumptions & Caveats** (if any)
5. **Verified Sources** (clickable Markdown links)`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const apolloRes = await callLLM({
        provider: config.provider,
        model: config.model,
        apiKey,
        systemPrompt: PRIMARY_DEITIES.Synthesizer.systemGuidance,
        messages: [{ role: 'user', content: synthesisPrompt }],
        tools: [],
        temperature: 0.3,
        maxTokens: 4096,
        signal: options.signal,
      });

      if (apolloRes.usage) {
        apollo.tokenUsage = apolloRes.usage;
      }

      apollo.output = apolloRes.text || zeusResult.output;
      apollo.status = 'done';
      apollo.activeTool = null;
      appendBotLog(
        apollo,
        'success',
        `Final Mission Report compiled across ${allUniqueSources.size} verified web sources.`,
      );
      finalReport = apollo.output;
    }

    mission.finalReport = finalReport;
    mission.status = 'completed';
    mission.completedAt = new Date().toISOString();
    mission.updatedAt = mission.completedAt;
    zeus.status = 'done';
    zeus.activeTool = null;

    const finalSnap = cloneMissionSnapshot(mission);
    emit({ type: 'done', mission: finalSnap });
    return finalSnap;
  } catch (err) {
    const aborted = Boolean(options.signal?.aborted);
    const message = err instanceof Error ? err.message : 'Mission failed';
    mission.status = aborted ? 'aborted' : 'failed';
    mission.error = aborted ? 'Mission stopped by operator' : message;
    mission.updatedAt = new Date().toISOString();

    for (const bot of Object.values(mission.bots)) {
      if (bot.status === 'running' || bot.status === 'waiting') {
        bot.status = aborted ? 'idle' : 'error';
        bot.activeTool = null;
      }
    }

    emit({ type: 'error', missionId: mission.id, message: mission.error });
    emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });
    return cloneMissionSnapshot(mission);
  }
}

export async function spawnFollowUpBotOnMission(
  mission: MissionState,
  parentId: string,
  role: BotRole,
  task: string,
  config: MissionConfig,
  apiKey: string,
  emit: (event: MissionStreamEvent) => void,
  signal?: AbortSignal,
): Promise<BotEntity> {
  const parent = mission.bots[parentId] ?? mission.bots[mission.rootId];
  const usedNames = new Set(Object.values(mission.bots).map((b) => b.name));
  const identity = pickMythologicalIdentity(role, usedNames);
  const nowIso = new Date().toISOString();
  const childId = `bot-${identity.name.toLowerCase()}-${Date.now()}`;

  const child: BotEntity = {
    id: childId,
    name: identity.name,
    epithet: identity.epithet,
    role,
    status: 'running',
    currentTask: task,
    activeTool: 'Initializing...',
    parentId: parent.id,
    childIds: [],
    depth: parent.depth + 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    logs: [],
    sources: [],
    modelUsed: config.model,
  };

  appendBotLog(child, 'info', `Manually deployed by operator under ${parent.name}.`);
  appendBotLog(child, 'debug', `Directive: ${task}`);

  parent.childIds = [...parent.childIds, child.id];
  mission.bots[child.id] = child;
  mission.updatedAt = nowIso;
  emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });

  const preset = DEPTH_PRESETS[config.depth];
  const ctx: AgentRunContext = {
    mission,
    config,
    apiKey,
    maxBots: Math.max(Object.keys(mission.bots).length + 4, preset.maxBots),
    maxDepth: Math.max(child.depth + 1, preset.maxDepth),
    workerSteps: preset.workerSteps,
    maxCrawlPages: preset.maxCrawlPages,
    maxCrawlDepth: preset.maxCrawlDepth,
    emit,
    signal,
  };

  const prompt = [
    `## Mission Goal`,
    mission.goal,
    `\n## Operator Follow-Up Task (under ${parent.name})`,
    task,
    parent.output ? `\n## Parent's Previous Findings\n${parent.output.slice(0, 3000)}` : '',
    `\nUse web_search, scrape_url, or deep_crawl to investigate deeply and report verified results with exact URLs.`,
  ]
    .filter(Boolean)
    .join('\n');

  await runOlympianAgent(child.id, prompt, preset.workerSteps, ctx);
  emit({ type: 'mission_updated', mission: cloneMissionSnapshot(mission) });
  return child;
}
