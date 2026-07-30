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
  ChevronRight,
  GripVertical,
  Info,
  MoreHorizontal,
  Plus,
  Rows3,
  Settings2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import { activeColumns } from "../board-utils";
import { type BoardItem, type BoardState, type LifeLane } from "../types";
import { LaneIcon } from "./LaneIcon";

type BoardMatrixProps = {
  state: BoardState;
  onCreateItem: (column: string, laneId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onCompleteItem: (item: BoardItem) => void;
  onMoveItem: (itemId: string, column: string, laneId: string, targetItemId?: string) => void;
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

function cellId(column: string, laneId: string) {
  return `cell:${column}:${laneId}`;
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
        <strong>{item.title}</strong>
        {dateLabel ? <span>{dateLabel}</span> : null}
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
          {items.map((item) => (
            <SortableNoteCard
              key={item.id}
              item={item}
              onEdit={() => onEditItem(item)}
              onComplete={() => onCompleteItem(item)}
            />
          ))}
        </div>
      </SortableContext>

      <button className="cell-add-button" type="button" onClick={onCreateItem}>
        <Plus size={15} />
        Item
      </button>
    </div>
  );
}

export function BoardMatrix({
  state,
  onCreateItem,
  onEditItem,
  onCompleteItem,
  onMoveItem,
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

    return state.lanes.slice(0, 7);
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

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedItem(state.items.find((item) => item.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedItem(null);
    const activeData = event.active.data.current as ItemDragData | undefined;
    const overData = event.over?.data.current as ItemDragData | CellDragData | undefined;

    if (!activeData || activeData.type !== "item" || !overData) {
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggedItem(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="matrix-scroll">
          <div className="lane-matrix" style={gridStyle}>
            <div className="matrix-header-cell lane-heading">
              <span>Life Lane</span>
              <Info size={16} aria-label="Life Lanes organise items by area of life" />
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

            {displayedLanes.map((lane) => {
              const collapsed = collapsedLaneIds.has(lane.id);
              return (
                <div className={`matrix-row-contents${collapsed ? " is-collapsed" : ""}`} key={lane.id}>
                  <div className={`lane-row-heading ${lane.color}`}>
                    <button className="lane-collapse-button" type="button" onClick={() => toggleLane(lane.id)} aria-expanded={!collapsed}>
                      {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                      <span className="lane-icon">
                        <LaneIcon name={lane.name} />
                      </span>
                      <strong>{lane.name}</strong>
                    </button>
                    <button className="lane-menu-button" type="button" onClick={onManageBoard} aria-label={`Manage ${lane.name}`}>
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
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}>
          {draggedItem ? <NoteCard item={draggedItem} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <footer className="board-footer">
        <div className="board-footer-actions">
          <button className="text-button accent" type="button" onClick={onManageBoard}>
            <Plus size={17} />
            Add Life Lane
          </button>
          <button className="text-button" type="button" onClick={() => setShowAllLanes((value) => !value)}>
            <Rows3 size={16} />
            {showAllLanes ? "Show active lanes" : `Show all ${state.lanes.length} lanes`}
          </button>
        </div>
        <button className="text-button" type="button" onClick={onManageBoard}>
          <Settings2 size={16} />
          Customize
        </button>
      </footer>
    </section>
  );
}
