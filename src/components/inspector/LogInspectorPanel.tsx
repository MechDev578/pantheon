import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Plus,
  Send,
  Terminal,
  X,
} from 'lucide-react';
import type {
  BotRole,
  BotStatus,
  LogInspectorPanelProps,
  LogLevel,
} from '../../types/bot';
import './LogInspectorPanel.css';

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const STATUS_LABELS: Record<BotStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  done: 'Done',
  error: 'Error',
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  success: 'OK',
  debug: 'DEBUG',
  tool: 'TOOL',
  thought: 'MIND',
  error: 'ERR',
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

type InspectorTab = 'logs' | 'sources' | 'output';

export function LogInspectorPanel({
  bot,
  parentBot,
  childBots,
  canSpawnLiveChild,
  hasMissionReport,
  onSelectBot,
  onSpawnChild,
  onOpenReport,
}: LogInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('logs');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSpawnForm, setShowSpawnForm] = useState(false);
  const [spawnRole, setSpawnRole] = useState<BotRole>('Scraper');
  const [spawnTask, setSpawnTask] = useState('');

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  const botId = bot?.id ?? null;
  const logCount = bot?.logs.length ?? 0;

  useEffect(() => {
    setAutoScroll(true);
    setShowSpawnForm(false);
    setSpawnTask('');
  }, [botId]);

  useEffect(() => {
    if (activeTab !== 'logs' || !autoScroll || !logContainerRef.current) {
      return;
    }
    const container = logContainerRef.current;
    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;
    const frameId = requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
    return () => cancelAnimationFrame(frameId);
  }, [activeTab, autoScroll, botId, logCount]);

  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || !logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom > 24 && autoScroll) setAutoScroll(false);
    else if (distanceFromBottom <= 8 && !autoScroll) setAutoScroll(true);
  };

  const handleToggleAutoScroll = () => {
    setAutoScroll((prev) => {
      const next = !prev;
      if (next && logContainerRef.current) {
        isProgrammaticScrollRef.current = true;
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      }
      return next;
    });
  };

  const handleSpawnSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!bot) return;
    onSpawnChild(bot.id, spawnRole, spawnTask.trim() || undefined);
    setSpawnTask('');
    setShowSpawnForm(false);
  };

  return (
    <aside
      className={`inspector-panel ${bot ? 'is-open' : 'is-closed'}`}
      aria-label="Olympian Inspector"
      aria-hidden={!bot}
    >
      {bot && (
        <div className="inspector-inner">
          <div className="inspector-header">
            <div className="inspector-title-block">
              <div className="inspector-name-row">
                <h2 className="inspector-bot-name">{bot.name}</h2>
                <span className="inspector-role-pill">{bot.role}</span>
              </div>
              {bot.epithet && <span className="inspector-epithet">{bot.epithet}</span>}
              <div className="inspector-sub-row">
                <span className={`inspector-status-badge status-${bot.status}`}>
                  <span className="inspector-status-dot" aria-hidden="true" />
                  <span>{STATUS_LABELS[bot.status]}</span>
                </span>
                <span className="inspector-depth-badge" title={`Hierarchy depth ${bot.depth}`}>
                  <Layers size={11} />
                  <span>L{bot.depth}</span>
                </span>
                {bot.modelUsed && (
                  <span className="inspector-model-badge" title={`Model: ${bot.modelUsed}`}>
                    {bot.modelUsed}
                  </span>
                )}
              </div>
            </div>

            <div className="inspector-header-actions">
              {canSpawnLiveChild && (
                <button
                  type="button"
                  className="inspector-action-btn"
                  onClick={() => setShowSpawnForm((v) => !v)}
                  title={`Deploy a child Olympian under ${bot.name}`}
                >
                  <Plus size={14} />
                  <span>Sub-Bot</span>
                </button>
              )}
              <button
                type="button"
                className="inspector-close-btn"
                onClick={() => onSelectBot(null)}
                title="Close inspector"
                aria-label="Close inspector"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {showSpawnForm && (
            <form className="inspector-spawn-form" onSubmit={handleSpawnSubmit}>
              <div className="spawn-form-row">
                <select
                  className="spawn-select"
                  value={spawnRole}
                  onChange={(e) => setSpawnRole(e.target.value as BotRole)}
                >
                  {SPAWN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button type="submit" className="spawn-go-btn">
                  <Send size={12} />
                  <span>Deploy</span>
                </button>
              </div>
              <input
                type="text"
                className="spawn-task-input"
                value={spawnTask}
                onChange={(e) => setSpawnTask(e.target.value)}
                placeholder="Directive (e.g. 'Deep-crawl official site for pricing & policies')…"
              />
            </form>
          )}

          <section className="inspector-metadata">
            <div className="meta-task-card">
              <div className="meta-label">Current Directive</div>
              <p className="meta-task-text">{bot.currentTask}</p>
            </div>

            <div className="meta-grid">
              <div className="meta-field">
                <span className="meta-label">Parent</span>
                {parentBot ? (
                  <button
                    type="button"
                    className="link-chip parent-chip"
                    onClick={() => onSelectBot(parentBot.id)}
                  >
                    <ArrowUpRight size={12} />
                    <span>{parentBot.name}</span>
                    <span className="chip-role">{parentBot.role}</span>
                  </button>
                ) : (
                  <span className="root-badge">Supreme Overlord</span>
                )}
              </div>

              <div className="meta-field">
                <span className="meta-label">Timestamps</span>
                <div className="timestamp-pair">
                  <span className="timestamp-item">
                    <Clock size={11} />
                    <span className="ts-key">Created</span>
                    <span className="ts-val">{formatTime(bot.createdAt)}</span>
                  </span>
                  <span className="timestamp-item">
                    <span className="ts-key">Updated</span>
                    <span className="ts-val">{formatTime(bot.updatedAt)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="meta-children-block">
              <div className="meta-children-header">
                <span className="meta-label">Deployed Sub-Bots</span>
                <span className="meta-count-pill">{childBots.length}</span>
              </div>
              {childBots.length > 0 ? (
                <div className="children-chips">
                  {childBots.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className="link-chip child-chip"
                      onClick={() => onSelectBot(child.id)}
                      title={`${child.name} — ${child.role} (${child.status})`}
                    >
                      <span className={`child-dot status-${child.status}`} aria-hidden="true" />
                      <span>{child.name}</span>
                      <ChevronRight size={12} className="child-arrow" />
                    </button>
                  ))}
                </div>
              ) : (
                <span className="empty-children-text">No sub-bots deployed under {bot.name}</span>
              )}
            </div>
          </section>

          <div className="inspector-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'logs'}
              className={`inspector-tab ${activeTab === 'logs' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Terminal size={13} />
              <span>Logs</span>
              <span className="tab-badge">{bot.logs.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'sources'}
              className={`inspector-tab ${activeTab === 'sources' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('sources')}
            >
              <Globe size={13} />
              <span>Sources</span>
              <span className="tab-badge">{bot.sources.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'output'}
              className={`inspector-tab ${activeTab === 'output' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('output')}
            >
              <FileText size={13} />
              <span>Output</span>
              {bot.output && <span className="tab-dot" />}
            </button>
          </div>

          {activeTab === 'logs' && (
            <section className="inspector-logs-section">
              <div className="logs-header">
                <span className="logs-title">Live Telemetry Stream</span>
                <button
                  type="button"
                  className={`autoscroll-toggle ${autoScroll ? 'is-active' : ''}`}
                  onClick={handleToggleAutoScroll}
                >
                  <ArrowDownToLine size={12} />
                  <span>Auto-scroll</span>
                </button>
              </div>
              <div
                ref={logContainerRef}
                className="logs-viewport"
                onScroll={handleScroll}
              >
                {bot.logs.length === 0 ? (
                  <div className="logs-empty">Waiting for telemetry events…</div>
                ) : (
                  bot.logs.map((entry) => (
                    <div key={entry.id} className="log-row">
                      <span className="log-ts">{formatTime(entry.timestamp)}</span>
                      <span className={`log-level level-${entry.level}`}>
                        {LEVEL_LABELS[entry.level]}
                      </span>
                      <span className="log-message">{entry.message}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === 'sources' && (
            <section className="inspector-sources-section">
              {bot.sources.length === 0 ? (
                <div className="logs-empty">
                  No websites scraped directly by {bot.name} yet.
                </div>
              ) : (
                <div className="sources-list">
                  {bot.sources.map((src) => (
                    <a
                      key={src.id}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`source-item ${src.status === 'error' ? 'is-error' : ''}`}
                    >
                      <div className="source-item-top">
                        <span className="source-domain">{src.domain}</span>
                        <span className="source-meta-right">
                          d{src.depth} · {src.wordCount}w
                          <ExternalLink size={11} />
                        </span>
                      </div>
                      <div className="source-title">{src.title}</div>
                      <p className="source-excerpt">{src.excerpt}</p>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'output' && (
            <section className="inspector-output-section">
              {hasMissionReport && (bot.role === 'Orchestrator' || bot.role === 'Synthesizer') && (
                <button
                  type="button"
                  className="open-full-report-btn"
                  onClick={onOpenReport}
                >
                  <FileText size={13} />
                  <span>Open Full Mission Report View</span>
                </button>
              )}
              {bot.output ? (
                <pre className="bot-output-pre">{bot.output}</pre>
              ) : (
                <div className="logs-empty">
                  {bot.status === 'running' || bot.status === 'waiting'
                    ? `${bot.name} is still gathering findings…`
                    : 'No final output recorded for this bot yet.'}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
