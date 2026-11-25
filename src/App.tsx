import { BotGraphCanvas } from './components/graph/BotGraphCanvas';
import { HeaderToolbar } from './components/header/HeaderToolbar';
import { LogInspectorPanel } from './components/inspector/LogInspectorPanel';
import { useBotSimulation } from './hooks/useBotSimulation';
import type { BotEntity } from './types/bot';
import './App.css';

export function App() {
  const {
    bots,
    rootId,
    selectedBotId,
    isSimulating,
    layoutVersion,
    stats,
    selectedBot,
    toggleSimulation,
    selectBot,
    spawnManualBot,
    resetSimulation,
    triggerAutoLayout,
  } = useBotSimulation();

  const parentBot: BotEntity | null =
    selectedBot?.parentId ? bots[selectedBot.parentId] ?? null : null;

  const childBots: BotEntity[] =
    selectedBot?.childIds
      .map((id) => bots[id])
      .filter((child): child is BotEntity => Boolean(child)) ?? [];

  return (
    <div className="app-shell">
      <HeaderToolbar
        isSimulating={isSimulating}
        stats={stats}
        selectedBotName={selectedBot?.name ?? null}
        onToggleSimulation={toggleSimulation}
        onSpawnBot={() => spawnManualBot()}
        onReset={resetSimulation}
        onAutoLayout={triggerAutoLayout}
      />
      <main className="app-workspace">
        <div className="canvas-pane">
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
          onSelectBot={selectBot}
          onSpawnChild={spawnManualBot}
        />
      </main>
    </div>
  );
}

export default App;
