import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowDown,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  ExternalLink,
  FileText,
  Globe,
  Plus,
  Search,
  Send,
  Terminal,
  X,
} from 'lucide-react';
import type {
  BotEntity,
  BotLogEntry,
  BotRole,
  DetailsDrawerProps,
  LogLevel,
} from '../../types/bot';
import { formatAgo, formatClockTime, formatDuration } from '../../utils/format';
import { STATUS_LABELS, StatusIcon } from '../common/StatusIcon';
import './DetailsDrawer.css';

type DrawerTab = 'activity' | 'sources' | 'output';
type LevelFilter = 'all' | 'tool' | 'thought' | 'info' | 'warn' | 'success' | 'error';

const FILTERS: ReadonlyArray<{ id: LevelFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tool', label: 'Tools' },
  { id: 'thought', label: 'Mind' },
  { id: 'info', label: 'Info' },
  { id: 'warn', label: 'Warn' },
  { id: 'success', label: 'OK' },
  { id: 'error', label: 'Err' },
];

const LEVEL_TAGS: Record<LogLevel, string> = {
  info: 'info',
  warn: 'warn',
  success: 'ok',
  debug: 'debug',
  tool: 'tool',
  thought: 'mind',
  error: 'err',
};

const SPAWN_ROLES: readonly BotRole[] = [
  'Scraper',
  'Researcher',
  'Planner',
  'Reviewer',
  'Architect',
  'Coder',
  'Tester',
  'Synthesizer',
];

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
  isActiveRun,
  runtimeMode,
  canSpawnLiveChild,
  hasMissionReport,
  onSelectBot,
  onSpawnChild,
  onCenterOnMap,
  onOpenReport,
}: DetailsDrawerProps) {
  const [height, setHeight] = useState(readSavedHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('activity');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSpawnForm, setShowSpawnForm] = useState(false);
  const [spawnRole, setSpawnRole] = useState<BotRole>('Scraper');
  const [spawnTask, setSpawnTask] = useState('');

  const feedRef = useRef<HTMLDivElement | null>(null);
  const programmaticScroll = useRef(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const botId = bot?.id ?? null;
  const logCount = bot?.logs.length ?? 0;

  useEffect(() => {
    setQuery('');
    setFollow(true);
    setShowSpawnForm(false);
    setSpawnTask('');
    if (botId) {
      setIsMinimized(false);
    }
  }, [botId]);

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
    const result: Record<LevelFilter, number> = {
      all: 0,
      tool: 0,
      thought: 0,
      info: 0,
      warn: 0,
      success: 0,
      error: 0,
    };
    for (const entry of bot?.logs ?? []) {
      result.all += 1;
      if (entry.level in result) {
        result[entry.level as LevelFilter] += 1;
      }
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
  const showTail =
    (bot?.status === 'running' || bot?.status === 'waiting') && isActiveRun && !isFiltered;

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
    if (activeTab === 'activity' && follow) {
      scrollToEnd();
    }
  }, [activeTab, follow, botId, logCount, events.length, isMinimized, scrollToEnd]);

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

  const handleAddChildClick = () => {
    if (!bot) return;
    if (runtimeMode === 'demo') {
      onSpawnChild(bot.id);
    } else {
      setIsMinimized(false);
      setShowSpawnForm((v) => !v);
    }
  };

  const handleSpawnSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!bot) return;
    onSpawnChild(bot.id, spawnRole, spawnTask.trim() || undefined);
    setSpawnTask('');
    setShowSpawnForm(false);
  };

  if (!bot) {
    const root = bots[rootId];
    return (
      <section className="drawer is-empty" aria-label="Agent details">
        <span>Select an Olympian to inspect its directive, scraped sources, and live activity.</span>
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
  const runtime =
    bot.status === 'done' || bot.status === 'error' ? updatedMs - createdMs : now - createdMs;
  const parent = bot.parentId ? bots[bot.parentId] : undefined;
  const children = bot.childIds
    .map((id) => bots[id])
    .filter((child): child is BotEntity => Boolean(child));

  const summary = [
    bot.status === 'done' ? `took ${formatDuration(runtime)}` : formatDuration(runtime),
    `${counts.all} events`,
    bot.sources.length > 0 ? `${bot.sources.length} ${bot.sources.length === 1 ? 'page' : 'pages'}` : null,
    counts.error > 0 ? `${counts.error} ${counts.error === 1 ? 'error' : 'errors'}` : null,
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

        {hasMissionReport && (bot.role === 'Orchestrator' || bot.role === 'Synthesizer') && (
          <button type="button" className="btn btn-secondary" onClick={onOpenReport} title="Open full Apollo mission report">
            <FileText strokeWidth={1.6} />
            <span className="drawer__label">Full report</span>
          </button>
        )}

        {canSpawnLiveChild && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleAddChildClick}
            title={`Deploy a child Olympian under ${bot.name}`}
          >
            <Plus strokeWidth={1.6} />
            <span className="drawer__label">Add child</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onCenterOnMap}
          aria-label="Center on map"
          title="Center on map"
        >
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

        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => onSelectBot(null)}
          aria-label="Close details"
          title="Close  Esc"
        >
          <X strokeWidth={1.6} />
        </button>
      </header>

      {!isMinimized && (
        <div className="drawer__body">
          <div className="drawer__side scroll-quiet">
            {showSpawnForm && (
              <form className="drawer__spawn-form" onSubmit={handleSpawnSubmit}>
                <div className="drawer__spawn-row">
                  <select
                    className="drawer__spawn-select"
                    value={spawnRole}
                    onChange={(e) => setSpawnRole(e.target.value as BotRole)}
                    aria-label="Sub-bot role"
                  >
                    {SPAWN_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-primary drawer__spawn-submit">
                    <Send size={12} />
                    <span>Deploy</span>
                  </button>
                </div>
                <input
                  type="text"
                  className="drawer__spawn-input"
                  value={spawnTask}
                  onChange={(e) => setSpawnTask(e.target.value)}
                  placeholder="Directive (e.g. 'Deep-crawl official site for pricing')…"
                />
              </form>
            )}

            {(bot.epithet || bot.modelUsed) && (
              <div className="drawer__tags">
                {bot.epithet && <span className="drawer__epithet">{bot.epithet}</span>}
                {bot.modelUsed && <span className="drawer__model mono">{bot.modelUsed}</span>}
              </div>
            )}

            <p className="drawer__task">{bot.currentTask}</p>

            <section>
              <h3 className="drawer__heading">Parent</h3>
              {parent ? (
                <AgentRow bot={parent} onSelect={() => onSelectBot(parent.id)} />
              ) : (
                <p className="drawer__none">None. This is the root Olympian.</p>
              )}
            </section>

            <section>
              <h3 className="drawer__heading">
                Children <span className="mono">{children.length}</span>
              </h3>
              {children.length > 0 ? (
                children.map((child) => (
                  <AgentRow key={child.id} bot={child} onSelect={() => onSelectBot(child.id)} />
                ))
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
              <dd className="mono">L{bot.depth}</dd>
              {bot.sources.length > 0 && (
                <>
                  <dt>Scraped</dt>
                  <dd className="mono">{bot.sources.length} pages</dd>
                </>
              )}
            </dl>
          </div>

          <div className="activity">
            <div className="activity__top">
              <div className="drawer__tabs" role="tablist" aria-label="Inspector sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'activity'}
                  className={`drawer__tab ${activeTab === 'activity' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('activity')}
                >
                  <Terminal size={13} strokeWidth={1.7} />
                  <span>Activity</span>
                  <span className="mono">{bot.logs.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'sources'}
                  className={`drawer__tab ${activeTab === 'sources' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('sources')}
                >
                  <Globe size={13} strokeWidth={1.7} />
                  <span>Sources</span>
                  <span className="mono">{bot.sources.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'output'}
                  className={`drawer__tab ${activeTab === 'output' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('output')}
                >
                  <FileText size={13} strokeWidth={1.7} />
                  <span>Output</span>
                  {bot.output && <span className="drawer__tab-dot" aria-hidden="true" />}
                </button>
              </div>

              {activeTab === 'activity' && (
                <div className="activity__controls">
                  <div className="activity__filters" role="group" aria-label="Filter events by level">
                    {FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        aria-pressed={level === filter.id}
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
              )}
            </div>

            {activeTab === 'activity' && (
              <>
                <div
                  className="activity__feed scroll-quiet"
                  ref={feedRef}
                  onScroll={handleFeedScroll}
                  role="log"
                  aria-label={`${bot.name} activity`}
                >
                  {events.map((entry) => (
                    <div key={entry.id} className={`event event--${entry.level}`}>
                      <span className="event__time mono">{formatClockTime(entry.timestamp)}</span>
                      <span className="event__level mono">{LEVEL_TAGS[entry.level]}</span>
                      <span className="event__message">{entry.message}</span>
                      <button
                        type="button"
                        className="event__copy"
                        onClick={() => copyEntry(entry)}
                        aria-label="Copy event"
                        title="Copy"
                      >
                        {copiedId === entry.id ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.6} />}
                      </button>
                    </div>
                  ))}
                  {showTail && (
                    <div className="event event--tail" aria-hidden="true">
                      <span className="event__time mono">now</span>
                      <span className="event__level">
                        <StatusIcon status={bot.status} size={12} decorative />
                      </span>
                      <span className="event__message">
                        {bot.activeTool ? `${bot.activeTool}…` : 'Working…'}
                      </span>
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
              </>
            )}

            {activeTab === 'sources' && (
              <div className="drawer__sources scroll-quiet">
                {bot.sources.length === 0 ? (
                  <div className="activity__empty">
                    No websites scraped directly by {bot.name} yet.
                  </div>
                ) : (
                  <div className="drawer__source-grid">
                    {bot.sources.map((src) => (
                      <a
                        key={src.id}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`drawer__source-card ${src.status === 'error' ? 'is-error' : ''}`}
                      >
                        <div className="drawer__source-top">
                          <span className="drawer__source-domain mono">{src.domain}</span>
                          <span className="drawer__source-meta mono">
                            d{src.depth} · {src.wordCount}w
                            <ExternalLink size={11} />
                          </span>
                        </div>
                        <div className="drawer__source-title">{src.title}</div>
                        <p className="drawer__source-excerpt">{src.excerpt}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'output' && (
              <div className="drawer__output scroll-quiet">
                {hasMissionReport && (bot.role === 'Orchestrator' || bot.role === 'Synthesizer') && (
                  <button type="button" className="btn btn-secondary drawer__report-banner" onClick={onOpenReport}>
                    <FileText size={14} />
                    <span>Open Full Apollo Mission Report</span>
                  </button>
                )}
                {bot.output ? (
                  <pre className="drawer__output-pre">{bot.output}</pre>
                ) : (
                  <div className="activity__empty">
                    {bot.status === 'running' || bot.status === 'waiting'
                      ? `${bot.name} is still gathering findings…`
                      : 'No final output recorded for this Olympian yet.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
