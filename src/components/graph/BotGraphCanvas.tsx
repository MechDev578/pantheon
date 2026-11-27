import { memo, useCallback, useEffect, useRef, type MouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useViewport,
  type OnNodeDrag,
  type XYPosition,
} from '@xyflow/react';
import { Maximize, Minus, Network, Plus } from 'lucide-react';
import type { BotGraphCanvasProps } from '../../types/bot';
import { computeTreeLayout, NODE_HEIGHT, NODE_WIDTH } from '../../utils/treeLayout';
import { isTypingTarget } from '../../utils/keyboard';
import { BotEdge, type BotFlowEdge } from './BotEdge';
import { BotNode, type BotFlowNode } from './BotNode';
import './BotGraphCanvas.css';

const nodeTypes = { botNode: BotNode };
const edgeTypes = { botEdge: BotEdge };
const FIT_OPTIONS = { padding: 0.25, duration: 400, maxZoom: 1.1 };
const LAYOUT_ANIMATION_MS = 420;

function MapToolbar({ onAutoLayout }: { onAutoLayout: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="map-toolbar" role="toolbar" aria-label="Map tools">
      <button type="button" className="btn btn-ghost" onClick={onAutoLayout} title="Re-run the tree layout and fit the view">
        <Network strokeWidth={1.6} />
        <span>Tidy up</span>
      </button>
      <span className="divider-v" aria-hidden="true" />
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => void zoomOut({ duration: 150 })} aria-label="Zoom out">
        <Minus strokeWidth={1.6} />
      </button>
      <span className="map-toolbar__zoom mono" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => void zoomIn({ duration: 150 })} aria-label="Zoom in">
        <Plus strokeWidth={1.6} />
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => void fitView(FIT_OPTIONS)} aria-label="Fit to view" title="Fit to view  F">
        <Maximize strokeWidth={1.6} />
      </button>
    </div>
  );
}

function BotGraphCanvasInner({
  bots,
  rootId,
  selectedBotId,
  layoutVersion,
  focusRequest,
  onSelectBot,
  onAutoLayout,
}: BotGraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BotFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BotFlowEdge>([]);
  const { fitView, setCenter, getNode, getZoom } = useReactFlow<BotFlowNode, BotFlowEdge>();

  const pinnedPositionsRef = useRef<Record<string, XYPosition>>({});
  const prevLayoutVersionRef = useRef<number>(layoutVersion);
  /** Where each node is drawn right now, including mid-animation. */
  const displayedRef = useRef<Record<string, XYPosition>>({});
  const animationRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    },
    [],
  );

  // Frame the tree once React Flow has measured the nodes. The built-in
  // `fitView` prop can run before measurement and leave the tree off-centre.
  const nodesInitialized = useNodesInitialized();
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (nodesInitialized && !didInitialFit.current) {
      didInitialFit.current = true;
      void fitView({ ...FIT_OPTIONS, duration: 0 });
    }
  }, [nodesInitialized, fitView]);

  useEffect(() => {
    const layoutChanged = prevLayoutVersionRef.current !== layoutVersion;
    if (layoutChanged) {
      pinnedPositionsRef.current = {};
      prevLayoutVersionRef.current = layoutVersion;
    }

    const pins = pinnedPositionsRef.current;
    for (const pinnedId of Object.keys(pins)) {
      if (!bots[pinnedId]) {
        delete pins[pinnedId];
      }
    }

    const computed = computeTreeLayout(bots, rootId);
    const botList = Object.values(bots);
    const shown = displayedRef.current;

    const targets: Record<string, XYPosition> = {};
    const origins: Record<string, XYPosition> = {};
    let needsAnimation = false;
    for (const bot of botList) {
      const target = pins[bot.id] ?? computed[bot.id] ?? { x: 0, y: 0 };
      // New agents grow out of their parent instead of popping in place.
      const origin = shown[bot.id] ?? (bot.parentId ? shown[bot.parentId] : undefined) ?? target;
      targets[bot.id] = target;
      origins[bot.id] = origin;
      if (Math.abs(origin.x - target.x) > 0.5 || Math.abs(origin.y - target.y) > 0.5) {
        needsAnimation = true;
      }
    }

    // Merge into the existing node objects so React Flow keeps its measured sizes
    // and drag state; a node being dragged keeps the position under the pointer.
    const applyPositions = (positions: Record<string, XYPosition>) =>
      setNodes((previous) => {
        const previousById = new Map(previous.map((node) => [node.id, node]));
        return botList.map((bot): BotFlowNode => {
          const existing = previousById.get(bot.id);
          const isSelected = bot.id === selectedBotId;
          return {
            ...existing,
            id: bot.id,
            type: 'botNode',
            position: existing?.dragging ? existing.position : positions[bot.id],
            selected: isSelected,
            ariaLabel: `${bot.name}, ${bot.role}, ${bot.status}`,
            data: { bot, isSelected },
          };
        });
      });

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!needsAnimation || reduceMotion) {
      displayedRef.current = targets;
      applyPositions(targets);
    } else {
      // Ease every node from where it is drawn now to its new slot. Positions go
      // through React Flow each frame, so edges follow the nodes.
      const start = performance.now();
      const step = (time: number) => {
        const progress = Math.min(1, (time - start) / LAYOUT_ANIMATION_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        const frame: Record<string, XYPosition> = {};
        for (const bot of botList) {
          const from = origins[bot.id];
          const to = targets[bot.id];
          frame[bot.id] = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
        }
        displayedRef.current = frame;
        applyPositions(frame);
        animationRef.current = progress < 1 ? requestAnimationFrame(step) : null;
      };
      animationRef.current = requestAnimationFrame(step);
    }

    const nextEdges: BotFlowEdge[] = [];
    for (const bot of botList) {
      if (bot.parentId && bots[bot.parentId]) {
        nextEdges.push({
          id: `${bot.parentId}->${bot.id}`,
          source: bot.parentId,
          target: bot.id,
          type: 'botEdge',
          data: { isActive: bot.status === 'running', targetStatus: bot.status },
        });
      }
    }
    setEdges(nextEdges);

    if (layoutChanged) {
      // Fit once the nodes have settled, so the camera frames the final layout.
      const timeoutId = window.setTimeout(() => void fitView(FIT_OPTIONS), needsAnimation ? LAYOUT_ANIMATION_MS : 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [bots, rootId, selectedBotId, layoutVersion, setNodes, setEdges, fitView]);

  // "Center on map" from the details drawer.
  useEffect(() => {
    if (focusRequest === 0 || !selectedBotId) {
      return;
    }
    const node = getNode(selectedBotId);
    if (node) {
      void setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
        zoom: Math.max(getZoom(), 1),
        duration: 300,
      });
    }
    // Only a new request should move the camera, not every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        void fitView(FIT_OPTIONS);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fitView]);

  // Track the drag live, so a simulation tick mid-drag doesn't snap the node back.
  const handleNodeDrag: OnNodeDrag<BotFlowNode> = useCallback((_event, node) => {
    pinnedPositionsRef.current[node.id] = { ...node.position };
    displayedRef.current[node.id] = { ...node.position };
  }, []);

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: BotFlowNode) => onSelectBot(node.id),
    [onSelectBot],
  );

  const handlePaneClick = useCallback(() => onSelectBot(null), [onSelectBot]);

  return (
    <div className="bot-graph-canvas">
      <ReactFlow<BotFlowNode, BotFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDrag}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}

        minZoom={0.2}
        maxZoom={1.75}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--grid)" />
        <MapToolbar onAutoLayout={onAutoLayout} />
      </ReactFlow>
    </div>
  );
}

// Memoised so the app's one-second clock doesn't re-render the whole map.
export const BotGraphCanvas = memo(function BotGraphCanvas(props: BotGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <BotGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
});
