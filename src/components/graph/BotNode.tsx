import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { BotEntity } from '../../types/bot';
import { StatusIcon } from '../common/StatusIcon';
import './BotNode.css';

export type BotFlowNodeData = {
  bot: BotEntity;
  isSelected: boolean;
};

export type BotFlowNode = Node<BotFlowNodeData, 'botNode'>;

/** Compact card: status, name, role, event count. The task lives in the details drawer. */
function BotNodeComponent({ data }: NodeProps<BotFlowNode>) {
  const { bot, isSelected } = data;

  const classes = ['bot-node', `bot-node--${bot.status}`, isSelected ? 'is-selected' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} title={bot.currentTask}>
      <Handle type="target" position={Position.Top} className="bot-node__handle" isConnectable={false} />
      <StatusIcon status={bot.status} />
      <span className="bot-node__text">
        <span className="bot-node__name">{bot.name}</span>
        <span className="bot-node__role">{bot.role}</span>
      </span>
      <span className="bot-node__count mono" aria-label={`${bot.logs.length} events`}>
        {bot.logs.length}
      </span>
      <Handle type="source" position={Position.Bottom} className="bot-node__handle" isConnectable={false} />
    </div>
  );
}

export const BotNode = memo(BotNodeComponent);
