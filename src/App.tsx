import { useCallback, useEffect, useMemo, useState } from "react";
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
  ConfirmActionDialog,
  DeleteDestinationDialog,
  ItemDialog,
  ManageBoardDialog,
  TriageDialog,
} from "./components/Dialogs";
import {
  CompletionFlight,
  StorageNotice,
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
  type ItemPriority,
  type LaneIconName,
} from "./types";

const VIEW_ORDER: ViewId[] = ["board", "capture", "achievements"];

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
    replacePersonalState,
    exportPersonalState,
    previewPersonalImport,
    importPersonalState,
    persistenceIssue,
    dismissPersistenceIssue,
  } = useLifeLanesState();

  const [activeView, setActiveView] = useState<ViewId>("board");
  const [viewEntrySource, setViewEntrySource] = useState<"pointer" | "keyboard">(
    "pointer",
  );
  const [viewDirection, setViewDirection] = useState<"forward" | "backward">(
    "forward",
  );
  const [editor, setEditor] = useState<ItemEditorState | null>(null);
  const [triageDraft, setTriageDraft] = useState<DraftNote | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<{
    type: "lane" | "column";
    id: string;
  } | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const changeView = useCallback(
    (
      nextView: ViewId,
      source: "pointer" | "keyboard" = "pointer",
    ) => {
      if (nextView === activeView) return;

      const currentIndex = VIEW_ORDER.indexOf(activeView);
      const nextIndex = VIEW_ORDER.indexOf(nextView);
      const direction = nextIndex >= currentIndex ? "forward" : "backward";
      setViewEntrySource(source);
      setViewDirection(direction);
      document.documentElement.dataset.viewDirection = direction;
      setActiveView(nextView);
    },
    [activeView],
  );

  const enterView = (view: ViewId) => {
    window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(
        `[data-workspace-panel="${view}"]`,
      );
      if (!panel) return;
      const entry = Array.from(
        panel.querySelectorAll<HTMLElement>("[data-workspace-entry]"),
      ).find((element) => element.offsetParent !== null);
      (entry ?? panel).focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    const handleWorkspaceNavigation = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const activePanel = target?.closest<HTMLElement>(
        `[data-workspace-panel="${activeView}"]`,
      );

      const focusWorkspaceNavigation = () => {
        document
          .getElementById(`workspace-nav-${activeView}`)
          ?.focus({ preventScroll: true });
      };

      if (event.key === "Escape") {
        if (!activePanel) return;
        event.preventDefault();
        focusWorkspaceNavigation();
        return;
      }

      if (event.key === "ArrowUp" && activePanel) {
        const isAchievementEntry = activeView === "achievements";
        const isComposerFirstLine =
          activeView === "capture" &&
          target instanceof HTMLTextAreaElement &&
          target.selectionStart === target.selectionEnd &&
          !target.value.slice(0, target.selectionStart).includes("\n");

        if (isAchievementEntry || isComposerFirstLine) {
          event.preventDefault();
          focusWorkspaceNavigation();
        }
        return;
      }

      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
      ) {
        return;
      }

      const ownsArrowKeys = target?.closest(
        [
          "input",
          "textarea",
          "select",
          "[contenteditable='true']",
          "[role='dialog']",
          "[role='listbox']",
          "[role='menu']",
          "[role='slider']",
          "[data-board-nav]",
          ".lane-drag-handle",
          ".note-drag-handle",
        ].join(","),
      );
      if (ownsArrowKeys) return;

      const currentIndex = VIEW_ORDER.indexOf(activeView);
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + offset + VIEW_ORDER.length) % VIEW_ORDER.length;
      const nextView = VIEW_ORDER[nextIndex];
      event.preventDefault();
      changeView(nextView, "keyboard");
      window.requestAnimationFrame(() => {
        document
          .getElementById(`workspace-nav-${nextView}`)
          ?.focus({ preventScroll: true });
      });
    };

    window.addEventListener("keydown", handleWorkspaceNavigation);
    return () =>
      window.removeEventListener("keydown", handleWorkspaceNavigation);
  }, [activeView, changeView]);

  const achievementIds = useMemo(
    () => new Set(achievementColumns(state.columns).map((column) => column.id)),
    [state.columns],
  );
  const completedItems = useMemo(
    () => state.items.filter((item) => achievementIds.has(item.column)),
    [achievementIds, state.items],
  );

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
    priority: ItemPriority;
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
      changeView("board");
      setToast(null);
    });
  };

  const addLane = (name: string, icon: LaneIconName) => {
    updateState((current) => ({
      ...current,
      lanes: [...current.lanes, createLifeLane(name, current.lanes.length, icon)],
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

  const reorderLane = (laneId: string, targetLaneId: string) => {
    updateState((current) => {
      const from = current.lanes.findIndex((lane) => lane.id === laneId);
      const to = current.lanes.findIndex((lane) => lane.id === targetLaneId);
      if (from < 0 || to < 0 || from === to) return current;

      const lanes = [...current.lanes];
      const [movedLane] = lanes.splice(from, 1);
      lanes.splice(to, 0, movedLane);
      return { ...current, lanes };
    });
  };

  const deleteLane = (id: string) => {
    const lane = state.lanes.find((candidate) => candidate.id === id);
    if (!lane || state.lanes.length <= 1) return;
    setManageOpen(false);
    setDeleteRequest({ type: "lane", id });
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
    setManageOpen(false);
    setDeleteRequest({ type: "column", id });
  };

  const resetBoard = () => {
    setManageOpen(false);
    setResetConfirmOpen(true);
  };

  const confirmResetBoard = () => {
    const previousState = state;
    const previousPreset = preset;
    if (preset === "demo") {
      resetDemo();
    } else {
      resetPersonal();
    }
    setResetConfirmOpen(false);
    setManageOpen(false);
    showToast(preset === "demo" ? "Demo reset" : "Board cleared", "Undo", () => {
      if (previousPreset === "demo") {
        updateState(() => previousState);
      } else {
        replacePersonalState(previousState);
      }
      setToast(null);
    });
  };

  const confirmDelete = (destinationId: string) => {
    if (!deleteRequest) return;
    const previousState = state;
    const request = deleteRequest;
    const deletedName =
      request.type === "lane"
        ? state.lanes.find((lane) => lane.id === request.id)?.name
        : state.columns.find((column) => column.id === request.id)?.title;

    updateState((current) => {
      if (request.type === "lane") {
        if (!current.lanes.some((lane) => lane.id === destinationId)) return current;
        return {
          ...current,
          lanes: current.lanes.filter((lane) => lane.id !== request.id),
          items: current.items.map((item) =>
            item.laneId === request.id
              ? { ...item, laneId: destinationId, updatedAt: nowStamp() }
              : item,
          ),
        };
      }

      if (!activeColumns(current.columns).some((column) => column.id === destinationId)) {
        return current;
      }
      return {
        ...current,
        columns: current.columns.filter((column) => column.id !== request.id),
        items: current.items.map((item) =>
          item.column === request.id
            ? { ...item, column: destinationId, updatedAt: nowStamp() }
            : item,
        ),
      };
    });
    setDeleteRequest(null);
    showToast(`${deletedName ?? "Entry"} deleted`, "Undo", () => {
      updateState(() => previousState);
      setToast(null);
    });
  };

  const changePreset = (nextPreset: "draft" | "demo") => {
    switchPreset(nextPreset);
    setViewEntrySource("pointer");
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
    <div className={`app-shell view-${viewDirection}`}>
      <AppHeader
        activeView={activeView}
        preset={preset}
        onChangeView={changeView}
        onEnterView={enterView}
        onChangePreset={changePreset}
        onStartTour={startTour}
      />

      {persistenceIssue ? (
        <StorageNotice
          message={persistenceIssue.message}
          onDownload={() =>
            downloadJson(
              persistenceIssue.recoveryData ?? exportPersonalState(),
            )
          }
          onDismiss={dismissPersistenceIssue}
        />
      ) : null}

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
          onMoveLane={reorderLane}
          onManageBoard={() => setManageOpen(true)}
          focusOnMount={false}
        />
      ) : null}

      {activeView === "capture" ? (
        <BrainDumpView
          drafts={state.drafts}
          focusComposer={viewEntrySource !== "keyboard"}
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
          onReorderLane={reorderLane}
          onAddColumn={addColumn}
          onRenameColumn={renameColumn}
          onDeleteColumn={deleteColumn}
          onExport={() => downloadJson(exportPersonalState())}
          onPreviewImport={previewPersonalImport}
          onImport={(value, mode) => {
            const previousState = state;
            const imported = importPersonalState(value, mode);
            if (imported) {
              setActiveView("board");
              setManageOpen(false);
              showToast(mode === "merge" ? "Backup merged" : "Backup imported", "Undo", () => {
                replacePersonalState(previousState);
                setToast(null);
              });
            }
            return imported;
          }}
          onReset={resetBoard}
        />
      ) : null}

      {deleteRequest ? (() => {
        const isLane = deleteRequest.type === "lane";
        const name = isLane
          ? state.lanes.find((lane) => lane.id === deleteRequest.id)?.name
          : state.columns.find((column) => column.id === deleteRequest.id)?.title;
        const itemCount = state.items.filter((item) =>
          isLane ? item.laneId === deleteRequest.id : item.column === deleteRequest.id,
        ).length;
        const destinations = isLane
          ? state.lanes
              .filter((lane) => lane.id !== deleteRequest.id)
              .map((lane) => ({ id: lane.id, label: lane.name }))
          : activeColumns(state.columns)
              .filter((column) => column.id !== deleteRequest.id)
              .map((column) => ({ id: column.id, label: column.title }));
        return (
          <DeleteDestinationDialog
            name={name ?? (isLane ? "Life Lane" : "state")}
            itemCount={itemCount}
            destinationLabel={isLane ? "Move items to" : "Move items to state"}
            destinations={destinations}
            onClose={() => {
              setDeleteRequest(null);
              setManageOpen(true);
            }}
            onConfirm={confirmDelete}
          />
        );
      })() : null}

      {resetConfirmOpen ? (
        <ConfirmActionDialog
          title={preset === "demo" ? "Reset demo?" : "Clear this board?"}
          message="A recovery copy will be kept, and you can undo immediately afterwards."
          confirmLabel={preset === "demo" ? "Reset demo" : "Clear board"}
          onClose={() => {
            setResetConfirmOpen(false);
            setManageOpen(true);
          }}
          onConfirm={confirmResetBoard}
        />
      ) : null}

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
      {celebrationId ? <CompletionFlight key={celebrationId} /> : null}
    </div>
  );
}
