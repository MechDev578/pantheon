import { useState, type FormEvent } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  History,
  HelpCircle,
  Loader2,
  Rocket,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { DEPTH_PRESETS } from '../../../engine/pantheonRoster';
import type {
  ContextMode,
  MissionState,
  MissionSummary,
  ResearchDepth,
} from '../../types/bot';
import './MissionLauncher.css';

interface MissionLauncherProps {
  defaultContextMode: ContextMode;
  defaultDepth: ResearchDepth;
  isDeploying: boolean;
  isBusy: boolean;
  hasKeyReady: boolean;
  hasBackend: boolean;
  activeMission: MissionState | null;
  missionHistory: MissionSummary[];
  onDeploy: (
    goal: string,
    opts: { contextMode: ContextMode; depth: ResearchDepth },
  ) => Promise<boolean>;
  onSelectMission: (missionId: string) => void;
  onDeleteMission: (missionId: string) => void;
  onOpenSettings: () => void;
  onOpenClarification: () => void;
}

const MISSION_TEMPLATES: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'Boutique Hotels Deep Scrape',
    prompt:
      'Find the top 5 boutique hotels in Lisbon near Alfama under €180/night. Deep-scrape their official websites for exact amenities, cancellation policies, breakfast inclusions, and hidden tourist taxes, then build a ranked comparison table.',
  },
  {
    label: 'Trip Itinerary Planner',
    prompt:
      'Plan a 5-day autumn trip to Kyoto & Osaka with hidden local dining spots, transit passes, and boutique stays. Scrape official transit and venue pages for current ticket prices and reservation rules.',
  },
  {
    label: 'Apartment & Landlord Intel',
    prompt:
      'Research the best neighborhoods and rental platforms for a 1-bedroom apartment in Munich under €1,600/month warm rent. Scrape tenant guides and listing portals for required landlord documents, typical deposits, and red flags.',
  },
  {
    label: 'Tech Competitor Audit',
    prompt:
      'Compare the top 4 open-source browser automation & AI web-scraping frameworks in 2026. Deep-crawl their official docs and GitHub pages for pricing, headless stealth features, MCP support, and limitations.',
  },
];

export function MissionLauncher({
  defaultContextMode,
  defaultDepth,
  isDeploying,
  isBusy,
  hasKeyReady,
  hasBackend,
  activeMission,
  missionHistory,
  onDeploy,
  onSelectMission,
  onDeleteMission,
  onOpenSettings,
  onOpenClarification,
}: MissionLauncherProps) {
  const [goal, setGoal] = useState('');
  const [contextMode, setContextMode] = useState<ContextMode>(defaultContextMode);
  const [depth, setDepth] = useState<ResearchDepth>(defaultDepth);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isDeploying) return;
    if (!hasKeyReady) {
      onOpenSettings();
      return;
    }
    const ok = await onDeploy(goal, { contextMode, depth });
    if (ok) {
      setGoal('');
      setIsExpanded(false);
    }
  };

  const waitingForInput = activeMission?.status === 'waiting_for_input';

  return (
    <div className={`mission-launcher ${isExpanded ? 'is-expanded' : 'is-compact'}`}>
      <div className="launcher-bar">
        <button
          type="button"
          className="launcher-toggle-btn"
          onClick={() => setIsExpanded((v) => !v)}
        >
          <Rocket size={14} className="launcher-rocket" />
          <span className="launcher-bar-title">
            {activeMission ? activeMission.title : 'Deploy a New Olympus Mission'}
          </span>
          {activeMission && (
            <span className={`mission-state-pill state-${activeMission.status}`}>
              {activeMission.status.replace(/_/g, ' ')}
            </span>
          )}
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        <div className="launcher-bar-right">
          {waitingForInput && (
            <button
              type="button"
              className="launcher-clarify-cta"
              onClick={onOpenClarification}
            >
              <HelpCircle size={13} />
              <span>Answer Zeus ({activeMission.questions.length})</span>
            </button>
          )}

          {missionHistory.length > 0 && (
            <button
              type="button"
              className={`launcher-history-btn ${showHistory ? 'is-open' : ''}`}
              onClick={() => setShowHistory((v) => !v)}
              title="Switch between saved missions"
            >
              <History size={13} />
              <span>Missions ({missionHistory.length})</span>
            </button>
          )}
        </div>
      </div>

      {showHistory && missionHistory.length > 0 && (
        <div className="launcher-history-drawer">
          <div className="history-header">Saved Missions</div>
          <div className="history-list">
            {missionHistory.map((m) => (
              <div
                key={m.id}
                className={`history-item ${activeMission?.id === m.id ? 'is-current' : ''}`}
              >
                <button
                  type="button"
                  className="history-select"
                  onClick={() => {
                    onSelectMission(m.id);
                    setShowHistory(false);
                    setIsExpanded(false);
                  }}
                >
                  <span className="history-item-title">{m.title}</span>
                  <span className="history-item-meta">
                    <span className={`mission-state-dot state-${m.status}`} />
                    {m.status} · {m.botCount} bots · {m.sourceCount} pages · {m.provider}
                  </span>
                </button>
                <button
                  type="button"
                  className="history-delete"
                  onClick={() => onDeleteMission(m.id)}
                  title="Delete mission"
                  aria-label={`Delete ${m.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isExpanded && (
        <form className="launcher-body" onSubmit={handleSubmit}>
          <textarea
            className="launcher-input"
            rows={2}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Command Zeus & the Pantheon… e.g. 'Research the best boutique hotels in Lisbon under €180/night and deep-scrape their official sites for policies, rooms & hidden fees'"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />

          <div className="launcher-controls">
            <div className="launcher-options-group">
              <div className="option-block">
                <span className="option-label">Context Strategy</span>
                <div className="segmented-control" role="group" aria-label="Context mode">
                  <button
                    type="button"
                    className={`seg-btn ${contextMode === 'ask' ? 'is-selected' : ''}`}
                    onClick={() => setContextMode('ask')}
                    title="Zeus checks for missing details and asks clarifying questions before launching bots"
                  >
                    <HelpCircle size={12} />
                    <span>Ask First</span>
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${contextMode === 'auto' ? 'is-selected is-auto' : ''}`}
                    onClick={() => setContextMode('auto')}
                    title="Zeus automatically infers smart defaults, logs assumptions, and deploys bots immediately"
                  >
                    <Brain size={12} />
                    <span>Auto-Assume</span>
                  </button>
                </div>
              </div>

              <div className="option-block">
                <span className="option-label">Crawl & Swarm Depth</span>
                <div className="segmented-control" role="group" aria-label="Research depth">
                  {(['quick', 'deep', 'abyssal'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`seg-btn ${depth === d ? 'is-selected' : ''}`}
                      onClick={() => setDepth(d)}
                      title={DEPTH_PRESETS[d].description}
                    >
                      <span>{DEPTH_PRESETS[d].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="launcher-submit-group">
              {!hasBackend && (
                <span className="launcher-hint">Run `npm run dev` locally or open Netlify for live bots</span>
              )}
              {hasBackend && !hasKeyReady && (
                <button
                  type="button"
                  className="launcher-key-btn"
                  onClick={onOpenSettings}
                >
                  Add API Key First
                </button>
              )}
              <button
                type="submit"
                className="launcher-deploy-btn"
                disabled={!goal.trim() || isDeploying || isBusy || !hasBackend}
                title="Cmd/Ctrl + Enter to deploy"
              >
                {isDeploying ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span>Summoning Zeus…</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>Deploy Pantheon</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="launcher-templates">
            <span className="templates-label">
              <Sparkles size={11} />
              Try a template:
            </span>
            {MISSION_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                className="template-chip"
                onClick={() => setGoal(tpl.prompt)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  );
}
