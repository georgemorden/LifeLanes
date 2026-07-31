import { Play } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
  const navRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef<Record<ViewId, HTMLButtonElement | null>>({
    board: null,
    capture: null,
    achievements: null,
  });
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const nav = navRef.current;
    const activeButton = buttonRefs.current[activeView];
    if (!nav || !activeButton) return;

    const measure = () => {
      setIndicator({
        left: activeButton.offsetLeft + 14,
        width: Math.max(0, activeButton.offsetWidth - 28),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeView]);

  const indicatorStyle = {
    "--indicator-x": `${indicator.left}px`,
    "--indicator-width": `${indicator.width}px`,
  } as CSSProperties;

  return (
    <header className="app-header">
      <div className="brand">
        <img src="/icon.svg" alt="" width="40" height="40" />
        <h1>Life Lanes</h1>
      </div>

      <nav ref={navRef} className="primary-nav" aria-label="Workspace">
        {NAV_ITEMS.map((item) => (
          <button
            ref={(node) => {
              buttonRefs.current[item.id] = node;
            }}
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
        <span
          className={indicator.width ? "nav-active-indicator ready" : "nav-active-indicator"}
          style={indicatorStyle}
          aria-hidden="true"
        />
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
