import { LANE_ICONS, type LaneIconName } from "./types";

export const LANE_ICON_OPTIONS: Array<{ id: LaneIconName; label: string }> = [
  { id: "sparkles", label: "General" },
  { id: "briefcase", label: "Work" },
  { id: "fitness", label: "Fitness" },
  { id: "money", label: "Money" },
  { id: "people", label: "People" },
  { id: "health", label: "Health" },
  { id: "home", label: "Home" },
  { id: "creative", label: "Creative" },
  { id: "learning", label: "Learning" },
  { id: "travel", label: "Travel" },
  { id: "adventure", label: "Adventure" },
  { id: "ideas", label: "Ideas" },
  { id: "projects", label: "Projects" },
  { id: "music", label: "Music" },
  { id: "food", label: "Food" },
  { id: "nature", label: "Outdoors" },
];

const ICON_RULES: Array<[RegExp, LaneIconName]> = [
  [/(career|work|job|portfolio)/i, "briefcase"],
  [/(fitness|training|strength|running|gym|sport)/i, "fitness"],
  [/(finance|money|budget|saving)/i, "money"],
  [/(relationship|family|social|friend|community)/i, "people"],
  [/(health|wellbeing|recovery|mental)/i, "health"],
  [/(home|admin|life admin|house)/i, "home"],
  [/(creative|art|design)/i, "creative"],
  [/(learning|upskill|course|certification|study)/i, "learning"],
  [/(travel|holiday|trip)/i, "travel"],
  [/(adventure|race|outdoor|explore)/i, "adventure"],
  [/(idea|future|random|inspiration)/i, "ideas"],
  [/(project|build|make)/i, "projects"],
  [/(music|audio|song)/i, "music"],
  [/(food|cook|nutrition|meal)/i, "food"],
  [/(nature|garden|hike)/i, "nature"],
  [/(lifestyle|personal|habit|general|other)/i, "sparkles"],
];

export function isLaneIcon(value: unknown): value is LaneIconName {
  return LANE_ICONS.includes(value as LaneIconName);
}

export function inferLaneIcon(name: string): LaneIconName {
  return ICON_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? "sparkles";
}
