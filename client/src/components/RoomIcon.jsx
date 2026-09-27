import { Bath, BedDouble, Car, CookingPot, DoorOpen, Monitor, Sofa } from "lucide-react";

// Picks an icon from the room's name ("Master bedroom" → bed).
const RULES = [
  [/bed|nursery|kid/i, BedDouble],
  [/kitchen|dining|pantry/i, CookingPot],
  [/living|lounge|family|den|sitting/i, Sofa],
  [/bath|toilet|powder|wc/i, Bath],
  [/office|study|desk|work/i, Monitor],
  [/garage|shed|basement|storage|workshop/i, Car],
];

export function RoomIcon({ name, size = 22 }) {
  const Icon = RULES.find(([re]) => re.test(name || ""))?.[1] ?? DoorOpen;
  return <Icon size={size} aria-hidden="true" />;
}
