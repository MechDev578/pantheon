import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { BotStatus } from '../../types/bot';
import './BotEdge.css';

export type BotFlowEdgeData = {
  isActive: boolean;
  targetStatus: BotStatus;
};

export type BotFlowEdge = Edge<BotFlowEdgeData, 'botEdge'>;

export function BotEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<BotFlowEdge>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const targetStatus: BotStatus = data?.targetStatus ?? 'idle';
  const isActive = Boolean(data?.isActive);

  const edgeClassName = [
    'bot-edge-path',
    isActive ? 'bot-edge-path--active' : `bot-edge-path--${targetStatus}`,
  ].join(' ');

  return <BaseEdge id={id} path={edgePath} className={edgeClassName} />;
}
