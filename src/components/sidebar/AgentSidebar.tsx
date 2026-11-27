import { useMemo, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import type { AgentSidebarProps, BotEntity } from '../../types/bot';
import { StatusIcon } from '../common/StatusIcon';
import './AgentSidebar.css';

interface TreeRow {
  bot: BotEntity;
  depth: number;
}

/** Depth-first order from the root, so the list reads like the map. */
function flattenTree(bots: Record<string, BotEntity>, rootId: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const seen = new Set<string>();

  const walk = (id: string, depth: number) => {
    const bot = bots[id];
    if (!bot || seen.has(id)) {
      return;
    }
    seen.add(id);
    rows.push({ bot, depth });
    for (const childId of bot.childIds) {
      walk(childId, depth + 1);
    }
  };

  walk(rootId, 0);
  for (const bot of Object.values(bots)) {
    if (!seen.has(bot.id)) {
      rows.push({ bot, depth: 0 });
    }
  }
  return rows;
}

const INDENT = 18;

export function AgentSidebar({
  bots,
  rootId,
  selectedBotId,
  stats,
  isOpen,
  filterInputRef,
  onSelectBot,
  onClose,
}: AgentSidebarProps) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => flattenTree(bots, rootId), [bots, rootId]);

  const trimmed = query.trim().toLowerCase();
  const visibleRows = trimmed
    ? rows.filter(({ bot }) => `${bot.name} ${bot.role}`.toLowerCase().includes(trimmed))
    : rows;

  return (
    <aside className={`sidebar ${isOpen ? '' : 'is-collapsed'}`} aria-label="Agents" aria-hidden={!isOpen}>
      <div className="sidebar__inner">
        <div className="sidebar__head">
          <h2 className="sidebar__title">
            Agents <span className="mono">{stats.total}</span>
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Hide agent list" tabIndex={isOpen ? 0 : -1}>
            <ChevronLeft strokeWidth={1.6} />
          </button>
        </div>

        <label className="field sidebar__filter">
          <Search strokeWidth={1.8} aria-hidden="true" />
          <input
            ref={filterInputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.stopPropagation();
                setQuery('');
              }
            }}
            placeholder="Filter by name or role"
            aria-label="Filter agents"
            tabIndex={isOpen ? 0 : -1}
          />
        </label>

        <div className="sidebar__tree scroll-quiet" role="tree" aria-label="Agent hierarchy">
          {visibleRows.map(({ bot, depth }) => {
            const indentDepth = trimmed ? 0 : depth;
            const isSelected = bot.id === selectedBotId;
            return (
              <button
                key={bot.id}
                type="button"
                role="treeitem"
                aria-selected={isSelected}
                aria-level={depth + 1}
                tabIndex={isOpen ? 0 : -1}
                className={`tree-row ${isSelected ? 'is-selected' : ''}`}
                style={{ paddingLeft: 8 + indentDepth * INDENT }}
                onClick={() => onSelectBot(bot.id)}
                title={bot.currentTask}
              >
                {Array.from({ length: indentDepth }, (_, level) => (
                  <span key={level} className="tree-row__guide" style={{ left: 14 + level * INDENT }} aria-hidden="true" />
                ))}
                <StatusIcon status={bot.status} />
                <span className="tree-row__name">{bot.name}</span>
                <span className="tree-row__role">{bot.role}</span>
                <span className="tree-row__count mono" title={`${bot.logs.length} events`}>
                  {bot.logs.length}
                </span>
              </button>
            );
          })}
          {visibleRows.length === 0 && (
            <p className="sidebar__empty">
              No agents match “{query.trim()}”.{' '}
              <button type="button" className="sidebar__clear" onClick={() => setQuery('')}>
                Clear
              </button>
            </p>
          )}
        </div>

        <div className="sidebar__foot">
          <div className="sidebar__bar" aria-hidden="true">
            {stats.running > 0 && <span style={{ flex: stats.running, background: 'var(--run)' }} />}
            {stats.idle > 0 && <span style={{ flex: stats.idle, background: 'var(--idle)' }} />}
            {stats.done > 0 && <span style={{ flex: stats.done, background: 'var(--done)' }} />}
          </div>
          <div className="sidebar__legend">
            <span><b className="mono">{stats.running}</b> running</span>
            <span><b className="mono">{stats.idle}</b> idle</span>
            <span><b className="mono">{stats.done}</b> done</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
