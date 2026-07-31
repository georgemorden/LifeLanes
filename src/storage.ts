import {
  BOARD_SCHEMA_VERSION,
  DEFAULT_LANES,
  DEFAULT_LANE_VERSION,
  createBoardState,
  createDefaultColumns,
  createId,
  createLifeLane,
  isDemoLikeState,
  isLaneColor,
  nowStamp,
} from "./data";
import { inferLaneIcon, isLaneIcon } from "./lane-icons";
import {
  ITEM_PRIORITIES,
  type BoardColumn,
  type BoardItem,
  type BoardState,
  type DraftNote,
  type ItemPriority,
  type LifeLane,
  type PresetId,
} from "./types";

export const BOARD_STORAGE_KEY = "life-lanes-two-panel-v1";
export const BOARD_RECOVERY_KEY = "life-lanes-recovery-v1";
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

const MAX_COLUMNS = 24;
const MAX_LANES = 100;
const MAX_ITEMS = 5000;
const MAX_DRAFTS = 2000;
const MAX_NAME_LENGTH = 80;
const MAX_TITLE_LENGTH = 240;
const MAX_NOTE_LENGTH = 20_000;
const MAX_DRAFT_LENGTH = 20_000;
const LEGACY_ACHIEVEMENT_TITLES = new Set(["done", "completed", "achievements"]);
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export type PersistenceIssue = {
  kind: "load" | "save";
  message: string;
  recoveryData?: string;
};

export type LoadStateResult = {
  state: BoardState;
  issue: PersistenceIssue | null;
};

export type SaveStateResult =
  | { ok: true }
  | { ok: false; issue: PersistenceIssue };

export type ImportPreview = {
  state: BoardState;
  summary: {
    lanes: number;
    states: number;
    items: number;
    notes: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: unknown) {
  if (!hasText(value) || value.length > 64) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function readLocalStorage(key: string) {
  try {
    return { ok: true as const, value: localStorage.getItem(key) };
  } catch {
    return { ok: false as const, value: null };
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function uniqueId(prefix: string, value: unknown, usedIds: Set<string>) {
  let candidate = hasText(value) && SAFE_ID_PATTERN.test(value) ? value : createId(prefix);
  while (usedIds.has(candidate)) {
    candidate = createId(prefix);
  }
  usedIds.add(candidate);
  return candidate;
}

function mergeMissingDefaultLanes(lanes: LifeLane[], savedVersion: number) {
  if (savedVersion >= DEFAULT_LANE_VERSION) {
    return lanes;
  }

  const existingNames = new Set(lanes.map((lane) => lane.name.toLowerCase()));
  const missing = DEFAULT_LANES.filter((name) => !existingNames.has(name.toLowerCase()))
    .slice(0, Math.max(0, MAX_LANES - lanes.length))
    .map((name, index) => createLifeLane(name, lanes.length + index));
  return [...lanes, ...missing];
}

function normalizeColumns(value: unknown) {
  if (!Array.isArray(value)) {
    const columns = createDefaultColumns();
    return {
      columns,
      idMap: new Map(columns.map((column) => [column.id, column.id])),
    };
  }

  const candidates = value.slice(0, MAX_COLUMNS).filter(isRecord);
  const hasExplicitKinds = candidates.some(
    (column) => column.kind === "active" || column.kind === "achievement",
  );
  const explicitAchievementIndex = candidates.findIndex(
    (column) => column.kind === "achievement",
  );
  const legacyAchievementIndex = hasExplicitKinds
    ? -1
    : candidates.findIndex(
        (column) =>
          column.id === "done" ||
          (hasText(column.title) &&
            LEGACY_ACHIEVEMENT_TITLES.has(column.title.trim().toLowerCase())),
      );
  const achievementIndex =
    explicitAchievementIndex >= 0
      ? explicitAchievementIndex
      : legacyAchievementIndex;
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const columns: BoardColumn[] = [];

  candidates.forEach((column, index) => {
    const title = cleanText(column.title, MAX_NAME_LENGTH);
    if (!title) return;
    const id = uniqueId("column", column.id, usedIds);
    if (hasText(column.id) && !idMap.has(column.id)) {
      idMap.set(column.id, id);
    }
    columns.push({
      id,
      title,
      kind: index === achievementIndex ? "achievement" : "active",
      createdAt: validTimestamp(column.createdAt) ?? nowStamp(),
    });
  });

  if (!columns.some((column) => column.kind === "active")) {
    if (columns.length >= MAX_COLUMNS) columns.pop();
    const fallback = createDefaultColumns().find((column) => column.id === "todo")!;
    fallback.id = uniqueId("column", fallback.id, usedIds);
    columns.unshift(fallback);
    idMap.set("todo", fallback.id);
  }

  if (!columns.some((column) => column.kind === "achievement")) {
    if (columns.length >= MAX_COLUMNS) columns.pop();
    const achievement = createDefaultColumns().find((column) => column.kind === "achievement")!;
    achievement.id = uniqueId("column", achievement.id, usedIds);
    columns.push(achievement);
    idMap.set("done", achievement.id);
  }

  return { columns, idMap };
}

function normalizeLanes(value: unknown, savedVersion: number) {
  if (!Array.isArray(value)) {
    return { lanes: [] as LifeLane[], idMap: new Map<string, string>() };
  }

  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const lanes = value.slice(0, MAX_LANES).reduce<LifeLane[]>((result, candidate, index) => {
    if (!isRecord(candidate)) return result;
    const name = cleanText(candidate.name, MAX_NAME_LENGTH);
    if (!name) return result;
    const id = uniqueId("lane", candidate.id, usedIds);
    if (hasText(candidate.id) && !idMap.has(candidate.id)) {
      idMap.set(candidate.id, id);
    }
    result.push({
      id,
      name,
      color: isLaneColor(candidate.color)
        ? candidate.color
        : (["mint", "sky", "lavender", "peach", "gold", "leaf"] as const)[index % 6],
      icon: isLaneIcon(candidate.icon) ? candidate.icon : inferLaneIcon(name),
      createdAt: validTimestamp(candidate.createdAt) ?? nowStamp(),
    });
    return result;
  }, []);

  const merged = mergeMissingDefaultLanes(lanes, savedVersion);
  return { lanes: merged, idMap };
}

function normalizeDrafts(value: unknown) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  return value.slice(0, MAX_DRAFTS).reduce<DraftNote[]>((result, candidate) => {
    if (!isRecord(candidate)) return result;
    const text = cleanText(candidate.text, MAX_DRAFT_LENGTH);
    if (!text) return result;
    const stamp = nowStamp();
    result.push({
      id: uniqueId("draft", candidate.id, usedIds),
      text,
      createdAt: validTimestamp(candidate.createdAt) ?? stamp,
      updatedAt: validTimestamp(candidate.updatedAt) ?? stamp,
    });
    return result;
  }, []);
}

function normalizeItems(
  value: unknown,
  lanes: LifeLane[],
  laneIdMap: Map<string, string>,
  columns: BoardColumn[],
  columnIdMap: Map<string, string>,
) {
  if (!Array.isArray(value)) return [];
  const fallbackLaneId = lanes[0].id;
  const fallbackColumnId = columns.find((column) => column.kind === "active")!.id;
  const laneIds = new Set(lanes.map((lane) => lane.id));
  const columnIds = new Set(columns.map((column) => column.id));
  const usedIds = new Set<string>();

  return value.slice(0, MAX_ITEMS).reduce<BoardItem[]>((result, candidate) => {
    if (!isRecord(candidate)) return result;
    const title = cleanText(candidate.title, MAX_TITLE_LENGTH);
    if (!title) return result;
    const stamp = nowStamp();
    const rawLaneId = hasText(candidate.laneId) ? candidate.laneId : "";
    const rawColumnId = hasText(candidate.column) ? candidate.column : "";
    const mappedLaneId = laneIdMap.get(rawLaneId) ?? rawLaneId;
    const mappedColumnId = columnIdMap.get(rawColumnId) ?? rawColumnId;
    result.push({
      id: uniqueId("item", candidate.id, usedIds),
      title,
      note: typeof candidate.note === "string"
        ? candidate.note.trim().slice(0, MAX_NOTE_LENGTH)
        : "",
      column: columnIds.has(mappedColumnId) ? mappedColumnId : fallbackColumnId,
      laneId: laneIds.has(mappedLaneId) ? mappedLaneId : fallbackLaneId,
      priority: ITEM_PRIORITIES.includes(candidate.priority as ItemPriority)
        ? (candidate.priority as ItemPriority)
        : "medium",
      startDate: validDate(candidate.startDate),
      endDate: validDate(candidate.endDate),
      createdAt: validTimestamp(candidate.createdAt) ?? stamp,
      updatedAt: validTimestamp(candidate.updatedAt) ?? stamp,
    });
    return result;
  }, []);
}

export function normalizeState(value: unknown): BoardState | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.lanes) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.drafts)
  ) {
    return null;
  }

  const savedDefaultLaneVersion =
    typeof value.defaultLaneVersion === "number" ? value.defaultLaneVersion : 0;
  const { columns, idMap: columnIdMap } = normalizeColumns(value.columns);
  const { lanes, idMap: laneIdMap } = normalizeLanes(
    value.lanes,
    savedDefaultLaneVersion,
  );
  if (!lanes.length) return null;

  const items = normalizeItems(
    value.items,
    lanes,
    laneIdMap,
    columns,
    columnIdMap,
  );
  const drafts = normalizeDrafts(value.drafts);
  const preset: PresetId =
    value.preset === "draft" || value.preset === "demo" ? value.preset : "custom";

  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    preset,
    defaultLaneVersion: DEFAULT_LANE_VERSION,
    updatedAt: validTimestamp(value.updatedAt) ?? nowStamp(),
    columns,
    lanes,
    drafts,
    items,
  };
}

export function inspectImport(value: unknown): ImportPreview | null {
  const state = normalizeState(value);
  if (!state) return null;
  return {
    state: { ...state, preset: "draft", updatedAt: nowStamp() },
    summary: {
      lanes: state.lanes.length,
      states: state.columns.filter((column) => column.kind === "active").length,
      items: state.items.length,
      notes: state.drafts.length,
    },
  };
}

export function mergeStates(current: BoardState, incoming: BoardState): BoardState {
  const lanes = [...current.lanes];
  const laneIdMap = new Map<string, string>();
  const laneByName = new Map(lanes.map((lane) => [lane.name.toLowerCase(), lane]));
  incoming.lanes.forEach((lane) => {
    const existing = laneByName.get(lane.name.toLowerCase());
    if (existing) {
      laneIdMap.set(lane.id, existing.id);
      return;
    }
    if (lanes.length >= MAX_LANES) {
      laneIdMap.set(lane.id, lanes[0].id);
      return;
    }
    const added = { ...lane, id: createId("lane"), createdAt: nowStamp() };
    lanes.push(added);
    laneByName.set(added.name.toLowerCase(), added);
    laneIdMap.set(lane.id, added.id);
  });

  const columns = [...current.columns];
  const columnIdMap = new Map<string, string>();
  const currentAchievement = columns.find((column) => column.kind === "achievement")!;
  const activeByTitle = new Map(
    columns
      .filter((column) => column.kind === "active")
      .map((column) => [column.title.toLowerCase(), column]),
  );
  incoming.columns.forEach((column) => {
    if (column.kind === "achievement") {
      columnIdMap.set(column.id, currentAchievement.id);
      return;
    }
    const existing = activeByTitle.get(column.title.toLowerCase());
    if (existing) {
      columnIdMap.set(column.id, existing.id);
      return;
    }
    if (columns.length >= MAX_COLUMNS) {
      columnIdMap.set(
        column.id,
        columns.find((candidate) => candidate.kind === "active")!.id,
      );
      return;
    }
    const added = { ...column, id: createId("column"), createdAt: nowStamp() };
    columns.splice(columns.indexOf(currentAchievement), 0, added);
    activeByTitle.set(added.title.toLowerCase(), added);
    columnIdMap.set(column.id, added.id);
  });

  const existingDraftIds = new Set(current.drafts.map((draft) => draft.id));
  const drafts = [
    ...current.drafts,
    ...incoming.drafts.map((draft) => ({
      ...draft,
      id: existingDraftIds.has(draft.id) ? createId("draft") : draft.id,
    })),
  ].slice(0, MAX_DRAFTS);
  const existingItemIds = new Set(current.items.map((item) => item.id));
  const items = [
    ...current.items,
    ...incoming.items.map((item) => ({
      ...item,
      id: existingItemIds.has(item.id) ? createId("item") : item.id,
      laneId: laneIdMap.get(item.laneId) ?? lanes[0].id,
      column: columnIdMap.get(item.column) ?? columns.find((column) => column.kind === "active")!.id,
      updatedAt: nowStamp(),
    })),
  ].slice(0, MAX_ITEMS);

  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    preset: "draft",
    defaultLaneVersion: DEFAULT_LANE_VERSION,
    updatedAt: nowStamp(),
    columns,
    lanes,
    drafts,
    items,
  };
}

export function loadStateResult(): LoadStateResult {
  const stored = readLocalStorage(BOARD_STORAGE_KEY);
  if (!stored.ok) {
    return {
      state: createBoardState("draft"),
      issue: {
        kind: "load",
        message: "This browser would not allow Life Lanes to read saved data. Keep this tab open and download a backup after making changes.",
      },
    };
  }
  const raw = stored.value;
  if (!raw) {
    return { state: createBoardState("draft"), issue: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const state = normalizeState(parsed);
    if (!state) throw new Error("Invalid board data");
    if (state.preset === "demo" || (state.preset === "custom" && isDemoLikeState(state))) {
      writeLocalStorage(BOARD_RECOVERY_KEY, raw);
      return {
        state: createBoardState("draft"),
        issue: {
          kind: "load",
          message: "Old demo data was kept out of your personal board. A recovery copy is available if you need it.",
          recoveryData: raw,
        },
      };
    }
    const migrated = { ...state, preset: "draft" as const };
    const rawVersion = isRecord(parsed) && typeof parsed.schemaVersion === "number"
      ? parsed.schemaVersion
      : 0;
    if (rawVersion !== BOARD_SCHEMA_VERSION) {
      const result = saveState(migrated);
      return { state: migrated, issue: result.ok ? null : result.issue };
    }
    return { state: migrated, issue: null };
  } catch {
    writeLocalStorage(BOARD_RECOVERY_KEY, raw);
    return {
      state: createBoardState("draft"),
      issue: {
        kind: "load",
        message: "Your saved board could not be opened. A recovery copy is ready to download.",
        recoveryData: raw,
      },
    };
  }
}

export function loadState() {
  return loadStateResult().state;
}

export function saveRecoveryState(state: BoardState) {
  return writeLocalStorage(BOARD_RECOVERY_KEY, JSON.stringify(state, null, 2));
}

export function saveState(state: BoardState): SaveStateResult {
  if (state.preset === "demo") {
    return { ok: true };
  }

  if (writeLocalStorage(BOARD_STORAGE_KEY, JSON.stringify(state))) {
    return { ok: true };
  }

  return {
    ok: false,
    issue: {
      kind: "save",
      message: "Changes are open in this tab, but this browser could not save them. Download a backup before closing it.",
      recoveryData: JSON.stringify(state, null, 2),
    },
  };
}
