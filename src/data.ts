import {
  KANBAN_COLUMNS,
  LANE_COLORS,
  type BoardColumn,
  type BoardItem,
  type BoardState,
  type ColumnId,
  type DraftNote,
  type LaneColor,
  type LifeLane,
  type PresetId,
} from "./types";

export const DEFAULT_LANE_VERSION = 2;

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
  "Possible weekend reset idea\nKeep it light: tidy, walk, one creative thing.",
  "Look into a practical finance habit",
  "Save notes for a stronger portfolio story",
];

const DEMO_ITEMS: Array<{
  title: string;
  note: string;
  column: ColumnId;
  lane: string;
  startDate?: string;
  endDate?: string;
}> = [
  {
    title: "Refresh portfolio positioning",
    note: "Tighten the headline and make recent work easier to scan.",
    column: "todo",
    lane: "Career",
    startDate: "2026-06-17",
    endDate: "2026-06-28",
  },
  {
    title: "Training rhythm",
    note: "Three steady sessions before adding intensity.",
    column: "todo",
    lane: "Fitness",
    startDate: "2026-06-16",
    endDate: "2026-07-07",
  },
  {
    title: "Budget review",
    note: "Check recurring spend and keep what still earns its place.",
    column: "doing",
    lane: "Finance",
    endDate: "2026-06-21",
  },
  {
    title: "Low-pressure weekend plan",
    note: "Something social that does not need much coordination.",
    column: "doing",
    lane: "Lifestyle",
  },
  {
    title: "Recovery habit tested",
    note: "Works best immediately after training.",
    column: "done",
    lane: "Fitness",
  },
  {
    title: "Long-term course idea",
    note: "Interesting, but not a commitment yet.",
    column: "parked",
    lane: "Career",
  },
];

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
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

export function createLifeLane(name: string, index = 0): LifeLane {
  return {
    id: createId("lane"),
    name,
    color: LANE_COLORS[index % LANE_COLORS.length],
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
    createdAt: nowStamp(),
  };
}

export function createDefaultColumns(): BoardColumn[] {
  const stamp = nowStamp();
  return KANBAN_COLUMNS.map((column) => ({
    id: column.id,
    title: column.title,
    createdAt: stamp,
  }));
}

function createDraft(text: string): DraftNote {
  const stamp = nowStamp();
  return {
    id: createId("draft"),
    text,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function createItem(input: (typeof DEMO_ITEMS)[number], lanes: LifeLane[]): BoardItem {
  const stamp = nowStamp();
  const lane = lanes.find((candidate) => candidate.name === input.lane) ?? lanes[0];
  return {
    id: createId("item"),
    title: input.title,
    note: input.note,
    column: input.column,
    laneId: lane.id,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createBoardState(preset: PresetId = "draft"): BoardState {
  const columns = createDefaultColumns();
  const lanes = createDefaultLanes();
  return {
    preset,
    defaultLaneVersion: DEFAULT_LANE_VERSION,
    columns,
    lanes,
    drafts: preset === "demo" ? DEMO_DRAFTS.map(createDraft) : [],
    items: preset === "demo" ? DEMO_ITEMS.map((item) => createItem(item, lanes)) : [],
  };
}
