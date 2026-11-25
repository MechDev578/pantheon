import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { BotGraphCanvas } from './components/graph/BotGraphCanvas';
import { HeaderToolbar } from './components/header/HeaderToolbar';
import { LogInspectorPanel } from './components/inspector/LogInspectorPanel';
import { ClarificationModal } from './components/mission/ClarificationModal';
import { MissionLauncher } from './components/mission/MissionLauncher';
import { MissionReportModal } from './components/mission/MissionReportModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { usePantheon } from './hooks/usePantheon';
import type { BotEntity } from './types/bot';
import './App.css';

export function App() {
  const {
    settings,
    updateSettings,
    capabilities,
    runtimeMode,
    switchRuntime,
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);

  // Auto-open Zeus's Clarification Modal whenever a mission enters waiting_for_input
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

  const parentBot: BotEntity | null =
    selectedBot?.parentId ? (bots[selectedBot.parentId] ?? null) : null;

  const childBots: BotEntity[] =
    selectedBot?.childIds
      .map((id) => bots[id])
      .filter((child): child is BotEntity => Boolean(child)) ?? [];

  const canSpawnChild =
    runtimeMode === 'demo' || (runtimeMode === 'local' && activeMission !== null);

  return (
    <div className="app-shell">
      <HeaderToolbar
        runtimeMode={runtimeMode}
        detectedBackend={capabilities?.runtime ?? null}
        isBusy={isMissionActive || isDeploying}
        isDemoSimulating={isDemoSimulating}
        hasReport={Boolean(activeMission?.finalReport)}
        hasKeyReady={hasKeyReady}
        stats={stats}
        onSwitchRuntime={switchRuntime}
        onToggleDemoSimulation={toggleDemoSimulation}
        onAbortMission={abortMission}
        onOpenReport={() => setReportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onAutoLayout={triggerAutoLayout}
        onResetDemo={resetDemo}
      />

      {bannerError && (
        <div className="app-error-banner" role="alert">
          <AlertCircle size={15} />
          <span>{bannerError}</span>
          <button
            type="button"
            className="app-error-close"
            onClick={clearBannerError}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <main className="app-workspace">
        <div className="canvas-pane">
          <MissionLauncher
            defaultContextMode={settings.defaultContextMode}
            defaultDepth={settings.defaultDepth}
            isDeploying={isDeploying}
            isBusy={isMissionActive}
            hasKeyReady={hasKeyReady}
            hasBackend={Boolean(capabilities)}
            activeMission={activeMission}
            missionHistory={missionHistory}
            onDeploy={deployMission}
            onSelectMission={selectMission}
            onDeleteMission={deleteMission}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenClarification={() => setClarifyOpen(true)}
          />

          <BotGraphCanvas
            bots={bots}
            rootId={rootId}
            selectedBotId={selectedBotId}
            layoutVersion={layoutVersion}
            onSelectBot={selectBot}
          />
        </div>

        <LogInspectorPanel
          bot={selectedBot}
          parentBot={parentBot}
          childBots={childBots}
          canSpawnLiveChild={canSpawnChild}
          hasMissionReport={Boolean(activeMission?.finalReport)}
          onSelectBot={selectBot}
          onSpawnChild={spawnChildBot}
          onOpenReport={() => setReportOpen(true)}
        />
      </main>

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
