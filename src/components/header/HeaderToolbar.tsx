import { Moon, PanelLeft, Pause, Play, Plus, RotateCcw, Search, Sun } from 'lucide-react';
import type { HeaderToolbarProps } from '../../types/bot';
import './HeaderToolbar.css';

export function HeaderToolbar({
  isSimulating,
  elapsedLabel,
  selectedBotName,
  isSidebarOpen,
  theme,
  onToggleSidebar,
  onToggleTheme,
  onOpenSearch,
  onToggleSimulation,
  onSpawnBot,
  onReset,
}: HeaderToolbarProps) {
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

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
        <span className="topbar__crumb">Mind map</span>
      </div>

      <div className="topbar__right">
        <span className="topbar__status" role="status">
          <span className={`topbar__dot ${isSimulating ? '' : 'is-paused'}`} aria-hidden="true" />
          {isSimulating ? 'Live' : 'Paused'}
          <span className="topbar__time mono" title="Time since the run started">
            {elapsedLabel}
          </span>
        </span>

        <button type="button" className="btn btn-ghost btn-icon" onClick={onOpenSearch} aria-label="Find an agent" title="Find an agent  ⌘K">
          <Search strokeWidth={1.6} />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
          {theme === 'dark' ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onReset} aria-label="Reset run" title="Reset to the starter tree">
          <RotateCcw strokeWidth={1.6} />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onToggleSimulation}
          title={isSimulating ? 'Pause simulation ticks' : 'Resume simulation ticks'}
        >
          {isSimulating ? <Pause strokeWidth={1.6} /> : <Play strokeWidth={1.6} />}
          <span className="topbar__label">{isSimulating ? 'Pause' : 'Resume'}</span>
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSpawnBot}
          title={selectedBotName ? `New agent under ${selectedBotName}  (N)` : 'New agent  (N)'}
        >
          <Plus strokeWidth={2} />
          <span className="topbar__label">New agent</span>
        </button>
      </div>
    </header>
  );
}
