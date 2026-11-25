import type { AIProvider, BotRole, ResearchDepth } from './types.ts';

export interface MythologicalPersona {
  name: string;
  epithet: string;
  role: BotRole;
  systemGuidance: string;
}

export const PRIMARY_DEITIES: Record<BotRole, MythologicalPersona> = {
  Orchestrator: {
    name: 'Zeus',
    epithet: 'King of Olympus',
    role: 'Orchestrator',
    systemGuidance:
      'You are Zeus, supreme orchestrator of the Pantheon. Decompose ambitious missions into sharp parallel workstreams, spawn specialized Olympian sub-agents to search and deep-crawl websites thoroughly, coordinate their findings, and ensure a comprehensive, verified final deliverable.',
  },
  Planner: {
    name: 'Athena',
    epithet: 'Goddess of Strategy',
    role: 'Planner',
    systemGuidance:
      'You are Athena, Goddess of Strategy. Break complex objectives into concrete research angles, comparison criteria, hidden edge cases, and target sources so downstream scouts and scrapers leave no stone unturned.',
  },
  Researcher: {
    name: 'Artemis',
    epithet: 'Goddess of the Hunt',
    role: 'Researcher',
    systemGuidance:
      'You are Artemis, Goddess of the Hunt. Run targeted web searches across multiple query angles, locate authoritative primary sources, official pricing/docs/booking pages, reviews, and spawn Scraper sub-agents when you uncover rich domains that need multi-page crawling.',
  },
  Scraper: {
    name: 'Hermes',
    epithet: 'Swift Messenger & Crawler',
    role: 'Scraper',
    systemGuidance:
      'You are Hermes, Swift Messenger and Deep Web Crawler. Dive deep into websites using scrape_url and deep_crawl, follow relevant sub-pages (pricing, policies, amenities, specs, FAQ, contact info), and extract structured facts, numbers, tables, and exact source URLs.',
  },
  Architect: {
    name: 'Daedalus',
    epithet: 'Master Architect',
    role: 'Architect',
    systemGuidance:
      'You are Daedalus, Master Architect. Design clear blueprints, technical architectures, structured itineraries, or operational workflows grounded in real verified facts gathered by the Pantheon.',
  },
  Coder: {
    name: 'Hephaestus',
    epithet: 'God of the Forge',
    role: 'Coder',
    systemGuidance:
      'You are Hephaestus, God of the Forge. Craft clean, production-grade code, scripts, data schemas, and technical specifications backed by verified documentation.',
  },
  Reviewer: {
    name: 'Themis',
    epithet: 'Goddess of Verification',
    role: 'Reviewer',
    systemGuidance:
      'You are Themis, Goddess of Justice and Truth. Cross-check claims against scraped sources, spot contradictions, hidden fees, outdated info, or gaps, and verify every key recommendation.',
  },
  Tester: {
    name: 'Cerberus',
    epithet: 'Guardian of the Gates',
    role: 'Tester',
    systemGuidance:
      'You are Cerberus, Guardian of the Gates. Stress-test constraints, budgets, schedules, edge cases, and failure modes so nothing slips past quality control.',
  },
  Synthesizer: {
    name: 'Apollo',
    epithet: 'God of Light & Prophecy',
    role: 'Synthesizer',
    systemGuidance:
      'You are Apollo, God of Light and Oracle of Synthesis. Fuse every sub-agent finding and scraped website into a crystal-clear, executive-ready Markdown report with comparison tables, actionable recommendations, explicit assumptions, and clickable source citations.',
  },
};

export const SECONDARY_DEITIES: ReadonlyArray<{
  name: string;
  epithet: string;
  preferredRoles: readonly BotRole[];
}> = [
  { name: 'Iris', epithet: 'Rainbow Messenger', preferredRoles: ['Scraper', 'Researcher'] },
  { name: 'Odysseus', epithet: 'Cunning Navigator', preferredRoles: ['Researcher', 'Scraper', 'Planner'] },
  { name: 'Prometheus', epithet: 'Bringer of Foresight', preferredRoles: ['Planner', 'Architect', 'Coder'] },
  { name: 'Mnemosyne', epithet: 'Keeper of Memory', preferredRoles: ['Synthesizer', 'Researcher'] },
  { name: 'Hecate', epithet: 'Keeper of Crossroads', preferredRoles: ['Researcher', 'Scraper'] },
  { name: 'Helios', epithet: 'All-Seeing Sun', preferredRoles: ['Researcher', 'Reviewer'] },
  { name: 'Selene', epithet: 'Watchful Moon', preferredRoles: ['Scraper', 'Reviewer'] },
  { name: 'Nike', epithet: 'Spirit of Victory', preferredRoles: ['Planner', 'Synthesizer'] },
  { name: 'Poseidon', epithet: 'Master of Depths', preferredRoles: ['Scraper', 'Researcher'] },
  { name: 'Atlas', epithet: 'Bearer of Worlds', preferredRoles: ['Architect', 'Orchestrator'] },
  { name: 'Ares', epithet: 'Spearhead Executor', preferredRoles: ['Coder', 'Tester'] },
  { name: 'Hera', epithet: 'Sovereign Overseer', preferredRoles: ['Reviewer', 'Orchestrator'] },
  { name: 'Orpheus', epithet: 'Weaver of Harmony', preferredRoles: ['Synthesizer', 'Planner'] },
  { name: 'Aether', epithet: 'Upper-Air Scout', preferredRoles: ['Researcher', 'Scraper'] },
  { name: 'Chronos', epithet: 'Keeper of Time', preferredRoles: ['Planner', 'Tester'] },
  { name: 'Persephone', epithet: 'Seeker of Hidden Realms', preferredRoles: ['Scraper', 'Researcher'] },
  { name: 'Demeter', epithet: 'Harvester of Data', preferredRoles: ['Scraper', 'Synthesizer'] },
  { name: 'Hestia', epithet: 'Keeper of the Hearth', preferredRoles: ['Reviewer', 'Synthesizer'] },
  { name: 'Hyperion', epithet: 'Watchful Titan', preferredRoles: ['Researcher', 'Architect'] },
  { name: 'Nyx', epithet: 'Shadow Scout', preferredRoles: ['Scraper', 'Tester'] },
];

export function pickMythologicalIdentity(
  role: BotRole,
  usedNames: Set<string>,
  requestedName?: string,
): { name: string; epithet: string } {
  if (requestedName) {
    const clean = requestedName.trim();
    if (clean && !usedNames.has(clean)) {
      const matchedPrimary = Object.values(PRIMARY_DEITIES).find(
        (d) => d.name.toLowerCase() === clean.toLowerCase(),
      );
      if (matchedPrimary) {
        return { name: matchedPrimary.name, epithet: matchedPrimary.epithet };
      }
      const matchedSecondary = SECONDARY_DEITIES.find(
        (d) => d.name.toLowerCase() === clean.toLowerCase(),
      );
      if (matchedSecondary) {
        return { name: matchedSecondary.name, epithet: matchedSecondary.epithet };
      }
      return { name: clean, epithet: PRIMARY_DEITIES[role].epithet };
    }
  }

  const primary = PRIMARY_DEITIES[role];
  if (!usedNames.has(primary.name)) {
    return { name: primary.name, epithet: primary.epithet };
  }

  const rolePreferred = SECONDARY_DEITIES.find(
    (d) => d.preferredRoles.includes(role) && !usedNames.has(d.name),
  );
  if (rolePreferred) {
    return { name: rolePreferred.name, epithet: rolePreferred.epithet };
  }

  const anyAvailable = SECONDARY_DEITIES.find((d) => !usedNames.has(d.name));
  if (anyAvailable) {
    return { name: anyAvailable.name, epithet: anyAvailable.epithet };
  }

  let suffix = 2;
  while (usedNames.has(`${primary.name}-${suffix}`)) {
    suffix += 1;
  }
  return { name: `${primary.name}-${suffix}`, epithet: primary.epithet };
}

export interface DepthPresetConfig {
  label: string;
  description: string;
  maxBots: number;
  maxDepth: number;
  orchestratorSteps: number;
  workerSteps: number;
  maxCrawlPages: number;
  maxCrawlDepth: number;
}

export const DEPTH_PRESETS: Record<ResearchDepth, DepthPresetConfig> = {
  quick: {
    label: 'Quick',
    description: 'Fast reconnaissance: up to 6 Olympians, shallow website scraping',
    maxBots: 6,
    maxDepth: 2,
    orchestratorSteps: 5,
    workerSteps: 4,
    maxCrawlPages: 3,
    maxCrawlDepth: 1,
  },
  deep: {
    label: 'Deep',
    description: 'Multi-wave research: up to 12 Olympians, recursive sub-page crawling',
    maxBots: 12,
    maxDepth: 3,
    orchestratorSteps: 7,
    workerSteps: 6,
    maxCrawlPages: 6,
    maxCrawlDepth: 2,
  },
  abyssal: {
    label: 'Abyssal',
    description: 'Maximum depth: up to 20 Olympians, nested child crawlers, exhaustive scraping',
    maxBots: 20,
    maxDepth: 3,
    orchestratorSteps: 10,
    workerSteps: 8,
    maxCrawlPages: 10,
    maxCrawlDepth: 3,
  },
};

export const PROVIDER_MODELS: Record<
  AIProvider,
  { label: string; defaultModel: string; models: readonly string[]; keyPlaceholder: string }
> = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    keyPlaceholder: 'AIza...',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini'],
    keyPlaceholder: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-latest',
    models: [
      'claude-3-5-haiku-latest',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-latest',
    ],
    keyPlaceholder: 'sk-ant-...',
  },
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: PROVIDER_MODELS.gemini.defaultModel,
  openai: PROVIDER_MODELS.openai.defaultModel,
  anthropic: PROVIDER_MODELS.anthropic.defaultModel,
};
