import { Check, ChevronRight, GripVertical, Pencil, Play, Plus, Send, Trash2, X } from "lucide-react";
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

type ViewId = "capture" | "board" | "achievements";
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
  threshold: number;
  element: HTMLElement;
};
type ToastState =
  | { id: string; kind: "undo-item"; label: string; item: BoardItem; index: number }
  | { id: string; kind: "undo-draft"; label: string; draft: DraftNote; index: number }
  | { id: string; kind: "notice"; label: string };
type DemoGuideTarget = "capture" | "triage" | "board" | "newLane" | "lanes" | "drag" | "deleteLane" | "achievements";
type DemoGuideStep = {
  title: string;
  body: string;
  view: ViewId;
  target: DemoGuideTarget;
};

const DEMO_GUIDE_STEPS: DemoGuideStep[] = [
  {
    title: "Capture",
    body: "Three loose notes get typed in. Press Capture.",
    view: "capture",
    target: "capture",
  },
  {
    title: "Sort",
    body: "They wait in Triage. Press Sort.",
    view: "capture",
    target: "triage",
  },
  {
    title: "Place",
    body: "Career, Fitness, and Finance appear on the board.",
    view: "board",
    target: "board",
  },
  {
    title: "Add lane",
    body: "A temporary lane appears, then disappears again.",
    view: "board",
    target: "newLane",
  },
  {
    title: "Sub-lanes",
    body: "Tags become smaller lanes inside each board lane.",
    view: "board",
    target: "lanes",
  },
  {
    title: "Move",
    body: "The holiday fund moves into Doing.",
    view: "board",
    target: "drag",
  },
  {
    title: "Remove",
    body: "The temporary lane is removed.",
    view: "board",
    target: "deleteLane",
  },
  {
    title: "Complete",
    body: "Completed items move into Achievements.",
    view: "achievements",
    target: "achievements",
  },
];

const DEMO_PRIMARY_ITEM_TITLE = "Holiday fund";
const DEMO_CAPTURE_ENTRIES = [
  { lane: "Career", text: "Complete project management certification" },
  { lane: "Fitness", text: "Build a 3-day gym routine" },
  { lane: "Finance", text: "Save £500 for holiday fund" },
];
const DEMO_CAPTURE_EXAMPLES = DEMO_CAPTURE_ENTRIES.map((entry) => entry.text);
const DEMO_TYPED_NOTE = DEMO_CAPTURE_EXAMPLES.join("\n");
const DEMO_DRAFT_TEXTS = new Set(DEMO_CAPTURE_EXAMPLES);
const DEMO_TEMP_COLUMN_TITLE = "This Week";

const DEMO_GUIDE_ITEMS: Array<{
  draftText?: string;
  title: string;
  note: string;
  column: ColumnId;
  lane: string;
  startDate?: string;
  endDate?: string;
}> = [
  {
    draftText: DEMO_CAPTURE_EXAMPLES[1],
    title: "3-day gym routine",
    note: "Keep it simple: one strength day, one conditioning day, one full-body session, with recovery between.",
    column: "doing",
    lane: "Fitness",
  },
  {
    draftText: DEMO_CAPTURE_EXAMPLES[0],
    title: "PM certification",
    note: "Choose the project management certification that best supports the next career step.",
    column: "todo",
    lane: "Career",
    endDate: "2026-09-30",
  },
  {
    draftText: DEMO_CAPTURE_EXAMPLES[2],
    title: DEMO_PRIMARY_ITEM_TITLE,
    note: "Put aside £500 over the next few months without squeezing normal weeks.",
    column: "todo",
    lane: "Finance",
    endDate: "2026-08-31",
  },
  {
    title: "Career evidence bank",
    note: "Collect examples of delivery, problem solving, and useful outcomes.",
    column: "todo",
    lane: "Career",
  },
  {
    title: "Long-term course idea",
    note: "Worth keeping, but not something to commit to this week.",
    column: "parked",
    lane: "Upskilling",
  },
  {
    title: "Training rhythm",
    note: "Keep it simple: two easy sessions, one focused effort, and recovery.",
    column: "doing",
    lane: "Fitness",
  },
  {
    title: "Money check-in",
    note: "Review spending, subscriptions, savings, and the next practical move.",
    column: "todo",
    lane: "Finance",
  },
  {
    title: "Creative backlog sort",
    note: "Separate ideas worth building soon from ideas that just need a safe place.",
    column: "parked",
    lane: "Creative",
  },
  {
    title: "Simple budget view",
    note: "Set up a lightweight view of regular income, bills, flexible spending, and savings.",
    column: "done",
    lane: "Finance",
    endDate: "2026-06-12",
  },
  {
    title: "Admin documents folder",
    note: "Put important files into one place so they are easy to find when needed.",
    column: "done",
    lane: "Life Admin",
    endDate: "2026-06-10",
  },
];

function isDemoDraftText(text: string) {
  return DEMO_DRAFT_TEXTS.has(text);
}

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

function isAchievementColumn(column: BoardColumn) {
  return column.id === "done";
}

function sameDropTarget(a: DropTarget | null, b: DropTarget | null) {
  return a?.column === b?.column && a?.laneId === b?.laneId && a?.targetId === b?.targetId && a?.placement === b?.placement;
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
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("board");
  const [mobileColumn, setMobileColumn] = useState<ColumnId>(initialState.columns[0]?.id ?? "doing");
  const [expandedLaneId, setExpandedLaneId] = useState<string | null>(null);
  const [expandedColumn, setExpandedColumn] = useState<ColumnId | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [openAddColumn, setOpenAddColumn] = useState<ColumnId | null>(null);
  const [showBoardLaneComposer, setShowBoardLaneComposer] = useState(false);
  const [demoGuideOpen, setDemoGuideOpen] = useState(false);
  const [demoGuideStep, setDemoGuideStep] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [achievementBurst, setAchievementBurst] = useState<{ id: string; title: string } | null>(null);
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
  const demoTypingTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const achievementBurstTimerRef = useRef<number | null>(null);

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
      if (demoTypingTimerRef.current) {
        window.clearInterval(demoTypingTimerRef.current);
      }
      if (achievementBurstTimerRef.current) {
        window.clearTimeout(achievementBurstTimerRef.current);
      }
      document.body.classList.remove("is-dragging-card");
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

  const achievementColumns = useMemo(() => state.columns.filter(isAchievementColumn), [state.columns]);
  const boardColumns = useMemo(() => state.columns.filter((column) => !isAchievementColumn(column)), [state.columns]);
  const achievementColumnIds = useMemo(() => new Set(achievementColumns.map((column) => column.id)), [achievementColumns]);
  const achievementItems = useMemo(() => state.items.filter((item) => achievementColumnIds.has(item.column)), [achievementColumnIds, state.items]);
  const boardItems = useMemo(() => state.items.filter((item) => !achievementColumnIds.has(item.column)), [achievementColumnIds, state.items]);
  const isDemoPreset = state.preset === "demo";
  const activeDemoGuideStep = isDemoPreset && demoGuideOpen ? DEMO_GUIDE_STEPS[demoGuideStep] : null;
  const demoGuideTarget = activeDemoGuideStep?.target;
  const guidedCardId = demoGuideTarget === "drag" ? boardItems.find((item) => item.title === DEMO_PRIMARY_ITEM_TITLE)?.id : null;

  useEffect(() => {
    if (!boardColumns.some((column) => column.id === mobileColumn)) {
      setMobileColumn(boardColumns[0]?.id ?? state.columns[0]?.id ?? "");
    }
  }, [boardColumns, mobileColumn, state.columns]);

  useEffect(() => {
    if (expandedItemId && !state.items.some((item) => item.id === expandedItemId)) {
      setExpandedItemId(null);
    }
  }, [expandedItemId, state.items]);

  useEffect(() => {
    if (isDemoPreset) {
      return;
    }
    setDemoGuideOpen(false);
    setDemoGuideStep(0);
  }, [isDemoPreset]);

  useEffect(() => {
    if (!activeDemoGuideStep || activeView === activeDemoGuideStep.view) {
      return;
    }
    setActiveView(activeDemoGuideStep.view);
  }, [activeDemoGuideStep, activeView]);

  useEffect(() => {
    if (!demoGuideOpen || demoGuideStep !== 0 || activeView === "capture") {
      return;
    }
    setActiveView("capture");
  }, [activeView, demoGuideOpen, demoGuideStep]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        state.columns.map((column) => [column.id, state.items.filter((item) => item.column === column.id).length]),
      ) as Record<ColumnId, number>,
    [state.columns, state.items],
  );

  const setCustomState = (updater: (current: BoardState) => BoardState) => {
    setState((current) => ({ ...updater(current), preset: current.preset === "demo" ? "demo" : "custom" }));
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

  const addDraftTexts = (texts: string[], dedupe = false) => {
    const cleanTexts = texts.map((text) => text.trim()).filter(Boolean);
    if (!cleanTexts.length) {
      return;
    }

    setCustomState((current) => {
      const existingDrafts = new Set(current.drafts.map((draft) => draft.text));
      const nextDraftTexts = dedupe ? cleanTexts.filter((text) => !existingDrafts.has(text)) : cleanTexts;
      if (!nextDraftTexts.length) {
        return current;
      }

      const stamp = nowStamp();
      return {
        ...current,
        drafts: [
          ...nextDraftTexts.map((text) => ({
            id: createId("draft"),
            text,
            createdAt: stamp,
            updatedAt: stamp,
          })),
          ...current.drafts,
        ],
      };
    });
  };

  const captureDraft = (event: FormEvent) => {
    event.preventDefault();
    const guidedCapture = isDemoPreset && demoGuideOpen && demoGuideStep === 0;
    const draftTexts = guidedCapture ? DEMO_CAPTURE_EXAMPLES : [captureText.trim()];
    if (!draftTexts.some((text) => text.trim())) {
      return;
    }

    addDraftTexts(draftTexts, guidedCapture);
    setCaptureText("");
    if (guidedCapture) {
      clearDemoTyping();
      setDemoGuideStep(1);
    }
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

  const defaultDraftChoice = (draft: DraftNote): TriageChoice => {
    const demoInput = DEMO_GUIDE_ITEMS.find((item) => item.draftText === draft.text);
    return {
      laneId: triageChoices[draft.id]?.laneId ?? (demoInput ? demoLaneIdFor(state.lanes, demoInput.lane) : state.lanes[0]?.id ?? ""),
      column:
        triageChoices[draft.id]?.column ??
        (demoInput ? demoColumnIdFor(state.columns, demoInput.column) : state.columns.find((column) => column.title.toLowerCase() === "to do")?.id) ??
        state.columns[0]?.id ??
        "",
    };
  };

  const openPushModal = (draft: DraftNote) => {
    setPushDraft(draft);
    setPushChoice(defaultDraftChoice(draft));
  };

  const createDemoItem = (input: (typeof DEMO_GUIDE_ITEMS)[number], columns: BoardColumn[], lanes: LifeLane[], stamp: string): BoardItem => ({
    id: createId("item"),
    title: input.title,
    note: input.note,
    column: demoColumnIdFor(columns, input.column),
    laneId: demoLaneIdFor(lanes, input.lane),
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: stamp,
    updatedAt: stamp,
  });

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
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
    }
    showToast({ id: createId("undo"), kind: "undo-item", label: "Item removed.", item, index });
  };

  const completeItem = (itemId: string) => {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item || item.column === "done") {
      return;
    }

    setCustomState((current) => {
      const doneColumn = current.columns.find(isAchievementColumn) ?? {
        id: "done",
        title: "Done",
        createdAt: nowStamp(),
      };
      const columns = current.columns.some((column) => column.id === doneColumn.id) ? current.columns : [...current.columns, doneColumn];

      return {
        ...current,
        columns,
        items: current.items.map((candidate) =>
          candidate.id === itemId
            ? {
                ...candidate,
                column: doneColumn.id,
                updatedAt: nowStamp(),
              }
            : candidate,
        ),
      };
    });

    setAchievementBurst({ id: createId("burst"), title: item.title });
    if (achievementBurstTimerRef.current) {
      window.clearTimeout(achievementBurstTimerRef.current);
    }
    achievementBurstTimerRef.current = window.setTimeout(() => setAchievementBurst(null), 2400);
    showToast({ id: createId("notice"), kind: "notice", label: "Moved to Achievements." }, 2800);
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
        const lastMatchingLaneIndex = remaining.reduce(
          (lastIndex, item, index) => (item.column === column && (!laneId || item.laneId === laneId) ? index : lastIndex),
          -1,
        );
        const lastColumnIndex = remaining.reduce((lastIndex, item, index) => (item.column === column ? index : lastIndex), -1);
        nextItems.splice((lastMatchingLaneIndex >= 0 ? lastMatchingLaneIndex : lastColumnIndex) + 1, 0, moved);
      }

      const sameOrder = nextItems.every(
        (item, index) =>
          item.id === current.items[index]?.id && item.column === current.items[index]?.column && item.laneId === current.items[index]?.laneId,
      );
      if (sameOrder && !commit) {
        return current;
      }

      return {
        ...current,
        items: sameOrder
          ? current.items.map((item) => (item.id === itemId ? { ...item, updatedAt: nowStamp() } : item))
          : nextItems,
      };
    });
  };

  const setActiveDropTarget = (target: DropTarget | null) => {
    if (sameDropTarget(dropTargetRef.current, target)) {
      return;
    }
    dropTargetRef.current = target;
    setDropTarget(target);

    const activeId = draggingIdRef.current;
    if (activeId && target) {
      moveDraggedItem(activeId, target.column, target.targetId, target.placement ?? "after", target.laneId, false);
    }
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
      const target = { column: targetItem.column, laneId: targetItem.laneId, targetId: targetItem.id, placement };
      setActiveDropTarget(target);
      return;
    }

    const hoveredLaneGroup = hoveredElements.map((element) => element.closest<HTMLElement>("[data-column-lane-id]")).find(Boolean);
    const laneColumn = hoveredLaneGroup?.dataset.columnId as ColumnId | undefined;
    const laneId = hoveredLaneGroup?.dataset.columnLaneId;
    if (laneColumn && laneId && columnsRef.current.some((candidate) => candidate.id === laneColumn)) {
      const target = { column: laneColumn, laneId };
      setActiveDropTarget(target);
      return;
    }

    const hoveredColumn = hoveredElements.map((element) => element.closest<HTMLElement>("[data-column-id]")).find(Boolean);
    const column = hoveredColumn?.dataset.columnId as ColumnId | undefined;
    if (column && columnsRef.current.some((candidate) => candidate.id === column)) {
      const activeItem = itemsRef.current.find((item) => item.id === activeId);
      setActiveDropTarget({ column, laneId: activeItem?.laneId });
    }
  };

  const autoScrollDuringDrag = (clientX: number, clientY: number) => {
    const edge = 78;
    const maxStep = 22;
    const board = boardRef.current;

    if (board) {
      const rect = board.getBoundingClientRect();
      if (clientX < rect.left + edge) {
        board.scrollLeft -= Math.min(maxStep, Math.ceil((rect.left + edge - clientX) / 4));
      } else if (clientX > rect.right - edge) {
        board.scrollLeft += Math.min(maxStep, Math.ceil((clientX - (rect.right - edge)) / 4));
      }
    }

    if (clientY < edge) {
      window.scrollBy({ top: -Math.min(maxStep, Math.ceil((edge - clientY) / 4)), left: 0 });
    } else if (clientY > window.innerHeight - edge) {
      window.scrollBy({ top: Math.min(maxStep, Math.ceil((clientY - (window.innerHeight - edge)) / 4)), left: 0 });
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
      if (distance < pendingDrag.threshold) {
        return;
      }

      preventDefault?.();
      document.body.classList.add("is-dragging-card");
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
      autoScrollDuringDrag(clientX, clientY);
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
    autoScrollDuringDrag(clientX, clientY);
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
    document.body.classList.remove("is-dragging-card");
    if (dragAnimationFrameRef.current) {
      window.cancelAnimationFrame(dragAnimationFrameRef.current);
      dragAnimationFrameRef.current = null;
    }
    dragSourceRef.current = null;
    pendingDragRef.current = null;
    dropTargetRef.current = null;
    setDropTarget(null);
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

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (draggingIdRef.current || pendingDragRef.current) {
        finishDraggingPointer();
        return;
      }

      if (pushDraft) {
        setPushDraft(null);
        setPushChoice(null);
        return;
      }

      if (expandedItemId) {
        setExpandedItemId(null);
        return;
      }

      if (expandedLaneId) {
        setExpandedLaneId(null);
        return;
      }

      if (expandedColumn) {
        setExpandedColumn(null);
        return;
      }

      if (editingId) {
        setEditingId(null);
        setEditing(null);
        return;
      }

      if (showBoardLaneComposer) {
        setShowBoardLaneComposer(false);
        setNewColumnName("");
        return;
      }

      if (demoGuideOpen) {
        setDemoGuideOpen(false);
        clearDemoTyping();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [demoGuideOpen, editingId, expandedColumn, expandedItemId, expandedLaneId, pushDraft, showBoardLaneComposer]);

  const startDraggingItem = (event: ReactPointerEvent<HTMLElement>, itemId: string) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || (target.closest("button, input, select, textarea") && !target.closest(".drag-handle"))) {
      return;
    }

    const cardElement = event.currentTarget.closest<HTMLElement>("[data-card-id]") ?? event.currentTarget;
    const rect = cardElement.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragSourceRef.current = event.currentTarget;
    setActiveDropTarget(null);
    pendingDragRef.current = {
      itemId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      startX: event.clientX,
      startY: event.clientY,
      threshold: event.pointerType === "touch" ? 8 : 5,
      element: cardElement,
    };
  };

  const clearDemoTyping = () => {
    if (demoTypingTimerRef.current) {
      window.clearInterval(demoTypingTimerRef.current);
      demoTypingTimerRef.current = null;
    }
  };

  const typeDemoNote = (text: string) => {
    clearDemoTyping();
    setCaptureText("");

    const startedAt = Date.now();
    const duration = Math.min(1900, Math.max(1100, text.length * 15));
    const renderFrame = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const index = Math.max(1, Math.ceil(progress * text.length));
      setCaptureText(text.slice(0, index));
      if (index >= text.length) {
        clearDemoTyping();
      }
    };

    demoTypingTimerRef.current = window.setInterval(renderFrame, 24);
    renderFrame();
  };

  const demoLaneIdFor = (lanes: LifeLane[], name: string) => lanes.find((lane) => lane.name === name)?.id ?? lanes[0]?.id ?? "";

  const demoColumnIdFor = (columns: BoardColumn[], column: ColumnId) => (columns.some((candidate) => candidate.id === column) ? column : columns[0]?.id ?? column);

  const addDemoDrafts = () => {
    addDraftTexts(DEMO_CAPTURE_EXAMPLES, true);
  };

  const addDemoItems = (titles: string[]) => {
    setState((current) => {
      if (current.preset !== "demo") {
        return current;
      }

      const stamp = nowStamp();
      let changed = false;
      let items = current.items;

      titles.forEach((title) => {
        const input = DEMO_GUIDE_ITEMS.find((item) => item.title === title);
        if (!input || items.some((item) => item.title === input.title)) {
          return;
        }

        changed = true;
        items = [...items, createDemoItem(input, current.columns, current.lanes, stamp)];
      });

      return changed ? { ...current, items } : current;
    });
  };

  const placeDemoDrafts = () => {
    setState((current) => {
      if (current.preset !== "demo") {
        return current;
      }

      const stamp = nowStamp();
      const demoInputs = DEMO_GUIDE_ITEMS.filter((item) => item.draftText);
      const nextDrafts = current.drafts.filter((draft) => !isDemoDraftText(draft.text));
      let changed = nextDrafts.length !== current.drafts.length;
      let items = current.items;

      demoInputs.forEach((input) => {
        if (items.some((item) => item.title === input.title)) {
          return;
        }
        changed = true;
        items = [...items, createDemoItem(input, current.columns, current.lanes, stamp)];
      });

      return changed ? { ...current, drafts: nextDrafts, items } : current;
    });
  };

  const sortDemoDraftsToBoard = () => {
    clearDemoTyping();
    placeDemoDrafts();
    setActiveView("board");
    if (isDemoPreset && demoGuideOpen) {
      setDemoGuideStep(2);
    }
  };

  const addTemporaryDemoLane = () => {
    setState((current) => {
      if (current.preset !== "demo") {
        return current;
      }

      const existingColumn = current.columns.find((column) => column.title === DEMO_TEMP_COLUMN_TITLE);
      const nextColumn = existingColumn ?? createColumn(DEMO_TEMP_COLUMN_TITLE);
      const columns = existingColumn ? current.columns : [...current.columns, nextColumn];
      const evidenceBank = DEMO_GUIDE_ITEMS.find((item) => item.title === "Career evidence bank");
      if (!evidenceBank || current.items.some((item) => item.title === evidenceBank.title)) {
        return existingColumn ? current : { ...current, columns };
      }

      const stamp = nowStamp();
      return {
        ...current,
        columns,
        items: [
          ...current.items,
          {
            id: createId("item"),
            title: evidenceBank.title,
            note: evidenceBank.note,
            column: nextColumn.id,
            laneId: demoLaneIdFor(current.lanes, evidenceBank.lane),
            createdAt: stamp,
            updatedAt: stamp,
          },
        ],
      };
    });
  };

  const movePrimaryDemoItemIntoDoing = () => {
    setState((current) => {
      if (current.preset !== "demo") {
        return current;
      }

      const doingColumn = demoColumnIdFor(current.columns, "doing");
      return {
        ...current,
        items: current.items.map((item) =>
          item.title === DEMO_PRIMARY_ITEM_TITLE
            ? {
                ...item,
                column: doingColumn,
                updatedAt: nowStamp(),
              }
            : item,
        ),
      };
    });
  };

  const deleteTemporaryDemoLane = () => {
    setState((current) => {
      if (current.preset !== "demo") {
        return current;
      }

      const temporaryColumn = current.columns.find((column) => column.title === DEMO_TEMP_COLUMN_TITLE);
      if (!temporaryColumn) {
        return current;
      }

      const todoColumn = demoColumnIdFor(current.columns, "todo");
      return {
        ...current,
        columns: current.columns.filter((column) => column.id !== temporaryColumn.id),
        items: current.items.map((item) =>
          item.column === temporaryColumn.id
            ? {
                ...item,
                column: todoColumn,
                updatedAt: nowStamp(),
              }
            : item,
        ),
      };
    });
  };

  const runDemoGuideStep = (step: number) => {
    clearDemoTyping();

    switch (step) {
      case 0:
        setActiveView("capture");
        setCaptureText("");
        typeDemoNote(DEMO_TYPED_NOTE);
        break;
      case 1:
        setActiveView("capture");
        setCaptureText("");
        addDemoDrafts();
        break;
      case 2:
        setActiveView("board");
        placeDemoDrafts();
        break;
      case 3:
        setActiveView("board");
        break;
      case 4:
        setActiveView("board");
        addTemporaryDemoLane();
        addDemoItems(["Training rhythm", "Money check-in", "Long-term course idea", "Creative backlog sort"]);
        break;
      case 5:
        setActiveView("board");
        movePrimaryDemoItemIntoDoing();
        break;
      case 6:
        setActiveView("board");
        deleteTemporaryDemoLane();
        break;
      case 7:
        setActiveView("achievements");
        addDemoItems(["Simple budget view", "Admin documents folder"]);
        break;
      default:
        break;
    }
  };

  const loadPreset = (preset: "draft" | "demo") => {
    const next = preset === "demo" ? createBoardState("demo") : loadState();
    const shouldStartGuide = preset === "demo";
    setState(next);
    setCaptureText("");
    setQuickAdd(createQuickAddState(next.lanes, next.columns));
    setTriageChoices({});
    setEditingId(null);
    setEditing(null);
    setExpandedLaneId(null);
    setExpandedColumn(null);
    setExpandedItemId(null);
    setOpenAddColumn(null);
    setShowBoardLaneComposer(false);
    setNewColumnName("");
    setEditingLaneId(null);
    setEditingLaneName("");
    setEditingColumnId(null);
    setEditingColumnName("");
    setDemoGuideOpen(shouldStartGuide);
    setDemoGuideStep(0);
    setPushDraft(null);
    setPushChoice(null);
    clearDemoTyping();
    pendingDragRef.current = null;
    dropTargetRef.current = null;
    setDropTarget(null);
    closeToast();
    setActiveView(shouldStartGuide ? "capture" : "board");
    setMobileColumn(next.columns[0]?.id ?? "");
    if (shouldStartGuide) {
      typeDemoNote(DEMO_TYPED_NOTE);
    }
  };

  const toggleDemoGuide = () => {
    const next = createBoardState("demo");
    clearDemoTyping();
    setState(next);
    setCaptureText("");
    setQuickAdd(createQuickAddState(next.lanes, next.columns));
    setTriageChoices({});
    setEditingId(null);
    setEditing(null);
    setExpandedLaneId(null);
    setExpandedColumn(null);
    setExpandedItemId(null);
    setOpenAddColumn(null);
    setShowBoardLaneComposer(false);
    setNewColumnName("");
    setEditingLaneId(null);
    setEditingLaneName("");
    setEditingColumnId(null);
    setEditingColumnName("");
    setPushDraft(null);
    setPushChoice(null);
    setDropTarget(null);
    pendingDragRef.current = null;
    dropTargetRef.current = null;
    setDemoGuideOpen(true);
    setDemoGuideStep(0);
    runDemoGuideStep(0);
  };

  const closeDemoGuide = () => {
    clearDemoTyping();
    setDemoGuideOpen(false);
  };

  const moveDemoGuideForward = () => {
    const nextStep = Math.min(DEMO_GUIDE_STEPS.length - 1, demoGuideStep + 1);
    setDemoGuideStep(nextStep);
    runDemoGuideStep(nextStep);
  };

  const finishDemoGuide = () => {
    clearDemoTyping();
    setDemoGuideOpen(false);
    setDemoGuideStep(0);
  };

  const expandedLane = expandedLaneId ? state.lanes.find((lane) => lane.id === expandedLaneId) : null;
  const expandedItem = expandedItemId ? state.items.find((item) => item.id === expandedItemId) : null;
  const draggingItem = draggingId ? state.items.find((item) => item.id === draggingId) : null;

  const renderLaneTools = () =>
    showBoardLaneComposer ? (
      <form
        className="lane-form inline lane-composer"
        onSubmit={(event) => {
          event.preventDefault();
          addColumn(newColumnName);
        }}
      >
        <input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Lane name" aria-label="Add Life Lane state" autoFocus />
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
      <button
        className={demoGuideTarget === "newLane" ? "add-lane-button guide-target" : "add-lane-button"}
        type="button"
        onClick={() => {
          if (isDemoPreset && demoGuideOpen && demoGuideStep === 3) {
            setDemoGuideStep(4);
            runDemoGuideStep(4);
            return;
          }
          setShowBoardLaneComposer(true);
        }}
        aria-label="Add Life Lane state"
      >
        <Plus size={15} />
        New lane
      </button>
    );

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
        guided={guidedCardId === item.id}
        onPointerDown={(event) => startDraggingItem(event, item.id)}
        onComplete={() => completeItem(item.id)}
        onEdit={() => startEdit(item)}
        onDelete={() => deleteItem(item.id)}
        onOpen={() => setExpandedItemId(item.id)}
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
          {isDemoPreset && (
            <button
              className={demoGuideOpen ? "guide-toggle active" : "guide-toggle"}
              type="button"
              onClick={toggleDemoGuide}
              aria-label={demoGuideOpen ? "Restart demo tour" : "Start demo tour"}
            >
              <Play size={15} />
              {demoGuideOpen ? "Restart" : "Tour"}
            </button>
          )}
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

      <div className="workspace-row">
        <nav className="workspace-tabs" aria-label="Workspace">
          <button
            className={activeView === "board" ? "tab-button active" : "tab-button"}
            type="button"
            onClick={() => setActiveView("board")}
            aria-label="Open My Life Lanes"
          >
            My Life Lanes
            {boardItems.length > 0 && <span>{boardItems.length}</span>}
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
          <button
            className={activeView === "achievements" ? "tab-button active" : "tab-button"}
            type="button"
            onClick={() => setActiveView("achievements")}
            aria-label="Open Achievements"
          >
            Achievements
            {achievementItems.length > 0 && <span>{achievementItems.length}</span>}
          </button>
        </nav>
        {activeView === "board" && <div className="board-lane-tools workspace-lane-tools">{renderLaneTools()}</div>}
      </div>

      {activeDemoGuideStep && (
        <DemoGuidePanel
          step={activeDemoGuideStep}
          stepIndex={demoGuideStep}
          stepCount={DEMO_GUIDE_STEPS.length}
          highlightNext={!["capture", "triage", "newLane"].includes(activeDemoGuideStep.target)}
          onNext={() => {
            if (demoGuideStep >= DEMO_GUIDE_STEPS.length - 1) {
              finishDemoGuide();
              return;
            }
            moveDemoGuideForward();
          }}
          onClose={closeDemoGuide}
        />
      )}

      {activeView === "capture" ? (
        <main className="capture-page">
          <div className="capture-sidebar">
            <section className={demoGuideTarget === "capture" ? "panel-card capture-card guide-target" : "panel-card capture-card"}>
              <div className="panel-title">
                <div>
                  <h2>Brain Dump</h2>
                </div>
              </div>
              <form className="capture-form" onSubmit={captureDraft}>
                {demoGuideTarget === "capture" ? (
                  <DemoBrainDumpPreview typedText={captureText} />
                ) : (
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
                )}
                <div className="capture-action-wrap">
                  <button className={demoGuideTarget === "capture" ? "primary-button capture-button guide-target" : "primary-button capture-button"} type="submit">
                    <Send size={17} />
                    Capture
                  </button>
                </div>
              </form>
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
          </div>

          <section className={demoGuideTarget === "triage" ? "panel-card triage-card guide-target" : "panel-card triage-card"}>
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
                    guided={demoGuideTarget === "triage" && isDemoDraftText(draft.text)}
                    onSend={() => {
                      if (isDemoPreset && demoGuideOpen && demoGuideStep === 1 && isDemoDraftText(draft.text)) {
                        sortDemoDraftsToBoard();
                        return;
                      }
                      openPushModal(draft);
                    }}
                    onDelete={() => deleteDraft(draft.id)}
                  />
                ))
              ) : (
                <div className="empty-state">No drafts.</div>
              )}
            </div>
          </section>
        </main>
      ) : activeView === "achievements" ? (
        <AchievementsView items={achievementItems} lanes={state.lanes} onOpenItem={setExpandedItemId} guided={demoGuideTarget === "achievements"} />
      ) : (
        <main className="board-panel">
          <div className="mobile-column-switcher" aria-label="Choose board column">
            {boardColumns.map((column) => (
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
              columns={boardColumns}
              items={boardItems.filter((item) => item.laneId === expandedLane.id)}
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
            style={{ "--column-count": Math.max(boardColumns.length, 1) } as CSSProperties}
            aria-label="Life Lanes Kanban"
          >
            {boardColumns.map((column) => {
              const columnItems = state.items.filter((item) => item.column === column.id);
              const isTemporaryDemoColumn = column.title === DEMO_TEMP_COLUMN_TITLE;
              const columnLaneGroups = state.lanes
                .map((lane) => ({
                  lane,
                  items: columnItems.filter((item) => item.laneId === lane.id),
                }))
                .filter((group) => draggingId || group.items.length > 0);
              return (
                <section
                  className={`${draggingId ? "kanban-column drag-aware" : "kanban-column"} ${mobileColumn === column.id ? "mobile-active" : ""} ${
                    demoGuideTarget === "board" || demoGuideTarget === "deleteLane" || (demoGuideTarget === "newLane" && isTemporaryDemoColumn)
                      ? "guide-target"
                      : ""
                  }`}
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
                    {columnLaneGroups.map((group) => {
                      const isDropLane = dropTarget?.column === column.id && dropTarget.laneId === group.lane.id;
                      return (
                        <section
                          className={`${group.items.length ? "column-lane" : "column-lane empty-lane"} ${isDropLane ? "active-drop" : ""} ${
                            demoGuideTarget === "lanes" && group.items.length ? "guide-target" : ""
                          }`}
                          key={group.lane.id}
                          data-column-id={column.id}
                          data-column-lane-id={group.lane.id}
                        >
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
                          <div className="item-stack column-lane-items">
                            {group.items.map((item) => (
                              <DropAwareItem
                                key={item.id}
                                item={item}
                                dropTarget={dropTarget}
                                columnId={column.id}
                                laneId={group.lane.id}
                                renderItem={renderBoardItem}
                              />
                            ))}
                            {dropTarget?.column === column.id && dropTarget.laneId === group.lane.id && !dropTarget.targetId && <DropPlaceholder />}
                          </div>
                        </section>
                      );
                    })}
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
      {expandedItem && (
        <ItemFocus
          item={expandedItem}
          columns={state.columns}
          lanes={state.lanes}
          items={state.items}
          onClose={() => setExpandedItemId(null)}
          onOpenItem={setExpandedItemId}
          onUpdate={(patch) => updateItem(expandedItem.id, patch)}
          onDelete={() => deleteItem(expandedItem.id)}
        />
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
      {achievementBurst && <AchievementBurst key={achievementBurst.id} title={achievementBurst.title} />}
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
  guided,
  onSend,
  onDelete,
}: {
  draft: DraftNote;
  guided: boolean;
  onSend: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="draft-card">
      <p>{draft.text}</p>
      <div className="draft-actions">
        <button className={guided ? "primary-button small guide-target" : "primary-button small"} type="button" onClick={onSend}>
          <Send size={15} />
          Sort
        </button>
        <button className="icon-button subtle" type="button" onClick={onDelete} aria-label="Delete draft">
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function DemoBrainDumpPreview({ typedText }: { typedText: string }) {
  const typedLines = typedText.split("\n");

  return (
    <div className="demo-brain-dumps" aria-label="Demo brain dump examples">
      {DEMO_CAPTURE_ENTRIES.map((entry, index) => {
        const value = typedLines[index] ?? "";
        return (
          <article className={value ? "demo-brain-dump filled" : "demo-brain-dump"} key={entry.text}>
            <span>{entry.lane}</span>
            <p>{value || "..."}</p>
          </article>
        );
      })}
    </div>
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
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="triage-modal" role="dialog" aria-modal="true" aria-labelledby="triage-modal-title">
        <header>
          <h2 id="triage-modal-title">Place note</h2>
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
            Place
          </button>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Cancel triage">
            <X size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

function DemoGuidePanel({
  step,
  stepIndex,
  stepCount,
  highlightNext,
  onNext,
  onClose,
}: {
  step: DemoGuideStep;
  stepIndex: number;
  stepCount: number;
  highlightNext: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const lastStep = stepIndex >= stepCount - 1;

  return (
    <aside className="demo-guide" aria-live="polite">
      <div className="demo-guide-copy">
        <span className="demo-guide-kicker">
          Demo · {stepIndex + 1}/{stepCount}
        </span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
      </div>
      <div className="demo-guide-actions">
        <div className="demo-guide-progress" aria-hidden="true">
          {Array.from({ length: stepCount }, (_, index) => (
            <span className={index === stepIndex ? "active" : ""} key={index} />
          ))}
        </div>
        <button className={highlightNext ? "primary-button small guide-target" : "primary-button small"} type="button" onClick={onNext}>
          {lastStep ? "Done" : "Next"}
          {!lastStep && <ChevronRight size={14} />}
        </button>
        <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close demo guide">
          <X size={14} />
        </button>
      </div>
    </aside>
  );
}

function DropAwareItem({
  item,
  dropTarget,
  columnId,
  laneId,
  renderItem,
}: {
  item: BoardItem;
  dropTarget: DropTarget | null;
  columnId: ColumnId;
  laneId: string;
  renderItem: (item: BoardItem) => JSX.Element;
}) {
  const isTarget = dropTarget?.column === columnId && dropTarget.laneId === laneId && dropTarget.targetId === item.id;

  return (
    <>
      {isTarget && dropTarget.placement === "before" && <DropPlaceholder />}
      {renderItem(item)}
      {isTarget && dropTarget.placement === "after" && <DropPlaceholder />}
    </>
  );
}

function DropPlaceholder() {
  return <div className="drop-placeholder" aria-hidden="true" />;
}

function AchievementsView({
  items,
  lanes,
  onOpenItem,
  guided,
}: {
  items: BoardItem[];
  lanes: LifeLane[];
  onOpenItem: (itemId: string) => void;
  guided: boolean;
}) {
  const groups = lanes
    .map((lane) => ({
      lane,
      items: items.filter((item) => item.laneId === lane.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <main className={guided ? "achievements-panel guide-target" : "achievements-panel"}>
      {groups.length ? (
        groups.map((group) => (
          <section className="achievement-lane" key={group.lane.id}>
            <header>
              <span className={`lane-pill ${group.lane.color}`}>{group.lane.name}</span>
              <span className="lane-count">{group.items.length}</span>
            </header>
            <div className="achievement-grid">
              {group.items.map((item) => (
                <AchievementCard key={item.id} item={item} lane={group.lane} onOpen={() => onOpenItem(item.id)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state achievements-empty">Completed items will collect here.</div>
      )}
    </main>
  );
}

function AchievementCard({ item, lane, onOpen }: { item: BoardItem; lane: LifeLane; onOpen: () => void }) {
  const dateLabel = dateRangeLabel(item);

  return (
    <article
      className={`achievement-card ${lane.color}`}
      aria-label={`${item.title}, ${lane.name}`}
      onDoubleClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
    >
      <h4>{item.title}</h4>
      {dateLabel && <span className="card-date">{dateLabel}</span>}
    </article>
  );
}

function ItemFocus({
  item,
  columns,
  lanes,
  items,
  onClose,
  onOpenItem,
  onUpdate,
  onDelete,
}: {
  item: BoardItem;
  columns: BoardColumn[];
  lanes: LifeLane[];
  items: BoardItem[];
  onClose: () => void;
  onOpenItem: (itemId: string) => void;
  onUpdate: (patch: Partial<BoardItem>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<EditingState>({
    title: item.title,
    note: item.note,
    column: item.column,
    laneId: item.laneId,
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? "",
  });
  const column = columns.find((candidate) => candidate.id === item.column);
  const activeColumnItems = items.filter((candidate) => candidate.column === item.column);
  const groups = lanes
    .map((lane) => ({
      lane,
      items: activeColumnItems.filter((candidate) => candidate.laneId === lane.id),
    }))
    .filter((group) => group.items.length > 0 || group.lane.id === item.laneId);

  useEffect(() => {
    setDraft({
      title: item.title,
      note: item.note,
      column: item.column,
      laneId: item.laneId,
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
    });
  }, [item]);

  const save = () => {
    if (!draft.title.trim()) {
      return;
    }
    onUpdate({
      title: draft.title.trim(),
      note: draft.note.trim(),
      column: draft.column,
      laneId: draft.laneId,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
    });
  };

  return (
    <div
      className="item-focus-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="item-focus" role="dialog" aria-modal="true" aria-labelledby="item-focus-title">
        <header className="item-focus-header">
          <div>
            <span className="focus-kicker">{column?.title ?? "Life Lane"}</span>
            <h2 id="item-focus-title">{item.title}</h2>
          </div>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="Close item view">
            <X size={16} />
          </button>
        </header>

        <div className="item-focus-body">
          <form
            className="item-focus-editor"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="Item title" />
            <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Notes" aria-label="Item notes" />
            <div className="card-controls">
              <select value={draft.column} onChange={(event) => setDraft({ ...draft, column: event.target.value })} aria-label="Move item">
                {columns.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
              </select>
              <select value={draft.laneId} onChange={(event) => setDraft({ ...draft, laneId: event.target.value })} aria-label="Item tag">
                {lanes.map((lane) => (
                  <option key={lane.id} value={lane.id}>
                    {lane.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="date-range-fields">
              <input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} aria-label="Start date" />
              <input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} aria-label="End date" />
            </div>
            <div className="item-focus-actions">
              <button className="primary-button small" type="submit">
                <Check size={15} />
                Save
              </button>
              <button className="icon-button subtle danger" type="button" onClick={onDelete} aria-label="Delete item">
                <Trash2 size={15} />
              </button>
            </div>
          </form>

          <div className="item-focus-lanes" aria-label="Parallel Life Lanes">
            {groups.map((group) => (
              <section className="focus-lane-column" key={group.lane.id}>
                <header>
                  <span className={`lane-pill ${group.lane.color}`}>{group.lane.name}</span>
                  <span className="lane-count">{group.items.length}</span>
                </header>
                <div className="mini-item-stack">
                  {group.items.length ? (
                    group.items.map((candidate) => (
                      <button
                        key={candidate.id}
                        className={candidate.id === item.id ? "mini-item focus-mini active" : "mini-item focus-mini"}
                        type="button"
                        onClick={() => onOpenItem(candidate.id)}
                      >
                        <strong>{candidate.title}</strong>
                        {dateRangeLabel(candidate) && <span>{dateRangeLabel(candidate)}</span>}
                      </button>
                    ))
                  ) : (
                    <span className="quiet">Empty</span>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BoardCard({
  item,
  lanes,
  dragging,
  guided,
  onPointerDown,
  onComplete,
  onEdit,
  onDelete,
  onOpen,
}: {
  item: BoardItem;
  lanes: LifeLane[];
  dragging: boolean;
  guided: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const lane = laneFor(lanes, item.laneId);
  const dateLabel = dateRangeLabel(item);

  return (
    <article
      className={`${dragging ? `board-card ${lane.color} dragging` : `board-card ${lane.color}`} ${guided ? "guide-target" : ""}`}
      data-card-id={item.id}
      aria-label={`${item.title}, ${lane.name}`}
      onPointerDown={onPointerDown}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen();
        }
      }}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input, select, textarea, .drag-handle")) {
          return;
        }
        onOpen();
      }}
    >
      <button className="drag-handle" type="button" aria-label={`Drag ${item.title}`}>
        <GripVertical size={15} />
      </button>
      <div className="card-title-row">
        <button className="complete-action" type="button" onClick={onComplete} aria-label={`Move ${item.title} to Achievements`}>
          <Check size={14} />
        </button>
        <h4>{item.title}</h4>
      </div>
      {dateLabel && <span className="card-date">{dateLabel}</span>}
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

function AchievementBurst({ title }: { title: string }) {
  return (
    <div className="achievement-burst" role="status" aria-live="polite" aria-label={`${title} moved to Achievements`}>
      <div className="achievement-flight-shell">
        <span className="achievement-trail main" aria-hidden="true" />
        <span className="achievement-trail secondary" aria-hidden="true" />
        <span className="achievement-trail tertiary" aria-hidden="true" />
        <LifeLanesGoat />
        <span className="achievement-label">Done</span>
        <span className="achievement-spark one" aria-hidden="true" />
        <span className="achievement-spark two" aria-hidden="true" />
        <span className="achievement-spark three" aria-hidden="true" />
        <span className="achievement-spark four" aria-hidden="true" />
        <span className="achievement-spark five" aria-hidden="true" />
        <span className="achievement-spark six" aria-hidden="true" />
      </div>
    </div>
  );
}

function LifeLanesGoat() {
  return (
    <svg className="achievement-goat" viewBox="0 0 190 128" aria-hidden="true">
      <defs>
        <linearGradient id="goatBody" x1="26" x2="156" y1="26" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f7fbff" />
          <stop offset="0.48" stopColor="#dfe8f0" />
          <stop offset="1" stopColor="#aebdc8" />
        </linearGradient>
        <linearGradient id="goatAccent" x1="62" x2="128" y1="18" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9ab7f5" />
          <stop offset="1" stopColor="#80cbb8" />
        </linearGradient>
        <linearGradient id="goatHorn" x1="132" x2="165" y1="4" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d8fff0" />
          <stop offset="1" stopColor="#9ab7f5" />
        </linearGradient>
      </defs>
      <path className="goat-shadow" d="M40 103C68 114 121 116 153 103" />
      <path className="goat-tail" d="M42 55C24 49 20 34 31 27C32 40 43 42 51 49Z" />
      <path className="goat-back-leg" d="M67 79C58 94 52 105 39 112L51 116C64 107 73 94 80 82Z" />
      <path className="goat-front-leg" d="M125 80C124 96 127 108 137 118L149 115C141 104 138 94 140 80Z" />
      <path className="goat-body" d="M42 54C54 27 103 22 132 40C158 56 152 84 123 94C91 105 51 93 40 70C36 62 37 57 42 54Z" />
      <path className="goat-patch" d="M78 45C93 35 114 37 124 49C114 62 89 67 72 58C69 52 72 48 78 45Z" />
      <path className="goat-neck" d="M122 39C134 27 153 27 162 40C169 51 160 65 144 67C129 69 119 55 122 39Z" />
      <path className="goat-head" d="M145 31C163 27 178 37 178 52C178 64 165 72 151 68C139 65 134 54 137 43C138 38 141 34 145 31Z" />
      <path className="goat-ear" d="M148 35C139 26 128 25 123 33C131 36 138 40 144 46Z" />
      <path className="goat-horn rear" d="M149 30C151 18 158 10 169 6C166 18 160 27 152 34Z" />
      <path className="goat-horn" d="M158 33C164 18 174 10 186 8C181 23 172 33 160 40Z" />
      <path className="goat-beard" d="M160 66C159 79 151 88 139 91C143 79 147 70 152 64Z" />
      <circle className="goat-eye" cx="162" cy="48" r="3.2" />
      <path className="goat-smile" d="M168 58C163 61 158 61 154 57" />
      <path className="goat-hoof back" d="M39 112L53 116" />
      <path className="goat-hoof front" d="M137 118L151 115" />
    </svg>
  );
}

function DragGhost({ item, lane, ghost, ghostRef }: { item: BoardItem; lane: LifeLane; ghost: DragGhostState; ghostRef: RefObject<HTMLDivElement> }) {
  return (
    <div
      ref={ghostRef}
      className={`drag-ghost ${lane.color}`}
      style={{
        width: `${ghost.width}px`,
        transform: `translate3d(${ghost.x - ghost.offsetX}px, ${ghost.y - ghost.offsetY}px, 0)`,
      }}
    >
      <div className="card-topline compact">
        <span className={`lane-pill ${lane.color}`}>{lane.name}</span>
      </div>
      <h4>{item.title}</h4>
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
