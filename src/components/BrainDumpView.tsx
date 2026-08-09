import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, Check, GripVertical, NotebookPen, Plus, Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
} from "react";
import { type DraftNote } from "../types";

type BrainDumpViewProps = {
  drafts: DraftNote[];
  onCapture: (note: Pick<DraftNote, "title" | "note">) => void;
  onReturnToNavigation: () => void;
  onEdit: (draft: DraftNote) => void;
  onReorder: (draftId: string, targetDraftId: string) => void;
  onSort: (draft: DraftNote) => void;
  onDelete: (draft: DraftNote) => void;
};

type BrainNoteCardProps = {
  draft: DraftNote;
  dragging?: boolean;
  overlay?: boolean;
  style?: CSSProperties;
  nodeRef?: (node: HTMLElement | null) => void;
  dragHandleRef?: (node: HTMLButtonElement | null) => void;
  dragAttributes?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragListeners?: ButtonHTMLAttributes<HTMLButtonElement>;
  onEdit?: () => void;
  onSort?: () => void;
  onDelete?: () => void;
  onKeyboardMove?: (direction: "previous" | "next") => void;
};

function BrainNoteCard({
  draft,
  dragging = false,
  overlay = false,
  style,
  nodeRef,
  dragHandleRef,
  dragAttributes,
  dragListeners,
  onEdit,
  onSort,
  onDelete,
  onKeyboardMove,
}: BrainNoteCardProps) {
  return (
    <article
      ref={nodeRef}
      className={`brain-note-card${dragging ? " is-dragging" : ""}${overlay ? " drag-overlay" : ""}`}
      style={style}
      data-draft-id={draft.id}
    >
      <button
        className="brain-note-copy brain-note-open"
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${draft.title}`}
        tabIndex={overlay ? -1 : 0}
      >
        <h2>{draft.title}</h2>
        {draft.note ? <p>{draft.note}</p> : null}
      </button>

      {!overlay ? (
        <footer className="brain-note-actions">
          <button
            className="brain-note-organise"
            type="button"
            onClick={onSort}
            aria-label={`Organise ${draft.title}`}
          >
            <ArrowUpRight size={15} />
            Organise
          </button>
          <span className="brain-note-secondary-actions">
            <button
              ref={dragHandleRef}
              className="brain-note-drag-handle"
              type="button"
              aria-label={`Reorder ${draft.title}`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
              title="Use arrow keys to reorder"
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  onKeyboardMove?.("previous");
                } else if (
                  event.key === "ArrowDown" ||
                  event.key === "ArrowRight"
                ) {
                  event.preventDefault();
                  onKeyboardMove?.("next");
                }
              }}
              {...dragAttributes}
              {...dragListeners}
            >
              <GripVertical size={16} />
            </button>
            <button
              className="icon-button danger"
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${draft.title}`}
            >
              <Trash2 size={16} />
            </button>
          </span>
        </footer>
      ) : null}
    </article>
  );
}

function SortableBrainNoteCard({
  draft,
  onEdit,
  onSort,
  onDelete,
  onKeyboardMove,
}: {
  draft: DraftNote;
  onEdit: () => void;
  onSort: () => void;
  onDelete: () => void;
  onKeyboardMove: (direction: "previous" | "next") => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: draft.id,
    data: { type: "draft", draftId: draft.id },
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <BrainNoteCard
      draft={draft}
      dragging={isDragging}
      style={style}
      nodeRef={setNodeRef}
      dragHandleRef={setActivatorNodeRef}
      dragAttributes={attributes as ButtonHTMLAttributes<HTMLButtonElement>}
      dragListeners={listeners as ButtonHTMLAttributes<HTMLButtonElement>}
      onEdit={onEdit}
      onSort={onSort}
      onDelete={onDelete}
      onKeyboardMove={onKeyboardMove}
    />
  );
}

export function BrainDumpView({
  drafts,
  onCapture,
  onReturnToNavigation,
  onEdit,
  onReorder,
  onSort,
  onDelete,
}: BrainDumpViewProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [draggedDraft, setDraggedDraft] = useState<DraftNote | null>(null);
  const hasContent = Boolean(title.trim() || note.trim());
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!active) return;

    const closeComposerOnOutsidePress = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        formRef.current?.contains(event.target)
      ) {
        return;
      }

      titleRef.current?.blur();
      noteRef.current?.blur();
      if (!hasContent && !saving) {
        setExpanded(false);
        setActive(false);
      }
    };

    document.addEventListener("pointerdown", closeComposerOnOutsidePress, true);
    return () =>
      document.removeEventListener("pointerdown", closeComposerOnOutsidePress, true);
  }, [active, hasContent, saving]);

  const openNoteBody = () => {
    setActive(true);
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    setExpanded(true);
    window.requestAnimationFrame(() => noteRef.current?.focus());
  };

  const capture = (returnToNavigation = false) => {
    if (saving) return;
    if (!title.trim()) {
      setActive(true);
      titleRef.current?.focus();
      return;
    }

    onCapture({ title: title.trim(), note: note.trim() });
    setSaving(true);
    setTitle("");
    setNote("");
    noteRef.current?.blur();
    saveTimerRef.current = window.setTimeout(() => {
      setSaving(false);
      setExpanded(false);
      setActive(false);
      titleRef.current?.blur();
      if (returnToNavigation) {
        onReturnToNavigation();
      }
      saveTimerRef.current = null;
    }, 260);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    capture();
  };

  const collapseEmptyComposer = (event: FocusEvent<HTMLFormElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    if (!hasContent && !saving) {
      setExpanded(false);
      setActive(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedDraft(
      drafts.find((draft) => draft.id === String(event.active.id)) ?? null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedDraft(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    onReorder(activeId, overId);
  };

  const moveDraftWithKeyboard = (
    draft: DraftNote,
    direction: "previous" | "next",
  ) => {
    const currentIndex = drafts.findIndex((candidate) => candidate.id === draft.id);
    const targetIndex = currentIndex + (direction === "next" ? 1 : -1);
    const targetDraft = drafts[targetIndex];
    if (currentIndex < 0 || !targetDraft) return;

    onReorder(draft.id, targetDraft.id);
    setReorderAnnouncement(
      `${draft.title} moved to position ${targetIndex + 1} of ${drafts.length}`,
    );
  };

  return (
    <main
      id="workspace-capture"
      className="capture-view capture-notes-view"
      data-workspace-panel="capture"
      aria-label="Brain Dump"
      tabIndex={-1}
    >
      <section className="brain-dump-composer">
        <form
          ref={formRef}
          className={`brain-dump-form${active ? " is-active" : ""}${expanded ? " is-expanded" : ""}${hasContent ? " has-content" : ""}${saving ? " is-saving" : ""}`}
          onSubmit={submit}
          onBlur={collapseEmptyComposer}
        >
          <button
            className="mobile-add-note-button"
            type="button"
            data-workspace-entry
            onClick={() => {
              setActive(true);
              window.requestAnimationFrame(() => titleRef.current?.focus());
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp") return;
              event.preventDefault();
              onReturnToNavigation();
            }}
          >
            <Plus size={17} />
            Add note
          </button>
          <input
            ref={titleRef}
            className="brain-note-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onFocus={() => setActive(true)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                openNoteBody();
              }
            }}
            aria-label="Note title"
            aria-expanded={expanded}
            data-workspace-entry
            placeholder={active ? "Title" : "Take a note..."}
            readOnly={saving}
            maxLength={240}
          />
          <div className="brain-note-body-field" aria-hidden={!expanded}>
            <textarea
              ref={noteRef}
              className="brain-note-body-input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  capture(true);
                }
              }}
              aria-label="Note content"
              placeholder="Note"
              rows={3}
              tabIndex={expanded ? 0 : -1}
              readOnly={saving}
              maxLength={20_000}
            />
          </div>
          <div className="composer-footer">
            <button
              className={`capture-submit-button${saving ? " is-saving" : ""}`}
              type="submit"
              aria-label="Save note"
              title="Save note"
              aria-busy={saving}
              disabled={!title.trim() && !saving}
            >
              <Check size={17} />
            </button>
          </div>
        </form>
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: {
            draggable: "Use the arrow keys to move this note earlier or later.",
          },
        }}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggedDraft(null)}
        onDragEnd={handleDragEnd}
      >
        <section className="brain-notes-section" aria-label="Saved notes" aria-live="polite">
          <span className="sr-only" role="status">
            {reorderAnnouncement}
          </span>
          {drafts.length ? (
            <SortableContext
              items={drafts.map((draft) => draft.id)}
              strategy={rectSortingStrategy}
            >
              <div className="brain-note-grid">
                {drafts.map((draft) => (
                  <SortableBrainNoteCard
                    key={draft.id}
                    draft={draft}
                    onEdit={() => onEdit(draft)}
                    onSort={() => onSort(draft)}
                    onDelete={() => onDelete(draft)}
                    onKeyboardMove={(direction) =>
                      moveDraftWithKeyboard(draft, direction)
                    }
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="brain-notes-empty">
              <NotebookPen size={26} aria-hidden="true" />
              <span>Your captured notes appear here</span>
            </div>
          )}
        </section>

        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {draggedDraft ? <BrainNoteCard draft={draggedDraft} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
