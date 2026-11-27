import {
  Code,
  Compass,
  Cpu,
  Eye,
  FlaskConical,
  GitMerge,
  Layers,
  Search,
  type LucideIcon,
} from 'lucide-react';
import type { BotRole } from '../../types/bot';

export const ROLE_ICONS: Record<BotRole, LucideIcon> = {
  Orchestrator: Cpu,
  Planner: Compass,
  Researcher: Search,
  Architect: Layers,
  Coder: Code,
  Reviewer: Eye,
  Tester: FlaskConical,
  Synthesizer: GitMerge,
};
