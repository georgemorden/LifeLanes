export const KANBAN_COLUMNS = [
  { id: "doing", title: "Doing" },
  { id: "todo", title: "To Do" },
  { id: "done", title: "Done" },
  { id: "parked", title: "Parked" },
] as const;

export const LANE_COLORS = ["mint", "sky", "lavender", "peach", "gold", "leaf"] as const;

export type ColumnId = string;
export type LaneColor = (typeof LANE_COLORS)[number];
export type PresetId = "draft" | "demo" | "custom";

export interface BoardColumn {
  id: ColumnId;
  title: string;
  createdAt: string;
}

export interface LifeLane {
  id: string;
  name: string;
  color: LaneColor;
  createdAt: string;
}

export interface DraftNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardItem {
  id: string;
  title: string;
  note: string;
  column: ColumnId;
  laneId: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardState {
  preset: PresetId;
  defaultLaneVersion: number;
  columns: BoardColumn[];
  lanes: LifeLane[];
  drafts: DraftNote[];
  items: BoardItem[];
}
