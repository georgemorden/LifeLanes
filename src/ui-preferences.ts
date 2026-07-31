import { type PresetId } from "./types";

const UI_PREFERENCES_KEY = "life-lanes-board-ui-v1";

export type BoardPreferences = {
  showAllLanes: boolean;
  collapsedLaneIds: string[];
  mobileColumn: string;
};

const DEFAULT_PREFERENCES: BoardPreferences = {
  showAllLanes: false,
  collapsedLaneIds: [],
  mobileColumn: "",
};

function preferenceKey(preset: PresetId) {
  return `${UI_PREFERENCES_KEY}:${preset === "demo" ? "demo" : "personal"}`;
}

export function loadBoardPreferences(preset: PresetId): BoardPreferences {
  try {
    const raw = localStorage.getItem(preferenceKey(preset));
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<BoardPreferences>;
    return {
      showAllLanes: parsed.showAllLanes === true,
      collapsedLaneIds: Array.isArray(parsed.collapsedLaneIds)
        ? parsed.collapsedLaneIds.filter((id): id is string => typeof id === "string").slice(0, 100)
        : [],
      mobileColumn: typeof parsed.mobileColumn === "string" ? parsed.mobileColumn : "",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveBoardPreferences(preset: PresetId, preferences: BoardPreferences) {
  try {
    localStorage.setItem(preferenceKey(preset), JSON.stringify(preferences));
  } catch {
    // Board preferences are optional; core data persistence reports its own failures.
  }
}
