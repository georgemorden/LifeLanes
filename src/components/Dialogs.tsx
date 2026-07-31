import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  Download,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { activeColumns, isAchievementColumn } from "../board-utils";
import { firstLine, remainingLines } from "../board-utils";
import { LANE_ICON_OPTIONS } from "../lane-icons";
import { type ItemDraft, type ItemEditorState } from "../ui-types";
import {
  type BoardColumn,
  type BoardItem,
  type BoardState,
  type DraftNote,
  type ItemPriority,
  type LaneIconName,
  type LifeLane,
} from "../types";
import { LaneIcon } from "./LaneIcon";

const PRIORITY_OPTIONS: Array<{ id: ItemPriority; label: string }> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function PriorityPicker({
  value,
  onChange,
}: {
  value: ItemPriority;
  onChange: (priority: ItemPriority) => void;
}) {
  return (
    <div className="priority-picker" role="group" aria-label="Priority">
      {PRIORITY_OPTIONS.map((option) => (
        <button
          className={value === option.id ? `priority-option ${option.id} active` : `priority-option ${option.id}`}
          type="button"
          key={option.id}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
        >
          <span className={`priority-meter ${option.id}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DialogFrame({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={wide ? "dialog dialog-wide" : "dialog"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function ItemDialog({
  editor,
  state,
  onClose,
  onSave,
  onDelete,
  onComplete,
}: {
  editor: ItemEditorState;
  state: BoardState;
  onClose: () => void;
  onSave: (draft: ItemDraft) => void;
  onDelete: (item: BoardItem) => void;
  onComplete: (item: BoardItem) => void;
}) {
  const editingItem = editor.mode === "edit" ? editor.item : null;
  const [draft, setDraft] = useState<ItemDraft>(() => {
    if (editor.mode === "edit") {
      return {
        title: editor.item.title,
        note: editor.item.note,
        column: editor.item.column,
        laneId: editor.item.laneId,
        priority: editor.item.priority,
        startDate: editor.item.startDate ?? "",
        endDate: editor.item.endDate ?? "",
      };
    }

    return {
      title: "",
      note: "",
      column: editor.column,
      laneId: editor.laneId,
      priority: "medium",
      startDate: "",
      endDate: "",
    };
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onSave({ ...draft, title: draft.title.trim(), note: draft.note.trim() });
  };

  return (
    <DialogFrame
      title={editingItem ? "Item details" : "New item"}
      onClose={onClose}
    >
      <form className="item-form" onSubmit={submit}>
        <label className="field field-title">
          <span>Title</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="What is moving?"
            aria-label="Item title"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            placeholder="Useful context, next step, or why it matters"
            aria-label="Item notes"
            rows={5}
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>State</span>
            <select
              value={draft.column}
              onChange={(event) => setDraft({ ...draft, column: event.target.value })}
              aria-label="Item state"
            >
              {state.columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {isAchievementColumn(column) ? "Achievements" : column.title}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Life Lane</span>
            <select
              value={draft.laneId}
              onChange={(event) => setDraft({ ...draft, laneId: event.target.value })}
              aria-label="Item Life Lane"
            >
              {state.lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field priority-field">
          <span>Priority</span>
          <PriorityPicker
            value={draft.priority}
            onChange={(priority) => setDraft({ ...draft, priority })}
          />
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Start date <small>optional</small></span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
              aria-label="Start date"
            />
          </label>
          <label className="field">
            <span>End date <small>optional</small></span>
            <input
              type="date"
              value={draft.endDate}
              onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              aria-label="End date"
            />
          </label>
        </div>

        <footer className="dialog-footer">
          <div>
            {editingItem ? (
              <button className="danger-button" type="button" onClick={() => onDelete(editingItem)}>
                <Trash2 size={16} />
                Delete
              </button>
            ) : null}
          </div>
          <div>
            {editingItem && !isAchievementColumn(state.columns.find((column) => column.id === editingItem.column) ?? { id: "", title: "" }) ? (
              <button className="secondary-button" type="button" onClick={() => onComplete(editingItem)}>
                <Check size={16} />
                Complete
              </button>
            ) : null}
            <button className="primary-button" type="submit">
              {editingItem ? "Save changes" : "Add item"}
            </button>
          </div>
        </footer>
      </form>
    </DialogFrame>
  );
}

export function TriageDialog({
  draft,
  columns,
  lanes,
  onClose,
  onPlace,
}: {
  draft: DraftNote;
  columns: BoardColumn[];
  lanes: LifeLane[];
  onClose: () => void;
  onPlace: (choice: { title: string; note: string; column: string; laneId: string; priority: ItemPriority }) => void;
}) {
  const availableColumns = useMemo(() => activeColumns(columns), [columns]);
  const preferredColumn = availableColumns.find((column) => /to do|next/i.test(column.title)) ?? availableColumns[0];
  const [title, setTitle] = useState(firstLine(draft.text));
  const [note, setNote] = useState(remainingLines(draft.text));
  const [column, setColumn] = useState(preferredColumn?.id ?? "");
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? "");
  const [priority, setPriority] = useState<ItemPriority>("medium");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !column || !laneId) return;
    onPlace({ title: title.trim(), note: note.trim(), column, laneId, priority });
  };

  return (
    <DialogFrame title="Sort this thought" subtitle="Choose a state and Life Lane." onClose={onClose}>
      <form className="item-form" onSubmit={submit}>
        <label className="field field-title">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Triage title" autoFocus />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Triage notes" rows={4} />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>State</span>
            <select value={column} onChange={(event) => setColumn(event.target.value)} aria-label="Triage state">
              {availableColumns.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Life Lane</span>
            <select value={laneId} onChange={(event) => setLaneId(event.target.value)} aria-label="Triage Life Lane">
              {lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field priority-field">
          <span>Priority</span>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>
        <footer className="dialog-footer">
          <span />
          <div>
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit">Place on board</button>
          </div>
        </footer>
      </form>
    </DialogFrame>
  );
}

function EditableNameRow({
  id,
  value,
  tone,
  icon,
  protectedRow = false,
  nodeRef,
  style,
  dragging = false,
  dragAttributes,
  dragListeners,
  onRename,
  onDelete,
}: {
  id: string;
  value: string;
  tone?: string;
  icon?: LaneIconName;
  protectedRow?: boolean;
  nodeRef?: (node: HTMLDivElement | null) => void;
  style?: CSSProperties;
  dragging?: boolean;
  dragAttributes?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragListeners?: ButtonHTMLAttributes<HTMLButtonElement>;
  onRename: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(value);

  useEffect(() => setName(value), [value]);

  const commit = () => {
    const clean = name.trim();
    if (clean && clean !== value) {
      onRename(id, clean);
    } else {
      setName(value);
    }
  };

  return (
    <div
      ref={nodeRef}
      className={`manage-row${dragListeners ? " has-drag-handle" : ""}${dragging ? " is-dragging" : ""}`}
      style={style}
    >
      {dragListeners ? (
        <button
          className="manage-drag-handle"
          type="button"
          aria-label={`Reorder ${value}`}
          {...dragAttributes}
          {...dragListeners}
        >
          <GripVertical size={15} />
        </button>
      ) : null}
      <span className={`manage-row-symbol ${tone ?? ""}`}>
        {icon ? <LaneIcon icon={icon} size={17} /> : <span className="manage-row-dot" />}
      </span>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setName(value);
            event.currentTarget.blur();
          }
        }}
        aria-label={`Rename ${value}`}
        disabled={protectedRow}
      />
      {protectedRow ? <span className="system-label">System</span> : null}
      {!protectedRow ? (
        <button className="icon-button danger" type="button" onClick={() => onDelete(id)} aria-label={`Delete ${value}`}>
          <Trash2 size={15} />
        </button>
      ) : null}
    </div>
  );
}

function SortableManageLaneRow({
  lane,
  onRename,
  onDelete,
}: {
  lane: LifeLane;
  onRename: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lane.id,
    transition: {
      duration: 240,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <EditableNameRow
      id={lane.id}
      value={lane.name}
      tone={lane.color}
      icon={lane.icon}
      nodeRef={setNodeRef}
      style={style}
      dragging={isDragging}
      dragAttributes={attributes as ButtonHTMLAttributes<HTMLButtonElement>}
      dragListeners={listeners as ButtonHTMLAttributes<HTMLButtonElement>}
      onRename={onRename}
      onDelete={onDelete}
    />
  );
}

export function ManageBoardDialog({
  state,
  onClose,
  onAddLane,
  onRenameLane,
  onDeleteLane,
  onReorderLane,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onExport,
  onImport,
  onReset,
}: {
  state: BoardState;
  onClose: () => void;
  onAddLane: (name: string, icon: LaneIconName) => void;
  onRenameLane: (id: string, name: string) => void;
  onDeleteLane: (id: string) => void;
  onReorderLane: (laneId: string, targetLaneId: string) => void;
  onAddColumn: (name: string) => void;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string) => void;
  onExport: () => void;
  onImport: (value: unknown) => boolean;
  onReset: () => void;
}) {
  const [laneName, setLaneName] = useState("");
  const [laneIcon, setLaneIcon] = useState<LaneIconName>("sparkles");
  const [columnName, setColumnName] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const laneSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addLane = (event: FormEvent) => {
    event.preventDefault();
    if (!laneName.trim()) return;
    onAddLane(laneName.trim(), laneIcon);
    setLaneName("");
    setLaneIcon("sparkles");
  };

  const addColumn = (event: FormEvent) => {
    event.preventDefault();
    if (!columnName.trim()) return;
    onAddColumn(columnName.trim());
    setColumnName("");
  };

  const reorderLane = (event: DragEndEvent) => {
    if (event.over && event.active.id !== event.over.id) {
      onReorderLane(String(event.active.id), String(event.over.id));
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      setImportMessage(onImport(parsed) ? "Backup imported." : "That file is not a valid Life Lanes backup.");
    } catch {
      setImportMessage("That file could not be read.");
    }
  };

  return (
    <DialogFrame title="Customize Life Lanes" onClose={onClose} wide>
      <div className="manage-grid">
        <section className="manage-section">
          <header>
            <h3>Life Lanes</h3>
            <span>{state.lanes.length}</span>
          </header>
          <DndContext
            sensors={laneSensors}
            collisionDetection={closestCenter}
            onDragEnd={reorderLane}
          >
            <SortableContext
              items={state.lanes.map((lane) => lane.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="manage-list">
                {state.lanes.map((lane) => (
                  <SortableManageLaneRow
                    key={lane.id}
                    lane={lane}
                    onRename={onRenameLane}
                    onDelete={onDeleteLane}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <form className="manage-add-form lane-add-form" onSubmit={addLane}>
            <div className="lane-icon-picker" role="group" aria-label="Choose a Life Lane icon">
              {LANE_ICON_OPTIONS.map((option) => (
                <button
                  className={laneIcon === option.id ? "lane-icon-choice active" : "lane-icon-choice"}
                  type="button"
                  key={option.id}
                  onClick={() => setLaneIcon(option.id)}
                  aria-label={option.label}
                  aria-pressed={laneIcon === option.id}
                  title={option.label}
                >
                  <LaneIcon icon={option.id} size={17} />
                </button>
              ))}
            </div>
            <input value={laneName} onChange={(event) => setLaneName(event.target.value)} placeholder="New Life Lane" aria-label="New Life Lane" />
            <button className="icon-button accent" type="submit" aria-label="Add Life Lane"><Plus size={16} /></button>
          </form>
        </section>

        <section className="manage-section">
          <header>
            <h3>States</h3>
            <span>{activeColumns(state.columns).length}</span>
          </header>
          <div className="manage-list compact">
            {state.columns.map((column, index) => (
              <EditableNameRow
                key={column.id}
                id={column.id}
                value={isAchievementColumn(column) ? "Achievements" : column.title}
                tone={`state-${index + 1}`}
                protectedRow={isAchievementColumn(column)}
                onRename={onRenameColumn}
                onDelete={onDeleteColumn}
              />
            ))}
          </div>
          <form className="manage-add-form" onSubmit={addColumn}>
            <input value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="New state" aria-label="New state" />
            <button className="icon-button accent" type="submit" aria-label="Add state"><Plus size={16} /></button>
          </form>

          <div className="backup-section">
            <h3>{state.preset === "demo" ? "Demo" : "Backup"}</h3>
            {state.preset === "demo" ? (
              <p>Demo changes are temporary. Reset to restore the example board.</p>
            ) : (
              <>
                <p>Your board lives in this browser. Export a copy whenever it matters.</p>
                <div className="backup-actions">
                  <button className="secondary-button" type="button" onClick={onExport}>
                    <Download size={16} />
                    Export JSON
                  </button>
                  <label className="secondary-button file-button">
                    <Upload size={16} />
                    Import JSON
                    <input type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} />
                  </label>
                </div>
                {importMessage ? <p className="import-message" role="status">{importMessage}</p> : null}
              </>
            )}
            <button className="reset-button" type="button" onClick={onReset}>
              <RotateCcw size={15} />
              {state.preset === "demo" ? "Reset demo" : "Reset this board"}
            </button>
          </div>
        </section>
      </div>
    </DialogFrame>
  );
}
