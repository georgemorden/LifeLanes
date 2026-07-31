import { Play } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { type BoardPreset } from "../hooks/useLifeLanesState";
import { type ViewId } from "../ui-types";

type AppHeaderProps = {
  activeView: ViewId;
  preset: BoardPreset;
  onChangeView: (view: ViewId, source?: "pointer" | "keyboard") => void;
  onEnterView: (view: ViewId) => void;
  onChangePreset: (preset: BoardPreset) => void;
  onStartTour: () => void;
};

const NAV_ITEMS: Array<{ id: ViewId; label: string }> = [
  { id: "board", label: "My Life Lanes" },
  { id: "capture", label: "Brain Dump" },
  { id: "achievements", label: "Achievements" },
];

export function AppHeader({
  activeView,
  preset,
  onChangeView,
  onEnterView,
  onChangePreset,
  onStartTour,
}: AppHeaderProps) {
  const buttonRefs = useRef<Record<ViewId, HTMLButtonElement | null>>({
    board: null,
    capture: null,
    achievements: null,
  });

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      buttonRefs.current[activeView]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleNavigationKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onEnterView(NAV_ITEMS[currentIndex].id);
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % NAV_ITEMS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = NAV_ITEMS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextView = NAV_ITEMS[nextIndex].id;
    onChangeView(nextView, "keyboard");
    window.requestAnimationFrame(() => {
      buttonRefs.current[nextView]?.focus({ preventScroll: true });
    });
  };

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" data-view={activeView} aria-hidden="true">
          <img src="/icon.svg" alt="" width="40" height="40" />
        </span>
        <h1>Life Lanes</h1>
      </div>

      <nav
        className="primary-nav"
        aria-label="Workspace"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowDown Home End"
      >
        {NAV_ITEMS.map((item, index) => (
          <button
            ref={(node) => {
              buttonRefs.current[item.id] = node;
            }}
            className={activeView === item.id ? "nav-button active" : "nav-button"}
            type="button"
            key={item.id}
            id={`workspace-nav-${item.id}`}
            tabIndex={activeView === item.id ? 0 : -1}
            onClick={(event) => {
              onChangeView(item.id, "pointer");
              event.currentTarget.focus({ preventScroll: true });
            }}
            onKeyDown={(event) => handleNavigationKey(event, index)}
            aria-current={activeView === item.id ? "page" : undefined}
            aria-controls={`workspace-${item.id}`}
            aria-label={`Open ${item.label}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-actions">
        {preset === "demo" ? (
          <button
            className="quiet-button tour-button"
            type="button"
            onClick={onStartTour}
            aria-label="Start demo tour"
          >
            <Play size={15} fill="currentColor" />
            <span>Tour</span>
          </button>
        ) : null}

        <label className="board-picker">
          <span className="sr-only">Choose board</span>
          <select
            value={preset}
            onChange={(event) => onChangePreset(event.target.value as BoardPreset)}
            aria-label="Choose board"
          >
            <option value="draft">My Life Lanes</option>
            <option value="demo">Demo</option>
          </select>
        </label>
      </div>
    </header>
  );
}
