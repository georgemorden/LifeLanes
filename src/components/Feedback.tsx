import { AlertTriangle, Check, ChevronLeft, ChevronRight, Download, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TOUR_STEPS } from "../tour";
import { type ToastMessage } from "../ui-types";

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastMessage;
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onClose, toast.onAction ? 10_000 : 6_000);
    return () => window.clearTimeout(timer);
  }, [onClose, paused, toast.id, toast.onAction]);

  return (
    <div
      className="toast"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <span className="toast-icon"><Check size={15} /></span>
      <p>{toast.message}</p>
      {toast.actionLabel && toast.onAction ? (
        <button type="button" onClick={toast.onAction}>{toast.actionLabel}</button>
      ) : null}
      <button className="toast-dismiss" type="button" onClick={onClose} aria-label="Dismiss message">
        <X size={15} />
      </button>
    </div>
  );
}

export function StorageNotice({
  message,
  onDownload,
  onDismiss,
}: {
  message: string;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside className="storage-notice" role="alert">
      <AlertTriangle size={17} aria-hidden="true" />
      <p>{message}</p>
      <button className="secondary-button" type="button" onClick={onDownload}>
        <Download size={15} />
        Download backup
      </button>
      <button className="icon-button" type="button" onClick={onDismiss} aria-label="Dismiss storage message">
        <X size={16} />
      </button>
    </aside>
  );
}

export function CompletionFlight() {
  return (
    <div className="completion-flight" aria-hidden="true">
      <img src="/assets/celebration-goat.png" alt="" />
    </div>
  );
}

export function TourBar({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const current = TOUR_STEPS[step];
  return (
    <aside className="tour-bar" aria-live="polite">
      <span className="tour-icon"><Sparkles size={17} /></span>
      <div className="tour-copy">
        <span>Tour {step + 1}/{TOUR_STEPS.length}</span>
        <strong>{current.title}</strong>
        <p>{current.body}</p>
      </div>
      <div className="tour-progress" aria-hidden="true">
        {TOUR_STEPS.map((_, index) => <span className={index === step ? "active" : ""} key={index} />)}
      </div>
      <div className="tour-actions">
        <button className="icon-button" type="button" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous tour step">
          <ChevronLeft size={17} />
        </button>
        {step < TOUR_STEPS.length - 1 ? (
          <button className="secondary-button" type="button" onClick={() => onStep(step + 1)}>
            Next
            <ChevronRight size={16} />
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onClose}>Done</button>
        )}
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close tour">
          <X size={17} />
        </button>
      </div>
    </aside>
  );
}
