import { Play, Send } from "lucide-react";
import { type BoardPreset } from "../hooks/useLifeLanesState";
import { type ViewId } from "../ui-types";

type AppHeaderProps = {
  activeView: ViewId;
  preset: BoardPreset;
  onChangeView: (view: ViewId) => void;
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
  onChangePreset,
  onStartTour,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <img src="/icon.svg" alt="" width="40" height="40" />
        <h1>Life Lanes</h1>
      </div>

      <nav className="primary-nav" aria-label="Workspace">
        {NAV_ITEMS.map((item) => (
          <button
            className={activeView === item.id ? "nav-button active" : "nav-button"}
            type="button"
            key={item.id}
            onClick={() => onChangeView(item.id)}
            aria-current={activeView === item.id ? "page" : undefined}
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

        <button
          className="capture-nav-button"
          type="button"
          onClick={() => onChangeView("capture")}
          aria-label="Open Brain Dump"
        >
          <Send size={17} />
          <span>Capture</span>
        </button>
      </div>
    </header>
  );
}
