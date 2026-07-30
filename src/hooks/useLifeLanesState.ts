import { useCallback, useEffect, useMemo, useState } from "react";
import { createBoardState } from "../data";
import { loadState, normalizeState, saveState } from "../storage";
import { type BoardState } from "../types";

export type BoardPreset = "draft" | "demo";
export type BoardUpdater = (current: BoardState) => BoardState;

export function useLifeLanesState() {
  const [personalState, setPersonalState] = useState<BoardState>(() => loadState());
  const [demoState, setDemoState] = useState<BoardState>(() => createBoardState("demo"));
  const [preset, setPreset] = useState<BoardPreset>("draft");

  useEffect(() => {
    saveState(personalState);
  }, [personalState]);

  const state = preset === "demo" ? demoState : personalState;

  const updateState = useCallback(
    (updater: BoardUpdater) => {
      if (preset === "demo") {
        setDemoState((current) => updater(current));
        return;
      }

      setPersonalState((current) => updater(current));
    },
    [preset],
  );

  const switchPreset = useCallback((nextPreset: BoardPreset) => {
    setPreset(nextPreset);
  }, []);

  const resetDemo = useCallback(() => {
    setDemoState(createBoardState("demo"));
    setPreset("demo");
  }, []);

  const resetPersonal = useCallback(() => {
    setPersonalState(createBoardState("draft"));
    setPreset("draft");
  }, []);

  const exportPersonalState = useCallback(() => JSON.stringify(personalState, null, 2), [personalState]);

  const importPersonalState = useCallback((value: unknown) => {
    const normalized = normalizeState(value);
    if (!normalized || normalized.preset === "demo") {
      return false;
    }

    setPersonalState({ ...normalized, preset: "draft" });
    setPreset("draft");
    return true;
  }, []);

  return useMemo(
    () => ({
      state,
      preset,
      personalState,
      updateState,
      switchPreset,
      resetDemo,
      resetPersonal,
      exportPersonalState,
      importPersonalState,
    }),
    [
      exportPersonalState,
      importPersonalState,
      personalState,
      preset,
      resetDemo,
      resetPersonal,
      state,
      switchPreset,
      updateState,
    ],
  );
}
