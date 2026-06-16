import { Check, GripVertical, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createBoardState, createColumn, createId, createLifeLane, nowStamp } from "./data";
import { loadState, saveState } from "./storage";
import { type BoardColumn, type BoardItem, type BoardState, type ColumnId, type DraftNote, type LifeLane } from "./types";

type TriageChoice = {
  laneId: string;
  column: ColumnId;
};

type ViewId = "capture" | "board";
type QuickAddDraft = { title: string; note: string; laneId: string; startDate: string; endDate: string };
type QuickAddState = Record<string, QuickAddDraft>;
type EditingState = Pick<BoardItem, "title" | "note" | "column" | "laneId" | "startDate" | "endDate">;
type DropPlacement = "before" | "after";
type DropTarget = { column: ColumnId; laneId?: string; targetId?: string; placement?: DropPlacement };
type DragGhostState = {
  itemId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  x: number;
  y: number;
};
type PendingDragState = {
  itemId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  startX: number;
  startY: number;
  element: HTMLElement;
};
type ToastState =
  | { id: string; kind: "undo-item"; label: string; item: BoardItem; index: number }
  | { id: string; kind: "undo-draft"; label: string; draft: DraftNote; index: number }
  | { id: string; kind: "notice"; label: string };

function firstLine(text: string) {
  return text.trim().split("\n").find(Boolean) ?? "Untitled Item";
}

function remainingLines(text: string) {
  const lines = text.trim().split("\n");
  return lines.slice(1).join("\n").trim();
}

function createQuickAddDraft(laneId: string): QuickAddDraft {
  return { title: "", note: "", laneId, startDate: "", endDate: "" };
}

function createQuickAddState(lanes: LifeLane[], columns: BoardColumn[]): QuickAddState {
  const laneId = lanes[0]?.id ?? "";
  return Object.fromEntries(columns.map((column) => [column.id, createQuickAddDraft(laneId)])) as QuickAddState;
}

function laneFor(lanes: LifeLane[], laneId: string) {
  return lanes.find((lane) => lane.id === laneId) ?? lanes[0];
}

function formatShortDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function dateRangeLabel(item: Pick<BoardItem, "startDate" | "endDate">) {
  if (item.startDate && item.endDate) {
    return `${formatShortDate(item.startDate)} - ${formatShortDate(item.endDate)}`;
  }
  if (item.startDate) {
    return `From ${formatShortDate(item.startDate)}`;
  }
  if (item.endDate) {
    return `By ${formatShortDate(item.endDate)}`;
  }
  return "";
}

function App() {
  const initialState = useMemo(() => loadState(), []);
  const [state, setState] = useState<BoardState>(initialState);
  const [captureText, setCaptureText] = useState("");
  const [triageChoices, setTriageChoices] = useState<Record<string, TriageChoice>>({});
  const [newLaneName, setNewLaneName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editingLaneName, setEditingLaneName] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [pushDraft, setPushDraft] = useState<DraftNote | null>(null);
  const [pushChoice, setPushChoice] = useState<TriageChoice | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(() => createQuickAddState(initialState.lanes, initialState.columns));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("board");
  const [mobileColumn, setMobileColumn] = useState<ColumnId>(initialState.columns[0]?.id ?? "doing");
  const [expandedLaneId, setExpandedLaneId] = useState<string | null>(null);
  const [expandedColumn, setExpandedColumn] = useState<ColumnId | null>(null);
  const [openAddColumn, setOpenAddColumn] = useState<ColumnId | null>(null);
  const [showBoardLaneComposer, setShowBoardLaneComposer] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cardPositionsRef = useRef<Map<string, DOMRect>>(new Map());
  const itemsRef = useRef<BoardItem[]>(initialState.items);
  const columnsRef = useRef<BoardColumn[]>(initialState.columns);
  const draggingIdRef = useRef<string | null>(null);
  const dragGhostRef = useRef<DragGhostState | null>(null);
  const dragGhostElementRef = useRef<HTMLDivElement | null>(null);
  const dragAnimationFrameRef = useRef<number | null>(null);
  const dragSourceRef = useRef<HTMLElement | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const pendingDragRef = useRef<PendingDragState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  useEffect(() => {
    columnsRef.current = state.columns;
  }, [state.columns]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const previousPositions = cardPositionsRef.current;
    const nextPositions = new Map<string, DOMRect>();
    const cards = board.querySelectorAll<HTMLElement>("[data-card-id]");

    cards.forEach((card) => {
      const id = card.dataset.cardId;
      if (!id) {
        return;
      }

      const nextRect = card.getBoundingClientRect();
      const previousRect = previousPositions.get(id);
      nextPositions.set(id, nextRect);

      if (!previousRect || card.classList.contains("dragging")) {
        return;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });

    cardPositionsRef.current = nextPositions;
  }, [state.items, activeView]);

  useLayoutEffect(() => {
    if (dragGhost) {
      paintDragGhost();
    }
  }, [dragGhost]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (dragAnimationFrameRef.current) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!state.lanes.length || !state.columns.length) {
      return;
    }

    setQuickAdd((current) => {
      const fallback = state.lanes[0].id;
      return Object.fromEntries(
        state.columns.map((column) => [
          column.id,
          {
            ...createQuickAddDraft(fallback),
            ...current[column.id],
            laneId: state.lanes.some((lane) => lane.id === current[column.id]?.laneId) ? current[column.id].laneId : fallback,
          },
        ]),
      ) as QuickAddState;
    });
  }, [state.lanes, state.columns]);

  useEffect(() => {
    if (!state.columns.some((column) => column.id === mobileColumn)) {
      setMobileColumn(state.columns[0]?.id ?? "");
    }
  }, [mobileColumn, state.columns]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        state.columns.map((column) => [column.id, state.items.filter((item) => item.column === column.id).length]),
      ) as Record<ColumnId, number>,
    [state.columns, state.items],
  );

  const setCustomState = (updater: (current: BoardState) => BoardState) => {
    setState((current) => ({ ...updater(current), preset: "custom" }));
  };

  const showToast = (nextToast: ToastState, duration = 5000) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(nextToast);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  };

  const closeToast = () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  };

  const restoreToast = () => {
    if (!toast || toast.kind === "notice") {
      return;
    }

    const currentToast = toast;
    setCustomState((current) => {
      if (currentToast.kind === "undo-item") {
        if (current.items.some((item) => item.id === currentToast.item.id)) {
          return current;
        }
        const items = [...current.items];
        items.splice(Math.min(currentToast.index, items.length), 0, currentToast.item);
        return { ...current, items };
      }

      if (current.drafts.some((draft) => draft.id === currentToast.draft.id)) {
        return current;
      }
      const drafts = [...current.drafts];
      drafts.splice(Math.min(currentToast.index, drafts.length), 0, currentToast.draft);
      return { ...current, drafts };
    });
    closeToast();
  };

  const captureDraft = (event: FormEvent) => {
    event.preventDefault();
    if (!captureText.trim()) {
      return;
    }

    const stamp = nowStamp();
    const draft: DraftNote = {
      id: createId("draft"),
      text: captureText.trim(),
      createdAt: stamp,
      updatedAt: stamp,
    };

    setCustomState((current) => ({
      ...current,
      drafts: [draft, ...current.drafts],
    }));
    setCaptureText("");
  };

  const addLane = (name: string) => {
    const clean = name.trim();
    if (!clean) {
      return;
    }
    if (state.lanes.some((lane) => lane.name.trim().toLowerCase() === clean.toLowerCase())) {
      showToast({ id: createId("notice"), kind: "notice", label: "That lane already exists." }, 3000);
      return;
    }

    setCustomState((current) => ({
      ...current,
      lanes: [...current.lanes, createLifeLane(clean, current.lanes.length)],
    }));
    setNewLaneName("");
  };

  const renameLane = (laneId: string, name: string) => {
    const clean = name.trim();
    if (!clean) {
      setEditingLaneId(null);
      setEditingLaneName("");
      return;
    }
    if (state.lanes.some((lane) => lane.id !== laneId && lane.name.trim().toLowerCase() === clean.toLowerCase())) {
      showToast({ id: createId("notice"), kind: "notice", label: "That lane already exists." }, 3000);
      return;
    }

    setCustomState((current) => ({
      ...current,
      lanes: current.lanes.map((lane) => (lane.id === laneId ? { ...lane, name: clean } : lane)),
    }));
    setEditingLaneId(null);
    setEditingLaneName("");
  };

  const deleteLane = (laneId: string) => {
    if (state.lanes.length <= 1) {
      showToast({ id: createId("notice"), kind: "notice", label: "Keep at least one lane." }, 3000);
      return;
    }

    setCustomState((current) => {
      const lanes = current.lanes.filter((lane) => lane.id !== laneId);
      const fallbackLaneId = lanes[0]?.id ?? current.lanes[0].id;
      return {
        ...current,
        lanes,
        items: current.items.map((item) => (item.laneId === laneId ? { ...item, laneId: fallbackLaneId, updatedAt: nowStamp() } : item)),
      };
    });
    setTriageChoices((current) =>
      Object.fromEntries(
        Object.entries(current).map(([draftId, choice]) => [
          draftId,
          { ...choice, laneId: choice.laneId === laneId ? state.lanes.find((lane) => lane.id !== laneId)?.id ?? "" : choice.laneId },
        ]),
      ),
    );
    setPushChoice((current) =>
      current?.laneId === laneId ? { ...current, laneId: state.lanes.find((lane) => lane.id !== laneId)?.id ?? "" } : current,
    );
    setEditingLaneId(null);
    setEditingLaneName("");
  };

  const addColumn = (name: string) => {
    const clean = name.trim();
    if (!clean) {
      return;
    }
    if (state.columns.some((column) => column.title.trim().toLowerCase() === clean.toLowerCase())) {
      showToast({ id: createId("notice"), kind: "notice", label: "That column already exists." }, 3000);
      return;
    }

    const column = createColumn(clean);
    setCustomState((current) => ({
      ...current,
      columns: [...current.columns, column],
    }));
    setNewColumnName("");
    setShowBoardLaneComposer(false);
  };

  const renameColumn = (columnId: string, name: string) => {
    const clean = name.trim();
    if (!clean) {
      setEditingColumnId(null);
      setEditingColumnName("");
      return;
    }
    if (state.columns.some((column) => column.id !== columnId && column.title.trim().toLowerCase() === clean.toLowerCase())) {
      showToast({ id: createId("notice"), kind: "notice", label: "That column already exists." }, 3000);
      return;
    }

    setCustomState((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === columnId ? { ...column, title: clean } : column)),
    }));
    setEditingColumnId(null);
    setEditingColumnName("");
  };

  const deleteColumn = (columnId: string) => {
    if (state.columns.length <= 1) {
      showToast({ id: createId("notice"), kind: "notice", label: "Keep at least one column." }, 3000);
      return;
    }

    const fallbackColumn = state.columns.find((column) => column.id !== columnId);
    setCustomState((current) => {
      const columns = current.columns.filter((column) => column.id !== columnId);
      const fallbackColumnId = columns[0]?.id ?? current.columns[0].id;
      return {
        ...current,
        columns,
        items: current.items.map((item) => (item.column === columnId ? { ...item, column: fallbackColumnId, updatedAt: nowStamp() } : item)),
      };
    });

    if (mobileColumn === columnId) {
      setMobileColumn(fallbackColumn?.id ?? "");
    }
    if (openAddColumn === columnId) {
      setOpenAddColumn(null);
    }
    if (expandedColumn === columnId) {
      setExpandedColumn(null);
    }
    setTriageChoices((current) =>
      Object.fromEntries(
        Object.entries(current).map(([draftId, choice]) => [
          draftId,
          { ...choice, column: choice.column === columnId ? fallbackColumn?.id ?? "" : choice.column },
        ]),
      ),
    );
    setPushChoice((current) => (current?.column === columnId ? { ...current, column: fallbackColumn?.id ?? "" } : current));
    setEditingColumnId(null);
    setEditingColumnName("");
  };

  const defaultDraftChoice = (draftId: string): TriageChoice => ({
    laneId: triageChoices[draftId]?.laneId ?? state.lanes[0]?.id ?? "",
    column: triageChoices[draftId]?.column ?? state.columns.find((column) => column.title.toLowerCase() === "to do")?.id ?? state.columns[0]?.id ?? "",
  });

  const openPushModal = (draft: DraftNote) => {
    setPushDraft(draft);
    setPushChoice(defaultDraftChoice(draft.id));
  };

  const sendDraftToBoard = (draft: DraftNote, choice: TriageChoice) => {
    if (!choice.column || !choice.laneId) {
      return;
    }
    const stamp = nowStamp();
    const item: BoardItem = {
      id: createId("item"),
      title: firstLine(draft.text),
      note: remainingLines(draft.text),
      column: choice.column,
      laneId: choice.laneId,
      createdAt: stamp,
      updatedAt: stamp,
    };

    setCustomState((current) => ({
      ...current,
      drafts: current.drafts.filter((candidate) => candidate.id !== draft.id),
      items: [...current.items, item],
    }));
    setTriageChoices((current) => {
      const next = { ...current };
      delete next[draft.id];
      return next;
    });
    setPushDraft(null);
    setPushChoice(null);
    setActiveView("board");
  };

  const deleteDraft = (draftId: string) => {
    const draft = state.drafts.find((candidate) => candidate.id === draftId);
    if (!draft) {
      return;
    }
    const index = state.drafts.findIndex((candidate) => candidate.id === draftId);
    setCustomState((current) => ({
      ...current,
      drafts: current.drafts.filter((draft) => draft.id !== draftId),
    }));
    showToast({ id: createId("undo"), kind: "undo-draft", label: "Draft removed.", draft, index });
  };

  const addBoardItem = (column: ColumnId) => {
    const entry = quickAdd[column] ?? createQuickAddDraft(state.lanes[0]?.id ?? "");
    if (!entry.title.trim()) {
      return;
    }

    const stamp = nowStamp();
    const item: BoardItem = {
      id: createId("item"),
      title: entry.title.trim(),
      note: entry.note.trim(),
      column,
      laneId: entry.laneId || state.lanes[0].id,
      startDate: entry.startDate || undefined,
      endDate: entry.endDate || undefined,
      createdAt: stamp,
      updatedAt: stamp,
    };

    setCustomState((current) => ({
      ...current,
      items: [...current.items, item],
    }));
    setQuickAdd((current) => ({
      ...current,
      [column]: { ...entry, title: "", note: "", startDate: "", endDate: "" },
    }));
    setOpenAddColumn(null);
  };

  const updateItem = (itemId: string, patch: Partial<BoardItem>) => {
    setCustomState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              updatedAt: nowStamp(),
            }
          : item,
      ),
    }));
  };

  const deleteItem = (itemId: string) => {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }
    const index = state.items.findIndex((candidate) => candidate.id === itemId);
    setCustomState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
    showToast({ id: createId("undo"), kind: "undo-item", label: "Item removed.", item, index });
  };

  const startEdit = (item: BoardItem) => {
    setEditingId(item.id);
    setEditing({
      title: item.title,
      note: item.note,
      column: item.column,
      laneId: item.laneId,
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
    });
  };

  const saveEdit = (itemId: string) => {
    if (!editing?.title.trim()) {
      return;
    }
    updateItem(itemId, {
      title: editing.title.trim(),
      note: editing.note.trim(),
      column: editing.column,
      laneId: editing.laneId,
      startDate: editing.startDate || undefined,
      endDate: editing.endDate || undefined,
    });
    setEditingId(null);
    setEditing(null);
  };

  const moveDraggedItem = (
    itemId: string,
    column: ColumnId,
    targetId?: string,
    placement: DropPlacement = "after",
    laneId?: string,
    commit = true,
  ) => {
    setCustomState((current) => {
      const dragged = current.items.find((item) => item.id === itemId);
      if (!dragged || dragged.id === targetId) {
        return current;
      }

      const remaining = current.items.filter((item) => item.id !== itemId);
      const moved = { ...dragged, column, laneId: laneId ?? dragged.laneId, updatedAt: commit ? nowStamp() : dragged.updatedAt };
      const targetIndex = targetId ? remaining.findIndex((item) => item.id === targetId) : -1;
      const nextItems = [...remaining];

      if (targetIndex >= 0) {
        nextItems.splice(targetIndex + (placement === "after" ? 1 : 0), 0, moved);
      } else {
        const lastColumnIndex = remaining.reduce((lastIndex, item, index) => (item.column === column ? index : lastIndex), -1);
        nextItems.splice(lastColumnIndex + 1, 0, moved);
      }

      const sameOrder = nextItems.every(
        (item, index) =>
          item.id === current.items[index]?.id && item.column === current.items[index]?.column && item.laneId === current.items[index]?.laneId,
      );
      if (sameOrder) {
        return current;
      }

      return { ...current, items: nextItems };
    });
  };

  const updateDropTargetAtPoint = (clientX: number, clientY: number) => {
    const activeId = draggingIdRef.current;
    if (!activeId) {
      return;
    }

    const hoveredElements = document.elementsFromPoint(clientX, clientY) as HTMLElement[];
    const hoveredCard = hoveredElements
      .map((element) => element.closest<HTMLElement>("[data-card-id]"))
      .find((card) => card && card.dataset.cardId !== activeId);

    if (hoveredCard?.dataset.cardId) {
      const targetItem = itemsRef.current.find((item) => item.id === hoveredCard.dataset.cardId);
      if (!targetItem) {
        return;
      }

      const rect = hoveredCard.getBoundingClientRect();
      const placement: DropPlacement = clientY > rect.top + rect.height / 2 ? "after" : "before";
      dropTargetRef.current = { column: targetItem.column, laneId: targetItem.laneId, targetId: targetItem.id, placement };
      return;
    }

    const hoveredLaneGroup = hoveredElements.map((element) => element.closest<HTMLElement>("[data-column-lane-id]")).find(Boolean);
    const laneColumn = hoveredLaneGroup?.dataset.columnId as ColumnId | undefined;
    const laneId = hoveredLaneGroup?.dataset.columnLaneId;
    if (laneColumn && laneId && columnsRef.current.some((candidate) => candidate.id === laneColumn)) {
      dropTargetRef.current = { column: laneColumn, laneId };
      return;
    }

    const hoveredColumn = hoveredElements.map((element) => element.closest<HTMLElement>("[data-column-id]")).find(Boolean);
    const column = hoveredColumn?.dataset.columnId as ColumnId | undefined;
    if (column && columnsRef.current.some((candidate) => candidate.id === column)) {
      dropTargetRef.current = { column };
    }
  };

  const paintDragGhost = () => {
    dragAnimationFrameRef.current = null;
    const ghost = dragGhostRef.current;
    const element = dragGhostElementRef.current;
    if (!ghost || !element) {
      return;
    }

    element.style.width = `${ghost.width}px`;
    element.style.transform = `translate3d(${ghost.x - ghost.offsetX}px, ${ghost.y - ghost.offsetY}px, 0)`;
  };

  const scheduleDragGhostPaint = () => {
    if (dragAnimationFrameRef.current) {
      return;
    }
    dragAnimationFrameRef.current = window.requestAnimationFrame(paintDragGhost);
  };

  const continueDraggingPointer = (pointerId: number, clientX: number, clientY: number, preventDefault?: () => void) => {
    const pendingDrag = pendingDragRef.current;
    if (!draggingIdRef.current && pendingDrag && pointerId === pendingDrag.pointerId) {
      const distance = Math.hypot(clientX - pendingDrag.startX, clientY - pendingDrag.startY);
      if (distance < 3) {
        return;
      }

      preventDefault?.();
      const nextGhost = {
        itemId: pendingDrag.itemId,
        pointerId: pendingDrag.pointerId,
        offsetX: pendingDrag.offsetX,
        offsetY: pendingDrag.offsetY,
        width: pendingDrag.width,
        x: clientX,
        y: clientY,
      };
      draggingIdRef.current = pendingDrag.itemId;
      dragGhostRef.current = nextGhost;
      setDraggingId(pendingDrag.itemId);
      setDragGhost(nextGhost);
      pendingDragRef.current = null;
      updateDropTargetAtPoint(clientX, clientY);
      scheduleDragGhostPaint();
      return;
    }

    const activeGhost = dragGhostRef.current;
    if (!draggingIdRef.current || !activeGhost || pointerId !== activeGhost.pointerId) {
      return;
    }

    preventDefault?.();
    const nextGhost = { ...activeGhost, x: clientX, y: clientY };
    dragGhostRef.current = nextGhost;
    updateDropTargetAtPoint(clientX, clientY);
    scheduleDragGhostPaint();
  };

  const finishDraggingPointer = (pointerId?: number) => {
    const pendingDrag = pendingDragRef.current;
    const source = dragSourceRef.current;
    const activeGhost = dragGhostRef.current;

    if (pendingDrag && pointerId === pendingDrag.pointerId) {
      if (source?.hasPointerCapture(pointerId)) {
        source.releasePointerCapture(pointerId);
      }
      pendingDragRef.current = null;
      dragSourceRef.current = null;
      return;
    }

    if (activeGhost && pointerId !== undefined && pointerId !== activeGhost.pointerId) {
      return;
    }

    const activeId = draggingIdRef.current;
    if (activeId) {
      const target = dropTargetRef.current;
      if (target) {
        moveDraggedItem(activeId, target.column, target.targetId, target.placement ?? "after", target.laneId, true);
      }
    }

    if (activeGhost && source?.hasPointerCapture(activeGhost.pointerId)) {
      source.releasePointerCapture(activeGhost.pointerId);
    }

    draggingIdRef.current = null;
    dragGhostRef.current = null;
    if (dragAnimationFrameRef.current) {
      window.cancelAnimationFrame(dragAnimationFrameRef.current);
      dragAnimationFrameRef.current = null;
    }
    dragSourceRef.current = null;
    pendingDragRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDragGhost(null);
  };

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      continueDraggingPointer(event.pointerId, event.clientX, event.clientY, () => event.preventDefault());
    };
    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      finishDraggingPointer(event.pointerId);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, []);

  const startDraggingItem = (event: ReactPointerEvent<HTMLElement>, itemId: string) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, input, select, textarea")) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    dragSourceRef.current = event.currentTarget;
    dropTargetRef.current = null;
    pendingDragRef.current = {
      itemId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      startX: event.clientX,
      startY: event.clientY,
      element: event.currentTarget,
    };
  };

  const moveDraggingItem = (event: ReactPointerEvent<HTMLElement>) => {
    continueDraggingPointer(event.pointerId, event.clientX, event.clientY, () => event.preventDefault());
  };

  const stopDraggingItem = (event?: ReactPointerEvent<HTMLElement>) => {
    finishDraggingPointer(event?.pointerId);
  };

  const loadPreset = (preset: "draft" | "demo") => {
    const next = createBoardState(preset);
    setState(next);
    setCaptureText("");
    setQuickAdd(createQuickAddState(next.lanes, next.columns));
    setTriageChoices({});
    setEditingId(null);
    setEditing(null);
    setExpandedLaneId(null);
    setExpandedColumn(null);
    setOpenAddColumn(null);
    setShowBoardLaneComposer(false);
    setNewColumnName("");
    setEditingLaneId(null);
    setEditingLaneName("");
    setEditingColumnId(null);
    setEditingColumnName("");
    setPushDraft(null);
    setPushChoice(null);
    pendingDragRef.current = null;
    dropTargetRef.current = null;
    closeToast();
    setActiveView("board");
    setMobileColumn(next.columns[0]?.id ?? "");
  };

  const expandedLane = expandedLaneId ? state.lanes.find((lane) => lane.id === expandedLaneId) : null;
  const draggingItem = draggingId ? state.items.find((item) => item.id === draggingId) : null;

  const renderBoardItem = (item: BoardItem) =>
    editingId === item.id && editing ? (
      <EditItemCard
        key={item.id}
        draft={editing}
        columns={state.columns}
        lanes={state.lanes}
        onChange={setEditing}
        onSave={() => saveEdit(item.id)}
        onCancel={() => {
          setEditingId(null);
          setEditing(null);
        }}
      />
    ) : (
      <BoardCard
        key={item.id}
        item={item}
        lanes={state.lanes}
        dragging={draggingId === item.id}
        onPointerDown={(event) => startDraggingItem(event, item.id)}
        onPointerMove={moveDraggingItem}
        onPointerUp={stopDraggingItem}
        onPointerCancel={stopDraggingItem}
        onEdit={() => startEdit(item)}
        onDelete={() => deleteItem(item.id)}
        onFocusLane={() => setExpandedLaneId(item.laneId)}
        onExpandColumn={() => setExpandedColumn(item.column)}
      />
    );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>Life Lanes</h1>
          </div>
        </div>
        <div className="header-actions preset-actions">
          <select
            className="preset-select"
            value={state.preset === "demo" ? "demo" : "draft"}
            onChange={(event) => loadPreset(event.target.value as "draft" | "demo")}
            aria-label="Choose board"
          >
            <option value="draft">My Life Lanes</option>
            <option value="demo">Demo</option>
          </select>
        </div>
      </header>

      <nav className="workspace-tabs" aria-label="Workspace">
        <button
          className={activeView === "board" ? "tab-button active" : "tab-button"}
          type="button"
          onClick={() => setActiveView("board")}
          aria-label="Open My Life Lanes"
        >
          My Life Lanes
          {state.items.length > 0 && <span>{state.items.length}</span>}
        </button>
        <button
          className={activeView === "capture" ? "tab-button active" : "tab-button"}
          type="button"
          onClick={() => setActiveView("capture")}
          aria-label="Open Brain Dump"
        >
          Brain Dump
          {state.drafts.length > 0 && <span>{state.drafts.length}</span>}
        </button>
      </nav>

      {activeView === "capture" ? (
        <main className="capture-page">
          <section className="panel-card capture-card">
            <div className="panel-title">
              <div>
                <h2>Brain Dump</h2>
              </div>
            </div>
            <form className="capture-form" onSubmit={captureDraft}>
              <textarea
                value={captureText}
                onChange={(event) => setCaptureText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Drop what is on your mind."
                aria-label="Brain Dump note"
              />
              <button className="primary-button" type="submit">
                <Plus size={17} />
                Add to Brain Dump
              </button>
            </form>
          </section>

          <section className="panel-card triage-card">
            <div className="panel-title">
              <div>
                <h2>Triage</h2>
              </div>
              <span className="count-badge">{state.drafts.length}</span>
            </div>
            <div className="draft-stack">
              {state.drafts.length ? (
                state.drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    onSend={() => openPushModal(draft)}
                    onDelete={() => deleteDraft(draft.id)}
                  />
                ))
              ) : (
                <div className="empty-state">No drafts.</div>
              )}
            </div>
          </section>

          <section className="panel-card tags-card">
            <div className="panel-title">
              <div>
                <h2>Tags</h2>
              </div>
            </div>
            <LifeLaneStrip
              lanes={state.lanes}
              editingLaneId={editingLaneId}
              editingLaneName={editingLaneName}
              onStartRename={(lane) => {
                setEditingLaneId(lane.id);
                setEditingLaneName(lane.name);
              }}
              onRename={renameLane}
              onRenameChange={setEditingLaneName}
              onCancelRename={() => {
                setEditingLaneId(null);
                setEditingLaneName("");
              }}
              onDelete={deleteLane}
            />
            <form
              className="lane-form"
              onSubmit={(event) => {
                event.preventDefault();
                addLane(newLaneName);
              }}
            >
              <input value={newLaneName} onChange={(event) => setNewLaneName(event.target.value)} placeholder="New tag" aria-label="New Life Lane" />
              <button className="icon-button" type="submit" aria-label="Create Life Lane">
                <Plus size={17} />
              </button>
            </form>
          </section>
        </main>
      ) : (
        <main className="board-panel">
          <div className="board-toolbar board-toolbar-minimal">
            <div className="board-lane-tools">
              {showBoardLaneComposer ? (
                <form
                  className="lane-form inline lane-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addColumn(newColumnName);
                  }}
                >
                  <input
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    placeholder="Life lane name"
                    aria-label="Add Life Lane state"
                    autoFocus
                  />
                  <button className="icon-button confirm" type="submit" aria-label="Add Life Lane state">
                    <Check size={16} />
                  </button>
                  <button
                    className="icon-button subtle"
                    type="button"
                    onClick={() => {
                      setNewColumnName("");
                      setShowBoardLaneComposer(false);
                    }}
                    aria-label="Cancel adding column"
                  >
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <button className="add-lane-button" type="button" onClick={() => setShowBoardLaneComposer(true)} aria-label="Add Life Lane state">
                  <Plus size={15} />
                  Life Lane
                </button>
              )}
            </div>
          </div>

          <div className="mobile-column-switcher" aria-label="Choose board column">
            {state.columns.map((column) => (
              <button
                key={column.id}
                className={mobileColumn === column.id ? "mobile-column-tab active" : "mobile-column-tab"}
                type="button"
                onClick={() => setMobileColumn(column.id)}
              >
                {column.title}
                <span>{counts[column.id]}</span>
              </button>
            ))}
          </div>

          {expandedLane && (
            <LaneFocus
              lane={expandedLane}
              columns={state.columns}
              items={state.items.filter((item) => item.laneId === expandedLane.id)}
              onClose={() => setExpandedLaneId(null)}
            />
          )}

          {expandedColumn && (
            <ColumnFocus
              column={expandedColumn}
              columnTitle={state.columns.find((column) => column.id === expandedColumn)?.title ?? "Column"}
              lanes={state.lanes}
              items={state.items.filter((item) => item.column === expandedColumn)}
              onClose={() => setExpandedColumn(null)}
            />
          )}

          <div
            className={draggingId ? "kanban-board dragging-board" : "kanban-board"}
            ref={boardRef}
            style={{ "--column-count": state.columns.length } as CSSProperties}
            aria-label="Life Lanes Kanban"
          >
            {state.columns.map((column) => {
              const columnItems = state.items.filter((item) => item.column === column.id);
              const columnLaneGroups = state.lanes
                .map((lane) => ({
                  lane,
                  items: columnItems.filter((item) => item.laneId === lane.id),
                }))
                .filter((group) => group.items.length > 0);
              return (
                <section
                  className={`${draggingId ? "kanban-column drag-aware" : "kanban-column"} ${mobileColumn === column.id ? "mobile-active" : ""}`}
                  key={column.id}
                  data-column-id={column.id}
                >
                  <header className="column-header">
                    {editingColumnId === column.id ? (
                      <form
                        className="inline-edit-form column-title-edit"
                        onSubmit={(event) => {
                          event.preventDefault();
                          renameColumn(column.id, editingColumnName);
                        }}
                      >
                        <input value={editingColumnName} onChange={(event) => setEditingColumnName(event.target.value)} autoFocus aria-label="Rename column" />
                        <button className="icon-button confirm" type="submit" aria-label="Save column name">
                          <Check size={14} />
                        </button>
                        <button
                          className="icon-button subtle"
                          type="button"
                          onClick={() => {
                            setEditingColumnId(null);
                            setEditingColumnName("");
                          }}
                          aria-label="Cancel column rename"
                        >
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <button
                        className="column-title-button"
                        type="button"
                        onDoubleClick={() => {
                          setEditingColumnId(column.id);
                          setEditingColumnName(column.title);
                        }}
                        aria-label={`Rename ${column.title}`}
                      >
                        <h3>{column.title}</h3>
                      </button>
                    )}
                    <div className="column-header-actions">
                      <span>{counts[column.id]}</span>
                      <button className="icon-button subtle danger" type="button" onClick={() => deleteColumn(column.id)} aria-label={`Delete ${column.title}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </header>

                  <div className="column-lane-stack">
                    {columnLaneGroups.map((group) => (
                      <section className="column-lane" key={group.lane.id} data-column-id={column.id} data-column-lane-id={group.lane.id}>
                        <header className="column-lane-header">
                          <button
                            className={`lane-pill lane-button ${group.lane.color}`}
                            type="button"
                            onDoubleClick={() => setExpandedLaneId(group.lane.id)}
                            aria-label={`Open ${group.lane.name} lane focus`}
                          >
                            {group.lane.name}
                          </button>
                          <span className="lane-count">{group.items.length}</span>
                        </header>
                        <div className="item-stack column-lane-items">{group.items.map(renderBoardItem)}</div>
                      </section>
                    ))}
                  </div>

                  {openAddColumn === column.id ? (
                    <QuickAddCard
                      column={column.id}
                      lanes={state.lanes}
                      value={quickAdd[column.id] ?? createQuickAddDraft(state.lanes[0]?.id ?? "")}
                      onChange={(value) => setQuickAdd((current) => ({ ...current, [column.id]: value }))}
                      onAdd={() => addBoardItem(column.id)}
                      onCancel={() => setOpenAddColumn(null)}
                    />
                  ) : (
                    <button className="column-add-button" type="button" onClick={() => setOpenAddColumn(column.id)} aria-label={`Add item to ${column.title}`}>
                      <Plus size={15} />
                      Item
                    </button>
                  )}
                </section>
              );
            })}
          </div>

          {dragGhost && draggingItem && (
            <DragGhost item={draggingItem} lane={laneFor(state.lanes, draggingItem.laneId)} ghost={dragGhost} ghostRef={dragGhostElementRef} />
          )}
        </main>
      )}
      {pushDraft && pushChoice && (
        <TriageModal
          draft={pushDraft}
          choice={pushChoice}
          columns={state.columns}
          lanes={state.lanes}
          onChoice={setPushChoice}
          onClose={() => {
            setPushDraft(null);
            setPushChoice(null);
          }}
          onSend={() => sendDraftToBoard(pushDraft, pushChoice)}
        />
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast.label}</span>
          {toast.kind !== "notice" && (
            <button className="toast-action" type="button" onClick={restoreToast}>
              Undo
            </button>
          )}
          <button className="toast-close" type="button" onClick={closeToast} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function LifeLaneStrip({
  lanes,
  editingLaneId,
  editingLaneName,
  onStartRename,
  onRename,
  onRenameChange,
  onCancelRename,
  onDelete,
}: {
  lanes: LifeLane[];
  editingLaneId: string | null;
  editingLaneName: string;
  onStartRename: (lane: LifeLane) => void;
  onRename: (laneId: string, name: string) => void;
  onRenameChange: (name: string) => void;
  onCancelRename: () => void;
  onDelete: (laneId: string) => void;
}) {
  return (
    <div className="lane-strip">
      {lanes.map((lane) => (
        <span className={`lane-pill editable-lane-pill ${lane.color}`} key={lane.id}>
          {editingLaneId === lane.id ? (
            <form
              className="lane-pill-edit"
              onSubmit={(event) => {
                event.preventDefault();
                onRename(lane.id, editingLaneName);
              }}
            >
              <input value={editingLaneName} onChange={(event) => onRenameChange(event.target.value)} autoFocus aria-label="Rename Life Lane" />
              <button className="pill-icon-button" type="submit" aria-label="Save Life Lane">
                <Check size={12} />
              </button>
              <button className="pill-icon-button" type="button" onClick={onCancelRename} aria-label="Cancel Life Lane rename">
                <X size={12} />
              </button>
            </form>
          ) : (
            <>
              <button className="lane-name-button" type="button" onDoubleClick={() => onStartRename(lane)} aria-label={`Rename ${lane.name}`}>
                {lane.name}
              </button>
              <button className="pill-icon-button danger" type="button" onClick={() => onDelete(lane.id)} aria-label={`Delete ${lane.name}`}>
                <X size={12} />
              </button>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

function LaneFocus({ lane, columns, items, onClose }: { lane: LifeLane; columns: BoardColumn[]; items: BoardItem[]; onClose: () => void }) {
  return (
    <section className="lane-focus">
      <header>
        <span className={`lane-pill ${lane.color}`}>{lane.name}</span>
        <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close lane view">
          <X size={15} />
        </button>
      </header>
      <div className="lane-focus-grid">
        {columns.map((column) => {
          const columnItems = items.filter((item) => item.column === column.id);
          return (
            <div key={column.id}>
              <strong>{column.title}</strong>
              {columnItems.length ? (
                columnItems.map((item) => <span key={item.id}>{item.title}</span>)
              ) : (
                <span className="quiet">Empty</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ColumnFocus({
  column,
  columnTitle,
  lanes,
  items,
  onClose,
}: {
  column: ColumnId;
  columnTitle: string;
  lanes: LifeLane[];
  items: BoardItem[];
  onClose: () => void;
}) {
  const laneGroups = lanes
    .map((lane) => ({
      lane,
      items: items.filter((item) => item.laneId === lane.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="column-focus">
      <header>
        <div>
          <h2>{columnTitle}</h2>
        </div>
        <span className="focus-count">{items.length}</span>
        <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close column view">
          <X size={15} />
        </button>
      </header>
      <div className="column-focus-grid">
        {laneGroups.length ? (
          laneGroups.map((group) => (
            <div className="column-lane-group" key={group.lane.id}>
              <span className={`lane-pill ${group.lane.color}`}>{group.lane.name}</span>
              <div className="mini-item-stack">
                {group.items.map((item) => {
                  const dateLabel = dateRangeLabel(item);
                  return (
                    <article className="mini-item" key={item.id}>
                      <strong>{item.title}</strong>
                      {dateLabel && <span>{dateLabel}</span>}
                      {item.note && <p>{item.note}</p>}
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="column-lane-group quiet-group">Nothing here yet.</div>
        )}
      </div>
    </section>
  );
}

function DraftCard({
  draft,
  onSend,
  onDelete,
}: {
  draft: DraftNote;
  onSend: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="draft-card">
      <p>{draft.text}</p>
      <div className="draft-actions">
        <button className="primary-button small" type="button" onClick={onSend}>
          <Send size={15} />
          Push to Life Lanes
        </button>
        <button className="icon-button subtle" type="button" onClick={onDelete} aria-label="Delete draft">
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function TriageModal({
  draft,
  choice,
  columns,
  lanes,
  onChoice,
  onClose,
  onSend,
}: {
  draft: DraftNote;
  choice: TriageChoice;
  columns: BoardColumn[];
  lanes: LifeLane[];
  onChoice: (choice: TriageChoice) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div className="modal-scrim" role="presentation">
      <section className="triage-modal" role="dialog" aria-modal="true" aria-labelledby="triage-modal-title">
        <header>
          <h2 id="triage-modal-title">Push to Life Lanes</h2>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close triage">
            <X size={15} />
          </button>
        </header>
        <p className="modal-note">{draft.text}</p>
        <div className="triage-grid">
          <label>
            <span>Column</span>
            <select value={choice.column} onChange={(event) => onChoice({ ...choice, column: event.target.value })} aria-label="Choose board column">
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tag</span>
            <select value={choice.laneId} onChange={(event) => onChoice({ ...choice, laneId: event.target.value })} aria-label="Choose Life Lane">
              {lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button className="primary-button small" type="button" onClick={onSend}>
            <Send size={15} />
            Push
          </button>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Cancel triage">
            <X size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

function BoardCard({
  item,
  lanes,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onEdit,
  onDelete,
  onFocusLane,
  onExpandColumn,
}: {
  item: BoardItem;
  lanes: LifeLane[];
  dragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocusLane: () => void;
  onExpandColumn: () => void;
}) {
  const lane = laneFor(lanes, item.laneId);
  const dateLabel = dateRangeLabel(item);

  return (
    <article
      className={dragging ? `board-card ${lane.color} dragging` : `board-card ${lane.color}`}
      data-card-id={item.id}
      aria-label={`${item.title}, ${lane.name}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input, select, textarea")) {
          return;
        }
        onExpandColumn();
      }}
    >
      <div className="card-topline">
        <GripVertical size={16} />
        <button className={`lane-pill lane-button ${lane.color}`} type="button" onDoubleClick={onFocusLane} aria-label={`Open ${lane.name} lane focus`}>
          {lane.name}
        </button>
      </div>
      <h4>{item.title}</h4>
      {dateLabel && <span className="card-date">{dateLabel}</span>}
      {item.note && <p>{item.note}</p>}
      <div className="card-actions">
        <button className="icon-button subtle" type="button" onClick={onEdit} aria-label={`Edit ${item.title}`}>
          <Pencil size={15} />
        </button>
        <button className="icon-button subtle danger" type="button" onClick={onDelete} aria-label={`Delete ${item.title}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function DragGhost({ item, lane, ghost, ghostRef }: { item: BoardItem; lane: LifeLane; ghost: DragGhostState; ghostRef: RefObject<HTMLDivElement> }) {
  const dateLabel = dateRangeLabel(item);

  return (
    <div
      ref={ghostRef}
      className={`drag-ghost ${lane.color}`}
      style={{
        width: `${ghost.width}px`,
        transform: `translate3d(${ghost.x - ghost.offsetX}px, ${ghost.y - ghost.offsetY}px, 0)`,
      }}
    >
      <div className="card-topline">
        <GripVertical size={16} />
        <span className={`lane-pill ${lane.color}`}>{lane.name}</span>
      </div>
      <h4>{item.title}</h4>
      {dateLabel && <span className="card-date">{dateLabel}</span>}
      {item.note && <p>{item.note}</p>}
    </div>
  );
}

function EditItemCard({
  draft,
  columns,
  lanes,
  onChange,
  onSave,
  onCancel,
}: {
  draft: EditingState;
  columns: BoardColumn[];
  lanes: LifeLane[];
  onChange: (draft: EditingState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <article className="board-card edit-card">
      <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} aria-label="Edit item title" />
      <textarea value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} aria-label="Edit item note" />
      <div className="card-controls">
        <select value={draft.column} onChange={(event) => onChange({ ...draft, column: event.target.value as ColumnId })} aria-label="Edit column">
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>
        <select value={draft.laneId} onChange={(event) => onChange({ ...draft, laneId: event.target.value })} aria-label="Edit Life Lane">
          {lanes.map((lane) => (
            <option key={lane.id} value={lane.id}>
              {lane.name}
            </option>
          ))}
        </select>
      </div>
      <div className="date-range-fields">
        <input
          type="date"
          value={draft.startDate ?? ""}
          onChange={(event) => onChange({ ...draft, startDate: event.target.value })}
          aria-label="Edit start date"
        />
        <input
          type="date"
          value={draft.endDate ?? ""}
          onChange={(event) => onChange({ ...draft, endDate: event.target.value })}
          aria-label="Edit end date"
        />
      </div>
      <div className="edit-actions">
        <button className="icon-button confirm" type="button" onClick={onSave} aria-label="Save edit">
          <Check size={16} />
        </button>
        <button className="icon-button subtle" type="button" onClick={onCancel} aria-label="Cancel edit">
          <X size={16} />
        </button>
      </div>
    </article>
  );
}

function QuickAddCard({
  column,
  lanes,
  value,
  onChange,
  onAdd,
  onCancel,
}: {
  column: ColumnId;
  lanes: LifeLane[];
  value: QuickAddDraft;
  onChange: (value: QuickAddDraft) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="quick-add-card"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd();
      }}
    >
      <div className="quick-add-head">
        <input
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="Item title"
          aria-label={`Add Item to ${column}`}
          autoFocus
        />
        <button className="icon-button confirm" type="submit" aria-label="Add Item">
          <Check size={16} />
        </button>
        <button className="icon-button subtle" type="button" onClick={onCancel} aria-label="Cancel add item">
          <X size={15} />
        </button>
      </div>
      <div className="quick-add-meta">
        <select value={value.laneId} onChange={(event) => onChange({ ...value, laneId: event.target.value })} aria-label="Life Lane for new Item">
          {lanes.map((lane) => (
            <option key={lane.id} value={lane.id}>
              {lane.name}
            </option>
          ))}
        </select>
      </div>
      <details className="date-details" open={Boolean(value.startDate || value.endDate)}>
        <summary>Date range</summary>
        <div className="date-range-fields">
          <input type="date" value={value.startDate} onChange={(event) => onChange({ ...value, startDate: event.target.value })} aria-label="Start date" />
          <input type="date" value={value.endDate} onChange={(event) => onChange({ ...value, endDate: event.target.value })} aria-label="End date" />
        </div>
      </details>
      <textarea value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Optional note" aria-label="New Item note" />
    </form>
  );
}

export default App;
