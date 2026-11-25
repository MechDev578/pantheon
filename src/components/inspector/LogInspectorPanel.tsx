import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  Terminal,
  X,
} from 'lucide-react';
import type { BotStatus, LogInspectorPanelProps, LogLevel } from '../../types/bot';
import './LogInspectorPanel.css';

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const STATUS_LABELS: Record<BotStatus, string> = {
  running: 'Running',
  idle: 'Idle',
  done: 'Done',
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  success: 'SUCCESS',
  debug: 'DEBUG',
};

export function LogInspectorPanel({
  bot,
  parentBot,
  childBots,
  onSelectBot,
  onSpawnChild,
}: LogInspectorPanelProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  const botId = bot?.id ?? null;
  const logCount = bot?.logs.length ?? 0;

  useEffect(() => {
    setAutoScroll(true);
  }, [botId]);

  useEffect(() => {
    if (!autoScroll || !logContainerRef.current) {
      return;
    }

    const container = logContainerRef.current;
    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;

    const frameId = requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });

    return () => cancelAnimationFrame(frameId);
  }, [autoScroll, botId, logCount]);

  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || !logContainerRef.current) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 24 && autoScroll) {
      setAutoScroll(false);
    } else if (distanceFromBottom <= 8 && !autoScroll) {
      setAutoScroll(true);
    }
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

  return (
    <aside
      className={`inspector-panel ${bot ? 'is-open' : 'is-closed'}`}
      aria-label="Bot Log Inspector"
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
              <div className="inspector-sub-row">
                <span className={`inspector-status-badge status-${bot.status}`}>
                  <span className="inspector-status-dot" aria-hidden="true" />
                  <span>{STATUS_LABELS[bot.status]}</span>
                </span>
                <span className="inspector-depth-badge" title={`Hierarchy depth ${bot.depth}`}>
                  <Layers size={11} />
                  <span>L{bot.depth}</span>
                </span>
              </div>
            </div>

            <div className="inspector-header-actions">
              <button
                type="button"
                className="inspector-action-btn"
                onClick={() => onSpawnChild(bot.id)}
                title={`Spawn child bot under ${bot.name}`}
              >
                <Plus size={14} />
                <span>Child</span>
              </button>
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

          <section className="inspector-metadata">
            <div className="meta-task-card">
              <div className="meta-label">Current Task</div>
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
                    title={`Inspect parent ${parentBot.name} (${parentBot.role})`}
                  >
                    <ArrowUpRight size={12} />
                    <span>{parentBot.name}</span>
                    <span className="chip-role">{parentBot.role}</span>
                  </button>
                ) : (
                  <span className="root-badge">Root Agent</span>
                )}
              </div>

              <div className="meta-field">
                <span className="meta-label">Timestamps</span>
                <div className="timestamp-pair">
                  <span className="timestamp-item" title={`Created ${bot.createdAt}`}>
                    <Clock size={11} />
                    <span className="ts-key">Created</span>
                    <span className="ts-val">{formatTime(bot.createdAt)}</span>
                  </span>
                  <span className="timestamp-item" title={`Last updated ${bot.updatedAt}`}>
                    <span className="ts-key">Updated</span>
                    <span className="ts-val">{formatTime(bot.updatedAt)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="meta-children-block">
              <div className="meta-children-header">
                <span className="meta-label">Children</span>
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
                      <span
                        className={`child-dot status-${child.status}`}
                        aria-hidden="true"
                      />
                      <span>{child.name}</span>
                      <ChevronRight size={12} className="child-arrow" />
                    </button>
                  ))}
                </div>
              ) : (
                <span className="empty-children-text">No child agents spawned yet</span>
              )}
            </div>
          </section>

          <section className="inspector-logs-section">
            <div className="logs-header">
              <div className="logs-title-group">
                <Terminal size={14} className="logs-icon" />
                <span className="logs-title">Live Stream</span>
                <span className="logs-count-badge">{bot.logs.length}</span>
              </div>

              <button
                type="button"
                className={`autoscroll-toggle ${autoScroll ? 'is-active' : ''}`}
                onClick={handleToggleAutoScroll}
                title={
                  autoScroll
                    ? 'Auto-scroll enabled (click to pause)'
                    : 'Auto-scroll paused (click to resume & jump to latest)'
                }
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
                <div className="logs-empty">Waiting for log events...</div>
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
        </div>
      )}
    </aside>
  );
}
