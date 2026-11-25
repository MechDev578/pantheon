import {
  Cloud,
  Crown,
  FileText,
  Globe,
  Pause,
  Play,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  Square,
  Workflow,
} from 'lucide-react';
import type { HeaderToolbarProps } from '../../types/bot';
import './HeaderToolbar.css';

export function HeaderToolbar({
  runtimeMode,
  detectedBackend,
  isBusy,
  isDemoSimulating,
  hasReport,
  hasKeyReady,
  stats,
  onSwitchRuntime,
  onToggleDemoSimulation,
  onAbortMission,
  onOpenReport,
  onOpenSettings,
  onAutoLayout,
  onResetDemo,
}: HeaderToolbarProps) {
  const isDemo = runtimeMode === 'demo';
  const liveLabel =
    detectedBackend === 'local'
      ? 'Local Engine'
      : detectedBackend === 'cloud'
        ? 'Netlify Cloud'
        : 'Live';

  return (
    <header className="header-toolbar">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">
          <Crown size={18} strokeWidth={2.1} />
        </div>
        <div className="header-title-group">
          <h1 className="header-title">Pantheon</h1>
          <span className="version-badge">v2</span>

          <div className="runtime-toggle" role="group" aria-label="Runtime mode">
            {detectedBackend && (
              <button
                type="button"
                className={`runtime-tab ${!isDemo ? 'is-active' : ''}`}
                onClick={() => onSwitchRuntime(detectedBackend)}
                title={
                  detectedBackend === 'local'
                    ? 'Connected to local Node.js Pantheon Engine (unlimited runtime)'
                    : 'Connected to Netlify Cloud streaming engine'
                }
              >
                {detectedBackend === 'local' ? <Server size={12} /> : <Cloud size={12} />}
                <span>{liveLabel}</span>
              </button>
            )}
            <button
              type="button"
              className={`runtime-tab ${isDemo ? 'is-active is-demo' : ''}`}
              onClick={() => onSwitchRuntime('demo')}
              title="Offline Greek mythology swarm simulator"
            >
              <Sparkles size={12} />
              <span>Demo</span>
            </button>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="header-stats" aria-label="Pantheon telemetry">
          <div className="stat-pill stat-running" title="Active running Olympians">
            <span className="stat-dot" aria-hidden="true" />
            <span className="stat-label">Active</span>
            <span className="stat-value">{stats.running}</span>
          </div>
          {stats.waiting > 0 && (
            <div className="stat-pill stat-waiting" title="Bots waiting for input or sub-agents">
              <span className="stat-dot" aria-hidden="true" />
              <span className="stat-label">Waiting</span>
              <span className="stat-value">{stats.waiting}</span>
            </div>
          )}
          <div className="stat-pill stat-done" title="Completed Olympians">
            <span className="stat-dot" aria-hidden="true" />
            <span className="stat-label">Done</span>
            <span className="stat-value">{stats.done}</span>
          </div>
          <div className="stat-pill stat-sources" title="Total web pages scraped across all bots">
            <Globe size={12} className="stat-globe" />
            <span className="stat-label">Scraped</span>
            <span className="stat-value">{stats.sourcesScraped}</span>
          </div>
          <div className="stat-pill stat-total" title="Total bots deployed">
            <span className="stat-label">Bots</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="header-divider" aria-hidden="true" />

        <div className="header-actions">
          {!isDemo && isBusy && (
            <button
              type="button"
              className="toolbar-btn btn-danger"
              onClick={onAbortMission}
              title="Stop active mission immediately"
            >
              <Square size={13} />
              <span>Stop</span>
            </button>
          )}

          {!isDemo && hasReport && (
            <button
              type="button"
              className="toolbar-btn btn-accent"
              onClick={onOpenReport}
              title="View Apollo's final synthesized mission report"
            >
              <FileText size={14} />
              <span>Report</span>
            </button>
          )}

          {isDemo && (
            <>
              <button
                type="button"
                className={`toolbar-btn ${isDemoSimulating ? 'btn-secondary' : 'btn-accent'}`}
                onClick={onToggleDemoSimulation}
                title={isDemoSimulating ? 'Pause demo simulation' : 'Resume demo simulation'}
              >
                {isDemoSimulating ? <Pause size={14} /> : <Play size={14} />}
                <span>{isDemoSimulating ? 'Pause' : 'Resume'}</span>
              </button>
              <button
                type="button"
                className="toolbar-btn btn-ghost"
                onClick={onResetDemo}
                title="Reset demo graph"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="toolbar-btn btn-secondary"
            onClick={onAutoLayout}
            title="Re-center hierarchical tree layout"
          >
            <Workflow size={14} />
            <span>Layout</span>
          </button>

          <button
            type="button"
            className={`toolbar-btn ${hasKeyReady ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onOpenSettings}
            title="Configure AI provider (Gemini / OpenAI / Claude), API keys, and depth defaults"
          >
            <Settings size={14} />
            <span>Settings</span>
            {!hasKeyReady && <span className="settings-alert-dot" aria-label="API key needed" />}
          </button>
        </div>
      </div>
    </header>
  );
}
