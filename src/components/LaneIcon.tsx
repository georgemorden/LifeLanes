import {
  BadgePoundSterling,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Dumbbell,
  Heart,
  House,
  Lightbulb,
  Map,
  Palette,
  Plane,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Array<[RegExp, LucideIcon]> = [
  [/(career|work|job|portfolio)/i, BriefcaseBusiness],
  [/(fitness|training|strength|running)/i, Dumbbell],
  [/(finance|money|budget)/i, BadgePoundSterling],
  [/(relationship|family|social|friend)/i, Users],
  [/(health|wellbeing|recovery)/i, Heart],
  [/(home|admin|life admin)/i, House],
  [/(creative|art|music)/i, Palette],
  [/(learning|upskill|course|certification)/i, BookOpen],
  [/(travel|holiday)/i, Plane],
  [/(adventure|race|outdoor)/i, Map],
  [/(idea|future|random)/i, Lightbulb],
  [/(project|build)/i, Wrench],
  [/(lifestyle|habit)/i, Sparkles],
];

export function LaneIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Bike;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.8} />;
}
