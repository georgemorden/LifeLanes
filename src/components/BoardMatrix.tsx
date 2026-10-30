import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  Columns3,
  GripVertical,
  MoreHorizontal,
  Plus,
  Rows3,
  Search,
  Settings2,
  X,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { activeColumns, dateRangeLabel } from "../board-utils";
import { CORE_DEFAULT_LANES } from "../data";
import { loadBoardPreferences, saveBoardPreferences } from "../ui-preferences";
import { type BoardColumn, type BoardItem, type BoardState, type ItemPriority, type LifeLane } from "../types";
import { LaneIcon } from "./LaneIcon";

type BoardMatrixProps = {
  state: BoardState;
  onCreateItem: (column: string, laneId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onCompleteItem: (item: BoardItem) => void;
  onMoveItem: (itemId: string, column: string, laneId: string, targetItemId?: string) => void;
  onMoveLane: (laneId: string, targetLaneId: string) => void;
  onManageBoard: (target?: "add" | "lanes" | "states" | "backup") => void;
  onChangePreset: (preset: "draft" | "demo") => void;
  focusOnMount?: boolean;
  tourAction?: "expand";
};

type ItemDragData = {
  type: "item";
  itemId: string;
  column: string;
  laneId: string;
};

type CellDragData = {
  type: "cell";
  column: string;
  laneId: string;
};

type LaneDragData = {
  type: "lane";
  laneId: string;
};

function cellId(column: string, laneId: string) {
  return `cell:${column}:${laneId}`;
}

function laneDragId(laneId: string) {
  return `lane:${laneId}`;
}

function cellKey(column: string, laneId: string) {
  return `${column}\u0000${laneId}`;
}

function stateTone(index: number) {
  return `state-tone-${(index % 5) + 1}`;
}

type BoardFocusTarget = {
  column: string;
  kind: "header" | "content";
  laneId?: string;
  itemIndex?: number;
};

const boardNavigationKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Escape",
  "Enter",
  " ",
]);

const interactiveBoardSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[role='dialog']",
  "[role='menu']",
].join(",");

function isVisibleBoardTarget(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return (
    element.offsetParent !== null &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    (!element.closest(".is-collapsed") || element.dataset.boardNav === "lane")
  );
}

function BoardCreateMenu({
  onAddLane,
  onAddState,
  guidedOpen = false,
  label = "Add to board",
}: {
  onAddLane: () => void;
  onAddState: () => void;
  guidedOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [guidedMenuTop, setGuidedMenuTop] = useState<number>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const laneRef = useRef<HTMLButtonElement | null>(null);
  const stateRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setOpen(guidedOpen);
  }, [guidedOpen]);

  useLayoutEffect(() => {
    if (!open || !guidedOpen || !window.matchMedia("(max-width: 720px)").matches) {
      setGuidedMenuTop(undefined);
      return;
    }
    const guide = document.querySelector<HTMLElement>(".tour-bar");
    if (!guide) return;
    const positionMenu = () => setGuidedMenuTop(Math.ceil(guide.getBoundingClientRect().bottom + 8));
    positionMenu();
    const observer = new ResizeObserver(positionMenu);
    observer.observe(guide);
    window.addEventListener("resize", positionMenu);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionMenu);
    };
  }, [guidedOpen, open]);

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => laneRef.current?.focus());
    const handleOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("pointerdown", handleOutsidePress);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handleOutsidePress);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const choose = (action: () => void) => {
    triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
    action();
  };

  return (
    <div className="board-create-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`board-create-trigger${open ? " is-open" : ""}`}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="board-create-options"
        title={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Plus size={15} />
      </button>

      {open ? (
        <div
          id="board-create-options"
          className="board-create-popover"
          role="menu"
          aria-label="Add to board"
          style={guidedMenuTop === undefined ? undefined : { position: "fixed", top: guidedMenuTop, right: 10, left: "auto" }}
        >
          <button
            ref={laneRef}
            type="button"
            role="menuitem"
            onClick={() => choose(onAddLane)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              stateRef.current?.focus();
            }}
          >
            <Rows3 size={15} />
            <span>Life Lane</span>
          </button>
          <button
            ref={stateRef}
            type="button"
            role="menuitem"
            onClick={() => choose(onAddState)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp") return;
              event.preventDefault();
              laneRef.current?.focus();
            }}
          >
            <Columns3 size={15} />
            <span>State</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SortableNoteCard({
  item,
  onEdit,
  onComplete,
}: {
  item: BoardItem;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: {
      type: "item",
      itemId: item.id,
      column: item.column,
      laneId: item.laneId,
    } satisfies ItemDragData,
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <NoteCard
      nodeRef={setNodeRef}
      item={item}
      style={style}
      dragging={isDragging}
      dragAttributes={attributes as ButtonHTMLAttributes<HTMLButtonElement>}
      dragListeners={listeners as ButtonHTMLAttributes<HTMLButtonElement>}
      onEdit={onEdit}
      onComplete={onComplete}
    />
  );
}

type NoteCardProps = {
  item: BoardItem;
  dragging?: boolean;
  overlay?: boolean;
  style?: CSSProperties;
  nodeRef?: (node: HTMLDivElement | null) => void;
  dragAttributes?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragListeners?: ButtonHTMLAttributes<HTMLButtonElement>;
  onEdit?: () => void;
  onComplete?: () => void;
};

function NoteCard({
  item,
  dragging = false,
  overlay = false,
  style,
  dragAttributes,
  dragListeners,
  onEdit,
  onComplete,
  nodeRef,
}: NoteCardProps) {
  const dateLabel = useMemo(() => dateRangeLabel(item), [item]);
  const priorityLabel = `${item.priority.slice(0, 1).toUpperCase()}${item.priority.slice(1)}`;

  return (
    <div
      ref={nodeRef}
      className={`note-card${dragging ? " is-dragging" : ""}${overlay ? " drag-overlay" : ""}`}
      style={style}
      data-item-id={item.id}
    >
      <button
        className="note-drag-handle"
        type="button"
        aria-label={`Drag ${item.title}`}
        {...dragAttributes}
        {...dragListeners}
      >
        <GripVertical size={16} />
      </button>

      <button
        className="note-open-button"
        type="button"
        onClick={onEdit}
        aria-label={`Open ${item.title}`}
        data-board-nav="item"
        data-board-column={item.column}
        data-board-lane={item.laneId}
      >
        <span className="note-title-row">
          <strong>{item.title}</strong>
        </span>
        <span className="note-meta">
          <span className={`priority-label ${item.priority}`} title={`${priorityLabel} priority`}>
            {priorityLabel}
          </span>
          {dateLabel ? (
            <span className="date-label">{dateLabel}</span>
          ) : null}
        </span>
      </button>

      <div className="note-actions">
        <button className="note-complete-button" type="button" onClick={onComplete} aria-label={`Complete ${item.title}`}>
          <Check size={15} />
        </button>
        <button className="note-menu-button" type="button" onClick={onEdit} aria-label={`Edit ${item.title}`}>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </div>
  );
}

function MatrixCell({
  column,
  columnTitle,
  tone,
  lane,
  items,
  collapsed,
  hiddenOnMobile,
  onCreateItem,
  onEditItem,
  onCompleteItem,
}: {
  column: string;
  columnTitle: string;
  tone: string;
  lane: LifeLane;
  items: BoardItem[];
  collapsed: boolean;
  hiddenOnMobile: boolean;
  onCreateItem: () => void;
  onEditItem: (item: BoardItem) => void;
  onCompleteItem: (item: BoardItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId(column, lane.id),
    data: { type: "cell", column, laneId: lane.id } satisfies CellDragData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`matrix-cell ${tone}${isOver ? " is-over" : ""}${hiddenOnMobile ? " mobile-hidden" : ""}`}
      data-column={column}
      data-lane={lane.id}
    >
      <div
        className="collapsed-lane-preview"
        data-lane-preview={`${column}-${lane.id}`}
        aria-hidden={!collapsed}
      >
        {items.slice(0, 2).map((item) => (
          <span className="collapsed-item-title" key={item.id}>
            {item.title}
          </span>
        ))}
        {items.length > 2 ? (
          <span className="collapsed-item-more">+{items.length - 2}</span>
        ) : null}
      </div>

      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="matrix-cell-items" aria-hidden={collapsed} {...(collapsed ? { inert: "" } : {})}>
          <div className="matrix-cell-stack">
            {items.map((item) => (
              <SortableNoteCard
                key={item.id}
                item={item}
                onEdit={() => onEditItem(item)}
                onComplete={() => onCompleteItem(item)}
              />
            ))}
          </div>
        </div>
      </SortableContext>

      <button
        className="cell-add-button"
        type="button"
        onClick={onCreateItem}
        aria-label={`Add item to ${lane.name} in ${columnTitle}`}
        title="Add item"
        data-board-nav="add"
        data-board-column={column}
        data-board-lane={lane.id}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function SortableLaneRow({
  lane,
  columns,
  itemsByCell,
  collapsed,
  mobileColumn,
  onToggleLane,
  onManageBoard,
  onCreateItem,
  onEditItem,
  onCompleteItem,
}: {
  lane: LifeLane;
  columns: BoardColumn[];
  itemsByCell: Map<string, BoardItem[]>;
  collapsed: boolean;
  mobileColumn: string;
  onToggleLane: () => void;
  onManageBoard: () => void;
  onCreateItem: (column: string, laneId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onCompleteItem: (item: BoardItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: laneDragId(lane.id),
    data: { type: "lane", laneId: lane.id } satisfies LaneDragData,
    transition: {
      duration: 280,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`matrix-row-contents${collapsed ? " is-collapsed" : ""}${isDragging ? " is-lane-dragging" : ""}`}
      style={style}
    >
      <div className={`lane-row-heading ${lane.color}`}>
        <button
          className="lane-drag-handle"
          type="button"
          aria-label={`Reorder ${lane.name}`}
          {...(attributes as ButtonHTMLAttributes<HTMLButtonElement>)}
          {...(listeners as ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          <GripVertical size={15} />
        </button>
        <button
          className="lane-collapse-button"
          type="button"
          onClick={onToggleLane}
          aria-expanded={!collapsed}
          data-board-nav="lane"
          data-board-column={columns[0]?.id}
          data-board-lane={lane.id}
        >
          <ChevronDown className="lane-chevron" size={17} />
          <span className="lane-icon">
            <LaneIcon name={lane.name} icon={lane.icon} />
          </span>
          <strong>{lane.name}</strong>
        </button>
        <button
          className="lane-menu-button"
          type="button"
          onClick={onManageBoard}
          aria-label={`Manage ${lane.name}`}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {columns.map((column, index) => {
        const items = itemsByCell.get(cellKey(column.id, lane.id)) ?? [];
        return (
          <MatrixCell
            key={`${column.id}-${lane.id}`}
            column={column.id}
            columnTitle={column.title}
            tone={stateTone(index)}
            lane={lane}
            items={items}
            collapsed={collapsed}
            hiddenOnMobile={mobileColumn !== column.id}
            onCreateItem={() => onCreateItem(column.id, lane.id)}
            onEditItem={onEditItem}
            onCompleteItem={onCompleteItem}
          />
        );
      })}
    </div>
  );
}

export function BoardMatrix({
  state,
  onCreateItem,
  onEditItem,
  onCompleteItem,
  onMoveItem,
  onMoveLane,
  onManageBoard,
  onChangePreset,
  focusOnMount = true,
  tourAction,
}: BoardMatrixProps) {
  const columns = useMemo(() => activeColumns(state.columns), [state.columns]);
  const activeColumnIds = useMemo(() => new Set(columns.map((column) => column.id)), [columns]);
  const activeItems = useMemo(
    () => state.items.filter((item) => activeColumnIds.has(item.column)),
    [activeColumnIds, state.items],
  );
  const initialPreferences = useMemo(() => loadBoardPreferences(state.preset), []);
  const [preferencePreset, setPreferencePreset] = useState(state.preset);
  const [showAllLanes, setShowAllLanes] = useState(false);
  const laneVisibilityRef = useRef(new Map<string, boolean>());
  const [collapsedLaneIds, setCollapsedLaneIds] = useState<Set<string>>(
    () => new Set(initialPreferences.collapsedLaneIds),
  );
  const [overviewExpandedLaneIds, setOverviewExpandedLaneIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [mobileColumn, setMobileColumn] = useState(
    initialPreferences.mobileColumn || columns[0]?.id || "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<ItemPriority | "all">("all");
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => window.matchMedia("(max-width: 720px)").matches,
  );
  const [customizeMenuOpen, setCustomizeMenuOpen] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [draggedItem, setDraggedItem] = useState<BoardItem | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const pendingFocusRef = useRef<BoardFocusTarget | null>(null);
  const lastBoardColumnRef = useRef(columns[0]?.id ?? "");

  useEffect(() => {
    if (state.preset !== "demo" || tourAction !== "expand") return;
    setShowAllLanes(true);
    setSearchQuery("");
    setPriorityFilter("all");
    setCollapsedLaneIds(new Set());
  }, [state.preset, tourAction]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const handleMobileChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };
    mobileQuery.addEventListener("change", handleMobileChange);
    return () => mobileQuery.removeEventListener("change", handleMobileChange);
  }, []);

  useLayoutEffect(() => {
    if (preferencePreset === state.preset) return;
    const preferences = loadBoardPreferences(state.preset);
    laneVisibilityRef.current.set(preferencePreset, showAllLanes);
    setShowAllLanes(state.preset === "demo" ? false : laneVisibilityRef.current.get(state.preset) ?? false);
    setCollapsedLaneIds(new Set(state.preset === "demo" ? [] : preferences.collapsedLaneIds));
    setMobileColumn(preferences.mobileColumn || columns[0]?.id || "");
    setPreferencePreset(state.preset);
  }, [columns, preferencePreset, showAllLanes, state.preset]);

  useEffect(() => {
    if (preferencePreset !== state.preset) return;
    saveBoardPreferences(state.preset, {
      showAllLanes,
      collapsedLaneIds: [...collapsedLaneIds],
      mobileColumn,
    });
  }, [collapsedLaneIds, mobileColumn, preferencePreset, showAllLanes, state.preset]);

  useEffect(() => {
    setOverviewExpandedLaneIds(new Set());
  }, [showAllLanes]);

  useEffect(() => {
    if (!columns.some((column) => column.id === mobileColumn)) {
      setMobileColumn(columns[0]?.id ?? "");
    }
    if (!columns.some((column) => column.id === lastBoardColumnRef.current)) {
      lastBoardColumnRef.current = columns[0]?.id ?? "";
    }
  }, [columns, mobileColumn]);

  useEffect(() => {
    if (
      window.matchMedia("(max-width: 720px)").matches &&
      columns.some((column) => column.id === mobileColumn)
    ) {
      lastBoardColumnRef.current = mobileColumn;
    }
  }, [columns, mobileColumn]);

  useEffect(() => {
    if (!focusOnMount) return;
    lastBoardColumnRef.current = window.matchMedia("(max-width: 720px)").matches
      ? mobileColumn || columns[0]?.id || ""
      : columns[0]?.id ?? "";
    const frame = window.requestAnimationFrame(() => {
      boardRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusOnMount, state.preset]);

  const laneNames = useMemo(
    () => new Map(state.lanes.map((lane) => [lane.id, lane.name.toLowerCase()])),
    [state.lanes],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasFilters = Boolean(normalizedQuery) || priorityFilter !== "all";
  const filteredItems = useMemo(
    () =>
      activeItems.filter((item) => {
        if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
        if (!normalizedQuery) return true;
        return `${item.title}\n${item.note}\n${laneNames.get(item.laneId) ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [activeItems, laneNames, normalizedQuery, priorityFilter],
  );
  const activeLaneIds = useMemo(
    () => new Set(filteredItems.map((item) => item.laneId)),
    [filteredItems],
  );
  const mobileActiveLaneIds = useMemo(
    () =>
      new Set(
        filteredItems
          .filter((item) => item.column === mobileColumn)
          .map((item) => item.laneId),
      ),
    [filteredItems, mobileColumn],
  );
  const displayedLanes = useMemo(() => {
    const coreLaneNames = new Set(CORE_DEFAULT_LANES.map((name) => name.toLowerCase()));
    if (state.preset === "demo" && !hasFilters) {
      return showAllLanes
        ? state.lanes
        : state.lanes.filter((lane) => coreLaneNames.has(lane.name.toLowerCase()));
    }
    if (isMobileLayout) {
      if (showAllLanes && !hasFilters) return state.lanes;
      return state.lanes.filter((lane) => mobileActiveLaneIds.has(lane.id));
    }
    if (hasFilters) {
      return state.lanes.filter((lane) => activeLaneIds.has(lane.id));
    }
    if (showAllLanes) {
      return state.lanes;
    }

    return state.lanes.filter(
      (lane) => coreLaneNames.has(lane.name.toLowerCase()) || activeLaneIds.has(lane.id),
    );
  }, [activeLaneIds, hasFilters, isMobileLayout, mobileActiveLaneIds, showAllLanes, state.lanes, state.preset]);

  const hiddenLaneCount = Math.max(0, state.lanes.length - displayedLanes.length);
  const compactLaneOverview =
    !isMobileLayout &&
    !hasFilters &&
    state.preset !== "demo" &&
    (showAllLanes || displayedLanes.length === state.lanes.length);

  const itemsByCell = useMemo(() => {
    const indexed = new Map<string, BoardItem[]>();
    filteredItems.forEach((item) => {
      const key = cellKey(item.column, item.laneId);
      const cellItems = indexed.get(key);
      if (cellItems) cellItems.push(item);
      else indexed.set(key, [item]);
    });
    return indexed;
  }, [filteredItems]);

  const focusBoardElement = useCallback((element: HTMLElement) => {
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, []);

  const getVisibleNavTargets = useCallback(() => {
    if (!boardRef.current) return [];
    return Array.from(
      boardRef.current.querySelectorAll<HTMLElement>("[data-board-nav]"),
    ).filter(isVisibleBoardTarget);
  }, []);

  const focusTarget = useCallback(
    (target: BoardFocusTarget) => {
      const candidates = getVisibleNavTargets().filter(
        (element) => element.dataset.boardColumn === target.column,
      );

      if (target.kind === "header") {
        const header = candidates.find((element) =>
          element.dataset.boardNav === "mobile-header" ||
          element.dataset.boardNav === "header",
        );
        if (!header) return false;
        focusBoardElement(header);
        return true;
      }

      const itemTargets = candidates.filter(
        (element) => element.dataset.boardNav === "item",
      );
      if (target.laneId) {
        const laneItems = itemTargets.filter(
          (element) => element.dataset.boardLane === target.laneId,
        );
        if (laneItems.length) {
          focusBoardElement(
            laneItems[Math.min(target.itemIndex ?? 0, laneItems.length - 1)],
          );
          return true;
        }
        const laneAdd = candidates.find(
          (element) =>
            element.dataset.boardNav === "add" &&
            element.dataset.boardLane === target.laneId,
        );
        if (laneAdd) {
          focusBoardElement(laneAdd);
          return true;
        }
      }

      const contentTargets = itemTargets.length
        ? itemTargets
        : candidates.filter((element) => element.dataset.boardNav === "add");
      const laneTarget = candidates.find((element) => element.dataset.boardNav === "lane");
      if (!contentTargets.length && laneTarget) {
        focusBoardElement(laneTarget);
        return true;
      }
      if (!contentTargets.length) return false;
      focusBoardElement(contentTargets[0]);
      return true;
    },
    [focusBoardElement, getVisibleNavTargets],
  );

  const requestBoardFocus = useCallback(
    (target: BoardFocusTarget) => {
      if (isMobileLayout && target.column !== mobileColumn) {
        pendingFocusRef.current = target;
        setMobileColumn(target.column);
        return;
      }
      if (focusTarget(target)) return;
      pendingFocusRef.current = target;
      setMobileColumn(target.column);
    },
    [focusTarget, isMobileLayout, mobileColumn],
  );

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || pending.column !== mobileColumn) return;
    const frame = window.requestAnimationFrame(() => {
      focusTarget(pending);
      pendingFocusRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [collapsedLaneIds, displayedLanes, filteredItems, focusTarget, mobileColumn, overviewExpandedLaneIds]);

  const handleBoardKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!boardNavigationKeys.has(event.key)) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      const navTarget = target.closest<HTMLElement>("[data-board-nav]");
      const navKind = navTarget?.dataset.boardNav;
      let columnId = navTarget?.dataset.boardColumn;

      if (!navKind || !columnId) {
        const isBoardSurface =
          target === boardRef.current ||
          Boolean(boardRef.current?.contains(target));
        if (!isBoardSurface || target.closest(interactiveBoardSelector)) return;

        columnId = columns.some(
          (column) => column.id === lastBoardColumnRef.current,
        )
          ? lastBoardColumnRef.current
          : mobileColumn || columns[0]?.id;
        if (!columnId) return;

        const columnIndex = columns.findIndex((column) => column.id === columnId);
        if (columnIndex < 0) return;
        event.preventDefault();

        if (event.key === "ArrowDown") {
          requestBoardFocus({ column: columnId, kind: "content" });
          return;
        }
        if (event.key === "ArrowUp" || event.key === "Escape") {
          requestBoardFocus({ column: columnId, kind: "header" });
          return;
        }

        let nextIndex = columnIndex;
        if (event.key === "ArrowLeft") {
          nextIndex = (columnIndex - 1 + columns.length) % columns.length;
        } else if (event.key === "ArrowRight") {
          nextIndex = (columnIndex + 1) % columns.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = columns.length - 1;
        }

        const nextColumn = columns[nextIndex].id;
        lastBoardColumnRef.current = nextColumn;
        if (window.matchMedia("(max-width: 720px)").matches) {
          setMobileColumn(nextColumn);
        }
        requestBoardFocus({ column: nextColumn, kind: "header" });
        return;
      }

      if (!navTarget) return;
      const targetElement = navTarget;
      lastBoardColumnRef.current = columnId;

      const columnIndex = columns.findIndex((column) => column.id === columnId);
      if (columnIndex < 0) return;
      const prevent = () => event.preventDefault();

      if (navKind === "lane") {
        const laneTargets = getVisibleNavTargets().filter(
          (element) => element.dataset.boardNav === "lane",
        );
        const laneIndex = laneTargets.indexOf(targetElement);

        if (event.key === "Enter" || event.key === " ") {
          prevent();
          targetElement.click();
          return;
        }
        if (event.key === "Escape") {
          prevent();
          requestBoardFocus({ column: columnId, kind: "header" });
          return;
        }
        if (event.key === "ArrowRight") {
          prevent();
          const laneId = targetElement.dataset.boardLane;
          if (laneId && columns[0]) {
            requestBoardFocus({ column: columns[0].id, kind: "content", laneId });
          }
          return;
        }
        if (event.key === "Home" || event.key === "End" || event.key === "ArrowUp" || event.key === "ArrowDown") {
          if (laneIndex < 0) return;
          const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
              ? laneTargets.length - 1
              : laneIndex + (event.key === "ArrowDown" ? 1 : -1);
          if (nextIndex < 0) {
            prevent();
            requestBoardFocus({ column: columnId, kind: "header" });
          } else if (nextIndex < laneTargets.length) {
            prevent();
            focusBoardElement(laneTargets[nextIndex]);
          }
          return;
        }
        return;
      }

      if (navKind === "header" || navKind === "mobile-header") {
        if (event.key === "ArrowDown") {
          prevent();
          requestBoardFocus({ column: columnId, kind: "content" });
          return;
        }

        if (event.key === "ArrowUp" || event.key === "Escape") {
          prevent();
          document
            .getElementById("workspace-nav-board")
            ?.focus({ preventScroll: true });
          return;
        }

        let nextIndex = columnIndex;
        if (event.key === "ArrowLeft") nextIndex -= 1;
        else if (event.key === "ArrowRight") nextIndex += 1;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = columns.length - 1;
        else return;

        if (nextIndex < 0 || nextIndex >= columns.length) return;
        prevent();
        const nextColumn = columns[nextIndex].id;
        if (navKind === "mobile-header") setMobileColumn(nextColumn);
        requestBoardFocus({ column: nextColumn, kind: "header" });
        return;
      }

      if (navKind !== "item" && navKind !== "add") return;
      if (event.key === "Escape") {
        prevent();
        requestBoardFocus({ column: columnId, kind: "header" });
        return;
      }

      const visibleTargets = getVisibleNavTargets();
      const columnItems = visibleTargets.filter(
        (element) =>
          element.dataset.boardColumn === columnId &&
          element.dataset.boardNav === "item",
      );
      const columnContent = columnItems.length
        ? columnItems
        : visibleTargets.filter(
            (element) =>
              element.dataset.boardColumn === columnId &&
              element.dataset.boardNav === "add",
          );

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const currentIndex = columnContent.indexOf(targetElement);
        if (currentIndex < 0) return;
        prevent();
        const nextIndex = currentIndex + (event.key === "ArrowDown" ? 1 : -1);
        if (nextIndex < 0) {
          requestBoardFocus({ column: columnId, kind: "header" });
        } else if (nextIndex < columnContent.length) {
          focusBoardElement(columnContent[nextIndex]);
        }
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        if (!columnContent.length) return;
        prevent();
        focusBoardElement(
          event.key === "Home"
            ? columnContent[0]
            : columnContent[columnContent.length - 1],
        );
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const nextColumnIndex = columnIndex + (event.key === "ArrowRight" ? 1 : -1);
      if (nextColumnIndex < 0 || nextColumnIndex >= columns.length) return;
      prevent();
      const laneId = targetElement.dataset.boardLane;
      const laneItems = visibleTargets.filter(
        (element) =>
          element.dataset.boardColumn === columnId &&
          element.dataset.boardLane === laneId &&
          element.dataset.boardNav === "item",
      );
      requestBoardFocus({
        column: columns[nextColumnIndex].id,
        kind: "content",
        laneId,
        itemIndex: Math.max(0, laneItems.indexOf(targetElement)),
      });
    },
    [
      columns,
      focusBoardElement,
      getVisibleNavTargets,
      mobileColumn,
      requestBoardFocus,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleBoardKeyDown);
    return () => window.removeEventListener("keydown", handleBoardKeyDown);
  }, [handleBoardKeyDown]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const counts = useMemo(
    () =>
      new Map(
        columns.map((column) => [column.id, filteredItems.filter((item) => item.column === column.id).length]),
      ),
    [columns, filteredItems],
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeType = args.active.data.current?.type;
    const allowedTypes =
      activeType === "lane" ? new Set(["lane"]) : new Set(["item", "cell"]);
    const droppableContainers = args.droppableContainers.filter((container) =>
      allowedTypes.has(container.data.current?.type),
    );

    if (activeType === "item") {
      const pointerCollisions = pointerWithin({
        ...args,
        droppableContainers,
      });
      const itemCollision = pointerCollisions.find(
        (collision) =>
          collision.id !== args.active.id &&
          droppableContainers.find((container) => container.id === collision.id)
            ?.data.current?.type === "item",
      );
      if (itemCollision) return [itemCollision];

      const cellCollision = pointerCollisions.find(
        (collision) =>
          droppableContainers.find((container) => container.id === collision.id)
            ?.data.current?.type === "cell",
      );
      if (cellCollision) return [cellCollision];
    }

    return closestCenter({
      ...args,
      droppableContainers,
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as ItemDragData | LaneDragData | undefined;
    setDraggedItem(
      activeData?.type === "item"
        ? state.items.find((item) => item.id === activeData.itemId) ?? null
        : null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedItem(null);
    const activeData = event.active.data.current as ItemDragData | LaneDragData | undefined;
    const overData = event.over?.data.current as
      | ItemDragData
      | CellDragData
      | LaneDragData
      | undefined;

    if (activeData?.type === "lane") {
      if (overData?.type === "lane" && activeData.laneId !== overData.laneId) {
        onMoveLane(activeData.laneId, overData.laneId);
      }
      return;
    }

    if (
      !activeData ||
      activeData.type !== "item" ||
      !overData ||
      overData.type === "lane"
    ) {
      return;
    }

    if (overData.type === "item") {
      onMoveItem(activeData.itemId, overData.column, overData.laneId, overData.itemId);
      return;
    }

    onMoveItem(activeData.itemId, overData.column, overData.laneId);
  };

  const toggleLane = (laneId: string) => {
    if (compactLaneOverview) {
      setOverviewExpandedLaneIds((current) => {
        const next = new Set(current);
        if (next.has(laneId)) next.delete(laneId);
        else next.add(laneId);
        return next;
      });
      return;
    }

    setCollapsedLaneIds((current) => {
      const next = new Set(current);
      if (next.has(laneId)) {
        next.delete(laneId);
      } else {
        next.add(laneId);
      }
      return next;
    });
  };

  const mobileColumnTitle =
    columns.find((column) => column.id === mobileColumn)?.title ?? columns[0]?.title ?? "this state";
  const mobileDefaultLane = displayedLanes[0] ?? state.lanes[0];

  if (!columns.length) {
    return (
      <main
        id="workspace-board"
        className="board-empty-state"
        data-workspace-panel="board"
        tabIndex={-1}
      >
        <Rows3 size={24} />
        <h2>Add your first state</h2>
        <p>A board needs somewhere for items to live.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => onManageBoard("states")}
        >
          Customize board
        </button>
      </main>
    );
  }

  const gridStyle = { "--column-count": columns.length } as CSSProperties;
  const toggleLaneOverview = () => {
    setShowAllLanes((value) => !value);
  };
  const openCustomization = (target: "lanes" | "states" | "backup") => {
    customizeTriggerRef.current?.focus({ preventScroll: true });
    setCustomizeMenuOpen(false);
    onManageBoard(target);
  };

  return (
    <main
      ref={boardRef}
      id="workspace-board"
      className="board-view"
      data-workspace-panel="board"
      aria-label="Life Lanes board"
      aria-describedby="board-keyboard-help"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape"
      tabIndex={-1}
    >
      <p id="board-keyboard-help" className="sr-only">
        Use left and right arrow keys to move between states and lane areas. Use
        down to enter a state, up and down to move through its items, and Escape
        to return to the state heading.
      </p>
      <div className="mobile-board-bar">
        <div className="mobile-state-tabs" role="tablist" aria-label="Choose state">
          {columns.map((column, index) => (
            <button
              className={`${stateTone(index)}${mobileColumn === column.id ? " active" : ""}`}
              type="button"
              role="tab"
              id={`mobile-state-${column.id}`}
              aria-controls="mobile-state-panel"
              tabIndex={mobileColumn === column.id ? 0 : -1}
              aria-label={`${column.title} ${counts.get(column.id) ?? 0}`}
              aria-selected={mobileColumn === column.id}
              data-workspace-entry={mobileColumn === column.id ? "" : undefined}
              data-board-nav="mobile-header"
              data-board-column={column.id}
              key={column.id}
              onClick={() => {
                lastBoardColumnRef.current = column.id;
                setMobileColumn(column.id);
              }}
            >
              {column.title}
              {(counts.get(column.id) ?? 0) > 0 ? (
                <span key={`${column.id}-${counts.get(column.id) ?? 0}`}>
                  {counts.get(column.id)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      {isMobileLayout
        ? createPortal(
            <div className="mobile-board-actions">
              <BoardCreateMenu
                label="Add a Life Lane"
                guidedOpen={tourAction === "expand"}
                onAddLane={() => onManageBoard("add")}
                onAddState={() => onManageBoard("states")}
              />
              <button
                className="icon-button mobile-customize-button"
                type="button"
                aria-label="Customize board"
                onClick={() => onManageBoard()}
              >
                <Settings2 size={17} aria-hidden="true" />
              </button>
              <button
                className={state.preset === "demo" ? "mobile-demo-button active" : "mobile-demo-button"}
                type="button"
                onClick={() => onChangePreset(state.preset === "demo" ? "draft" : "demo")}
                aria-label={state.preset === "demo" ? "Exit demo" : "Open demo board"}
                aria-pressed={state.preset === "demo"}
              >
                {state.preset === "demo" ? "Exit demo" : "Demo"}
              </button>
            </div>,
            document.body,
          )
        : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggedItem(null)}
        onDragEnd={handleDragEnd}
      >
        <div
          id="mobile-state-panel"
          role={isMobileLayout ? "tabpanel" : undefined}
          aria-labelledby={isMobileLayout ? `mobile-state-${mobileColumn}` : undefined}
          className={`matrix-scroll${
            isMobileLayout && !displayedLanes.length && !hasFilters
              ? " is-mobile-empty"
              : ""
          }`}
        >
          <div className={`lane-matrix${compactLaneOverview ? " is-lane-overview" : ""}`} style={gridStyle}>
            <div className="matrix-header-cell lane-heading">
              <Rows3 className="lane-heading-symbol" size={15} aria-hidden="true" />
              <span className="lane-heading-label">Life lanes</span>
              <BoardCreateMenu
                guidedOpen={tourAction === "expand" && !isMobileLayout}
                onAddLane={() => onManageBoard("add")}
                onAddState={() => onManageBoard("states")}
              />
            </div>

            {columns.map((column, index) => (
              <div
                className={`matrix-header-cell state-heading ${stateTone(index)}${mobileColumn !== column.id ? " mobile-hidden" : ""}`}
                key={column.id}
                role="group"
                tabIndex={0}
                aria-label={`${column.title} state, ${counts.get(column.id) ?? 0} item${counts.get(column.id) === 1 ? "" : "s"}`}
                data-workspace-entry={index === 0 ? "" : undefined}
                data-board-nav="header"
                data-board-column={column.id}
              >
                <div className="state-title">
                  <h2>{column.title}</h2>
                  {(counts.get(column.id) ?? 0) > 0 ? (
                    <span
                      className="state-count"
                      key={`${column.id}-${counts.get(column.id) ?? 0}`}
                      title={`${counts.get(column.id)} item${counts.get(column.id) === 1 ? "" : "s"}`}
                      aria-hidden="true"
                    >
                      {counts.get(column.id)}
                    </span>
                  ) : null}
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onManageBoard("states")}
                  aria-label={`Manage ${column.title}`}
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            ))}

            <SortableContext
              items={displayedLanes.map((lane) => laneDragId(lane.id))}
              strategy={verticalListSortingStrategy}
            >
              {displayedLanes.map((lane) => (
                <SortableLaneRow
                  key={lane.id}
                  lane={lane}
                  columns={columns}
                  itemsByCell={itemsByCell}
                  collapsed={compactLaneOverview
                    ? !overviewExpandedLaneIds.has(lane.id)
                    : collapsedLaneIds.has(lane.id)}
                  mobileColumn={mobileColumn}
                  onToggleLane={() => toggleLane(lane.id)}
                  onManageBoard={() => onManageBoard("lanes")}
                  onCreateItem={onCreateItem}
                  onEditItem={onEditItem}
                  onCompleteItem={onCompleteItem}
                />
              ))}
            </SortableContext>
            {isMobileLayout && !displayedLanes.length && !hasFilters && mobileDefaultLane ? (
              <div className="mobile-state-empty">
                <span>Nothing in {mobileColumnTitle}</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onCreateItem(mobileColumn, mobileDefaultLane.id)}
                  aria-label={`Add item to ${mobileDefaultLane.name} in ${mobileColumnTitle}`}
                  data-board-nav="add"
                  data-board-column={mobileColumn}
                  data-board-lane={mobileDefaultLane.id}
                >
                  <Plus size={16} />
                  Add item
                </button>
              </div>
            ) : null}
            {hasFilters && !displayedLanes.length ? (
              <div className="matrix-empty-results">
                <Search size={18} aria-hidden="true" />
                <span>No matching items</span>
                <button
                  className="text-button accent"
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setPriorityFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
          {draggedItem ? <NoteCard item={draggedItem} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <footer className="board-footer">
        <div className="board-footer-actions">
          {!hasFilters && (hiddenLaneCount > 0 || showAllLanes) ? (
            <button className="text-button" type="button" onClick={toggleLaneOverview}>
              <Rows3 size={16} />
              {showAllLanes ? (state.preset === "demo" ? "Show main lanes" : "Focus on active lanes") : "Show all lanes"}
            </button>
          ) : null}
          {!isMobileLayout ? (
            <>
              <label className="board-search">
                <Search size={15} aria-hidden="true" />
                <span className="sr-only">Search items</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search items"
                />
                {searchQuery ? (
                  <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">
                    <X size={14} />
                  </button>
                ) : null}
              </label>
              <label className="board-priority-filter">
                <span className="sr-only">Filter by priority</span>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as ItemPriority | "all")}
                  aria-label="Filter by priority"
                >
                  <option value="all">All priorities</option>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
        {!isMobileLayout ? (
          <div className="board-footer-tools">
            <button
              className={state.preset === "demo" ? "text-button board-demo-button active" : "text-button board-demo-button"}
              type="button"
              onClick={() => onChangePreset(state.preset === "demo" ? "draft" : "demo")}
              aria-label={state.preset === "demo" ? "Exit demo" : "Open demo board"}
              aria-pressed={state.preset === "demo"}
            >
              {state.preset === "demo" ? "Exit demo" : "Demo"}
            </button>
            <div className="desktop-customize-menu">
            {customizeMenuOpen ? (
              <div className="customize-menu" role="menu" aria-label="Customize board">
                <button type="button" role="menuitem" onClick={() => openCustomization("lanes")}>
                  Edit Life Lanes
                </button>
                <button type="button" role="menuitem" onClick={() => openCustomization("states")}>
                  Edit States
                </button>
                <button type="button" role="menuitem" onClick={() => openCustomization("backup")}>
                  Backup Life Lanes
                </button>
              </div>
            ) : null}
            <button
              ref={customizeTriggerRef}
              className="text-button desktop-customize-button"
              type="button"
              onClick={() => setCustomizeMenuOpen((open) => !open)}
              aria-label="Customize board"
              aria-expanded={customizeMenuOpen}
              aria-haspopup="menu"
            >
              <Settings2 size={16} />
              <span>Customize</span>
              <ChevronDown size={14} className={customizeMenuOpen ? "is-open" : ""} />
            </button>
            </div>
          </div>
        ) : null}
      </footer>
    </main>
  );
}
