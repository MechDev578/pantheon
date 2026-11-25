import {
  Cpu,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Workflow,
} from 'lucide-react';
import type { HeaderToolbarProps } from '../../types/bot';
import './HeaderToolbar.css';

export function HeaderToolbar({
  isSimulating,
  stats,
  selectedBotName,
  onToggleSimulation,
  onSpawnBot,
  onReset,
  onAutoLayout,
}: HeaderToolbarProps) {
  const spawnTitle = selectedBotName
    ? `Spawn child bot under ${selectedBotName}`
    : 'Spawn child bot under an active parent';

  return (
    <header className="header-toolbar">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">
          <Cpu size={18} strokeWidth={2.1} />
        </div>
        <div className="header-title-group">
          <h1 className="header-title">Bot Mind Map</h1>
          <span
            className={`sim-status-pill ${isSimulating ? 'is-live' : 'is-paused'}`}
            title={
              isSimulating
                ? 'Simulation ticks active'
                : 'Simulation paused'
            }
          >
            <span className="sim-status-dot" aria-hidden="true" />
            <span>{isSimulating ? 'Live' : 'Paused'}</span>
          </span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-stats" aria-label="Simulation statistics">
          <div className="stat-pill stat-running" title="Currently running bots">
            <span className="stat-dot" aria-hidden="true" />
            <span className="stat-label">Running</span>
            <span className="stat-value">{stats.running}</span>
          </div>
          <div className="stat-pill stat-idle" title="Idle bots waiting on subtasks">
            <span className="stat-dot" aria-hidden="true" />
            <span className="stat-label">Idle</span>
            <span className="stat-value">{stats.idle}</span>
          </div>
          <div className="stat-pill stat-done" title="Completed bots">
            <span className="stat-dot" aria-hidden="true" />
            <span className="stat-label">Done</span>
            <span className="stat-value">{stats.done}</span>
          </div>
          <div className="stat-pill stat-total" title="Total bots in graph">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="header-divider" aria-hidden="true" />

        <div className="header-actions">
          <button
            type="button"
            className={`toolbar-btn ${isSimulating ? 'btn-secondary' : 'btn-accent'}`}
            onClick={onToggleSimulation}
            title={isSimulating ? 'Pause simulation' : 'Resume simulation'}
          >
            {isSimulating ? <Pause size={15} /> : <Play size={15} />}
            <span>{isSimulating ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            type="button"
            className="toolbar-btn btn-primary"
            onClick={onSpawnBot}
            title={spawnTitle}
          >
            <Plus size={15} />
            <span>Spawn Bot</span>
          </button>

          <button
            type="button"
            className="toolbar-btn btn-secondary"
            onClick={onAutoLayout}
            title="Re-run hierarchical tree layout and fit view"
          >
            <Workflow size={15} />
            <span>Auto-Layout</span>
          </button>

          <button
            type="button"
            className="toolbar-btn btn-ghost"
            onClick={onReset}
            title="Reset simulation to initial starter tree"
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
