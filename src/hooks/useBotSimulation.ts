import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  advanceSimulationTick,
  createInitialSimulationState,
  createManualChildBot,
} from '../engine/mockOrchestrator';
import type {
  BotEntity,
  BotSimulationState,
  SimulationStats,
  UseBotSimulationResult,
} from '../types/bot';

const TICK_INTERVAL_MS = 1400;

export function useBotSimulation(): UseBotSimulationResult {
  const [state, setState] = useState<BotSimulationState>(() =>
    createInitialSimulationState(),
  );

  useEffect(() => {
    if (!state.isSimulating) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setState((prev) =>
        prev.isSimulating ? advanceSimulationTick(prev) : prev,
      );
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.isSimulating]);

  const stats = useMemo<SimulationStats>(() => {
    const bots = Object.values(state.bots);
    let running = 0;
    let idle = 0;
    let done = 0;

    for (const bot of bots) {
      if (bot.status === 'running') {
        running += 1;
      } else if (bot.status === 'idle') {
        idle += 1;
      } else {
        done += 1;
      }
    }

    return {
      total: bots.length,
      running,
      idle,
      done,
    };
  }, [state.bots]);

  const selectedBot = useMemo<BotEntity | null>(
    () =>
      state.selectedBotId ? (state.bots[state.selectedBotId] ?? null) : null,
    [state.bots, state.selectedBotId],
  );

  const toggleSimulation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isSimulating: !prev.isSimulating,
    }));
  }, []);

  const selectBot = useCallback((botId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedBotId: botId !== null && prev.bots[botId] ? botId : null,
    }));
  }, []);

  const spawnManualBot = useCallback((parentId?: string) => {
    setState((prev) => createManualChildBot(prev, parentId));
  }, []);

  const resetSimulation = useCallback(() => {
    setState((prev) => ({
      ...createInitialSimulationState(),
      layoutVersion: prev.layoutVersion + 1,
    }));
  }, []);

  const triggerAutoLayout = useCallback(() => {
    setState((prev) => ({
      ...prev,
      layoutVersion: prev.layoutVersion + 1,
    }));
  }, []);

  return {
    ...state,
    stats,
    selectedBot,
    toggleSimulation,
    selectBot,
    spawnManualBot,
    resetSimulation,
    triggerAutoLayout,
  };
}
