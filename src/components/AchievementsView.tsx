import { RotateCcw, Trash2, Trophy } from "lucide-react";
import { useMemo } from "react";
import { dateRangeLabel } from "../board-utils";
import { type BoardItem, type LifeLane } from "../types";
import { LaneIcon } from "./LaneIcon";

type AchievementsViewProps = {
  items: BoardItem[];
  lanes: LifeLane[];
  onOpenItem: (item: BoardItem) => void;
  onRestoreItem: (item: BoardItem) => void;
  onDeleteItem: (item: BoardItem) => void;
};

export function AchievementsView({
  items,
  lanes,
  onOpenItem,
  onRestoreItem,
  onDeleteItem,
}: AchievementsViewProps) {
  const grouped = useMemo(
    () =>
      lanes
        .map((lane) => ({
          lane,
          items: items.filter((item) => item.laneId === lane.id),
        }))
        .filter((group) => group.items.length),
    [items, lanes],
  );
  return (
    <main
      id="workspace-achievements"
      className="achievements-view"
      data-workspace-panel="achievements"
      aria-label="Achievements"
      tabIndex={-1}
    >
      {grouped.length ? (
        <div className="achievement-groups">
          {grouped.map(({ lane, items: laneItems }) => (
            <section className={`achievement-group ${lane.color}`} key={lane.id}>
              <header>
                <span className="lane-icon">
                  <LaneIcon name={lane.name} icon={lane.icon} />
                </span>
                <h3>{lane.name}</h3>
                <span>{laneItems.length}</span>
              </header>
              <div className="achievement-list">
                {laneItems.map((item) => (
                  <article className="achievement-row" key={item.id}>
                    <button
                      className="achievement-open"
                      type="button"
                      data-workspace-entry
                      onClick={() => onOpenItem(item)}
                      aria-label={`Open ${item.title}`}
                    >
                      <strong>{item.title}</strong>
                      {dateRangeLabel(item) ? <span>{dateRangeLabel(item)}</span> : null}
                      {item.note ? <p>{item.note}</p> : null}
                    </button>
                    <div>
                      <button className="icon-button" type="button" onClick={() => onRestoreItem(item)} aria-label={`Restore ${item.title}`}>
                        <RotateCcw size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => onDeleteItem(item)}
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="achievements-empty">
          <Trophy size={26} />
          <h3>Your completed achievements appear here</h3>
        </div>
      )}
    </main>
  );
}
