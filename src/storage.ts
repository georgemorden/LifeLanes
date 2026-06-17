import {
  DEFAULT_LANES,
  DEFAULT_LANE_VERSION,
  createBoardState,
  createDefaultColumns,
  createId,
  createLifeLane,
  isColumnId,
  isDemoLikeState,
  isLaneColor,
  nowStamp,
} from "./data";
import { type BoardColumn, type BoardItem, type BoardState, type DraftNote, type LifeLane, type PresetId } from "./types";

export const BOARD_STORAGE_KEY = "life-lanes-two-panel-v1";
export const PROFILE_STORAGE_KEY = "life-lanes-profile-v1";

const LEGACY_NAME_STORAGE_KEY = "life-lanes-user-name-v1";

export type BrowserProfile = {
  userName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readLocalStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
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

function removeLocalStorage(key: string) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function normalizeLane(value: unknown, index: number): LifeLane | null {
  if (!isRecord(value) || !hasText(value.name)) {
    return null;
  }

  return {
    id: hasText(value.id) ? value.id : createId("lane"),
    name: value.name.trim(),
    color: isLaneColor(value.color) ? value.color : (["mint", "sky", "lavender", "peach", "gold", "leaf"] as const)[index % 6],
    createdAt: hasText(value.createdAt) ? value.createdAt : nowStamp(),
  };
}

function normalizeColumn(value: unknown): BoardColumn | null {
  if (!isRecord(value) || !hasText(value.title)) {
    return null;
  }

  return {
    id: hasText(value.id) ? value.id : createId("column"),
    title: value.title.trim(),
    createdAt: hasText(value.createdAt) ? value.createdAt : nowStamp(),
  };
}

function normalizeDraft(value: unknown): DraftNote | null {
  if (!isRecord(value) || !hasText(value.text)) {
    return null;
  }

  const stamp = nowStamp();
  return {
    id: hasText(value.id) ? value.id : createId("draft"),
    text: value.text.trim(),
    createdAt: hasText(value.createdAt) ? value.createdAt : stamp,
    updatedAt: hasText(value.updatedAt) ? value.updatedAt : stamp,
  };
}

function normalizeItem(value: unknown, fallbackLaneId: string, fallbackColumnId: string, columnIds: Set<string>): BoardItem | null {
  if (!isRecord(value) || !hasText(value.title)) {
    return null;
  }

  const stamp = nowStamp();
  const column = isColumnId(value.column) && columnIds.has(value.column) ? value.column : fallbackColumnId;
  return {
    id: hasText(value.id) ? value.id : createId("item"),
    title: value.title.trim(),
    note: typeof value.note === "string" ? value.note : "",
    column,
    laneId: hasText(value.laneId) ? value.laneId : fallbackLaneId,
    startDate: hasText(value.startDate) ? value.startDate : undefined,
    endDate: hasText(value.endDate) ? value.endDate : undefined,
    createdAt: hasText(value.createdAt) ? value.createdAt : stamp,
    updatedAt: hasText(value.updatedAt) ? value.updatedAt : stamp,
  };
}

function mergeMissingDefaultLanes(lanes: LifeLane[], savedVersion: number) {
  if (savedVersion >= DEFAULT_LANE_VERSION) {
    return lanes;
  }

  const existingNames = new Set(lanes.map((lane) => lane.name.trim().toLowerCase()));
  const missing = DEFAULT_LANES.filter((name) => !existingNames.has(name.toLowerCase())).map((name, index) =>
    createLifeLane(name, lanes.length + index),
  );
  return [...lanes, ...missing];
}

export function normalizeState(value: unknown): BoardState | null {
  if (!isRecord(value) || !Array.isArray(value.lanes) || !Array.isArray(value.items) || !Array.isArray(value.drafts)) {
    return null;
  }

  const columns = Array.isArray(value.columns)
    ? value.columns.map(normalizeColumn).filter((column): column is BoardColumn => column !== null)
    : createDefaultColumns();
  if (!columns.length) {
    return null;
  }

  const savedDefaultLaneVersion = typeof value.defaultLaneVersion === "number" ? value.defaultLaneVersion : 0;
  const lanes = mergeMissingDefaultLanes(
    value.lanes.map(normalizeLane).filter((lane): lane is LifeLane => lane !== null),
    savedDefaultLaneVersion,
  );
  if (!lanes.length) {
    return null;
  }

  const laneIds = new Set(lanes.map((lane) => lane.id));
  const columnIds = new Set(columns.map((column) => column.id));
  const items = value.items
    .map((item) => normalizeItem(item, lanes[0].id, columns[0].id, columnIds))
    .filter((item): item is BoardItem => item !== null)
    .map((item) => ({
      ...item,
      laneId: laneIds.has(item.laneId) ? item.laneId : lanes[0].id,
    }));

  const drafts = value.drafts.map(normalizeDraft).filter((draft): draft is DraftNote => draft !== null);
  const preset: PresetId = value.preset === "draft" || value.preset === "demo" ? value.preset : "custom";

  return {
    preset,
    defaultLaneVersion: DEFAULT_LANE_VERSION,
    columns,
    lanes,
    drafts,
    items,
  };
}

export function loadState() {
  try {
    const raw = readLocalStorage(BOARD_STORAGE_KEY);
    if (!raw) {
      return createBoardState("draft");
    }
    const state = normalizeState(JSON.parse(raw));
    if (!state || state.preset === "demo" || (state.preset === "custom" && isDemoLikeState(state))) {
      return createBoardState("draft");
    }
    return state;
  } catch {
    return createBoardState("draft");
  }
}

export function saveState(state: BoardState) {
  if (state.preset === "demo") {
    return true;
  }

  return writeLocalStorage(BOARD_STORAGE_KEY, JSON.stringify(state));
}

export function loadProfile(): BrowserProfile {
  try {
    const raw = readLocalStorage(PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isRecord(parsed) && typeof parsed.userName === "string") {
      return { userName: parsed.userName };
    }
  } catch {
    // Fall through to the legacy key.
  }

  return { userName: readLocalStorage(LEGACY_NAME_STORAGE_KEY) ?? "" };
}

export function saveProfile(profile: BrowserProfile) {
  const cleanName = profile.userName.trim();
  if (!cleanName) {
    const removedProfile = removeLocalStorage(PROFILE_STORAGE_KEY);
    const removedLegacy = removeLocalStorage(LEGACY_NAME_STORAGE_KEY);
    return removedProfile && removedLegacy;
  }

  const saved = writeLocalStorage(PROFILE_STORAGE_KEY, JSON.stringify({ userName: cleanName }));
  removeLocalStorage(LEGACY_NAME_STORAGE_KEY);
  return saved;
}
