import { useCallback, useMemo, useRef, useState } from "react";
import { createBoardState } from "../data";
import { loadState, normalizeState, saveState } from "../storage";
import { type BoardState } from "../types";

export type BoardPreset = "draft" | "demo";
export type BoardUpdater = (current: BoardState) => BoardState;

export function useLifeLanesState() {
  const [personalState, setPersonalState] = useState<BoardState>(() => loadState());
  const [demoState, setDemoState] = useState<BoardState>(() => createBoardState("demo"));
  const [preset, setPreset] = useState<BoardPreset>("draft");
  const personalStateRef = useRef(personalState);

  const state = preset === "demo" ? demoState : personalState;

  const updateState = useCallback(
    (updater: BoardUpdater) => {
      if (preset === "demo") {
        setDemoState((current) => updater(current));
        return;
      }

      const nextState = updater(personalStateRef.current);
      personalStateRef.current = nextState;
      saveState(nextState);
      setPersonalState(nextState);
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
    const nextState = createBoardState("draft");
    personalStateRef.current = nextState;
    saveState(nextState);
    setPersonalState(nextState);
    setPreset("draft");
  }, []);

  const exportPersonalState = useCallback(() => JSON.stringify(personalState, null, 2), [personalState]);

  const importPersonalState = useCallback((value: unknown) => {
    const normalized = normalizeState(value);
    if (!normalized || normalized.preset === "demo") {
      return false;
    }

    const nextState: BoardState = { ...normalized, preset: "draft" };
    personalStateRef.current = nextState;
    saveState(nextState);
    setPersonalState(nextState);
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
