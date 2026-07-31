import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
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
  GripVertical,
  MoreHorizontal,
  Plus,
  Rows3,
  Settings2,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import { activeColumns } from "../board-utils";
import { type BoardColumn, type BoardItem, type BoardState, type LifeLane } from "../types";
import { LaneIcon } from "./LaneIcon";

type BoardMatrixProps = {
  state: BoardState;
  onCreateItem: (column: string, laneId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onCompleteItem: (item: BoardItem) => void;
  onMoveItem: (itemId: string, column: string, laneId: string, targetItemId?: string) => void;
  onMoveLane: (laneId: string, targetLaneId: string) => void;
  onManageBoard: () => void;
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
  const dateLabel = useMemo(() => {
    const format = (value?: string) => {
      if (!value) return "";
      const date = new Date(`${value}T12:00:00`);
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
    };
    const start = format(item.startDate);
    const end = format(item.endDate);
    return start && end ? `${start} – ${end}` : end ? `By ${end}` : start;
  }, [item.endDate, item.startDate]);
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

      <button className="note-open-button" type="button" onClick={onEdit} aria-label={`Open ${item.title}`}>
        <span className="note-title-row">
          <strong>{item.title}</strong>
          <span className={`priority-meter ${item.priority}`} title={`${priorityLabel} priority`}>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <span className="sr-only">{priorityLabel} priority</span>
          </span>
        </span>
        {dateLabel ? (
          <span className="note-meta">
            <span className="date-label">{dateLabel}</span>
          </span>
        ) : null}
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
  lane,
  items,
  hiddenOnMobile,
  onCreateItem,
  onEditItem,
  onCompleteItem,
}: {
  column: string;
  lane: LifeLane;
  items: BoardItem[];
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
      className={`matrix-cell${isOver ? " is-over" : ""}${hiddenOnMobile ? " mobile-hidden" : ""}`}
      data-column={column}
      data-lane={lane.id}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="matrix-cell-items">
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

      <button className="cell-add-button" type="button" onClick={onCreateItem}>
        <Plus size={15} />
        Item
      </button>
    </div>
  );
}

function SortableLaneRow({
  lane,
  columns,
  activeItems,
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
  activeItems: BoardItem[];
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

      {columns.map((column) => {
        const items = activeItems.filter(
          (item) => item.column === column.id && item.laneId === lane.id,
        );
        return (
          <MatrixCell
            key={`${column.id}-${lane.id}`}
            column={column.id}
            lane={lane}
            items={items}
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
}: BoardMatrixProps) {
  const columns = useMemo(() => activeColumns(state.columns), [state.columns]);
  const activeColumnIds = useMemo(() => new Set(columns.map((column) => column.id)), [columns]);
  const activeItems = useMemo(
    () => state.items.filter((item) => activeColumnIds.has(item.column)),
    [activeColumnIds, state.items],
  );
  const activeLaneIds = useMemo(() => new Set(activeItems.map((item) => item.laneId)), [activeItems]);
  const [showAllLanes, setShowAllLanes] = useState(false);
  const [collapsedLaneIds, setCollapsedLaneIds] = useState<Set<string>>(() => new Set());
  const [mobileColumn, setMobileColumn] = useState(columns[0]?.id ?? "");
  const [draggedItem, setDraggedItem] = useState<BoardItem | null>(null);

  useEffect(() => {
    if (!columns.some((column) => column.id === mobileColumn)) {
      setMobileColumn(columns[0]?.id ?? "");
    }
  }, [columns, mobileColumn]);

  const displayedLanes = useMemo(() => {
    if (showAllLanes) {
      return state.lanes;
    }

    if (activeLaneIds.size) {
      return state.lanes.filter((lane) => activeLaneIds.has(lane.id));
    }

    return state.lanes.slice(0, 5);
  }, [activeLaneIds, showAllLanes, state.lanes]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const counts = useMemo(
    () =>
      new Map(
        columns.map((column) => [column.id, activeItems.filter((item) => item.column === column.id).length]),
      ),
    [activeItems, columns],
  );

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const activeType = args.active.data.current?.type;
    const allowedTypes =
      activeType === "lane" ? new Set(["lane"]) : new Set(["item", "cell"]);

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) =>
        allowedTypes.has(container.data.current?.type),
      ),
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

  if (!columns.length) {
    return (
      <section className="board-empty-state">
        <Rows3 size={24} />
        <h2>Add your first state</h2>
        <p>A board needs somewhere for items to live.</p>
        <button className="primary-button" type="button" onClick={onManageBoard}>
          Customize board
        </button>
      </section>
    );
  }

  const gridStyle = { "--column-count": columns.length } as CSSProperties;

  return (
    <section className="board-view" aria-label="Life Lanes board">
      <div className="mobile-state-tabs" aria-label="Choose state">
        {columns.map((column) => (
          <button
            className={mobileColumn === column.id ? "active" : ""}
            type="button"
            key={column.id}
            onClick={() => setMobileColumn(column.id)}
          >
            {column.title}
            <span>{counts.get(column.id) ?? 0}</span>
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggedItem(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="matrix-scroll">
          <div className="lane-matrix" style={gridStyle}>
            <div className="matrix-header-cell lane-heading">
              <span>Life Lanes</span>
              <button
                className="lane-header-add"
                type="button"
                onClick={onManageBoard}
                aria-label="Add Life Lane"
                title="Add Life Lane"
              >
                <Plus size={14} />
                <span>New</span>
              </button>
            </div>

            {columns.map((column, index) => (
              <div
                className={`matrix-header-cell state-heading${mobileColumn !== column.id ? " mobile-hidden" : ""}`}
                key={column.id}
              >
                <span className={`state-dot state-${index + 1}`} />
                <h2>{column.title}</h2>
                <span className="state-count">{counts.get(column.id) ?? 0}</span>
                <button className="icon-button" type="button" onClick={onManageBoard} aria-label={`Manage ${column.title}`}>
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
                  activeItems={activeItems}
                  collapsed={collapsedLaneIds.has(lane.id)}
                  mobileColumn={mobileColumn}
                  onToggleLane={() => toggleLane(lane.id)}
                  onManageBoard={onManageBoard}
                  onCreateItem={onCreateItem}
                  onEditItem={onEditItem}
                  onCompleteItem={onCompleteItem}
                />
              ))}
            </SortableContext>
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
          {draggedItem ? <NoteCard item={draggedItem} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <footer className="board-footer">
        <div className="board-footer-actions">
          <button className="text-button" type="button" onClick={() => setShowAllLanes((value) => !value)}>
            <Rows3 size={16} />
            {showAllLanes ? "Show less" : `Show all ${state.lanes.length} lanes`}
          </button>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={onManageBoard}
          aria-label="Customize board"
        >
          <Settings2 size={16} />
          <span>Customize</span>
        </button>
      </footer>
    </section>
  );
}
