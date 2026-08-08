import {
  BadgePoundSterling,
  BookOpen,
  BriefcaseBusiness,
  Dumbbell,
  Heart,
  House,
  Lightbulb,
  Map,
  Music2,
  Palette,
  Plane,
  Salad,
  Sprout,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { inferLaneIcon } from "../lane-icons";
import { type LaneIconName } from "../types";

const ICONS: Record<LaneIconName, LucideIcon> = {
  sparkles: Sparkles,
  briefcase: BriefcaseBusiness,
  fitness: Dumbbell,
  money: BadgePoundSterling,
  people: Users,
  health: Heart,
  home: House,
  creative: Palette,
  learning: BookOpen,
  travel: Plane,
  adventure: Map,
  ideas: Lightbulb,
  projects: Wrench,
  music: Music2,
  food: Salad,
  nature: Sprout,
};

export function LaneIcon({
  name = "",
  icon,
  size = 18,
}: {
  name?: string;
  icon?: LaneIconName;
  size?: number;
}) {
  const Icon = ICONS[icon ?? inferLaneIcon(name)] ?? Sparkles;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.8} />;
}
