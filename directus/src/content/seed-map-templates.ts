import { createItem, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";

/**
 * One-time (but safe-to-re-run) seed migrating the original hardcoded
 * template set into Directus — matched by `key`, so re-running this after
 * editing the copy below just updates the existing rows instead of
 * duplicating them. This is a *starting point*: once seeded, add, edit, or
 * reorder templates directly in the Directus admin panel — this script
 * never needs to run again unless you want to reset one back to its
 * original seed copy.
 */
interface SeedTemplate {
  key: string;
  icon: string;
  label: string;
  tagline: string;
  suggestedName: string;
  suggestedDescription: string;
  noteLabel: string;
  notePrompt: string;
  defaultPinColor: string;
  defaultPinIcon: string;
  sortOrder: number;
}

const templates: SeedTemplate[] = [
  {
    key: "weekend-trip",
    icon: "plane",
    label: "Weekend trip",
    tagline: "Plan a trip together — everyone adds what they want to see.",
    suggestedName: "Our weekend trip",
    suggestedDescription: "Everywhere we're planning to go — food, sights, and everything in between.",
    noteLabel: "Why here?",
    notePrompt: "What's the plan for this stop?",
    defaultPinColor: "blue",
    defaultPinIcon: "flag",
    sortOrder: 1,
  },
  {
    key: "neighborhood-guide",
    icon: "compass",
    label: "Neighborhood guide",
    tagline: "The local spots worth knowing about, from people who actually live there.",
    suggestedName: "Neighborhood favorites",
    suggestedDescription: "Our go-to spots around here — add yours.",
    noteLabel: "What's good here?",
    notePrompt: "What should someone order or look for?",
    defaultPinColor: "teal",
    defaultPinIcon: "coffee",
    sortOrder: 2,
  },
  {
    key: "wedding-guests",
    icon: "heart",
    label: "Wedding guest map",
    tagline: "Where guests are staying, or places to recommend for the weekend.",
    suggestedName: "Wedding weekend guide",
    suggestedDescription: "Everything guests need to know — hotels, the venue, and things to do while you're in town.",
    noteLabel: "Good to know",
    notePrompt: "Anything guests should know about this place?",
    defaultPinColor: "pink",
    defaultPinIcon: "heart",
    sortOrder: 3,
  },
  {
    key: "team-locations",
    icon: "briefcase",
    label: "Team locations",
    tagline: "Where a distributed team is based, or your company's own offices.",
    suggestedName: "Team locations",
    suggestedDescription: "Where everyone on the team is based.",
    noteLabel: "Role / team",
    notePrompt: "What do you work on?",
    defaultPinColor: "indigo",
    defaultPinIcon: "building",
    sortOrder: 4,
  },
  {
    key: "event-guide",
    icon: "users",
    label: "Event guide",
    tagline: "Venue, nearby parking, and recommendations for attendees.",
    suggestedName: "Event guide",
    suggestedDescription: "Venue details and nearby recommendations for anyone coming to the event.",
    noteLabel: "Attendee note",
    notePrompt: "What should attendees know about this place?",
    defaultPinColor: "amber",
    defaultPinIcon: "star",
    sortOrder: 5,
  },
];

async function main() {
  const client = await getSchemaClient();

  for (const template of templates) {
    const existing = (await client.request(
      readItems("pintogather_map_templates", { filter: { key: { _eq: template.key } }, fields: ["id"], limit: 1 }),
    )) as { id: string }[];

    const payload = {
      icon: template.icon,
      label: template.label,
      tagline: template.tagline,
      suggested_name: template.suggestedName,
      suggested_description: template.suggestedDescription,
      note_label: template.noteLabel,
      note_prompt: template.notePrompt,
      default_pin_color: template.defaultPinColor,
      default_pin_icon: template.defaultPinIcon,
      sort_order: template.sortOrder,
      published: true,
    };

    if (existing[0]) {
      await client.request(updateItem("pintogather_map_templates", existing[0].id, payload));
      console.log(`= updated template "${template.key}"`);
    } else {
      await client.request(createItem("pintogather_map_templates", { key: template.key, ...payload }));
      console.log(`+ created template "${template.key}"`);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
