import {
  LayoutGrid,
  NotebookPen,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { type BoardPreset } from "../hooks/useLifeLanesState";
import { type ViewId } from "../ui-types";

type AppHeaderProps = {
  activeView: ViewId;
  preset: BoardPreset;
  logoQuarterTurns: number;
  onChangeView: (
    view: ViewId,
    source?: "pointer" | "keyboard",
    quarterTurns?: number,
  ) => void;
  onEnterView: (view: ViewId) => void;
};

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "board", label: "My Life Lanes", icon: LayoutGrid },
  { id: "capture", label: "Brain Dump", icon: NotebookPen },
  { id: "achievements", label: "Achievements", icon: Trophy },
];

export function AppHeader({
  activeView,
  preset,
  logoQuarterTurns,
  onChangeView,
  onEnterView,
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
    let movement = 0;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length;
      movement =
        nextIndex < currentIndex ? -1 : -(NAV_ITEMS.length - 1);
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % NAV_ITEMS.length;
      movement = nextIndex > currentIndex ? 1 : NAV_ITEMS.length - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
      movement = -currentIndex;
    } else if (event.key === "End") {
      nextIndex = NAV_ITEMS.length - 1;
      movement = nextIndex - currentIndex;
    } else {
      return;
    }

    event.preventDefault();
    const nextView = NAV_ITEMS[nextIndex].id;
    onChangeView(nextView, "keyboard", movement);
    window.requestAnimationFrame(() => {
      buttonRefs.current[nextView]?.focus({ preventScroll: true });
    });
  };

  return (
    <header className="app-header">
      <div className="brand">
        <span
          className="brand-mark"
          data-turns={logoQuarterTurns}
          style={{ "--brand-turn": `${logoQuarterTurns * 90}deg` } as CSSProperties}
          aria-hidden="true"
        >
          <span className="brand-lanes">
            <span className="brand-lane mint" />
            <span className="brand-lane blue" />
            <span className="brand-lane violet" />
          </span>
        </span>
        <h1>Life Lanes</h1>
      </div>

      <nav
        className="primary-nav"
        aria-label="Workspace"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowDown Home End"
      >
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const label = item.label;
          return (
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
              aria-label={`Open ${label}`}
            >
              <Icon className="nav-icon" size={18} aria-hidden="true" />
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </nav>

    </header>
  );
}
