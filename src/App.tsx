import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { DetailsDrawer } from './components/details/DetailsDrawer';
import { BotGraphCanvas } from './components/graph/BotGraphCanvas';
import { HeaderToolbar } from './components/header/HeaderToolbar';
import { ClarificationModal } from './components/mission/ClarificationModal';
import { MissionLauncher } from './components/mission/MissionLauncher';
import { MissionReportModal } from './components/mission/MissionReportModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { AgentSidebar } from './components/sidebar/AgentSidebar';
import { useNow } from './hooks/useNow';
import { usePantheon } from './hooks/usePantheon';
import { useTheme } from './hooks/useTheme';
import { formatElapsed } from './utils/format';
import { isTypingTarget } from './utils/keyboard';
import './App.css';

const SIDEBAR_KEY = 'pantheon-sidebar-open';

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function App() {
  const {
    settings,
    updateSettings,
    capabilities,
    runtimeMode,
    switchRuntime,
    showingLiveMission,
    activeMission,
    missionHistory,
    bots,
    rootId,
    selectedBotId,
    selectedBot,
    selectBot,
    stats,
    layoutVersion,
    triggerAutoLayout,
    bannerError,
    clearBannerError,
    isDeploying,
    isMissionActive,
    hasKeyReady,
    isDemoSimulating,
    toggleDemoSimulation,
    resetDemo,
    deployMission,
    submitClarifications,
    abortMission,
    selectMission,
    deleteMission,
    spawnChildBot,
  } = usePantheon();

  const { theme, toggleTheme } = useTheme();
  const isActiveRun = runtimeMode === 'demo' ? isDemoSimulating : isMissionActive || isDeploying;
  const now = useNow(isActiveRun);

  const [isSidebarOpen, setIsSidebarOpen] = useState(readSidebarPreference);
  const [launcherExpanded, setLauncherExpanded] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);

  const filterInputRef = useRef<HTMLInputElement>(null);
  const launcherInputRef = useRef<HTMLTextAreaElement>(null);

  // Collapse MissionLauncher when switching back to Demo mode so the map stays unobstructed.
  useEffect(() => {
    if (runtimeMode === 'demo') {
      setLauncherExpanded(false);
    }
  }, [runtimeMode]);

  // Auto-open Zeus's Clarification Modal whenever a mission enters waiting_for_input.
  useEffect(() => {
    if (
      activeMission?.status === 'waiting_for_input' &&
      activeMission.questions.length > 0
    ) {
      setClarifyOpen(true);
    } else if (activeMission?.status !== 'waiting_for_input') {
      setClarifyOpen(false);
    }
  }, [activeMission?.id, activeMission?.status, activeMission?.questions.length]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // Preference just won't persist.
      }
      return next;
    });
  }, []);

  const openSearch = useCallback(() => {
    setIsSidebarOpen(true);
    requestAnimationFrame(() => filterInputRef.current?.focus());
  }, []);

  const openLauncher = useCallback(() => {
    setLauncherExpanded(true);
    requestAnimationFrame(() => launcherInputRef.current?.focus());
  }, []);

  const toggleLauncher = useCallback(() => {
    setLauncherExpanded((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => launcherInputRef.current?.focus());
      }
      return next;
    });
  }, []);

  const spawnDemoFromToolbar = useCallback(
    () => void spawnChildBot(selectedBotId ?? rootId),
    [spawnChildBot, selectedBotId, rootId],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        if (event.key === 'Escape' && isTypingTarget(event.target)) {
          (event.target as HTMLElement).blur();
        }
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        toggleSidebar();
      } else if (event.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else if (reportOpen) {
          setReportOpen(false);
        } else if (clarifyOpen) {
          setClarifyOpen(false);
        } else if (launcherExpanded) {
          setLauncherExpanded(false);
        } else {
          selectBot(null);
        }
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        if (runtimeMode === 'demo') {
          spawnDemoFromToolbar();
        } else {
          openLauncher();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    openSearch,
    toggleSidebar,
    selectBot,
    spawnDemoFromToolbar,
    openLauncher,
    runtimeMode,
    settingsOpen,
    reportOpen,
    clarifyOpen,
    launcherExpanded,
  ]);

  const root = bots[rootId];
  const elapsedMs = (() => {
    if (showingLiveMission && activeMission) {
      const endMs = activeMission.completedAt
        ? new Date(activeMission.completedAt).getTime()
        : isMissionActive || isDeploying
          ? now
          : new Date(activeMission.updatedAt).getTime();
      return Math.max(0, endMs - new Date(activeMission.createdAt).getTime());
    }
    return root ? Math.max(0, now - new Date(root.createdAt).getTime()) : 0;
  })();
  const elapsedLabel = formatElapsed(elapsedMs);

  const canSpawnChild =
    runtimeMode === 'demo' || (runtimeMode === 'local' && activeMission !== null);

  return (
    <div className={`app-shell ${isActiveRun ? '' : 'is-paused'}`}>
      <HeaderToolbar
        runtimeMode={runtimeMode}
        detectedBackend={capabilities?.runtime ?? null}
        activeMission={activeMission}
        isBusy={isMissionActive || isDeploying}
        isDemoSimulating={isDemoSimulating}
        elapsedLabel={elapsedLabel}
        selectedBotName={selectedBot?.name ?? null}
        isSidebarOpen={isSidebarOpen}
        theme={theme}
        hasReport={Boolean(activeMission?.finalReport)}
        hasKeyReady={hasKeyReady}
        onToggleSidebar={toggleSidebar}
        onToggleTheme={toggleTheme}
        onOpenSearch={openSearch}
        onSwitchRuntime={switchRuntime}
        onToggleDemoSimulation={toggleDemoSimulation}
        onSpawnDemoBot={spawnDemoFromToolbar}
        onResetDemo={resetDemo}
        onToggleLauncher={toggleLauncher}
        onOpenClarification={() => setClarifyOpen(true)}
        onAbortMission={() => void abortMission()}
        onOpenReport={() => setReportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {bannerError && (
        <div className="app-error-banner" role="alert">
          <AlertCircle size={15} />
          <span>{bannerError}</span>
          <button
            type="button"
            className="btn btn-ghost btn-icon app-error-close"
            onClick={clearBannerError}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="app-body">
        <AgentSidebar
          bots={bots}
          rootId={rootId}
          selectedBotId={selectedBotId}
          stats={stats}
          isOpen={isSidebarOpen}
          filterInputRef={filterInputRef}
          missionHistory={missionHistory}
          activeMissionId={activeMission?.id ?? null}
          onSelectBot={selectBot}
          onSelectMission={(id) => {
            void selectMission(id);
            setLauncherExpanded(false);
          }}
          onDeleteMission={(id) => void deleteMission(id)}
          onClose={toggleSidebar}
        />

        <main className="app-main">
          <div className="app-canvas">
            <MissionLauncher
              defaultContextMode={settings.defaultContextMode}
              defaultDepth={settings.defaultDepth}
              isExpanded={launcherExpanded}
              onSetExpanded={setLauncherExpanded}
              inputRef={launcherInputRef}
              isDeploying={isDeploying}
              isBusy={isMissionActive}
              hasKeyReady={hasKeyReady}
              hasBackend={Boolean(capabilities)}
              activeMission={activeMission}
              missionHistory={missionHistory}
              onDeploy={deployMission}
              onSelectMission={(id) => {
                void selectMission(id);
              }}
              onDeleteMission={(id) => void deleteMission(id)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenClarification={() => setClarifyOpen(true)}
            />

            <BotGraphCanvas
              bots={bots}
              rootId={rootId}
              selectedBotId={selectedBotId}
              layoutVersion={layoutVersion}
              focusRequest={focusRequest}
              onSelectBot={selectBot}
              onAutoLayout={triggerAutoLayout}
            />
          </div>

          <DetailsDrawer
            bot={selectedBot}
            bots={bots}
            rootId={rootId}
            now={now}
            isActiveRun={isActiveRun}
            runtimeMode={runtimeMode}
            canSpawnLiveChild={canSpawnChild}
            hasMissionReport={Boolean(activeMission?.finalReport)}
            onSelectBot={selectBot}
            onSpawnChild={(parentId, role, task) => void spawnChildBot(parentId, role, task)}
            onCenterOnMap={() => setFocusRequest((count) => count + 1)}
            onOpenReport={() => setReportOpen(true)}
          />
        </main>
      </div>

      {activeMission && (
        <ClarificationModal
          mission={activeMission}
          isOpen={clarifyOpen}
          isSubmitting={isDeploying}
          onClose={() => setClarifyOpen(false)}
          onSubmit={(answers, skip) => {
            void submitClarifications(answers, skip);
          }}
        />
      )}

      <MissionReportModal
        mission={activeMission}
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
      />

      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        capabilities={capabilities}
        onUpdateSettings={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
