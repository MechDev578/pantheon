import { useCallback, useEffect, useRef, type MouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type OnNodeDrag,
  type XYPosition,
} from '@xyflow/react';
import type { BotGraphCanvasProps, BotStatus } from '../../types/bot';
import { computeTreeLayout } from '../../utils/treeLayout';
import { BotEdge, type BotFlowEdge } from './BotEdge';
import { BotNode, type BotFlowNode } from './BotNode';
import './BotGraphCanvas.css';

const nodeTypes = {
  botNode: BotNode,
};

const edgeTypes = {
  botEdge: BotEdge,
};

const MINIMAP_STATUS_COLOR: Record<BotStatus, string> = {
  running: '#22d3ee',
  waiting: '#a78bfa',
  idle: '#f59e0b',
  done: '#10b981',
  error: '#f87171',
};

function BotGraphCanvasInner({
  bots,
  rootId,
  selectedBotId,
  layoutVersion,
  onSelectBot,
}: BotGraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BotFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BotFlowEdge>([]);
  const { fitView } = useReactFlow<BotFlowNode, BotFlowEdge>();

  const pinnedPositionsRef = useRef<Record<string, XYPosition>>({});
  const prevLayoutVersionRef = useRef<number>(layoutVersion);
  const prevBotCountRef = useRef<number>(0);

  useEffect(() => {
    const layoutChanged = prevLayoutVersionRef.current !== layoutVersion;
    if (layoutChanged) {
      pinnedPositionsRef.current = {};
      prevLayoutVersionRef.current = layoutVersion;
    }

    const existingPins = pinnedPositionsRef.current;
    for (const pinnedId of Object.keys(existingPins)) {
      if (!bots[pinnedId]) {
        delete existingPins[pinnedId];
      }
    }

    const computedPositions = computeTreeLayout(bots, rootId);
    const botList = Object.values(bots);

    const nextNodes: BotFlowNode[] = botList.map((bot) => {
      const position = existingPins[bot.id] ?? computedPositions[bot.id] ?? { x: 0, y: 0 };
      const isSelected = bot.id === selectedBotId;

      return {
        id: bot.id,
        type: 'botNode',
        position,
        selected: isSelected,
        data: {
          bot,
          isSelected,
        },
      };
    });

    const nextEdges: BotFlowEdge[] = [];
    for (const bot of botList) {
      if (bot.parentId && bots[bot.parentId]) {
        nextEdges.push({
          id: `${bot.parentId}->${bot.id}`,
          source: bot.parentId,
          target: bot.id,
          type: 'botEdge',
          data: {
            isActive: bot.status === 'running',
            targetStatus: bot.status,
          },
        });
      }
    }

    setNodes(nextNodes);
    setEdges(nextEdges);

    const countGrew = botList.length !== prevBotCountRef.current;
    prevBotCountRef.current = botList.length;

    if (layoutChanged || (countGrew && Object.keys(existingPins).length === 0)) {
      const frameId = requestAnimationFrame(() => {
        void fitView({ padding: 0.22, duration: 350 });
      });
      return () => cancelAnimationFrame(frameId);
    }

    return undefined;
  }, [bots, rootId, selectedBotId, layoutVersion, setNodes, setEdges, fitView]);

  const handleNodeDragStop: OnNodeDrag<BotFlowNode> = useCallback((_event, node) => {
    pinnedPositionsRef.current[node.id] = { ...node.position };
  }, []);

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: BotFlowNode) => {
      onSelectBot(node.id);
    },
    [onSelectBot],
  );

  const handlePaneClick = useCallback(() => {
    onSelectBot(null);
  }, [onSelectBot]);

  const getMiniMapNodeColor = useCallback((node: BotFlowNode): string => {
    return MINIMAP_STATUS_COLOR[node.data.bot.status];
  }, []);

  return (
    <div className="bot-graph-canvas">
      <ReactFlow<BotFlowNode, BotFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.18}
        maxZoom={1.75}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={getMiniMapNodeColor}
          nodeStrokeWidth={2}
          maskColor="rgba(11, 15, 23, 0.72)"
        />
      </ReactFlow>
    </div>
  );
}

export function BotGraphCanvas(props: BotGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <BotGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
