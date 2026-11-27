import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import type { BotEntity } from '../../types/bot';
import { StatusIcon } from '../common/StatusIcon';
import './BotNode.css';

export type BotFlowNodeData = {
  bot: BotEntity;
  isSelected: boolean;
};

export type BotFlowNode = Node<BotFlowNodeData, 'botNode'>;

/** Compact Graphite card: status glyph, deity name, role or live tool, sources & event count. */
function BotNodeComponent({ data }: NodeProps<BotFlowNode>) {
  const { bot, isSelected } = data;

  const classes = ['bot-node', `bot-node--${bot.status}`, isSelected ? 'is-selected' : '']
    .filter(Boolean)
    .join(' ');

  const showLiveTool = Boolean(bot.activeTool && (bot.status === 'running' || bot.status === 'waiting'));
  const subtitle = showLiveTool ? bot.activeTool! : bot.role;

  return (
    <div className={classes} title={`${bot.name}${bot.epithet ? ` — ${bot.epithet}` : ''}\n${bot.currentTask}`}>
      <Handle type="target" position={Position.Top} className="bot-node__handle" isConnectable={false} />
      <StatusIcon status={bot.status} />
      <span className="bot-node__text">
        <span className="bot-node__name">{bot.name}</span>
        <span className={`bot-node__sub ${showLiveTool ? `is-tool is-${bot.status}` : ''}`}>
          {subtitle}
        </span>
      </span>
      <span className="bot-node__stats">
        {bot.sources.length > 0 && (
          <span className="bot-node__sources mono" title={`${bot.sources.length} websites scraped`}>
            <Globe size={10} strokeWidth={1.8} aria-hidden="true" />
            {bot.sources.length}
          </span>
        )}
        <span className="bot-node__count mono" aria-label={`${bot.logs.length} events`}>
          {bot.logs.length}
        </span>
      </span>
      <Handle type="source" position={Position.Bottom} className="bot-node__handle" isConnectable={false} />
    </div>
  );
}

export const BotNode = memo(BotNodeComponent);
