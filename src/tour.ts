import { type ViewId } from "./ui-types";

export type TourStep = {
  title: string;
  body: string;
  view: ViewId;
  target: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    title: "See both dimensions",
    body: "States run across the top. Life Lanes run down the side.",
    view: "board",
    target: ".lane-matrix",
  },
  {
    title: "Capture the loose thought",
    body: "Write it down without deciding where it belongs yet.",
    view: "capture",
    target: ".brain-dump-form",
  },
  {
    title: "Sort when you are ready",
    body: "Triage gives each note a state and a Life Lane.",
    view: "capture",
    target: ".triage-section",
  },
  {
    title: "Move as life changes",
    body: "Drag any note between states or Life Lanes.",
    view: "board",
    target: ".note-card",
  },
  {
    title: "Mark the win",
    body: "Complete an item to clear it from the active board.",
    view: "board",
    target: ".note-complete-button",
  },
  {
    title: "Keep the record",
    body: "Completed items leave the active board and collect in Achievements.",
    view: "achievements",
    target: ".achievements-view",
  },
];
