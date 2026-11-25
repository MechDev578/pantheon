import {
  pickMythologicalIdentity,
  PRIMARY_DEITIES,
} from '../../engine/pantheonRoster';
import type {
  BotEntity,
  BotLogEntry,
  BotRole,
  BotSimulationState,
  LogLevel,
  ScrapedSource,
} from '../types/bot';

const AUTO_MAX_BOTS = 20;
const AUTO_MAX_DEPTH = 3;
const MANUAL_MAX_BOTS = 36;
const MANUAL_MAX_DEPTH = 4;
const MAX_LOGS_PER_BOT = 120;
const MAX_AUTO_CHILDREN_PER_PARENT = 4;

const CHILD_ROLE_MAP: Record<BotRole, readonly BotRole[]> = {
  Orchestrator: ['Planner', 'Researcher', 'Scraper', 'Architect'],
  Planner: ['Researcher', 'Scraper', 'Architect'],
  Researcher: ['Scraper', 'Synthesizer', 'Reviewer'],
  Scraper: ['Scraper', 'Reviewer', 'Synthesizer'],
  Architect: ['Coder', 'Reviewer'],
  Coder: ['Tester', 'Reviewer'],
  Reviewer: ['Scraper', 'Synthesizer'],
  Tester: ['Synthesizer', 'Reviewer'],
  Synthesizer: ['Reviewer'],
};

const ROLE_TASK_POOLS: Record<BotRole, readonly string[]> = {
  Orchestrator: [
    'Coordinate Olympian swarm across multi-site web discovery & deep scraping',
    'Rebalance crawler priorities and monitor child bot source extraction',
    'Aggregate verified pricing, policies, and deep site findings from sub-agents',
    'Dispatch follow-up Olympians to close remaining research gaps',
  ],
  Planner: [
    'Decompose user objective into parallel website scouting & comparison tracks',
    'Build evaluation rubric covering pricing, hidden fees, location, and ratings',
    'Sequence dependency gates for deep crawlers and fact verifiers',
  ],
  Researcher: [
    'Hunt official websites, booking portals, and independent review threads',
    'Query multiple search angles to surface primary listings and direct rates',
    'Cross-check availability, neighborhood reviews, and hidden policies',
  ],
  Scraper: [
    'Deep-crawl target website sub-pages (/rooms, /pricing, /amenities, /faq)',
    'Extract structured pricing tables, cancellation rules, and contact details',
    'Follow internal links to uncover unlisted fees and direct-booking perks',
  ],
  Architect: [
    'Structure multi-day itinerary and logistics matrix from verified sources',
    'Design comparison schema mapping cost, quality, and distance trade-offs',
  ],
  Coder: [
    'Normalize scraped HTML tables into structured JSON comparison objects',
    'Build reusable extraction selectors for dynamic listing pages',
  ],
  Reviewer: [
    'Cross-verify scraped prices against official booking and policy pages',
    'Audit sources for stale listings, hidden taxes, or contradictory reviews',
  ],
  Tester: [
    'Validate budget constraints, transit times, and booking edge cases',
    'Verify every recommendation has at least two independent live URLs',
  ],
  Synthesizer: [
    'Fuse all Olympian dossiers into an executive comparison report with citations',
    'Compile ranked shortlist with clickable official links and transparent assumptions',
  ],
};

const ROLE_ACTIVE_TOOLS: Record<BotRole, readonly string[]> = {
  Orchestrator: ['Coordinating swarm', 'Monitoring Olympians', 'Delegating wave'],
  Planner: ['Structuring rubric', 'Mapping research tracks'],
  Researcher: ['Searching web', 'Ranking primary URLs', 'Discovering leads'],
  Scraper: ['Deep crawling site', 'Extracting tables', 'Following sub-links'],
  Architect: ['Designing blueprint', 'Mapping dependencies'],
  Coder: ['Building parser', 'Normalizing schema'],
  Reviewer: ['Fact-checking claims', 'Verifying prices'],
  Tester: ['Checking constraints', 'Auditing citations'],
  Synthesizer: ['Composing report', 'Formatting tables'],
};

const ROLE_LOG_MESSAGES: Record<
  BotRole,
  ReadonlyArray<{ level: LogLevel; message: string }>
> = {
  Orchestrator: [
    { level: 'info', message: 'Evaluated active Olympian branches; parallel throughput nominal.' },
    { level: 'thought', message: 'Checking if additional deep crawlers are needed on top domains.' },
    { level: 'success', message: 'Upstream discovery milestone confirmed across active scouts.' },
    { level: 'warn', message: 'Detected slight rate limit on one host; redistributing crawl depth.' },
  ],
  Planner: [
    { level: 'thought', message: 'Refined comparison dimensions: total cost, proximity, cancellation terms.' },
    { level: 'info', message: 'Published parallel research tracks for Artemis and Hermes.' },
    { level: 'success', message: 'Locked evaluation checklist for downstream verifiers.' },
  ],
  Researcher: [
    { level: 'tool', message: 'Searching web: official direct booking pages & verified guest reviews' },
    { level: 'info', message: 'Surfaced 9 high-authority candidate URLs for deep crawling.' },
    { level: 'success', message: 'Filtered out aggregators; prioritized primary source domains.' },
  ],
  Scraper: [
    { level: 'tool', message: 'Deep crawling /pricing, /amenities, and /policies sub-pages' },
    { level: 'info', message: 'Extracted structured rate table (1,840 words, 24 internal links).' },
    { level: 'success', message: 'Captured direct contact info and cancellation policy details.' },
    { level: 'warn', message: 'Encountered cookie modal; parsed semantic main content directly.' },
  ],
  Architect: [
    { level: 'thought', message: 'Organizing findings into weighted decision matrix and day-by-day plan.' },
    { level: 'info', message: 'Mapped transit durations and geographic clusters.' },
  ],
  Coder: [
    { level: 'tool', message: 'Parsing structured HTML specification tables into clean Markdown.' },
    { level: 'success', message: 'Normalized currency units and fee breakdowns cleanly.' },
  ],
  Reviewer: [
    { level: 'info', message: 'Cross-checked direct website rate against third-party listing.' },
    { level: 'warn', message: 'Flagged local city tax not included in headline nightly rate.' },
    { level: 'success', message: 'All 6 cited URLs verified active and consistent.' },
  ],
  Tester: [
    { level: 'info', message: 'Validated total budget and schedule feasibility across top picks.' },
    { level: 'success', message: 'Zero broken links or constraint violations detected.' },
  ],
  Synthesizer: [
    { level: 'thought', message: 'Merging scraped dossiers from Hermes, Iris, and Artemis.' },
    { level: 'success', message: 'Updated executive report with ranked comparison table & citations.' },
  ],
};

const DEMO_SAMPLE_DOMAINS: ReadonlyArray<{ domain: string; title: string; path: string; excerpt: string }> = [
  {
    domain: 'visitlisboa.com',
    title: 'Official Lisbon Neighborhood & Boutique Stay Guide',
    path: '/en/stay/alfama-historic-quarter',
    excerpt: 'Historic Alfama district guide covering boutique guesthouses, tram 28 access, and seasonal tourist tax details.',
  },
  {
    domain: 'alma-lusa.com',
    title: 'AlmaLusa Baixa/Chiado — Direct Rates & Policies',
    path: '/rooms-and-rates',
    excerpt: 'Direct booking includes flexible 48-hour cancellation, complimentary breakfast options, and walkability to Alfama.',
  },
  {
    domain: 'santiagodealfama.com',
    title: 'Santiago de Alfama Boutique Hotel — Rooms & Amenities',
    path: '/en/amenities-and-faq',
    excerpt: '5-star historic boutique property steps from Miradouro de Santa Luzia with direct reservation perks and airport transfer rates.',
  },
  {
    domain: 'casadobarao.pt',
    title: 'Casa do Barão — Boutique Guesthouse & Courtyard Pool',
    path: '/policies-and-rates',
    excerpt: '18th-century townhouse offering quiet suites, daily breakfast buffet, and transparent seasonal pricing.',
  },
  {
    domain: 'memmohotels.com',
    title: 'Memmo Alfama Hotel — Terrace & Direct Offers',
    path: '/alfama/offers',
    excerpt: 'Adults-oriented design hotel overlooking the Tagus River with wine bar terrace and clear cancellation windows.',
  },
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
  return nextLogs.length > MAX_LOGS_PER_BOT
    ? nextLogs.slice(nextLogs.length - MAX_LOGS_PER_BOT)
    : nextLogs;
}

function makeDemoSource(nowIso: string, depth: number): ScrapedSource {
  const sample = pickRandom(DEMO_SAMPLE_DOMAINS);
  return {
    id: nextUniqueId('src'),
    url: `https://${sample.domain}${sample.path}`,
    title: sample.title,
    domain: sample.domain,
    scrapedAt: nowIso,
    wordCount: 650 + Math.floor(Math.random() * 1900),
    excerpt: sample.excerpt,
    linksFound: 8 + Math.floor(Math.random() * 28),
    depth,
    status: 'ok',
  };
}

function cloneBot(bot: BotEntity): BotEntity {
  return {
    ...bot,
    childIds: [...bot.childIds],
    logs: [...bot.logs],
    sources: [...bot.sources],
  };
}

function hasActiveChildren(bot: BotEntity, bots: Record<string, BotEntity>): boolean {
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
  overrideRole?: BotRole,
  overrideTask?: string,
): { bots: Record<string, BotEntity>; newBot: BotEntity } {
  const parent = cloneBot(bots[parentId]);
  const childRole = overrideRole ?? pickRandom(CHILD_ROLE_MAP[parent.role]);
  const usedNames = new Set(Object.values(bots).map((b) => b.name));
  const identity = pickMythologicalIdentity(childRole, usedNames);
  const childTask = overrideTask?.trim() || pickRandom(ROLE_TASK_POOLS[childRole]);
  const childId = nextUniqueId('bot');

  const initialLogs: BotLogEntry[] = [
    {
      id: nextUniqueId('log'),
      timestamp: nowIso,
      level: 'info',
      message:
        reasonLabel === 'manual'
          ? `Summoned by operator under ${parent.name} (${parent.role}).`
          : `Deployed by ${parent.name} (${parent.role}) for parallel subtask.`,
    },
    {
      id: nextUniqueId('log'),
      timestamp: nowIso,
      level: 'debug',
      message: `Directive: ${childTask}`,
    },
  ];

  const newBot: BotEntity = {
    id: childId,
    name: identity.name,
    epithet: identity.epithet,
    role: childRole,
    status: 'running',
    currentTask: childTask,
    activeTool: pickRandom(ROLE_ACTIVE_TOOLS[childRole]),
    parentId: parent.id,
    childIds: [],
    depth: parent.depth + 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    logs: initialLogs,
    sources: childRole === 'Scraper' || childRole === 'Researcher' ? [makeDemoSource(nowIso, 0)] : [],
  };

  if (parent.status !== 'running') {
    parent.status = 'running';
    parent.logs = appendLog(
      parent.logs,
      'info',
      `Reactivated to coordinate newly deployed Olympian ${newBot.name}.`,
      nowIso,
    );
  }

  parent.childIds.push(newBot.id);
  parent.updatedAt = nowIso;
  parent.logs = appendLog(
    parent.logs,
    'success',
    `Deployed ${newBot.name} (${newBot.role}): ${newBot.currentTask}`,
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
  const rootId = 'bot-zeus';

  const bots: Record<string, BotEntity> = {
    [rootId]: {
      id: rootId,
      name: PRIMARY_DEITIES.Orchestrator.name,
      epithet: PRIMARY_DEITIES.Orchestrator.epithet,
      role: 'Orchestrator',
      status: 'running',
      currentTask: 'Orchestrate Greek Pantheon swarm to deep-research & compare live web sources (Demo Mode)',
      activeTool: 'Coordinating swarm',
      parentId: null,
      childIds: ['bot-athena', 'bot-artemis', 'bot-hermes'],
      depth: 0,
      createdAt: new Date(nowMs - 45_000).toISOString(),
      updatedAt: new Date(nowMs - 2_000).toISOString(),
      sources: [],
      logs: makeStarterLogs(
        [
          { offsetMs: -45_000, level: 'info', message: 'Olympus demo swarm initialized — configure an API key in Settings to run live AI missions!' },
          { offsetMs: -36_000, level: 'success', message: 'Deployed Athena (Planner) to build evaluation criteria.' },
          { offsetMs: -24_000, level: 'success', message: 'Deployed Artemis (Researcher) and Hermes (Scraper) in parallel.' },
          { offsetMs: -2_000, level: 'thought', message: 'Monitoring deep website crawl progress across child Olympians.' },
        ],
        nowMs,
      ),
    },
    'bot-athena': {
      id: 'bot-athena',
      name: PRIMARY_DEITIES.Planner.name,
      epithet: PRIMARY_DEITIES.Planner.epithet,
      role: 'Planner',
      status: 'done',
      currentTask: 'Define research criteria, hidden-fee checks, and source verification strategy',
      activeTool: null,
      parentId: rootId,
      childIds: [],
      depth: 1,
      createdAt: new Date(nowMs - 36_000).toISOString(),
      updatedAt: new Date(nowMs - 14_000).toISOString(),
      sources: [],
      output:
        '### Strategic Plan (Demo)\n- Compare official website direct rates vs OTA listings\n- Crawl `/policies` and `/faq` for hidden taxes & cancellation windows\n- Cross-verify walkability and guest sentiment across 2+ independent sources',
      logs: makeStarterLogs(
        [
          { offsetMs: -36_000, level: 'info', message: 'Received mission strategy directive from Zeus.' },
          { offsetMs: -22_000, level: 'thought', message: 'Mapped 4 research angles and target URL patterns.' },
          { offsetMs: -14_000, level: 'success', message: 'Strategy complete; handed rubric off to Artemis & Hermes.' },
        ],
        nowMs,
      ),
    },
    'bot-artemis': {
      id: 'bot-artemis',
      name: PRIMARY_DEITIES.Researcher.name,
      epithet: PRIMARY_DEITIES.Researcher.epithet,
      role: 'Researcher',
      status: 'running',
      currentTask: 'Hunt official websites, direct booking pages, and neighborhood reviews',
      activeTool: 'Searching web',
      parentId: rootId,
      childIds: ['bot-iris'],
      depth: 1,
      createdAt: new Date(nowMs - 24_000).toISOString(),
      updatedAt: new Date(nowMs - 3_000).toISOString(),
      sources: [makeDemoSource(new Date(nowMs - 12_000).toISOString(), 0)],
      logs: makeStarterLogs(
        [
          { offsetMs: -24_000, level: 'tool', message: 'Searching web: boutique hotels Alfama Lisbon official sites' },
          { offsetMs: -15_000, level: 'info', message: 'Discovered 8 primary hotel domains with direct booking pages.' },
          { offsetMs: -9_000, level: 'success', message: 'Spawned Iris (Scraper) to deep-crawl Memmo & Casa do Barão.' },
        ],
        nowMs,
      ),
    },
    'bot-hermes': {
      id: 'bot-hermes',
      name: PRIMARY_DEITIES.Scraper.name,
      epithet: PRIMARY_DEITIES.Scraper.epithet,
      role: 'Scraper',
      status: 'running',
      currentTask: 'Deep-crawl official property websites for pricing, amenities, and cancellation rules',
      activeTool: 'Deep crawling site',
      parentId: rootId,
      childIds: ['bot-themis'],
      depth: 1,
      createdAt: new Date(nowMs - 24_000).toISOString(),
      updatedAt: new Date(nowMs - 2_000).toISOString(),
      sources: [
        makeDemoSource(new Date(nowMs - 14_000).toISOString(), 0),
        makeDemoSource(new Date(nowMs - 6_000).toISOString(), 1),
      ],
      logs: makeStarterLogs(
        [
          { offsetMs: -24_000, level: 'tool', message: 'Deep crawling santiagodealfama.com (depth 2, focus: rates, policies)' },
          { offsetMs: -14_000, level: 'success', message: 'Scraped rooms & direct-booking benefits table (1,420 words).' },
          { offsetMs: -6_000, level: 'info', message: 'Following internal link to /amenities-and-faq.' },
        ],
        nowMs,
      ),
    },
    'bot-iris': {
      id: 'bot-iris',
      name: 'Iris',
      epithet: 'Rainbow Messenger',
      role: 'Scraper',
      status: 'running',
      currentTask: 'Crawl sub-pages for hidden tourist taxes, breakfast inclusions, and transfer fees',
      activeTool: 'Extracting tables',
      parentId: 'bot-artemis',
      childIds: [],
      depth: 2,
      createdAt: new Date(nowMs - 9_000).toISOString(),
      updatedAt: new Date(nowMs - 1_500).toISOString(),
      sources: [makeDemoSource(new Date(nowMs - 4_000).toISOString(), 1)],
      logs: makeStarterLogs(
        [
          { offsetMs: -9_000, level: 'info', message: 'Summoned by Artemis for parallel site extraction.' },
          { offsetMs: -4_000, level: 'tool', message: 'Scraping memmohotels.com/alfama/offers' },
        ],
        nowMs,
      ),
    },
    'bot-themis': {
      id: 'bot-themis',
      name: PRIMARY_DEITIES.Reviewer.name,
      epithet: PRIMARY_DEITIES.Reviewer.epithet,
      role: 'Reviewer',
      status: 'waiting',
      currentTask: 'Await remaining rate tables from Hermes to cross-verify total stay costs',
      activeTool: 'Awaiting Hermes',
      parentId: 'bot-hermes',
      childIds: [],
      depth: 2,
      createdAt: new Date(nowMs - 10_000).toISOString(),
      updatedAt: new Date(nowMs - 4_000).toISOString(),
      sources: [],
      logs: makeStarterLogs(
        [
          { offsetMs: -10_000, level: 'info', message: 'Initialized cross-source fact verification rules.' },
          { offsetMs: -4_000, level: 'warn', message: 'Waiting on next scraped tariff page from Hermes.' },
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

export function advanceSimulationTick(state: BotSimulationState): BotSimulationState {
  const nowIso = new Date().toISOString();
  let nextBots: Record<string, BotEntity> = { ...state.bots };

  for (const existing of Object.values(nextBots)) {
    if (existing.status !== 'running') continue;

    const updated = cloneBot(existing);
    const pickedLog = pickRandom(ROLE_LOG_MESSAGES[updated.role]);
    updated.logs = appendLog(updated.logs, pickedLog.level, pickedLog.message, nowIso);
    updated.activeTool = pickRandom(ROLE_ACTIVE_TOOLS[updated.role]);

    if (
      (updated.role === 'Scraper' || updated.role === 'Researcher') &&
      updated.sources.length < 6 &&
      Math.random() < 0.38
    ) {
      updated.sources = [...updated.sources, makeDemoSource(nowIso, Math.min(updated.depth, 2))];
    }

    if (Math.random() < 0.3) {
      updated.currentTask = pickDifferentTask(updated.role, updated.currentTask);
    }

    updated.updatedAt = nowIso;
    nextBots[updated.id] = updated;
  }

  for (const existing of Object.values(nextBots)) {
    if (existing.status === 'idle' || existing.status === 'waiting') {
      if (Math.random() < 0.4) {
        const updated = cloneBot(existing);
        updated.status = 'running';
        updated.activeTool = pickRandom(ROLE_ACTIVE_TOOLS[updated.role]);
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

      if (!childrenBusy && enoughWorkDone && roll < 0.16) {
        const updated = cloneBot(existing);
        updated.status = 'done';
        updated.activeTool = null;
        updated.logs = appendLog(
          updated.logs,
          'success',
          `Completed directive: ${updated.currentTask}`,
          nowIso,
        );
        updated.updatedAt = nowIso;
        nextBots[updated.id] = updated;
      } else if (roll >= 0.16 && roll < 0.26) {
        const updated = cloneBot(existing);
        updated.status = 'waiting';
        updated.activeTool = 'Awaiting peer signal';
        updated.logs = appendLog(
          updated.logs,
          'warn',
          'Paused briefly while awaiting upstream verification.',
          nowIso,
        );
        updated.updatedAt = nowIso;
        nextBots[updated.id] = updated;
      }
    }
  }

  const totalBots = Object.keys(nextBots).length;
  const runningBots = Object.values(nextBots).filter((bot) => bot.status === 'running');
  const eligibleParents = runningBots.filter(
    (bot) => bot.depth < AUTO_MAX_DEPTH && bot.childIds.length < MAX_AUTO_CHILDREN_PER_PARENT,
  );

  if (
    totalBots < AUTO_MAX_BOTS &&
    eligibleParents.length > 0 &&
    (runningBots.length <= 2 || Math.random() < 0.44)
  ) {
    const nonRoot = eligibleParents.filter((b) => b.id !== state.rootId);
    const pool = nonRoot.length > 0 && Math.random() < 0.68 ? nonRoot : eligibleParents;
    const parent = pickRandom(pool);
    nextBots = spawnChildUnderParent(nextBots, parent.id, nowIso, 'auto').bots;
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
  role?: BotRole,
  task?: string,
): BotSimulationState {
  const nowIso = new Date().toISOString();
  const initialParent =
    (preferredParentId ? state.bots[preferredParentId] : undefined) ??
    (state.selectedBotId ? state.bots[state.selectedBotId] : undefined) ??
    Object.values(state.bots).find((b) => b.status === 'running') ??
    state.bots[state.rootId];

  if (!initialParent) return state;

  let parent: BotEntity = initialParent;
  while (parent.depth >= MANUAL_MAX_DEPTH && parent.parentId) {
    const upper: BotEntity | undefined = state.bots[parent.parentId];
    if (!upper) break;
    parent = upper;
  }

  if (Object.keys(state.bots).length >= MANUAL_MAX_BOTS || parent.depth >= MANUAL_MAX_DEPTH) {
    return state;
  }

  const { bots: nextBots, newBot } = spawnChildUnderParent(
    state.bots,
    parent.id,
    nowIso,
    'manual',
    role,
    task,
  );

  return {
    ...state,
    bots: nextBots,
    selectedBotId: newBot.id,
  };
}
