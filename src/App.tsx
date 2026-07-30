import { useEffect, useMemo, useState } from "react";
import {
  achievementColumnId,
  achievementColumns,
  activeColumns,
  isAchievementColumn,
} from "./board-utils";
import { AchievementsView } from "./components/AchievementsView";
import { AppHeader } from "./components/AppHeader";
import { BoardMatrix } from "./components/BoardMatrix";
import { BrainDumpView } from "./components/BrainDumpView";
import {
  ItemDialog,
  ManageBoardDialog,
  TriageDialog,
} from "./components/Dialogs";
import {
  CompletionFlight,
  Toast,
  TourBar,
} from "./components/Feedback";
import {
  createColumn,
  createId,
  createLifeLane,
  nowStamp,
} from "./data";
import { useLifeLanesState } from "./hooks/useLifeLanesState";
import { TOUR_STEPS } from "./tour";
import {
  type ItemDraft,
  type ItemEditorState,
  type ToastMessage,
  type ViewId,
} from "./ui-types";
import {
  type BoardItem,
  type BoardState,
  type DraftNote,
} from "./types";

const TOAST_DURATION = 5000;

function fallbackActiveColumn(state: BoardState) {
  const columns = activeColumns(state.columns);
  return (
    columns.find((column) => /to do|next|later/i.test(column.title)) ??
    columns[0]
  );
}

function downloadJson(value: string) {
  const blob = new Blob([value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `life-lanes-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function replaceCellOrder(
  items: BoardItem[],
  column: string,
  laneId: string,
  orderedIds: string[],
) {
  const ordered = orderedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is BoardItem => Boolean(item));
  let index = 0;

  return items.map((item) => {
    if (item.column !== column || item.laneId !== laneId) {
      return item;
    }

    const next = ordered[index];
    index += 1;
    return next ?? item;
  });
}

export default function App() {
  const {
    state,
    preset,
    updateState,
    switchPreset,
    resetDemo,
    resetPersonal,
    exportPersonalState,
    importPersonalState,
  } = useLifeLanesState();

  const [activeView, setActiveView] = useState<ViewId>("board");
  const [editor, setEditor] = useState<ItemEditorState | null>(null);
  const [triageDraft, setTriageDraft] = useState<DraftNote | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);

  const achievementIds = useMemo(
    () => new Set(achievementColumns(state.columns).map((column) => column.id)),
    [state.columns],
  );
  const activeItems = useMemo(
    () => state.items.filter((item) => !achievementIds.has(item.column)),
    [achievementIds, state.items],
  );
  const completedItems = useMemo(
    () => state.items.filter((item) => achievementIds.has(item.column)),
    [achievementIds, state.items],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!celebrationId) return;
    const timer = window.setTimeout(() => setCelebrationId(null), 2100);
    return () => window.clearTimeout(timer);
  }, [celebrationId]);

  useEffect(() => {
    if (tourStep === null) return;
    setActiveView(TOUR_STEPS[tourStep].view);
  }, [tourStep]);

  useEffect(() => {
    if (tourStep === null) return;

    const frame = window.requestAnimationFrame(() => {
      document
        .querySelectorAll(".tour-highlight")
        .forEach((element) => element.classList.remove("tour-highlight"));
      const target = document.querySelector(TOUR_STEPS[tourStep].target);
      target?.classList.add("tour-highlight");
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document
        .querySelectorAll(".tour-highlight")
        .forEach((element) => element.classList.remove("tour-highlight"));
    };
  }, [activeView, tourStep]);

  const showToast = (
    message: string,
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToast({
      id: createId("toast"),
      message,
      actionLabel,
      onAction,
    });
  };

  const openNewItem = (column: string, laneId: string) => {
    setEditor({ mode: "create", column, laneId });
  };

  const saveItem = (draft: ItemDraft) => {
    const stamp = nowStamp();

    if (editor?.mode === "edit") {
      const itemId = editor.item.id;
      updateState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                ...draft,
                startDate: draft.startDate || undefined,
                endDate: draft.endDate || undefined,
                updatedAt: stamp,
              }
            : item,
        ),
      }));
      setEditor(null);
      showToast("Item updated");
      return;
    }

    updateState((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId("item"),
          ...draft,
          startDate: draft.startDate || undefined,
          endDate: draft.endDate || undefined,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    }));
    setEditor(null);
    showToast("Item added");
  };

  const deleteItem = (item: BoardItem) => {
    const originalIndex = state.items.findIndex((candidate) => candidate.id === item.id);
    updateState((current) => ({
      ...current,
      items: current.items.filter((candidate) => candidate.id !== item.id),
    }));
    setEditor(null);
    showToast("Item deleted", "Undo", () => {
      updateState((current) => {
        if (current.items.some((candidate) => candidate.id === item.id)) {
          return current;
        }
        const items = [...current.items];
        items.splice(Math.max(0, Math.min(originalIndex, items.length)), 0, item);
        return { ...current, items };
      });
      setToast(null);
    });
  };

  const completeItem = (item: BoardItem) => {
    const doneColumn = achievementColumnId(state.columns);
    const previousColumn = item.column;
    const stamp = nowStamp();

    updateState((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, column: doneColumn, updatedAt: stamp }
          : candidate,
      ),
    }));
    setEditor(null);
    setCelebrationId(createId("celebration"));
    showToast("Added to Achievements", "Undo", () => {
      updateState((current) => ({
        ...current,
        items: current.items.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, column: previousColumn, updatedAt: nowStamp() }
            : candidate,
        ),
      }));
      setToast(null);
    });
  };

  const restoreItem = (item: BoardItem) => {
    const destination = fallbackActiveColumn(state);
    if (!destination) return;
    updateState((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, column: destination.id, updatedAt: nowStamp() }
          : candidate,
      ),
    }));
    showToast(`Restored to ${destination.title}`);
  };

  const moveItem = (
    itemId: string,
    column: string,
    laneId: string,
    targetItemId?: string,
  ) => {
    updateState((current) => {
      const source = current.items.find((item) => item.id === itemId);
      if (!source) return current;

      if (
        targetItemId &&
        source.column === column &&
        source.laneId === laneId
      ) {
        const cellItems = current.items.filter(
          (item) => item.column === column && item.laneId === laneId,
        );
        const from = cellItems.findIndex((item) => item.id === itemId);
        const to = cellItems.findIndex((item) => item.id === targetItemId);
        if (from < 0 || to < 0 || from === to) return current;

        const ids = cellItems.map((item) => item.id);
        const [movedId] = ids.splice(from, 1);
        ids.splice(to, 0, movedId);
        return {
          ...current,
          items: replaceCellOrder(current.items, column, laneId, ids),
        };
      }

      const moved: BoardItem = {
        ...source,
        column,
        laneId,
        updatedAt: nowStamp(),
      };
      const items = current.items.filter((item) => item.id !== itemId);

      if (targetItemId) {
        const targetIndex = items.findIndex((item) => item.id === targetItemId);
        if (targetIndex >= 0) {
          items.splice(targetIndex, 0, moved);
          return { ...current, items };
        }
      }

      const lastTargetIndex = items.reduce(
        (latest, item, index) =>
          item.column === column && item.laneId === laneId ? index : latest,
        -1,
      );
      items.splice(lastTargetIndex + 1, 0, moved);
      return { ...current, items };
    });
  };

  const captureDraft = (text: string) => {
    const stamp = nowStamp();
    updateState((current) => ({
      ...current,
      drafts: [
        {
          id: createId("draft"),
          text,
          createdAt: stamp,
          updatedAt: stamp,
        },
        ...current.drafts,
      ],
    }));
    showToast("Saved to Triage");
  };

  const deleteDraft = (draft: DraftNote) => {
    const originalIndex = state.drafts.findIndex(
      (candidate) => candidate.id === draft.id,
    );
    updateState((current) => ({
      ...current,
      drafts: current.drafts.filter((candidate) => candidate.id !== draft.id),
    }));
    showToast("Note deleted", "Undo", () => {
      updateState((current) => {
        if (current.drafts.some((candidate) => candidate.id === draft.id)) {
          return current;
        }
        const drafts = [...current.drafts];
        drafts.splice(Math.max(0, Math.min(originalIndex, drafts.length)), 0, draft);
        return { ...current, drafts };
      });
      setToast(null);
    });
  };

  const placeDraft = (choice: {
    title: string;
    note: string;
    column: string;
    laneId: string;
  }) => {
    if (!triageDraft) return;
    const stamp = nowStamp();
    const draftId = triageDraft.id;
    updateState((current) => ({
      ...current,
      drafts: current.drafts.filter((draft) => draft.id !== draftId),
      items: [
        ...current.items,
        {
          id: createId("item"),
          ...choice,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    }));
    setTriageDraft(null);
    showToast("Placed on your board", "View", () => {
      setActiveView("board");
      setToast(null);
    });
  };

  const addLane = (name: string) => {
    updateState((current) => ({
      ...current,
      lanes: [...current.lanes, createLifeLane(name, current.lanes.length)],
    }));
  };

  const renameLane = (id: string, name: string) => {
    updateState((current) => ({
      ...current,
      lanes: current.lanes.map((lane) =>
        lane.id === id ? { ...lane, name } : lane,
      ),
    }));
  };

  const deleteLane = (id: string) => {
    const lane = state.lanes.find((candidate) => candidate.id === id);
    if (!lane || state.lanes.length <= 1) return;
    const itemCount = state.items.filter((item) => item.laneId === id).length;
    if (
      itemCount > 0 &&
      !window.confirm(
        `Delete ${lane.name}? Its ${itemCount} item${itemCount === 1 ? "" : "s"} will move to another Life Lane.`,
      )
    ) {
      return;
    }

    updateState((current) => {
      const fallback = current.lanes.find((candidate) => candidate.id !== id);
      if (!fallback) return current;
      return {
        ...current,
        lanes: current.lanes.filter((candidate) => candidate.id !== id),
        items: current.items.map((item) =>
          item.laneId === id ? { ...item, laneId: fallback.id } : item,
        ),
      };
    });
  };

  const addColumn = (name: string) => {
    updateState((current) => {
      const doneIndex = current.columns.findIndex(isAchievementColumn);
      const columns = [...current.columns];
      columns.splice(doneIndex >= 0 ? doneIndex : columns.length, 0, createColumn(name));
      return { ...current, columns };
    });
  };

  const renameColumn = (id: string, name: string) => {
    updateState((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === id && !isAchievementColumn(column)
          ? { ...column, title: name }
          : column,
      ),
    }));
  };

  const deleteColumn = (id: string) => {
    const column = state.columns.find((candidate) => candidate.id === id);
    const available = activeColumns(state.columns);
    if (!column || isAchievementColumn(column) || available.length <= 1) return;
    const itemCount = state.items.filter((item) => item.column === id).length;
    if (
      itemCount > 0 &&
      !window.confirm(
        `Delete ${column.title}? Its ${itemCount} item${itemCount === 1 ? "" : "s"} will move to another state.`,
      )
    ) {
      return;
    }

    updateState((current) => {
      const fallback = activeColumns(current.columns).find(
        (candidate) => candidate.id !== id,
      );
      if (!fallback) return current;
      return {
        ...current,
        columns: current.columns.filter((candidate) => candidate.id !== id),
        items: current.items.map((item) =>
          item.column === id ? { ...item, column: fallback.id } : item,
        ),
      };
    });
  };

  const resetBoard = () => {
    const boardName = preset === "demo" ? "the demo" : "your board";
    if (!window.confirm(`Reset ${boardName}? This cannot be undone.`)) return;
    if (preset === "demo") {
      resetDemo();
    } else {
      resetPersonal();
    }
    setManageOpen(false);
    showToast(preset === "demo" ? "Demo reset" : "Board cleared");
  };

  const changePreset = (nextPreset: "draft" | "demo") => {
    switchPreset(nextPreset);
    setActiveView("board");
    setEditor(null);
    setTriageDraft(null);
    setManageOpen(false);
    setTourStep(null);
    setToast(null);
  };

  const startTour = () => {
    if (preset !== "demo") {
      switchPreset("demo");
    }
    setTourStep(0);
  };

  return (
    <div className="app-shell">
      <AppHeader
        activeView={activeView}
        preset={preset}
        onChangeView={setActiveView}
        onChangePreset={changePreset}
        onStartTour={startTour}
      />

      {tourStep !== null ? (
        <TourBar
          step={tourStep}
          onStep={setTourStep}
          onClose={() => setTourStep(null)}
        />
      ) : null}

      {activeView === "board" ? (
        <BoardMatrix
          state={state}
          onCreateItem={openNewItem}
          onEditItem={(item) => setEditor({ mode: "edit", item })}
          onCompleteItem={completeItem}
          onMoveItem={moveItem}
          onManageBoard={() => setManageOpen(true)}
        />
      ) : null}

      {activeView === "capture" ? (
        <BrainDumpView
          drafts={state.drafts}
          focusComposer
          onCapture={captureDraft}
          onSort={setTriageDraft}
          onDelete={deleteDraft}
          onManageLanes={() => setManageOpen(true)}
        />
      ) : null}

      {activeView === "achievements" ? (
        <AchievementsView
          items={completedItems}
          lanes={state.lanes}
          onOpenItem={(item) => setEditor({ mode: "edit", item })}
          onRestoreItem={restoreItem}
        />
      ) : null}

      {editor ? (
        <ItemDialog
          editor={editor}
          state={state}
          onClose={() => setEditor(null)}
          onSave={saveItem}
          onDelete={deleteItem}
          onComplete={completeItem}
        />
      ) : null}

      {triageDraft ? (
        <TriageDialog
          draft={triageDraft}
          columns={state.columns}
          lanes={state.lanes}
          onClose={() => setTriageDraft(null)}
          onPlace={placeDraft}
        />
      ) : null}

      {manageOpen ? (
        <ManageBoardDialog
          state={state}
          onClose={() => setManageOpen(false)}
          onAddLane={addLane}
          onRenameLane={renameLane}
          onDeleteLane={deleteLane}
          onAddColumn={addColumn}
          onRenameColumn={renameColumn}
          onDeleteColumn={deleteColumn}
          onExport={() => downloadJson(exportPersonalState())}
          onImport={(value) => {
            const imported = importPersonalState(value);
            if (imported) {
              setActiveView("board");
              setManageOpen(false);
            }
            return imported;
          }}
          onReset={resetBoard}
        />
      ) : null}

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
      {celebrationId ? <CompletionFlight key={celebrationId} /> : null}
    </div>
  );
}
