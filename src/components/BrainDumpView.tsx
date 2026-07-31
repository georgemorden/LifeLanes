import { ArrowRight, Inbox, Layers3, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { type DraftNote } from "../types";

type BrainDumpViewProps = {
  drafts: DraftNote[];
  focusComposer: boolean;
  onCapture: (text: string) => void;
  onSort: (draft: DraftNote) => void;
  onDelete: (draft: DraftNote) => void;
  onManageLanes: () => void;
};

const BRAIN_DUMP_STARTERS = [
  {
    label: "Untangle a problem",
    text: "What's the problem?\n\nWhat have I tried?\n\nWhat would make this feel lighter?",
  },
  {
    label: "Choose a next step",
    text: "What needs to move?\n\nWhat is the smallest useful next step?",
  },
  {
    label: "Hold an idea",
    text: "What's the idea?\n\nWhy is it worth keeping?\n\nWhat could I explore next?",
  },
] as const;

export function BrainDumpView({
  drafts,
  focusComposer,
  onCapture,
  onSort,
  onDelete,
  onManageLanes,
}: BrainDumpViewProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusComposer) {
      textareaRef.current?.focus();
    }
  }, [focusComposer]);

  const capture = () => {
    if (!text.trim()) {
      textareaRef.current?.focus();
      return;
    }
    onCapture(text.trim());
    setText("");
    textareaRef.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    capture();
  };

  const applyStarter = (starter: string) => {
    setText((current) =>
      current.trim() ? `${current.trimEnd()}\n\n${starter}` : starter,
    );
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <main
      id="workspace-capture"
      className="capture-view"
      data-workspace-panel="capture"
      tabIndex={-1}
    >
      <section className="capture-composer-section">
        <div className="section-heading">
          <div>
            <h2>Brain Dump</h2>
          </div>
          <Inbox size={21} aria-hidden="true" />
        </div>

        <div className="brain-dump-starters" aria-label="Brain Dump starters">
          <span>Start with</span>
          <div>
            {BRAIN_DUMP_STARTERS.map((starter) => (
              <button
                className="starter-button"
                type="button"
                key={starter.label}
                onClick={() => applyStarter(starter.text)}
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>

        <form className="brain-dump-form" onSubmit={submit}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                capture();
              }
            }}
            aria-label="Brain Dump note"
            data-workspace-entry
            placeholder="What is taking up space in your head?"
            rows={8}
          />
          <div className="composer-footer">
            <span>Decide where it belongs later.</span>
            <button className="primary-button" type="submit">
              <Send size={16} />
              Capture
            </button>
          </div>
        </form>

        <button className="inline-link-button" type="button" onClick={onManageLanes}>
          <Plus size={15} />
          Manage Life Lanes
        </button>
      </section>

      <section className="triage-section">
        <div className="section-heading">
          <div>
            <h2>Triage</h2>
          </div>
          <span className="section-count">{drafts.length}</span>
        </div>

        {drafts.length ? (
          <div className="draft-list">
            {drafts.map((draft) => (
              <article className="draft-row" key={draft.id}>
                <p>{draft.text}</p>
                <div className="draft-actions">
                  <button className="sort-button" type="button" onClick={() => onSort(draft)}>
                    Sort
                    <ArrowRight size={15} />
                  </button>
                  <button className="icon-button danger" type="button" onClick={() => onDelete(draft)} aria-label={`Delete ${draft.text}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="quiet-empty-state">
            <Layers3 size={22} />
            <h3>Nothing waiting</h3>
            <p>Loose thoughts will wait here until you are ready to place them.</p>
          </div>
        )}
      </section>
    </main>
  );
}
