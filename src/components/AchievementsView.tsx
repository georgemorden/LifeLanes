import { ArrowUpRight, RotateCcw, Trophy } from "lucide-react";
import { useMemo } from "react";
import { dateRangeLabel } from "../board-utils";
import { type BoardItem, type LifeLane } from "../types";
import { LaneIcon } from "./LaneIcon";

type AchievementsViewProps = {
  items: BoardItem[];
  lanes: LifeLane[];
  onOpenItem: (item: BoardItem) => void;
  onRestoreItem: (item: BoardItem) => void;
};

export function AchievementsView({
  items,
  lanes,
  onOpenItem,
  onRestoreItem,
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
  const firstAchievementId = grouped[0]?.items[0]?.id;

  return (
    <main
      id="workspace-achievements"
      className="achievements-view"
      data-workspace-panel="achievements"
      tabIndex={-1}
    >
      <header className="achievements-heading">
        <div>
          <h2>Achievements</h2>
        </div>
        <div className="achievement-total">
          <Trophy size={18} />
          <span>{items.length}</span>
        </div>
      </header>

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
                      data-workspace-entry={item.id === firstAchievementId ? "" : undefined}
                      onClick={() => onOpenItem(item)}
                    >
                      <strong>{item.title}</strong>
                      {dateRangeLabel(item) ? <span>{dateRangeLabel(item)}</span> : null}
                      {item.note ? <p>{item.note}</p> : null}
                    </button>
                    <div>
                      <button className="icon-button" type="button" onClick={() => onOpenItem(item)} aria-label={`Open ${item.title}`}>
                        <ArrowUpRight size={16} />
                      </button>
                      <button className="icon-button" type="button" onClick={() => onRestoreItem(item)} aria-label={`Restore ${item.title}`}>
                        <RotateCcw size={16} />
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
          <h3>No achievements yet</h3>
          <p>Completed items appear here.</p>
        </div>
      )}
    </main>
  );
}
