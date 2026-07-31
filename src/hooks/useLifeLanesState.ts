import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOARD_SCHEMA_VERSION, createBoardState, nowStamp } from "../data";
import {
  BOARD_STORAGE_KEY,
  inspectImport,
  loadStateResult,
  mergeStates,
  normalizeState,
  saveRecoveryState,
  saveState,
  type ImportPreview,
  type PersistenceIssue,
} from "../storage";
import { type BoardState } from "../types";

export type BoardPreset = "draft" | "demo";
export type BoardUpdater = (current: BoardState) => BoardState;
export type ImportMode = "replace" | "merge";

function nextStateStamp(previousStamp: string) {
  const previousTime = new Date(previousStamp).getTime();
  return new Date(Math.max(Date.now(), Number.isNaN(previousTime) ? 0 : previousTime + 1)).toISOString();
}

export function useLifeLanesState() {
  const [initialLoad] = useState(loadStateResult);
  const [personalState, setPersonalState] = useState<BoardState>(initialLoad.state);
  const [demoState, setDemoState] = useState<BoardState>(() => createBoardState("demo"));
  const [preset, setPreset] = useState<BoardPreset>("draft");
  const [persistenceIssue, setPersistenceIssue] = useState<PersistenceIssue | null>(
    initialLoad.issue,
  );
  const personalStateRef = useRef(personalState);
  const pendingSaveRef = useRef<BoardState | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const state = preset === "demo" ? demoState : personalState;

  const persistState = useCallback((nextState: BoardState) => {
    const result = saveState(nextState);
    setPersistenceIssue(result.ok ? null : result.issue);
    return result.ok;
  }, []);

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    return pending ? persistState(pending) : true;
  }, [persistState]);

  const commitPersonalState = useCallback((nextState: BoardState, immediate = false) => {
    const committed: BoardState = {
      ...nextState,
      schemaVersion: BOARD_SCHEMA_VERSION,
      preset: "draft",
      updatedAt: nextStateStamp(personalStateRef.current.updatedAt),
    };
    personalStateRef.current = committed;
    setPersonalState(committed);
    pendingSaveRef.current = committed;
    if (immediate) return flushPendingSave();
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushPendingSave, 120);
    return true;
  }, [flushPendingSave]);

  const updateState = useCallback(
    (updater: BoardUpdater) => {
      if (preset === "demo") {
        setDemoState((current) => {
          const next = updater(current);
          return next === current ? current : { ...next, updatedAt: nowStamp() };
        });
        return;
      }

      const current = personalStateRef.current;
      const nextState = updater(current);
      if (nextState === current) return;
      commitPersonalState(nextState);
    },
    [commitPersonalState, preset],
  );

  useEffect(() => {
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== BOARD_STORAGE_KEY || !event.newValue) return;
      if (pendingSaveRef.current) return;
      try {
        const incoming = normalizeState(JSON.parse(event.newValue));
        if (
          !incoming ||
          incoming.preset === "demo" ||
          incoming.updatedAt <= personalStateRef.current.updatedAt
        ) {
          return;
        }
        const synced = { ...incoming, preset: "draft" as const };
        personalStateRef.current = synced;
        setPersonalState(synced);
        setPersistenceIssue(null);
      } catch {
        setPersistenceIssue({
          kind: "load",
          message: "A change from another tab could not be read. This tab has kept its current board.",
        });
      }
    };

    window.addEventListener("storage", syncFromAnotherTab);
    return () => window.removeEventListener("storage", syncFromAnotherTab);
  }, []);

  useEffect(() => {
    const flushWhenLeaving = () => flushPendingSave();
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushPendingSave();
    };
    window.addEventListener("pagehide", flushWhenLeaving);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushWhenLeaving);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const switchPreset = useCallback((nextPreset: BoardPreset) => {
    setPreset(nextPreset);
  }, []);

  const resetDemo = useCallback(() => {
    setDemoState(createBoardState("demo"));
    setPreset("demo");
  }, []);

  const replacePersonalState = useCallback(
    (nextState: BoardState, keepRecovery = true) => {
      if (keepRecovery) saveRecoveryState(personalStateRef.current);
      const saved = commitPersonalState(nextState, true);
      setPreset("draft");
      return saved;
    },
    [commitPersonalState],
  );

  const resetPersonal = useCallback(() => {
    replacePersonalState(createBoardState("draft"));
  }, [replacePersonalState]);

  const exportPersonalState = useCallback(
    () => JSON.stringify(personalStateRef.current, null, 2),
    [],
  );

  const previewPersonalImport = useCallback(
    (value: unknown): ImportPreview | null => inspectImport(value),
    [],
  );

  const importPersonalState = useCallback(
    (value: unknown, mode: ImportMode) => {
      const preview = inspectImport(value);
      if (!preview) return false;
      const nextState =
        mode === "merge"
          ? mergeStates(personalStateRef.current, preview.state)
          : preview.state;
      replacePersonalState(nextState);
      return true;
    },
    [replacePersonalState],
  );

  const dismissPersistenceIssue = useCallback(() => {
    setPersistenceIssue(null);
  }, []);

  return useMemo(
    () => ({
      state,
      preset,
      personalState,
      persistenceIssue,
      updateState,
      switchPreset,
      resetDemo,
      resetPersonal,
      replacePersonalState,
      exportPersonalState,
      previewPersonalImport,
      importPersonalState,
      dismissPersistenceIssue,
    }),
    [
      dismissPersistenceIssue,
      importPersonalState,
      personalState,
      persistenceIssue,
      preset,
      previewPersonalImport,
      replacePersonalState,
      resetDemo,
      resetPersonal,
      state,
      switchPreset,
      updateState,
    ],
  );
}
