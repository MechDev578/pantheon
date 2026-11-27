import { useCallback, useEffect, useRef, useState } from 'react';
import { DetailsDrawer } from './components/details/DetailsDrawer';
import { BotGraphCanvas } from './components/graph/BotGraphCanvas';
import { HeaderToolbar } from './components/header/HeaderToolbar';
import { AgentSidebar } from './components/sidebar/AgentSidebar';
import { useBotSimulation } from './hooks/useBotSimulation';
import { useNow } from './hooks/useNow';
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

  const { theme, toggleTheme } = useTheme();
  const now = useNow(isSimulating);
  const [isSidebarOpen, setIsSidebarOpen] = useState(readSidebarPreference);
  const [focusRequest, setFocusRequest] = useState(0);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const root = bots[rootId];
  const elapsedLabel = root ? formatElapsed(now - new Date(root.createdAt).getTime()) : '00:00';

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
    // Wait for the sidebar to become focusable before moving focus into it.
    requestAnimationFrame(() => filterInputRef.current?.focus());
  }, []);

  const spawnFromToolbar = useCallback(() => spawnManualBot(selectedBotId ?? undefined), [spawnManualBot, selectedBotId]);

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
        selectBot(null);
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        spawnFromToolbar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch, toggleSidebar, selectBot, spawnFromToolbar]);

  return (
    <div className={`app-shell ${isSimulating ? '' : 'is-paused'}`}>
      <HeaderToolbar
        isSimulating={isSimulating}
        elapsedLabel={elapsedLabel}
        selectedBotName={selectedBot?.name ?? null}
        isSidebarOpen={isSidebarOpen}
        theme={theme}
        onToggleSidebar={toggleSidebar}
        onToggleTheme={toggleTheme}
        onOpenSearch={openSearch}
        onToggleSimulation={toggleSimulation}
        onSpawnBot={spawnFromToolbar}
        onReset={resetSimulation}
      />
      <div className="app-body">
        <AgentSidebar
          bots={bots}
          rootId={rootId}
          selectedBotId={selectedBotId}
          stats={stats}
          isOpen={isSidebarOpen}
          filterInputRef={filterInputRef}
          onSelectBot={selectBot}
          onClose={toggleSidebar}
        />
        <main className="app-main">
          <div className="app-canvas">
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
            isSimulating={isSimulating}
            onSelectBot={selectBot}
            onSpawnChild={spawnManualBot}
            onCenterOnMap={() => setFocusRequest((count) => count + 1)}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
