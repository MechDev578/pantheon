import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, Check, ChevronDown, ChevronUp, Copy, Crosshair, Plus, Search, X } from 'lucide-react';
import type { BotEntity, BotLogEntry, DetailsDrawerProps, LogLevel } from '../../types/bot';
import { formatAgo, formatClockTime, formatDuration } from '../../utils/format';
import { STATUS_LABELS, StatusIcon } from '../common/StatusIcon';
import './DetailsDrawer.css';

type LevelFilter = 'all' | LogLevel;

const FILTERS: ReadonlyArray<{ id: LevelFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'info', label: 'Info' },
  { id: 'warn', label: 'Warnings' },
  { id: 'success', label: 'Success' },
  { id: 'debug', label: 'Debug' },
];

const LEVEL_TAGS: Record<LogLevel, string> = {
  info: 'info',
  warn: 'warn',
  success: 'ok',
  debug: 'debug',
};

const HEIGHT_KEY = 'pantheon-drawer-height';
const DEFAULT_HEIGHT = 340;
const MIN_HEIGHT = 180;

function maxHeight(): number {
  return Math.max(MIN_HEIGHT, Math.round(window.innerHeight * 0.75));
}

function clampHeight(value: number): number {
  return Math.min(maxHeight(), Math.max(MIN_HEIGHT, Math.round(value)));
}

function readSavedHeight(): number {
  try {
    const saved = Number(localStorage.getItem(HEIGHT_KEY));
    return saved > 0 ? clampHeight(saved) : DEFAULT_HEIGHT;
  } catch {
    return DEFAULT_HEIGHT;
  }
}

function saveHeight(value: number): void {
  try {
    localStorage.setItem(HEIGHT_KEY, String(value));
  } catch {
    // Height just won't persist.
  }
}

function logLine(entry: BotLogEntry): string {
  return `${formatClockTime(entry.timestamp)}  ${entry.level.toUpperCase().padEnd(7)} ${entry.message}`;
}

function AgentRow({ bot, onSelect }: { bot: BotEntity; onSelect: () => void }) {
  return (
    <button type="button" className="tree-row" style={{ paddingLeft: 8 }} onClick={onSelect} title={bot.currentTask}>
      <StatusIcon status={bot.status} />
      <span className="tree-row__name">{bot.name}</span>
      <span className="tree-row__role">{bot.role}</span>
      <span className="tree-row__count mono">{bot.logs.length}</span>
    </button>
  );
}

export function DetailsDrawer({
  bot,
  bots,
  rootId,
  now,
  isSimulating,
  onSelectBot,
  onSpawnChild,
  onCenterOnMap,
}: DetailsDrawerProps) {
  const [height, setHeight] = useState(readSavedHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const programmaticScroll = useRef(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const botId = bot?.id ?? null;
  const logCount = bot?.logs.length ?? 0;

  useEffect(() => {
    setQuery('');
    setFollow(true);
    if (botId) {
      setIsMinimized(false);
    }
  }, [botId]);

  // Keep the saved height valid when the window shrinks.
  useEffect(() => {
    const onResize = () => setHeight((value) => clampHeight(value));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = height;
      let latest = startHeight;
      setIsResizing(true);
      setIsMinimized(false);

      const onMove = (moveEvent: PointerEvent) => {
        latest = clampHeight(startHeight + (startY - moveEvent.clientY));
        setHeight(latest);
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        resizeCleanupRef.current = null;
      };
      const onUp = () => {
        setIsResizing(false);
        saveHeight(latest);
        cleanup();
      };
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = cleanup;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [height],
  );

  const resizeByKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowUp' ? 24 : event.key === 'ArrowDown' ? -24 : 0;
    if (delta !== 0) {
      event.preventDefault();
      const next = clampHeight(height + delta);
      setHeight(next);
      saveHeight(next);
    }
  };

  const resetHeight = () => {
    setHeight(DEFAULT_HEIGHT);
    saveHeight(DEFAULT_HEIGHT);
  };

  const counts = useMemo(() => {
    const result: Record<LevelFilter, number> = { all: 0, info: 0, warn: 0, success: 0, debug: 0 };
    for (const entry of bot?.logs ?? []) {
      result.all += 1;
      result[entry.level] += 1;
    }
    return result;
  }, [bot?.logs]);

  const trimmedQuery = query.trim().toLowerCase();
  const events = useMemo(
    () =>
      (bot?.logs ?? []).filter(
        (entry) =>
          (level === 'all' || entry.level === level) &&
          (!trimmedQuery || entry.message.toLowerCase().includes(trimmedQuery)),
      ),
    [bot?.logs, level, trimmedQuery],
  );

  const isFiltered = level !== 'all' || trimmedQuery.length > 0;
  const showTail = bot?.status === 'running' && isSimulating && !isFiltered;

  const scrollToEnd = useCallback(() => {
    const feed = feedRef.current;
    if (!feed) {
      return;
    }
    programmaticScroll.current = true;
    feed.scrollTop = feed.scrollHeight;
    requestAnimationFrame(() => {
      programmaticScroll.current = false;
    });
  }, []);

  useEffect(() => {
    if (follow) {
      scrollToEnd();
    }
  }, [follow, botId, logCount, events.length, isMinimized, scrollToEnd]);

  const handleFeedScroll = () => {
    const feed = feedRef.current;
    if (!feed || programmaticScroll.current) {
      return;
    }
    const distance = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    if (distance > 24 && follow) {
      setFollow(false);
    } else if (distance <= 4 && !follow) {
      setFollow(true);
    }
  };

  const copyEntry = (entry: BotLogEntry) => {
    void navigator.clipboard?.writeText(logLine(entry)).then(() => {
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId((current) => (current === entry.id ? null : current)), 1400);
    });
  };

  if (!bot) {
    const root = bots[rootId];
    return (
      <section className="drawer is-empty" aria-label="Agent details">
        <span>Select an agent to see its task and activity.</span>
        {root && (
          <button type="button" className="drawer__text-btn" onClick={() => onSelectBot(root.id)}>
            Open {root.name}
          </button>
        )}
      </section>
    );
  }

  const createdMs = new Date(bot.createdAt).getTime();
  const updatedMs = new Date(bot.updatedAt).getTime();
  const runtime = bot.status === 'done' ? updatedMs - createdMs : now - createdMs;
  const parent = bot.parentId ? bots[bot.parentId] : undefined;
  const children = bot.childIds.map((id) => bots[id]).filter((child): child is BotEntity => Boolean(child));

  const summary = [
    bot.status === 'done' ? `took ${formatDuration(runtime)}` : `${formatDuration(runtime)}`,
    `${counts.all} events`,
    counts.warn > 0 ? `${counts.warn} ${counts.warn === 1 ? 'warning' : 'warnings'}` : null,
    `last ${formatAgo(now - updatedMs)}`,
  ].filter(Boolean);

  return (
    <section
      className={`drawer ${isMinimized ? 'is-minimized' : ''} ${isResizing ? 'is-resizing' : ''}`}
      style={isMinimized ? undefined : { height }}
      aria-label={`${bot.name} details`}
    >
      <div
        className="drawer__resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize details panel"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={maxHeight()}
        tabIndex={0}
        onPointerDown={startResize}
        onDoubleClick={resetHeight}
        onKeyDown={resizeByKey}
        title="Drag to resize. Double-click to reset."
      />

      <header className="drawer__head">
        <StatusIcon status={bot.status} decorative />
        <h2 className="drawer__name">{bot.name}</h2>
        <span className="drawer__meta">
          {bot.role} · {STATUS_LABELS[bot.status]}
        </span>
        <span className="drawer__summary mono">{summary.join('  ·  ')}</span>
        <span className="drawer__spacer" />
        <button type="button" className="btn btn-ghost" onClick={() => onSpawnChild(bot.id)} title={`Spawn a child agent under ${bot.name}`}>
          <Plus strokeWidth={1.6} />
          <span className="drawer__label">Add child</span>
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onCenterOnMap} aria-label="Center on map" title="Center on map">
          <Crosshair strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => setIsMinimized((value) => !value)}
          aria-label={isMinimized ? 'Expand details' : 'Minimize details'}
          aria-expanded={!isMinimized}
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? <ChevronUp strokeWidth={1.6} /> : <ChevronDown strokeWidth={1.6} />}
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => onSelectBot(null)} aria-label="Close details" title="Close  Esc">
          <X strokeWidth={1.6} />
        </button>
      </header>

      {!isMinimized && (
        <div className="drawer__body">
          <div className="drawer__side scroll-quiet">
            <p className="drawer__task">{bot.currentTask}</p>

            <section>
              <h3 className="drawer__heading">Parent</h3>
              {parent ? (
                <AgentRow bot={parent} onSelect={() => onSelectBot(parent.id)} />
              ) : (
                <p className="drawer__none">None. This is the root agent.</p>
              )}
            </section>

            <section>
              <h3 className="drawer__heading">
                Children <span className="mono">{children.length}</span>
              </h3>
              {children.length > 0 ? (
                children.map((child) => <AgentRow key={child.id} bot={child} onSelect={() => onSelectBot(child.id)} />)
              ) : (
                <p className="drawer__none">None yet.</p>
              )}
            </section>

            <dl className="drawer__facts">
              <dt>Started</dt>
              <dd className="mono">{formatClockTime(bot.createdAt)}</dd>
              <dt>Updated</dt>
              <dd className="mono">{formatClockTime(bot.updatedAt)}</dd>
              <dt>Depth</dt>
              <dd className="mono">{bot.depth}</dd>
            </dl>
          </div>

          <div className="activity">
            <div className="activity__bar">
              <div className="activity__filters" role="tablist" aria-label="Filter events by level">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={level === filter.id}
                    className={`activity__filter ${level === filter.id ? 'is-active' : ''}`}
                    onClick={() => setLevel(filter.id)}
                  >
                    {filter.label}
                    <span className="mono">{counts[filter.id]}</span>
                  </button>
                ))}
              </div>
              <label className="field activity__search">
                <Search strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter messages"
                  aria-label="Filter messages"
                />
              </label>
            </div>

            <div className="activity__feed scroll-quiet" ref={feedRef} onScroll={handleFeedScroll} role="log" aria-label={`${bot.name} activity`}>
              {events.map((entry) => (
                <div key={entry.id} className={`event event--${entry.level}`}>
                  <span className="event__time mono">{formatClockTime(entry.timestamp)}</span>
                  <span className="event__level mono">{LEVEL_TAGS[entry.level]}</span>
                  <span className="event__message">{entry.message}</span>
                  <button type="button" className="event__copy" onClick={() => copyEntry(entry)} aria-label="Copy event" title="Copy">
                    {copiedId === entry.id ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.6} />}
                  </button>
                </div>
              ))}
              {showTail && (
                <div className="event event--tail" aria-hidden="true">
                  <span className="event__time mono">now</span>
                  <span className="event__level">
                    <StatusIcon status="running" size={12} decorative />
                  </span>
                  <span className="event__message">Working…</span>
                  <span />
                </div>
              )}
              {events.length === 0 && (
                <div className="activity__empty">
                  {isFiltered ? 'Nothing matches these filters.' : 'No events yet.'}
                  {isFiltered && (
                    <button
                      type="button"
                      className="drawer__text-btn"
                      onClick={() => {
                        setLevel('all');
                        setQuery('');
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {!follow && (
              <button type="button" className="activity__jump" onClick={() => setFollow(true)}>
                <ArrowDown strokeWidth={1.8} />
                Latest
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
