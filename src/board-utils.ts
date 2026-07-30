import { type BoardColumn, type BoardItem } from "./types";

const ACHIEVEMENT_TITLES = new Set(["done", "completed", "achievements"]);

export function isAchievementColumn(column: Pick<BoardColumn, "id" | "title">) {
  return column.id === "done" || ACHIEVEMENT_TITLES.has(column.title.trim().toLowerCase());
}

export function activeColumns(columns: BoardColumn[]) {
  return columns.filter((column) => !isAchievementColumn(column));
}

export function achievementColumns(columns: BoardColumn[]) {
  return columns.filter(isAchievementColumn);
}

export function achievementColumnId(columns: BoardColumn[]) {
  return achievementColumns(columns)[0]?.id ?? "done";
}

export function formatShortDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function dateRangeLabel(item: Pick<BoardItem, "startDate" | "endDate">) {
  const start = formatShortDate(item.startDate);
  const end = formatShortDate(item.endDate);

  if (start && end) {
    return `${start} – ${end}`;
  }

  if (end) {
    return `By ${end}`;
  }

  return start;
}

export function firstLine(value: string) {
  return value.split(/\r?\n/)[0]?.trim() ?? "";
}

export function remainingLines(value: string) {
  return value
    .split(/\r?\n/)
    .slice(1)
    .join("\n")
    .trim();
}
