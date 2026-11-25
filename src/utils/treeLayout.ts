import type { BotEntity } from '../types/bot';

export const NODE_WIDTH = 264;
export const NODE_HEIGHT = 122;
export const H_GAP = 44;
export const V_GAP = 86;

export interface TreePoint {
  x: number;
  y: number;
}

/**
 * Deterministic top-to-bottom (TB) recursive subtree-width layout.
 * Computes each subtree's horizontal span bottom-up so sibling branches
 * across arbitrary nesting depths never overlap, then centers each parent
 * directly above its children's span.
 */
export function computeTreeLayout(
  bots: Record<string, BotEntity>,
  rootId: string,
): Record<string, TreePoint> {
  if (!bots[rootId]) {
    return {};
  }

  const childrenMap: Record<string, string[]> = {};
  const visited = new Set<string>();

  const buildTree = (botId: string): void => {
    visited.add(botId);
    const bot = bots[botId];
    if (!bot) {
      childrenMap[botId] = [];
      return;
    }

    const validChildren: string[] = [];
    for (const childId of bot.childIds) {
      if (bots[childId] && !visited.has(childId)) {
        validChildren.push(childId);
        buildTree(childId);
      }
    }
    childrenMap[botId] = validChildren;
  };

  buildTree(rootId);

  const subtreeWidths: Record<string, number> = {};

  const measureWidth = (botId: string): number => {
    const children = childrenMap[botId] ?? [];
    if (children.length === 0) {
      subtreeWidths[botId] = NODE_WIDTH;
      return NODE_WIDTH;
    }

    let childrenSpan = 0;
    for (let i = 0; i < children.length; i++) {
      childrenSpan += measureWidth(children[i]);
      if (i > 0) {
        childrenSpan += H_GAP;
      }
    }

    const width = Math.max(NODE_WIDTH, childrenSpan);
    subtreeWidths[botId] = width;
    return width;
  };

  const rootWidth = measureWidth(rootId);
  const positions: Record<string, TreePoint> = {};

  const assignPositions = (botId: string, leftX: number, topY: number): number => {
    const children = childrenMap[botId] ?? [];
    const totalWidth = subtreeWidths[botId] ?? NODE_WIDTH;

    if (children.length === 0) {
      const nodeX = leftX + (totalWidth - NODE_WIDTH) / 2;
      positions[botId] = { x: nodeX, y: topY };
      return nodeX;
    }

    let childrenSpan = 0;
    for (let i = 0; i < children.length; i++) {
      childrenSpan += subtreeWidths[children[i]] ?? NODE_WIDTH;
      if (i > 0) {
        childrenSpan += H_GAP;
      }
    }

    let cursorX = leftX + (totalWidth - childrenSpan) / 2;
    const childTopY = topY + NODE_HEIGHT + V_GAP;
    let firstChildX = 0;
    let lastChildX = 0;

    for (let i = 0; i < children.length; i++) {
      const childId = children[i];
      const childWidth = subtreeWidths[childId] ?? NODE_WIDTH;
      const childX = assignPositions(childId, cursorX, childTopY);

      if (i === 0) {
        firstChildX = childX;
      }
      if (i === children.length - 1) {
        lastChildX = childX;
      }

      cursorX += childWidth + H_GAP;
    }

    const parentX = (firstChildX + lastChildX) / 2;
    positions[botId] = { x: parentX, y: topY };
    return parentX;
  };

  assignPositions(rootId, -rootWidth / 2, 0);

  // Fallback placement for any disconnected nodes not reachable from rootId
  let orphanX = rootWidth / 2 + H_GAP;
  for (const botId of Object.keys(bots)) {
    if (!positions[botId]) {
      positions[botId] = { x: orphanX, y: 0 };
      orphanX += NODE_WIDTH + H_GAP;
    }
  }

  return positions;
}
