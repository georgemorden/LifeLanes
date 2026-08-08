export const KANBAN_COLUMNS = [
  { id: "doing", title: "Doing" },
  { id: "todo", title: "To Do" },
  { id: "done", title: "Done" },
  { id: "parked", title: "Parked" },
] as const;

export const LANE_COLORS = ["mint", "sky", "lavender", "peach", "gold", "leaf"] as const;
export const LANE_ICONS = [
  "sparkles",
  "briefcase",
  "fitness",
  "money",
  "people",
  "health",
  "home",
  "creative",
  "learning",
  "travel",
  "adventure",
  "ideas",
  "projects",
  "music",
  "food",
  "nature",
] as const;
export const ITEM_PRIORITIES = ["low", "medium", "high"] as const;

export type ColumnId = string;
export type LaneColor = (typeof LANE_COLORS)[number];
export type LaneIconName = (typeof LANE_ICONS)[number];
export type ItemPriority = (typeof ITEM_PRIORITIES)[number];
export type PresetId = "draft" | "demo" | "custom";
export type ColumnKind = "active" | "achievement";

export interface BoardColumn {
  id: ColumnId;
  title: string;
  kind: ColumnKind;
  createdAt: string;
}

export interface LifeLane {
  id: string;
  name: string;
  color: LaneColor;
  icon: LaneIconName;
  createdAt: string;
}

export interface DraftNote {
  id: string;
  title: string;
  note: string;
  priority?: ItemPriority;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardItem {
  id: string;
  title: string;
  note: string;
  column: ColumnId;
  laneId: string;
  priority: ItemPriority;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardState {
  schemaVersion: number;
  preset: PresetId;
  defaultLaneVersion: number;
  updatedAt: string;
  columns: BoardColumn[];
  lanes: LifeLane[];
  drafts: DraftNote[];
  items: BoardItem[];
}
