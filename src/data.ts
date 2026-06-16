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
  "Create a calmer weekly reset that covers calendar, money, training, meals, and one small admin task.",
  "Review career direction and list roles that fit operations, creative work, project coordination, and digital change.",
  "Build a simple evidence bank for applications, interviews, portfolio notes, and useful examples.",
  "Plan a low-friction fitness week with enough recovery to keep momentum sustainable.",
  "Sort home admin into one visible place so nothing important lives only in memory.",
  "Capture creative ideas without turning every idea into an urgent project.",
  "Create a monthly money check that feels practical rather than restrictive.",
  "Make a shortlist of learning goals that support the next career step.",
  "Reconnect with friends in a way that feels easy, not performative.",
  "Design the app demo so it feels polished, realistic, and calm.",
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
    title: "Weekly reset",
    note: "Review the week ahead, choose three priorities, and clear any small loose ends.",
    column: "doing",
    lane: "Life Admin",
    startDate: "2026-06-16",
  },
  {
    title: "Career evidence bank",
    note: "Collect strong examples of problem solving, delivery, stakeholder work, and process improvement.",
    column: "doing",
    lane: "Career",
  },
  {
    title: "Revision sprint",
    note: "Refresh the core concepts first, then move into timed practice once the basics feel familiar again.",
    column: "doing",
    lane: "Upskilling",
    startDate: "2026-06-17",
    endDate: "2026-06-30",
  },
  {
    title: "Base fitness rhythm",
    note: "Keep the week simple with easy sessions, one focused effort, and enough recovery to stay consistent.",
    column: "doing",
    lane: "Fitness",
  },
  {
    title: "Portfolio polish",
    note: "Tidy the best examples into a clean format that shows taste, structure, and follow-through.",
    column: "doing",
    lane: "Creative",
  },
  {
    title: "Calmer mornings",
    note: "Create a short start-of-day routine that makes energy feel steadier before work begins.",
    column: "todo",
    lane: "Lifestyle",
  },
  {
    title: "Money check-in",
    note: "Review spending, savings, subscriptions, and upcoming costs without turning it into a big event.",
    column: "todo",
    lane: "Finance",
    startDate: "2026-06-28",
  },
  {
    title: "Inbox tidy",
    note: "Clear the obvious noise, flag anything that needs action, and archive the rest.",
    column: "todo",
    lane: "Life Admin",
  },
  {
    title: "Home admin list",
    note: "Write down the boring but useful tasks that make the home feel easier to maintain.",
    column: "todo",
    lane: "Home",
  },
  {
    title: "Friend catch-up",
    note: "Send one easy message to reconnect without overthinking the perfect wording.",
    column: "todo",
    lane: "Social",
  },
  {
    title: "Shared plans chat",
    note: "Agree the next few practical steps together so future decisions feel less vague.",
    column: "todo",
    lane: "Relationships",
  },
  {
    title: "Weekend mini-adventure",
    note: "Choose something local, low-cost, and refreshing that still feels like a change of scene.",
    column: "todo",
    lane: "Adventure",
    startDate: "2026-06-22",
  },
  {
    title: "Travel shortlist",
    note: "Save a few realistic trip ideas with rough timing, budget, and why each one appeals.",
    column: "todo",
    lane: "Travel",
  },
  {
    title: "Meal staples",
    note: "Create a small list of reliable meals that are quick, filling, and easy to repeat.",
    column: "todo",
    lane: "Health",
  },
  {
    title: "Learning map",
    note: "Group possible courses and certificates into useful, optional, and later categories.",
    column: "todo",
    lane: "Upskilling",
  },
  {
    title: "Creative backlog sort",
    note: "Separate ideas worth building soon from ideas that simply need a safe place to live.",
    column: "todo",
    lane: "Ideas",
  },
  {
    title: "Admin documents folder",
    note: "Put important files into a simple structure so they are easy to find when needed.",
    column: "done",
    lane: "Life Admin",
    endDate: "2026-06-10",
  },
  {
    title: "Simple budget view",
    note: "Set up a lightweight view of regular income, bills, flexible spending, and savings.",
    column: "done",
    lane: "Finance",
    endDate: "2026-06-12",
  },
  {
    title: "Training plan outline",
    note: "Choose a realistic weekly structure that supports progress without crowding out everything else.",
    column: "done",
    lane: "Fitness",
    endDate: "2026-06-14",
  },
  {
    title: "Application tracker",
    note: "Create one place to track opportunities, deadlines, status, and useful follow-up notes.",
    column: "done",
    lane: "Career",
    endDate: "2026-06-09",
  },
  {
    title: "App concept board",
    note: "Capture the product idea, core lanes, columns, and the kind of tone the app should have.",
    column: "done",
    lane: "Creative",
    endDate: "2026-06-15",
  },
  {
    title: "Reading queue",
    note: "Pick a few books and resources that support energy, craft, career, and better systems.",
    column: "parked",
    lane: "Lifestyle",
  },
  {
    title: "Big product idea",
    note: "Keep the idea visible, but do not let it compete with the current focus until there is space.",
    column: "parked",
    lane: "Ideas",
  },
  {
    title: "Long trip plan",
    note: "Save inspiration and practical notes now, then revisit when timing and budget are clearer.",
    column: "parked",
    lane: "Travel",
  },
  {
    title: "Home refresh",
    note: "List small upgrades that would improve the space, then choose only one when energy allows.",
    column: "parked",
    lane: "Home",
  },
  {
    title: "Group gathering",
    note: "Keep the idea warm until there is a clear weekend and a simple plan.",
    column: "parked",
    lane: "Social",
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
