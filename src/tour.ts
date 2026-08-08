import { type ViewId } from "./ui-types";

export type TourStep = {
  title: string;
  body: string;
  view: ViewId;
  target: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Your Life Lanes",
    body: "Organise tasks by life area and status.",
    view: "board",
    target: ".lane-matrix",
  },
  {
    title: "Move things forward",
    body: "Open an item to update it or move it.",
    view: "board",
    target: ".note-card",
  },
  {
    title: "Brain Dump",
    body: "Capture thoughts, then sort them into a Life Lane.",
    view: "capture",
    target: ".brain-dump-form",
  },
  {
    title: "Achievements",
    body: "Completed items live here and can return to the board.",
    view: "achievements",
    target: ".achievements-view",
  },
];
