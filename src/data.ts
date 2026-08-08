import { inferLaneIcon } from "./lane-icons";
import {
  KANBAN_COLUMNS,
  LANE_COLORS,
  type BoardColumn,
  type BoardState,
  type ColumnId,
  type ItemPriority,
  type LaneColor,
  type LaneIconName,
  type LifeLane,
  type PresetId,
} from "./types";

export const DEFAULT_LANE_VERSION = 4;
export const BOARD_SCHEMA_VERSION = 3;

export const DEFAULT_LANES = [
  "Career",
  "Health",
  "Finances",
  "Relationships",
  "Home & Admin",
  "Learning",
  "Social",
  "Creative",
  "Travel",
  "Ideas",
  "Fitness",
  "Personal",
  "Other",
];

export const CORE_DEFAULT_LANES = DEFAULT_LANES.slice(0, 5);

const DEMO_DRAFTS = [
  {
    title: "Pottery class",
    note: "Look for an evening taster session.",
  },
  {
    title: "Lisbon weekend",
    note: "Check possible dates later.",
  },
  {
    title: "Ask about mentoring",
    note: "Mention it in the next one-to-one.",
  },
];

const DEMO_ITEMS: Array<{
  title: string;
  note: string;
  column: ColumnId;
  lane: string;
  priority?: ItemPriority;
  startOffsetDays?: number;
  endOffsetDays?: number;
}> = [
  {
    title: "Finish portfolio case study",
    note: "Complete the final draft and add the results.",
    column: "doing",
    lane: "Career",
    priority: "high",
    startOffsetDays: -7,
    endOffsetDays: 56,
  },
  {
    title: "Three workouts this week",
    note: "Two strength sessions and one run.",
    column: "doing",
    lane: "Health",
    startOffsetDays: -2,
    endOffsetDays: 5,
  },
  {
    title: "Build emergency fund",
    note: "Set up a monthly transfer towards three months of expenses.",
    column: "doing",
    lane: "Finances",
    priority: "high",
    startOffsetDays: -35,
    endOffsetDays: 150,
  },
  {
    title: "Update CV",
    note: "Tailor it to the roles you want next.",
    column: "todo",
    lane: "Career",
  },
  {
    title: "Book a health check",
    note: "Choose a date and book it.",
    column: "todo",
    lane: "Health",
  },
  {
    title: "Review monthly budget",
    note: "Check bills, spending and savings.",
    column: "todo",
    lane: "Finances",
  },
  {
    title: "Attend an industry event",
    note: "Revisit when the right event comes up.",
    column: "parked",
    lane: "Career",
    priority: "low",
  },
  {
    title: "Run a half-marathon",
    note: "Revisit when the current routine feels steady.",
    column: "parked",
    lane: "Health",
    priority: "low",
  },
  {
    title: "Plan a family lunch",
    note: "Choose a Sunday and send the invite.",
    column: "todo",
    lane: "Relationships",
  },
  {
    title: "Book the car service",
    note: "Book it before the next long drive.",
    column: "todo",
    lane: "Home & Admin",
  },
  {
    title: "Updated portfolio homepage",
    note: "Published the new introduction and project links.",
    column: "done",
    lane: "Career",
    endOffsetDays: -18,
  },
  {
    title: "Created emergency details folder",
    note: "Stored key documents and contacts in one place.",
    column: "done",
    lane: "Home & Admin",
    endOffsetDays: -24,
  },
];

const DEMO_ITEM_TITLES = new Set(DEMO_ITEMS.map((item) => item.title));
const DEMO_DRAFT_TITLES = new Set(DEMO_DRAFTS.map((draft) => draft.title));
const LEGACY_DEMO_ITEM_TITLES = new Set([
  "Project management certification",
  "Three-run training week",
  "Holiday fund",
  "Update LinkedIn headline",
  "Add two strength sessions",
  "Review monthly budget",
  "Attend an industry conference",
  "Half-marathon next spring",
  "Plan a family lunch",
  "Book the car service",
  "Application story bank",
  "Emergency details folder",
  "Explore stronger-fit roles",
  "Refresh portfolio positioning",
  "Build interview story bank",
  "Research an Agile certification",
  "Compare short course options",
  "Save useful learning resources",
  "Build consistent training rhythm",
  "Future race idea",
  "Recovery habit",
  "Book check-in",
  "Protect low-energy day",
  "Mobility routine idea",
  "Emergency fund milestone",
  "Budget review",
  "Housing deposit thinking",
  "EP idea",
  "Artwork concept",
  "Title shortlist",
  "Portfolio app idea",
  "Case study polish",
  "README improvement",
  "Catch up with friend",
  "Plan low-pressure weekend thing",
  "Random thought to revisit",
  "Interesting app idea",
  "Article or video to save",
  "Course to maybe take",
  "Future project concept",
  "Long-term running goal",
  "Low-pressure weekend plan",
  "Training rhythm",
  "Recovery habit tested",
  "Long-term course idea",
]);

export function createId(prefix: string) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${randomPart}`;
}

export function nowStamp() {
  return new Date().toISOString();
}

function dateFromToday(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && value.trim().length > 0;
}

export function isLaneColor(value: unknown): value is LaneColor {
  return LANE_COLORS.includes(value as LaneColor);
}

export function createLifeLane(
  name: string,
  index = 0,
  icon: LaneIconName = inferLaneIcon(name),
): LifeLane {
  return {
    id: createId("lane"),
    name,
    color: LANE_COLORS[index % LANE_COLORS.length],
    icon,
    createdAt: nowStamp(),
  };
}

export function createDefaultLanes() {
  return DEFAULT_LANES.map((name, index) => createLifeLane(name, index));
}

export function createColumn(title: string): BoardColumn {
  return {
    id: createId("column"),
    title,
    kind: "active",
    createdAt: nowStamp(),
  };
}

export function createDefaultColumns(): BoardColumn[] {
  const stamp = nowStamp();
  return KANBAN_COLUMNS.map((column) => ({
    id: column.id,
    title: column.title,
    kind: column.id === "done" ? "achievement" : "active",
    createdAt: stamp,
  }));
}

export function createBoardState(preset: PresetId = "draft"): BoardState {
  const columns = createDefaultColumns();
  const lanes = createDefaultLanes();
  const stamp = nowStamp();

  if (preset === "demo") {
    const laneByName = new Map(lanes.map((lane) => [lane.name, lane.id]));
    return {
      schemaVersion: BOARD_SCHEMA_VERSION,
      preset,
      defaultLaneVersion: DEFAULT_LANE_VERSION,
      updatedAt: stamp,
      columns,
      lanes,
      drafts: DEMO_DRAFTS.map((draft, index) => ({
        id: createId(`draft-${index}`),
        title: draft.title,
        note: draft.note,
        createdAt: stamp,
        updatedAt: stamp,
      })),
      items: DEMO_ITEMS.map((item, index) => ({
        id: createId(`item-${index}`),
        title: item.title,
        note: item.note,
        column: item.column,
        laneId: laneByName.get(item.lane) ?? lanes[0].id,
        priority: item.priority ?? "medium",
        startDate:
          item.startOffsetDays === undefined
            ? undefined
            : dateFromToday(item.startOffsetDays),
        endDate:
          item.endOffsetDays === undefined
            ? undefined
            : dateFromToday(item.endOffsetDays),
        createdAt: stamp,
        updatedAt: stamp,
      })),
    };
  }

  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    preset,
    defaultLaneVersion: DEFAULT_LANE_VERSION,
    updatedAt: stamp,
    columns,
    lanes,
    drafts: [],
    items: [],
  };
}

export function isDemoLikeState(state: Pick<BoardState, "drafts" | "items">) {
  const demoItemHits = state.items.filter((item) => DEMO_ITEM_TITLES.has(item.title) || LEGACY_DEMO_ITEM_TITLES.has(item.title)).length;
  const demoDraftHits = state.drafts.filter((draft) => DEMO_DRAFT_TITLES.has(draft.title)).length;
  return demoItemHits >= 4 || demoDraftHits >= 3;
}
