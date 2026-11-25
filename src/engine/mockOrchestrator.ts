import type {
  BotEntity,
  BotLogEntry,
  BotRole,
  BotSimulationState,
  LogLevel,
} from '../types/bot';

const AUTO_MAX_BOTS = 22;
const AUTO_MAX_DEPTH = 3;
const MANUAL_MAX_BOTS = 40;
const MANUAL_MAX_DEPTH = 4;
const MAX_LOGS_PER_BOT = 120;
const MAX_AUTO_CHILDREN_PER_PARENT = 4;

const CHILD_ROLE_MAP: Record<BotRole, readonly BotRole[]> = {
  Orchestrator: ['Planner', 'Researcher', 'Architect'],
  Planner: ['Researcher', 'Architect'],
  Researcher: ['Synthesizer', 'Planner'],
  Architect: ['Coder', 'Reviewer'],
  Coder: ['Tester', 'Reviewer'],
  Reviewer: ['Coder', 'Tester'],
  Tester: ['Synthesizer', 'Reviewer'],
  Synthesizer: ['Reviewer'],
};

const ROLE_TASK_POOLS: Record<BotRole, readonly string[]> = {
  Orchestrator: [
    'Coordinate active sub-agent execution graph and resolve dependency gates',
    'Rebalance task queue priorities across active planning and coding branches',
    'Monitor child agent telemetry and aggregate completion milestones',
    'Dispatch next-wave work packages to idle specialist branches',
  ],
  Planner: [
    'Decompose system requirements into parallelizable execution milestones',
    'Validate critical-path dependencies across architectural modules',
    'Sequence handoff contracts and acceptance criteria for downstream bots',
    'Refine scope boundaries and fallback strategies for edge cases',
  ],
  Researcher: [
    'Scan repository conventions and index existing type interfaces',
    'Benchmark streaming graph layout performance under high node density',
    'Cross-reference API compatibility constraints and state invariants',
    'Gather telemetry patterns for real-time observability dashboards',
  ],
  Architect: [
    'Design decoupled state-transition contracts and immutable graph updates',
    'Specify hierarchical tree layout geometry and collision-free spacing',
    'Define edge animation triggers and node lifecycle state machines',
    'Audit module boundaries to prevent circular dependencies',
  ],
  Coder: [
    'Implement deterministic simulation tick reducer and log buffer capping',
    'Build reactive hook bindings with memoized topology statistics',
    'Wire status transition guards and parent-child delegation handlers',
    'Optimize immutable state cloning for high-frequency tick updates',
  ],
  Reviewer: [
    'Inspect TypeScript strict-mode compliance and union exhaustiveness',
    'Verify immutability of simulation state across concurrent ticks',
    'Review parent-child termination ordering and orphan prevention',
    'Check log ring-buffer bounds and timestamp monotonicity',
  ],
  Tester: [
    'Run stress simulation up to 22 auto-spawned agents across 3 depth levels',
    'Verify manual child spawning under selected, idle, and done parents',
    'Validate pause, resume, auto-layout, and reset state transitions',
    'Assert zero duplicate bot IDs and consistent parent/child references',
  ],
  Synthesizer: [
    'Consolidate research findings into actionable implementation briefs',
    'Merge verification telemetry and summarize subsystem health',
    'Compile execution trace highlights for root orchestrator sign-off',
    'Distill cross-branch anomalies into structured diagnostic notes',
  ],
};

const ROLE_LOG_MESSAGES: Record<
  BotRole,
  ReadonlyArray<{ level: LogLevel; message: string }>
> = {
  Orchestrator: [
    { level: 'info', message: 'Evaluated active DAG branches; latency nominal.' },
    { level: 'debug', message: 'Synchronized shared context snapshot across child workers.' },
    { level: 'success', message: 'Verified upstream milestone checkpoint reached.' },
    { level: 'warn', message: 'Detected slight queue skew; rebalancing task weights.' },
  ],
  Planner: [
    { level: 'info', message: 'Updated execution dependency matrix for current sprint.' },
    { level: 'debug', message: 'Estimated branch depth and token budget allocation.' },
    { level: 'success', message: 'Locked interface contract for parallel subtasks.' },
    { level: 'warn', message: 'Flagged potential bottleneck in downstream review stage.' },
  ],
  Researcher: [
    { level: 'info', message: 'Indexed 14 module references and cross-checked signatures.' },
    { level: 'debug', message: 'Sampled throughput metrics over sliding 10-tick window.' },
    { level: 'success', message: 'Confirmed zero breaking changes in target dependencies.' },
    { level: 'warn', message: 'Partial cache miss on historical trace lookup; retrying.' },
  ],
  Architect: [
    { level: 'info', message: 'Validated component isolation and unidirectional data flow.' },
    { level: 'debug', message: 'Checked subtree spacing invariants for nested children.' },
    { level: 'success', message: 'Approved state machine transition table for workers.' },
    { level: 'warn', message: 'Depth threshold approaching limit; constraining fan-out.' },
  ],
  Coder: [
    { level: 'info', message: 'Patched pure state reducer with immutable log appends.' },
    { level: 'debug', message: 'Verified strict TypeScript narrowing on nullable parentId.' },
    { level: 'success', message: 'Compiled worker module cleanly with zero warnings.' },
    { level: 'warn', message: 'Retrying lock-free batch update after concurrent tick.' },
  ],
  Reviewer: [
    { level: 'info', message: 'Audited diff for side effects and accidental array mutations.' },
    { level: 'debug', message: 'Traced edge-case handling when selectedBotId is null.' },
    { level: 'success', message: 'Static type and invariant checks passed.' },
    { level: 'warn', message: 'Requested clearer boundary check on maximum tree depth.' },
  ],
  Tester: [
    { level: 'info', message: 'Executed randomized tick sequence over 50 iterations.' },
    { level: 'debug', message: 'Asserted bidirectional parentId/childIds symmetry.' },
    { level: 'success', message: 'All lifecycle transition assertions passed.' },
    { level: 'warn', message: 'High fan-out detected on branch; monitoring layout bounds.' },
  ],
  Synthesizer: [
    { level: 'info', message: 'Aggregated telemetry summaries from sibling research bots.' },
    { level: 'debug', message: 'Deduplicated overlapping findings across depth levels.' },
    { level: 'success', message: 'Published concise status digest to parent orchestrator.' },
    { level: 'warn', message: 'Waiting on one pending trace before finalizing report.' },
  ],
};

const CODENAME_POOL: readonly string[] = [
  'Kestrel',
  'Pulse',
  'Cipher',
  'Aegis',
  'Lyra',
  'Helix',
  'Orion',
  'Echo',
  'Beacon',
  'Nexus',
  'Strata',
  'Vertex',
  'Quill',
  'Delta',
  'Spark',
  'Flux',
  'Prism',
  'Talon',
  'Nimbus',
  'Rift',
  'Cortex',
  'Sable',
  'Zephyr',
  'Solis',
  'Matrix',
  'Cobalt',
  'Signal',
  'Drift',
  'Torus',
  'Vanguard',
  'Astra',
  'Chronos',
  'Zenith',
  'Relay',
  'Kernel',
  'Shard',
];

let idSequence = 0;

function nextUniqueId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
}

function pickRandom<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0];
}

function pickDifferentTask(role: BotRole, currentTask: string): string {
  const pool = ROLE_TASK_POOLS[role];
  const candidates = pool.filter((task) => task !== currentTask);
  return candidates.length > 0 ? pickRandom(candidates) : pool[0];
}

function pickAvailableName(existingBots: Record<string, BotEntity>): string {
  const usedNames = new Set(Object.values(existingBots).map((bot) => bot.name));
  const available = CODENAME_POOL.filter((name) => !usedNames.has(name));
  if (available.length > 0) {
    return pickRandom(available);
  }
  const base = pickRandom(CODENAME_POOL);
  let suffix = 2;
  while (usedNames.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function appendLog(
  logs: readonly BotLogEntry[],
  level: LogLevel,
  message: string,
  timestamp: string,
): BotLogEntry[] {
  const entry: BotLogEntry = {
    id: nextUniqueId('log'),
    timestamp,
    level,
    message,
  };
  const nextLogs = [...logs, entry];
  if (nextLogs.length > MAX_LOGS_PER_BOT) {
    return nextLogs.slice(nextLogs.length - MAX_LOGS_PER_BOT);
  }
  return nextLogs;
}

function cloneBot(bot: BotEntity): BotEntity {
  return {
    ...bot,
    childIds: [...bot.childIds],
    logs: [...bot.logs],
  };
}

function hasActiveChildren(
  bot: BotEntity,
  bots: Record<string, BotEntity>,
): boolean {
  return bot.childIds.some((childId) => {
    const child = bots[childId];
    return child !== undefined && child.status !== 'done';
  });
}

function spawnChildUnderParent(
  bots: Record<string, BotEntity>,
  parentId: string,
  nowIso: string,
  reasonLabel: 'auto' | 'manual',
): { bots: Record<string, BotEntity>; newBot: BotEntity } {
  const parent = cloneBot(bots[parentId]);
  const childRoles = CHILD_ROLE_MAP[parent.role];
  const childRole = pickRandom(childRoles);
  const childName = pickAvailableName(bots);
  const childTask = pickRandom(ROLE_TASK_POOLS[childRole]);
  const childId = nextUniqueId('bot');

  const initialLogs: BotLogEntry[] = [
    {
      id: nextUniqueId('log'),
      timestamp: nowIso,
      level: 'info',
      message:
        reasonLabel === 'manual'
          ? `Manually spawned by operator under ${parent.name} (${parent.role}).`
          : `Spawned by ${parent.name} (${parent.role}) for delegated subtask.`,
    },
    {
      id: nextUniqueId('log'),
      timestamp: nowIso,
      level: 'debug',
      message: `Initialized task: ${childTask}`,
    },
  ];

  const newBot: BotEntity = {
    id: childId,
    name: childName,
    role: childRole,
    status: 'running',
    currentTask: childTask,
    parentId: parent.id,
    childIds: [],
    depth: parent.depth + 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    logs: initialLogs,
  };

  if (parent.status !== 'running') {
    parent.status = 'running';
    parent.logs = appendLog(
      parent.logs,
      'info',
      `Reactivated to coordinate newly spawned child ${newBot.name}.`,
      nowIso,
    );
  }

  parent.childIds.push(newBot.id);
  parent.updatedAt = nowIso;
  parent.logs = appendLog(
    parent.logs,
    'success',
    `Delegated subtask to ${newBot.name} (${newBot.role}): ${newBot.currentTask}`,
    nowIso,
  );

  return {
    bots: {
      ...bots,
      [parent.id]: parent,
      [newBot.id]: newBot,
    },
    newBot,
  };
}

function makeStarterLogs(
  entries: ReadonlyArray<{ offsetMs: number; level: LogLevel; message: string }>,
  baseTimeMs: number,
): BotLogEntry[] {
  return entries.map((entry) => ({
    id: nextUniqueId('log'),
    timestamp: new Date(baseTimeMs + entry.offsetMs).toISOString(),
    level: entry.level,
    message: entry.message,
  }));
}

export function createInitialSimulationState(): BotSimulationState {
  const nowMs = Date.now();
  const rootId = 'bot-root';

  const bots: Record<string, BotEntity> = {
    [rootId]: {
      id: rootId,
      name: 'Atlas',
      role: 'Orchestrator',
      status: 'running',
      currentTask: 'Coordinate multi-agent execution tree and monitor active branches',
      parentId: null,
      childIds: ['bot-sage', 'bot-nova', 'bot-vektor'],
      depth: 0,
      createdAt: new Date(nowMs - 45_000).toISOString(),
      updatedAt: new Date(nowMs - 2_000).toISOString(),
      logs: makeStarterLogs(
        [
          { offsetMs: -45_000, level: 'info', message: 'Bootstrapped root orchestration session.' },
          { offsetMs: -38_000, level: 'success', message: 'Spawned Sage (Planner) for initial blueprint.' },
          { offsetMs: -24_000, level: 'info', message: 'Dispatched Nova (Researcher) and Vektor (Architect).' },
          { offsetMs: -2_000, level: 'debug', message: 'Monitoring active subtrees and worker heartbeats.' },
        ],
        nowMs,
      ),
    },
    'bot-sage': {
      id: 'bot-sage',
      name: 'Sage',
      role: 'Planner',
      status: 'done',
      currentTask: 'Partition execution blueprint into parallel specialist tracks',
      parentId: rootId,
      childIds: [],
      depth: 1,
      createdAt: new Date(nowMs - 38_000).toISOString(),
      updatedAt: new Date(nowMs - 18_000).toISOString(),
      logs: makeStarterLogs(
        [
          { offsetMs: -38_000, level: 'info', message: 'Received root directive from Atlas.' },
          { offsetMs: -31_000, level: 'debug', message: 'Evaluated dependency graph across 4 subsystems.' },
          { offsetMs: -22_000, level: 'info', message: 'Published phased task allocation schema.' },
          { offsetMs: -18_000, level: 'success', message: 'Planning phase completed; handed off to execution.' },
        ],
        nowMs,
      ),
    },
    'bot-nova': {
      id: 'bot-nova',
      name: 'Nova',
      role: 'Researcher',
      status: 'running',
      currentTask: 'Gather telemetry patterns for real-time observability dashboards',
      parentId: rootId,
      childIds: [],
      depth: 1,
      createdAt: new Date(nowMs - 24_000).toISOString(),
      updatedAt: new Date(nowMs - 3_000).toISOString(),
      logs: makeStarterLogs(
        [
          { offsetMs: -24_000, level: 'info', message: 'Initialized research scan on live graph rendering.' },
          { offsetMs: -16_000, level: 'debug', message: 'Profiling React Flow update throughput at 60fps.' },
          { offsetMs: -3_000, level: 'info', message: 'Synthesizing benchmark notes for parent orchestrator.' },
        ],
        nowMs,
      ),
    },
    'bot-vektor': {
      id: 'bot-vektor',
      name: 'Vektor',
      role: 'Architect',
      status: 'running',
      currentTask: 'Specify hierarchical tree layout geometry and collision-free spacing',
      parentId: rootId,
      childIds: ['bot-forge', 'bot-lens'],
      depth: 1,
      createdAt: new Date(nowMs - 24_000).toISOString(),
      updatedAt: new Date(nowMs - 4_000).toISOString(),
      logs: makeStarterLogs(
        [
          { offsetMs: -24_000, level: 'info', message: 'Loaded system architecture constraints from Sage.' },
          { offsetMs: -15_000, level: 'success', message: 'Spawned Forge (Coder) to implement core logic.' },
          { offsetMs: -11_000, level: 'info', message: 'Spawned Lens (Reviewer) for continuous contract audits.' },
          { offsetMs: -4_000, level: 'debug', message: 'Reviewing edge animation state transitions.' },
        ],
        nowMs,
      ),
    },
    'bot-forge': {
      id: 'bot-forge',
      name: 'Forge',
      role: 'Coder',
      status: 'running',
      currentTask: 'Implement deterministic simulation tick reducer and log buffer capping',
      parentId: 'bot-vektor',
      childIds: [],
      depth: 2,
      createdAt: new Date(nowMs - 15_000).toISOString(),
      updatedAt: new Date(nowMs - 1_500).toISOString(),
      logs: makeStarterLogs(
        [
          { offsetMs: -15_000, level: 'info', message: 'Assigned implementation spec by Vektor.' },
          { offsetMs: -9_000, level: 'debug', message: 'Drafting immutable state helpers and log ring buffer.' },
          { offsetMs: -1_500, level: 'info', message: 'Integrating status transition guards for active workers.' },
        ],
        nowMs,
      ),
    },
    'bot-lens': {
      id: 'bot-lens',
      name: 'Lens',
      role: 'Reviewer',
      status: 'idle',
      currentTask: 'Await next implementation checkpoint from Forge for strict audit',
      parentId: 'bot-vektor',
      childIds: [],
      depth: 2,
      createdAt: new Date(nowMs - 11_000).toISOString(),
      updatedAt: new Date(nowMs - 5_000).toISOString(),
      logs: makeStarterLogs(
        [
          { offsetMs: -11_000, level: 'info', message: 'Initialized static analysis and type-contract checks.' },
          { offsetMs: -7_000, level: 'success', message: 'Verified initial schema alignment across modules.' },
          { offsetMs: -5_000, level: 'warn', message: 'Paused pending upstream build artifact from Forge.' },
        ],
        nowMs,
      ),
    },
  };

  return {
    bots,
    rootId,
    selectedBotId: rootId,
    isSimulating: true,
    tickCount: 0,
    layoutVersion: 0,
  };
}

export function advanceSimulationTick(
  state: BotSimulationState,
): BotSimulationState {
  const nowIso = new Date().toISOString();
  let nextBots: Record<string, BotEntity> = { ...state.bots };
  const botList = Object.values(nextBots);

  // 1. Append logs & rotate tasks on currently running bots
  for (const existing of botList) {
    if (existing.status !== 'running') {
      continue;
    }

    const updated = cloneBot(existing);
    const messagePool = ROLE_LOG_MESSAGES[updated.role];
    const pickedLog = pickRandom(messagePool);

    updated.logs = appendLog(
      updated.logs,
      pickedLog.level,
      pickedLog.message,
      nowIso,
    );

    if (Math.random() < 0.35) {
      updated.currentTask = pickDifferentTask(updated.role, updated.currentTask);
    }

    updated.updatedAt = nowIso;
    nextBots[updated.id] = updated;
  }

  // 2. Transition statuses cleanly
  const currentList = Object.values(nextBots);
  for (const existing of currentList) {
    if (existing.status === 'idle') {
      if (Math.random() < 0.35) {
        const updated = cloneBot(existing);
        updated.status = 'running';
        updated.currentTask = pickDifferentTask(updated.role, updated.currentTask);
        updated.logs = appendLog(
          updated.logs,
          'info',
          `Resumed execution: ${updated.currentTask}`,
          nowIso,
        );
        updated.updatedAt = nowIso;
        nextBots[updated.id] = updated;
      }
      continue;
    }

    if (existing.status === 'running' && existing.id !== state.rootId) {
      const childrenBusy = hasActiveChildren(existing, nextBots);
      const enoughWorkDone = existing.logs.length >= 6;
      const roll = Math.random();

      if (!childrenBusy && enoughWorkDone && roll < 0.18) {
        const updated = cloneBot(existing);
        updated.status = 'done';
        updated.logs = appendLog(
          updated.logs,
          'success',
          `Completed assigned task: ${updated.currentTask}`,
          nowIso,
        );
        updated.updatedAt = nowIso;
        nextBots[updated.id] = updated;
      } else if (roll >= 0.18 && roll < 0.3) {
        const updated = cloneBot(existing);
        updated.status = 'idle';
        updated.logs = appendLog(
          updated.logs,
          'warn',
          'Yielding execution slot while awaiting downstream signal.',
          nowIso,
        );
        updated.updatedAt = nowIso;
        nextBots[updated.id] = updated;
      }
    }
  }

  // 3. Dynamically spawn new child bots under eligible running parents
  const totalBots = Object.keys(nextBots).length;
  const runningBots = Object.values(nextBots).filter(
    (bot) => bot.status === 'running',
  );

  const eligibleParents = runningBots.filter(
    (bot) =>
      bot.depth < AUTO_MAX_DEPTH &&
      bot.childIds.length < MAX_AUTO_CHILDREN_PER_PARENT,
  );

  const shouldSpawn =
    totalBots < AUTO_MAX_BOTS &&
    eligibleParents.length > 0 &&
    (runningBots.length <= 2 || Math.random() < 0.48);

  if (shouldSpawn) {
    // Prefer deeper active workers occasionally so the mind map grows multi-level
    const nonRootEligible = eligibleParents.filter((b) => b.id !== state.rootId);
    const pool =
      nonRootEligible.length > 0 && Math.random() < 0.7
        ? nonRootEligible
        : eligibleParents;
    const parent = pickRandom(pool);
    const spawned = spawnChildUnderParent(nextBots, parent.id, nowIso, 'auto');
    nextBots = spawned.bots;
  }

  // 4. Keep orchestration lively if active running bots drop below 2
  const afterSpawnList = Object.values(nextBots);
  const activeCount = afterSpawnList.filter(
    (bot) => bot.status === 'running',
  ).length;

  if (activeCount < 2) {
    const idleCandidate = afterSpawnList.find((bot) => bot.status === 'idle');
    if (idleCandidate) {
      const woken = cloneBot(idleCandidate);
      woken.status = 'running';
      woken.currentTask = pickDifferentTask(woken.role, woken.currentTask);
      woken.logs = appendLog(
        woken.logs,
        'info',
        'Woken by orchestrator heartbeat to maintain active throughput.',
        nowIso,
      );
      woken.updatedAt = nowIso;
      nextBots[woken.id] = woken;
    } else if (
      Object.keys(nextBots).length < AUTO_MAX_BOTS &&
      nextBots[state.rootId]
    ) {
      const root = nextBots[state.rootId];
      if (root.status !== 'running') {
        const wokenRoot = cloneBot(root);
        wokenRoot.status = 'running';
        wokenRoot.logs = appendLog(
          wokenRoot.logs,
          'info',
          'Initiating next orchestration wave.',
          nowIso,
        );
        wokenRoot.updatedAt = nowIso;
        nextBots[root.id] = wokenRoot;
      }

      if (root.depth < AUTO_MAX_DEPTH) {
        const spawned = spawnChildUnderParent(nextBots, root.id, nowIso, 'auto');
        nextBots = spawned.bots;
      }
    }
  }

  return {
    ...state,
    bots: nextBots,
    tickCount: state.tickCount + 1,
  };
}

export function createManualChildBot(
  state: BotSimulationState,
  preferredParentId?: string,
): BotSimulationState {
  const nowIso = new Date().toISOString();

  const initialParent: BotEntity | undefined =
    (preferredParentId ? state.bots[preferredParentId] : undefined) ??
    (state.selectedBotId ? state.bots[state.selectedBotId] : undefined) ??
    Object.values(state.bots).find((bot) => bot.status === 'running') ??
    state.bots[state.rootId];

  if (!initialParent) {
    return state;
  }

  let parent: BotEntity = initialParent;

  // Respect manual depth cap cleanly by stepping up if a max-depth leaf is selected
  while (parent.depth >= MANUAL_MAX_DEPTH && parent.parentId) {
    const upper: BotEntity | undefined = state.bots[parent.parentId];
    if (!upper) {
      break;
    }
    parent = upper;
  }

  if (
    Object.keys(state.bots).length >= MANUAL_MAX_BOTS ||
    parent.depth >= MANUAL_MAX_DEPTH
  ) {
    const cappedParent = cloneBot(parent);
    cappedParent.logs = appendLog(
      cappedParent.logs,
      'warn',
      `Manual spawn skipped: safety cap (${MANUAL_MAX_BOTS} bots / depth ${MANUAL_MAX_DEPTH}) reached.`,
      nowIso,
    );
    cappedParent.updatedAt = nowIso;
    return {
      ...state,
      bots: {
        ...state.bots,
        [cappedParent.id]: cappedParent,
      },
    };
  }

  const { bots: nextBots, newBot } = spawnChildUnderParent(
    state.bots,
    parent.id,
    nowIso,
    'manual',
  );

  return {
    ...state,
    bots: nextBots,
    selectedBotId: newBot.id,
  };
}
