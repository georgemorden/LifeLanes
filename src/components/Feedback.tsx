import { AlertTriangle, Check, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
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
      <img
        src={`${import.meta.env.BASE_URL}assets/celebration-goat.png`}
        alt=""
      />
    </div>
  );
}

export function TourBar({
  step,
  onStep,
  onClose,
  onFinish,
  onExitDemo,
}: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onFinish: () => void;
  onExitDemo: () => void;
}) {
  const current = TOUR_STEPS[step];
  return (
    <aside className={`tour-bar${current.showOnMobile ? " has-description" : ""}`} aria-live="polite">
      <div className="tour-copy">
        <span>Demo {step + 1}/{TOUR_STEPS.length}</span>
        <strong>{current.title}</strong>
        <p>{current.body}</p>
      </div>
      <div className="tour-actions">
        <button className="text-button tour-exit-button" type="button" onClick={onExitDemo}>
          Exit demo
        </button>
        <button className="icon-button" type="button" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous tour step">
          <ChevronLeft size={17} />
        </button>
        {step < TOUR_STEPS.length - 1 ? (
          <button className="text-button" type="button" onClick={() => onStep(step + 1)}>
            Next
            <ChevronRight size={16} />
          </button>
        ) : (
          <button className="text-button" type="button" onClick={onFinish}>
            Back to my board
          </button>
        )}
        <button className="icon-button" type="button" onClick={onClose} aria-label="Explore demo without tour">
          <X size={17} />
        </button>
      </div>
      {current.showOnMobile ? <p className="tour-mobile-description">{current.body}</p> : null}
    </aside>
  );
}
