import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  Activity,
  Code2,
  Compass,
  Crown,
  Eye,
  FlaskConical,
  GitFork,
  Globe,
  Layers,
  Radar,
  ScrollText,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { BotEntity, BotRole, BotStatus } from '../../types/bot';
import './BotNode.css';

export type BotFlowNodeData = {
  bot: BotEntity;
  isSelected: boolean;
};

export type BotFlowNode = Node<BotFlowNodeData, 'botNode'>;

const ROLE_ICON_MAP: Record<BotRole, LucideIcon> = {
  Orchestrator: Crown,
  Planner: Compass,
  Researcher: Search,
  Scraper: Radar,
  Architect: Layers,
  Coder: Code2,
  Reviewer: Eye,
  Tester: FlaskConical,
  Synthesizer: Sparkles,
};

const STATUS_LABEL_MAP: Record<BotStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  done: 'Done',
  error: 'Error',
};

function BotNodeComponent({ data }: NodeProps<BotFlowNode>) {
  const { bot, isSelected } = data;
  const RoleIcon = ROLE_ICON_MAP[bot.role] ?? Search;

  const cardClasses = [
    'bot-node',
    `bot-node--${bot.status}`,
    isSelected ? 'bot-node--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses}>
      <Handle
        type="target"
        position={Position.Top}
        className="bot-node__handle bot-node__handle--target"
        isConnectable={false}
      />

      <div className="bot-node__header">
        <div className="bot-node__identity">
          <span
            className={`bot-node__icon bot-node__icon--${bot.status}`}
            aria-hidden="true"
          >
            <RoleIcon size={15} strokeWidth={2.1} />
          </span>
          <div className="bot-node__titles">
            <div className="bot-node__name-line">
              <span className="bot-node__name" title={bot.name}>
                {bot.name}
              </span>
              <span className="bot-node__role">{bot.role}</span>
            </div>
            {bot.epithet && (
              <span className="bot-node__epithet" title={bot.epithet}>
                {bot.epithet}
              </span>
            )}
          </div>
        </div>

        <span className={`bot-node__status bot-node__status--${bot.status}`}>
          <span className="bot-node__status-dot" aria-hidden="true" />
          <span>{STATUS_LABEL_MAP[bot.status]}</span>
        </span>
      </div>

      <p className="bot-node__task" title={bot.currentTask}>
        {bot.currentTask}
      </p>

      {bot.activeTool && (bot.status === 'running' || bot.status === 'waiting') && (
        <div className={`bot-node__tool bot-node__tool--${bot.status}`} title={bot.activeTool}>
          <Activity size={11} className="bot-node__tool-icon" />
          <span className="bot-node__tool-text">{bot.activeTool}</span>
        </div>
      )}

      <div className="bot-node__footer">
        <span className="bot-node__depth">L{bot.depth}</span>
        <div className="bot-node__metrics">
          <span className="bot-node__metric" title={`${bot.childIds.length} child bots`}>
            <GitFork size={11} aria-hidden="true" />
            <span>{bot.childIds.length}</span>
          </span>
          <span
            className={`bot-node__metric ${bot.sources.length > 0 ? 'bot-node__metric--sources' : ''}`}
            title={`${bot.sources.length} websites scraped`}
          >
            <Globe size={11} aria-hidden="true" />
            <span>{bot.sources.length}</span>
          </span>
          <span className="bot-node__metric" title={`${bot.logs.length} log entries`}>
            <ScrollText size={11} aria-hidden="true" />
            <span>{bot.logs.length}</span>
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="bot-node__handle bot-node__handle--source"
        isConnectable={false}
      />
    </div>
  );
}

export const BotNode = memo(BotNodeComponent);
