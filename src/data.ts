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

export const DEFAULT_LANE_VERSION = 3;
export const BOARD_SCHEMA_VERSION = 2;

export const DEFAULT_LANES = [
  "Lifestyle",
  "Career",
  "Fitness",
  "Finance",
  "Upskilling",
  "Social",
  "Adventure",
  "Health",
  "Creative",
  "Home",
  "Life Admin",
  "Relationships",
  "Travel",
  "Ideas",
];

const DEMO_DRAFTS = [
  "Book the car service before the August road trip.",
  "Compare two project management certification routes.",
  "Plan one easy family lunch for next month.",
  "Save a coastal half-marathon idea for later.",
];

const DEMO_ITEMS: Array<{
  title: string;
  note: string;
  column: ColumnId;
  lane: string;
  priority?: ItemPriority;
  startDate?: string;
  endDate?: string;
}> = [
  {
    title: "Project management certification",
    note: "Finish the final learning module, then book the assessment while the material is still fresh.",
    column: "doing",
    lane: "Career",
    priority: "high",
    startDate: "2026-07-28",
    endDate: "2026-09-30",
  },
  {
    title: "Three-run training week",
    note: "One easy run, one steady session, and one longer run with enough recovery between them.",
    column: "doing",
    lane: "Fitness",
    startDate: "2026-07-27",
    endDate: "2026-08-02",
  },
  {
    title: "Holiday fund",
    note: "Move a manageable amount across each payday and keep the target visible without obsessing over it.",
    column: "doing",
    lane: "Finance",
    priority: "high",
    startDate: "2026-07-01",
    endDate: "2026-12-31",
  },
  {
    title: "Family Sunday lunch",
    note: "Pick a date that works, keep the plan simple, and send the message before the week gets busy.",
    column: "doing",
    lane: "Relationships",
  },
  {
    title: "Update LinkedIn headline",
    note: "Make the positioning clearer and align it with the roles that are the strongest fit.",
    column: "todo",
    lane: "Career",
  },
  {
    title: "Add two strength sessions",
    note: "Keep both sessions short enough to support running rather than compete with it.",
    column: "todo",
    lane: "Fitness",
  },
  {
    title: "Review monthly budget",
    note: "Check regular costs, flexible spending, and the next savings milestone in one calm pass.",
    column: "todo",
    lane: "Finance",
  },
  {
    title: "Car service",
    note: "Compare two local garages and book a morning appointment before the road trip.",
    column: "doing",
    lane: "Life Admin",
    endDate: "2026-08-05",
  },
  {
    title: "Portfolio case study",
    note: "Turn one strong project into a concise story about the problem, decisions, and outcome.",
    column: "doing",
    lane: "Creative",
  },
  {
    title: "Map a hiking weekend",
    note: "Choose a route, check transport, and keep the plan flexible enough to enjoy.",
    column: "doing",
    lane: "Adventure",
  },
  {
    title: "Call Mum",
    note: "Find a quiet half hour this week rather than leaving it to a rushed moment.",
    column: "todo",
    lane: "Relationships",
    priority: "high",
  },
  {
    title: "Renew passport",
    note: "Check the photo requirements and submit the renewal before travel plans become urgent.",
    column: "todo",
    lane: "Life Admin",
    priority: "high",
    endDate: "2026-09-15",
  },
  {
    title: "Sketch ten ideas",
    note: "Make a fast first pass without judging which ideas deserve more time.",
    column: "todo",
    lane: "Creative",
  },
  {
    title: "Enter a local 10K",
    note: "Pick an autumn event that fits the current training rhythm.",
    column: "todo",
    lane: "Adventure",
  },
  {
    title: "Attend an industry conference",
    note: "Worth revisiting when the next role and learning priorities are clearer.",
    column: "parked",
    lane: "Career",
    priority: "low",
  },
  {
    title: "Try a new sport",
    note: "Keep the idea without adding another commitment to the current training block.",
    column: "parked",
    lane: "Fitness",
    priority: "low",
  },
  {
    title: "Marathon idea",
    note: "Save a possible autumn race and revisit after the current routine feels established.",
    column: "parked",
    lane: "Adventure",
    priority: "low",
  },
  {
    title: "Start a small side project",
    note: "Hold the concept here until the portfolio work is finished.",
    column: "parked",
    lane: "Creative",
    priority: "low",
  },
  {
    title: "Application story bank",
    note: "Collected six useful examples covering delivery, problem solving, and stakeholder work.",
    column: "done",
    lane: "Career",
    endDate: "2026-07-18",
  },
  {
    title: "Emergency details folder",
    note: "Put the key household documents and useful contact details in one reliable place.",
    column: "done",
    lane: "Life Admin",
    endDate: "2026-07-12",
  },
];

const DEMO_ITEM_TITLES = new Set(DEMO_ITEMS.map((item) => item.title));
const DEMO_DRAFT_TEXT = new Set(DEMO_DRAFTS);
const LEGACY_DEMO_ITEM_TITLES = new Set([
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
      drafts: DEMO_DRAFTS.map((text, index) => ({
        id: createId(`draft-${index}`),
        text,
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
        startDate: item.startDate,
        endDate: item.endDate,
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
  const demoDraftHits = state.drafts.filter((draft) => DEMO_DRAFT_TEXT.has(draft.text)).length;
  return demoItemHits >= 4 || demoDraftHits >= 3;
}
