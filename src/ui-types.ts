import { type BoardItem, type ColumnId } from "./types";

export type ViewId = "board" | "capture" | "achievements";

export type ItemEditorState =
  | {
      mode: "create";
      column: ColumnId;
      laneId: string;
    }
  | {
      mode: "edit";
      item: BoardItem;
    };

export type ItemDraft = Pick<BoardItem, "title" | "note" | "column" | "laneId" | "priority"> & {
  startDate: string;
  endDate: string;
};

export type ToastMessage = {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};
