import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Globe, Search, Trash2 } from 'lucide-react';
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

const INDENT = 16;

export function AgentSidebar({
  bots,
  rootId,
  selectedBotId,
  stats,
  isOpen,
  filterInputRef,
  missionHistory,
  activeMissionId,
  onSelectBot,
  onSelectMission,
  onDeleteMission,
  onClose,
}: AgentSidebarProps) {
  const [query, setQuery] = useState('');
  const [missionsExpanded, setMissionsExpanded] = useState(false);
  const rows = useMemo(() => flattenTree(bots, rootId), [bots, rootId]);

  const trimmed = query.trim().toLowerCase();
  const visibleRows = trimmed
    ? rows.filter(({ bot }) =>
        `${bot.name} ${bot.role} ${bot.epithet ?? ''}`.toLowerCase().includes(trimmed),
      )
    : rows;

  return (
    <aside className={`sidebar ${isOpen ? '' : 'is-collapsed'}`} aria-label="Agents" aria-hidden={!isOpen}>
      <div className="sidebar__inner">
        <div className="sidebar__head">
          <h2 className="sidebar__title">
            Pantheon <span className="mono">{stats.total}</span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Hide agent list"
            tabIndex={isOpen ? 0 : -1}
          >
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
            placeholder="Filter by deity or role"
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
                  <span
                    key={level}
                    className="tree-row__guide"
                    style={{ left: 14 + level * INDENT }}
                    aria-hidden="true"
                  />
                ))}
                <StatusIcon status={bot.status} />
                <span className="tree-row__name">{bot.name}</span>
                <span className="tree-row__role">{bot.role}</span>
                {bot.sources.length > 0 && (
                  <span className="tree-row__pages mono" title={`${bot.sources.length} scraped pages`}>
                    {bot.sources.length}p
                  </span>
                )}
                <span className="tree-row__count mono" title={`${bot.logs.length} events`}>
                  {bot.logs.length}
                </span>
              </button>
            );
          })}
          {visibleRows.length === 0 && (
            <p className="sidebar__empty">
              No agents match &ldquo;{query.trim()}&rdquo;.{' '}
              <button type="button" className="sidebar__clear" onClick={() => setQuery('')}>
                Clear
              </button>
            </p>
          )}
        </div>

        {missionHistory.length > 0 && (
          <div className="sidebar__missions">
            <button
              type="button"
              className="sidebar__section-toggle"
              onClick={() => setMissionsExpanded((v) => !v)}
              aria-expanded={missionsExpanded}
              tabIndex={isOpen ? 0 : -1}
            >
              {missionsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Saved missions</span>
              <span className="mono">{missionHistory.length}</span>
            </button>

            {missionsExpanded && (
              <div className="sidebar__mission-list scroll-quiet">
                {missionHistory.map((m) => (
                  <div
                    key={m.id}
                    className={`sidebar__mission-row ${m.id === activeMissionId ? 'is-selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="sidebar__mission-btn"
                      onClick={() => onSelectMission(m.id)}
                      title={m.goal}
                      tabIndex={isOpen ? 0 : -1}
                    >
                      <span className={`sidebar__mission-dot is-${m.status}`} aria-hidden="true" />
                      <span className="sidebar__mission-info">
                        <span className="sidebar__mission-title">{m.title}</span>
                        <span className="sidebar__mission-meta mono">
                          {m.botCount} bots · {m.sourceCount}p
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="sidebar__mission-del"
                      onClick={() => onDeleteMission(m.id)}
                      aria-label={`Delete ${m.title}`}
                      title="Delete mission"
                      tabIndex={isOpen ? 0 : -1}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sidebar__foot">
          <div className="sidebar__bar" aria-hidden="true">
            {stats.running > 0 && <span style={{ flex: stats.running, background: 'var(--run)' }} />}
            {stats.waiting > 0 && <span style={{ flex: stats.waiting, background: 'var(--wait)' }} />}
            {stats.idle > 0 && <span style={{ flex: stats.idle, background: 'var(--idle)' }} />}
            {stats.done > 0 && <span style={{ flex: stats.done, background: 'var(--done)' }} />}
            {stats.error > 0 && <span style={{ flex: stats.error, background: 'var(--err)' }} />}
          </div>
          <div className="sidebar__legend">
            <span><b className="mono">{stats.running}</b> run</span>
            {stats.waiting > 0 ? (
              <span><b className="mono">{stats.waiting}</b> wait</span>
            ) : (
              <span><b className="mono">{stats.idle}</b> idle</span>
            )}
            <span><b className="mono">{stats.done}</b> done</span>
            {stats.error > 0 ? (
              <span className="is-err"><b className="mono">{stats.error}</b> err</span>
            ) : stats.sourcesScraped > 0 ? (
              <span className="is-pages" title="Websites scraped across all agents">
                <Globe size={11} aria-hidden="true" />
                <b className="mono">{stats.sourcesScraped}</b>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
