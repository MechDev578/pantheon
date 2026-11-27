import {
  Cloud,
  Cpu,
  FileText,
  HelpCircle,
  Moon,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
} from 'lucide-react';
import type { HeaderToolbarProps } from '../../types/bot';
import './HeaderToolbar.css';

export function HeaderToolbar({
  runtimeMode,
  detectedBackend,
  activeMission,
  isBusy,
  isDemoSimulating,
  elapsedLabel,
  selectedBotName,
  isSidebarOpen,
  theme,
  hasReport,
  hasKeyReady,
  onToggleSidebar,
  onToggleTheme,
  onOpenSearch,
  onSwitchRuntime,
  onToggleDemoSimulation,
  onSpawnDemoBot,
  onResetDemo,
  onToggleLauncher,
  onOpenClarification,
  onAbortMission,
  onOpenReport,
  onOpenSettings,
}: HeaderToolbarProps) {
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  const waitingForInput = runtimeMode !== 'demo' && activeMission?.status === 'waiting_for_input';

  let statusLabel = 'Ready';
  let dotState: 'ok' | 'run' | 'wait' | 'paused' | 'err' = 'ok';
  if (runtimeMode === 'demo') {
    statusLabel = isDemoSimulating ? 'Live' : 'Paused';
    dotState = isDemoSimulating ? 'ok' : 'paused';
  } else if (activeMission) {
    if (activeMission.status === 'running' || activeMission.status === 'analyzing') {
      statusLabel = activeMission.status === 'analyzing' ? 'Analyzing' : 'Running';
      dotState = 'run';
    } else if (activeMission.status === 'waiting_for_input') {
      statusLabel = 'Awaiting input';
      dotState = 'wait';
    } else if (activeMission.status === 'failed' || activeMission.status === 'aborted') {
      statusLabel = activeMission.status === 'failed' ? 'Failed' : 'Stopped';
      dotState = 'err';
    } else {
      statusLabel = 'Completed';
      dotState = 'ok';
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Hide agent list' : 'Show agent list'}
          aria-expanded={isSidebarOpen}
          title="Agent list  ["
        >
          <PanelLeft strokeWidth={1.6} />
        </button>

        <h1 className="topbar__title">Pantheon</h1>
        <span className="topbar__version mono">v2.2.1</span>

        <div className="topbar__runtime" role="group" aria-label="Execution runtime">
          {detectedBackend === 'local' && (
            <button
              type="button"
              className={`runtime-seg ${runtimeMode === 'local' ? 'is-active' : ''}`}
              onClick={() => onSwitchRuntime('local')}
              title="Local Node.js Engine (unlimited crawl depth & mission persistence)"
            >
              <Cpu size={13} strokeWidth={1.7} />
              <span>Local</span>
            </button>
          )}
          {detectedBackend === 'cloud' && (
            <button
              type="button"
              className={`runtime-seg ${runtimeMode === 'cloud' ? 'is-active' : ''}`}
              onClick={() => onSwitchRuntime('cloud')}
              title="Netlify Cloud Function (live serverless streaming)"
            >
              <Cloud size={13} strokeWidth={1.7} />
              <span>Cloud</span>
            </button>
          )}
          <button
            type="button"
            className={`runtime-seg ${runtimeMode === 'demo' ? 'is-active' : ''}`}
            onClick={() => onSwitchRuntime('demo')}
            title="Offline Greek mythology swarm simulation (no API key needed)"
          >
            <Sparkles size={13} strokeWidth={1.7} />
            <span>Demo</span>
          </button>
        </div>
      </div>

      <div className="topbar__right">
        <span className="topbar__status" role="status">
          <span className={`topbar__dot is-${dotState}`} aria-hidden="true" />
          <span>{statusLabel}</span>
          {(runtimeMode === 'demo' || activeMission !== null) && (
            <span className="topbar__time mono" title="Elapsed time">
              {elapsedLabel}
            </span>
          )}
        </span>

        {waitingForInput && activeMission && (
          <button
            type="button"
            className="btn topbar__clarify"
            onClick={onOpenClarification}
            title="Answer Zeus's clarifying questions"
          >
            <HelpCircle strokeWidth={1.7} />
            <span className="topbar__label">Answer Zeus ({activeMission.questions.length})</span>
          </button>
        )}

        {runtimeMode !== 'demo' && isBusy && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={onAbortMission}
            title="Stop active mission"
          >
            <Square strokeWidth={1.8} />
            <span className="topbar__label">Stop</span>
          </button>
        )}

        {runtimeMode !== 'demo' && hasReport && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenReport}
            title="Open Apollo's compiled mission report"
          >
            <FileText strokeWidth={1.6} />
            <span className="topbar__label">Report</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onOpenSearch}
          aria-label="Find an agent"
          title="Find an agent  ⌘K"
        >
          <Search strokeWidth={1.6} />
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onToggleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          {theme === 'dark' ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-icon topbar__settings-btn"
          onClick={onOpenSettings}
          aria-label="Engine & API settings"
          title={hasKeyReady ? 'Engine settings (API key ready)' : 'Configure AI provider & API key'}
        >
          <Settings strokeWidth={1.6} />
          <span className={`topbar__key-dot ${hasKeyReady ? 'is-ready' : 'is-missing'}`} aria-hidden="true" />
        </button>

        {runtimeMode === 'demo' ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={onResetDemo}
              aria-label="Reset demo"
              title="Reset to the starter Pantheon tree"
            >
              <RotateCcw strokeWidth={1.6} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onToggleDemoSimulation}
              title={isDemoSimulating ? 'Pause simulation ticks' : 'Resume simulation ticks'}
            >
              {isDemoSimulating ? <Pause strokeWidth={1.6} /> : <Play strokeWidth={1.6} />}
              <span className="topbar__label">{isDemoSimulating ? 'Pause' : 'Resume'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSpawnDemoBot}
              title={selectedBotName ? `New agent under ${selectedBotName}  (N)` : 'New agent  (N)'}
            >
              <Plus strokeWidth={2} />
              <span className="topbar__label">New agent</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onToggleLauncher}
            title="Deploy a new live mission  (N)"
          >
            <Rocket strokeWidth={1.8} />
            <span className="topbar__label">New mission</span>
          </button>
        )}
      </div>
    </header>
  );
}
