import type { PinColor, PinIcon } from "./enums.js";

/**
 * Starter presets shown when creating a new map, so a first-time user
 * doesn't face a blank "name your map" field with no sense of what this is
 * for. Purely client-side prefill data — nothing here is persisted
 * server-side; picking one just seeds the create-map form's initial values.
 *
 * `icon` is a semantic key, not a component reference — each platform maps
 * it to its own icon library (lucide-react on web, @expo/vector-icons on
 * mobile), same pattern as the small pieces intentionally duplicated per
 * platform elsewhere (see mobile/README.md).
 */
export interface MapTemplate {
  id: string;
  icon: "briefcase" | "plane" | "compass" | "heart" | "users";
  label: string;
  tagline: string;
  suggestedName: string;
  suggestedDescription: string;
  noteLabel: string;
  notePrompt: string;
  defaultPinColor: PinColor | null;
  defaultPinIcon: PinIcon | null;
}

export const MAP_TEMPLATES: MapTemplate[] = [
  {
    id: "weekend-trip",
    icon: "plane",
    label: "Weekend trip",
    tagline: "Plan a trip together — everyone adds what they want to see.",
    suggestedName: "Our weekend trip",
    suggestedDescription: "Everywhere we're planning to go — food, sights, and everything in between.",
    noteLabel: "Why here?",
    notePrompt: "What's the plan for this stop?",
    defaultPinColor: "blue",
    defaultPinIcon: "flag",
  },
  {
    id: "neighborhood-guide",
    icon: "compass",
    label: "Neighborhood guide",
    tagline: "The local spots worth knowing about, from people who actually live there.",
    suggestedName: "Neighborhood favorites",
    suggestedDescription: "Our go-to spots around here — add yours.",
    noteLabel: "What's good here?",
    notePrompt: "What should someone order or look for?",
    defaultPinColor: "teal",
    defaultPinIcon: "coffee",
  },
  {
    id: "wedding-guests",
    icon: "heart",
    label: "Wedding guest map",
    tagline: "Where guests are staying, or places to recommend for the weekend.",
    suggestedName: "Wedding weekend guide",
    suggestedDescription: "Everything guests need to know — hotels, the venue, and things to do while you're in town.",
    noteLabel: "Good to know",
    notePrompt: "Anything guests should know about this place?",
    defaultPinColor: "pink",
    defaultPinIcon: "heart",
  },
  {
    id: "team-locations",
    icon: "briefcase",
    label: "Team locations",
    tagline: "Where a distributed team is based, or your company's own offices.",
    suggestedName: "Team locations",
    suggestedDescription: "Where everyone on the team is based.",
    noteLabel: "Role / team",
    notePrompt: "What do you work on?",
    defaultPinColor: "indigo",
    defaultPinIcon: "building",
  },
  {
    id: "event-guide",
    icon: "users",
    label: "Event guide",
    tagline: "Venue, nearby parking, and recommendations for attendees.",
    suggestedName: "Event guide",
    suggestedDescription: "Venue details and nearby recommendations for anyone coming to the event.",
    noteLabel: "Attendee note",
    notePrompt: "What should attendees know about this place?",
    defaultPinColor: "amber",
    defaultPinIcon: "star",
  },
];
