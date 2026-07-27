import { createItem, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";

/**
 * One-time (but safe-to-re-run) seed for the initial static/marketing pages
 * — matched by slug, so re-running this after editing the copy below just
 * updates the existing rows instead of duplicating them. Content authored
 * here is a *starting point*: once seeded, edit it directly in the Directus
 * admin panel — this script never needs to run again unless you want to
 * reset a page back to its seed copy.
 */
const APP = env.APP_NAME;

interface SeedPage {
  slug: string;
  title: string;
  metaDescription: string;
  navOrder: number;
  content: string;
}

const pages: SeedPage[] = [
  {
    slug: "how-it-works",
    title: `How ${APP} works`,
    metaDescription: `Create a shareable map, invite people to drop pins on it, and watch a list of places turn into something everyone can actually use.`,
    navOrder: 1,
    content: `## From a blank map to something worth sharing

${APP} turns "everyone send me your recommendations" into a single map anyone can add to, browse, and trust.

### 1. Create a map

Pick a template — weekend trip, neighborhood guide, wedding guest list, team locations, event guide — or start from scratch. Give it a name, and optionally customize what each pin asks for (the default is a simple note, but you can change the label and prompt to fit your map: "What should I order here?", "Where are you staying?", "What's the parking situation?").

### 2. Share the link

Every map gets a short, shareable URL. Anyone with the link can view it; depending on the permissions you set, they can also add their own pins — no account required. If you'd rather keep contributions curated, turn on approval mode: pins from anyone but you sit pending until you approve them.

### 3. People add pins

A contributor drops a pin by clicking the map or searching for a specific venue by name. Each pin can carry a name, a note, a photo, and social links. If your map is public, contributors don't need to sign up — they can add a pin anonymously in a few seconds.

### 4. Organize and explore

Once the map fills in, a few tools help you make sense of it:

- **Clustering** groups nearby pins together at a glance, so a busy map doesn't turn into an unreadable pile of markers.
- **Route mode** lets you drag pins into a visiting order and see the distance between stops, with a driving-route line to match.
- **The pin table** gives you a sortable, searchable list view alongside the map, with CSV export if you want the raw data elsewhere.

### 5. Make it yours

Owners on a paid plan can add their own logo to a map's public page, and choose default pin colors and icons so every marker matches at a glance. Maps can also be listed on your public profile, or submitted to Discover so other people can find them.

That's the whole loop: **create → share → collect → organize.** No spreadsheet, no "reply to this email with your suggestions," no losing track of who said what.`,
  },
  {
    slug: "who-its-for",
    title: `Who ${APP} is for`,
    metaDescription: `Travelers, event planners, community organizers, and teams who need one shared map instead of a scattered group chat full of pins nobody can find again.`,
    navOrder: 2,
    content: `${APP} is for anyone who's ever tried to collect a group's recommendations and ended up with them scattered across a group chat, a spreadsheet nobody opens, or a dozen separate messages nobody can find again.

### Groups of friends and travelers

Planning a trip? Start a map, share the link, and let everyone drop the restaurants, sights, and "we have to go here" spots they've been saving. Switch to Route mode once you're ready to plan the actual day-by-day order.

### Event organizers

Wedding guests flying in from out of town, a conference with a dozen recommended venues nearby, a work offsite with restaurant options for every dietary need — a map is easier to send around than a document, and it stays updated as plans change.

### Community organizers and local guides

If you run a community — a neighborhood group, an alumni network, a diaspora community, a hobby group — a curated map of trusted local businesses, services, or meeting spots becomes a resource people actually come back to, instead of a pinned post that gets buried in a week.

### Teams and small businesses

Field teams, sales reps, and site visit coordinators use maps to track locations that matter to the business — client sites, installation locations, partner offices — with notes and contact details attached to each one, shared with exactly the people who need it.

### Anyone building an audience around places

If you write about a city, a neighborhood, or a niche (best coffee, dog-friendly patios, hidden viewpoints), a public ${APP} map is a shareable, explorable format your audience can browse — and if it's good, it can be featured on Discover.

**In short:** if the question is "where should we go," and the answer used to live in someone's head or a dozen text messages, ${APP} gives that answer a home.`,
  },
  {
    slug: "features",
    title: "Features",
    metaDescription: `Everything ${APP} includes: collaborative maps, pin customization, route planning, branding, and the collaboration and discovery tools built around them.`,
    navOrder: 3,
    content: `## Mapping & pins

- **Shareable maps** with a short, memorable link — no account needed to view or contribute, unless you want to require one.
- **Click-to-drop or search-to-add** pins, backed by place search so you can pin a real venue by name instead of guessing coordinates.
- **Custom note fields** — change the label and prompt so each map asks contributors the right question for its purpose.
- **Photos per pin**, so a map shows what a place looks like, not just its name.
- **Social links** per pin (Twitter/X, Instagram, LinkedIn) for pins about people or businesses with an online presence.
- **Marker clustering** keeps dense maps readable as they grow.
- **Route/itinerary mode** — drag pins into a visiting order, see the distance between stops, and follow a driving-route line on the map.
- **Templates** for common map types: weekend trip, neighborhood guide, wedding guest list, team locations, event guide.

## Collaboration & permissions

- **Anonymous contribution** on public maps — no sign-up required to add a pin.
- **Approval mode** — pins from anyone but the owner stay pending until approved, so a map stays curated even when it's open to contributions.
- **Invite collaborators** by email with view or edit permissions.
- **Public/private maps** — keep a map fully private, or share it with the world.
- **Bulk import** — paste a list of place names to add many pins at once, with AI-assisted venue suggestions from a short theme description, or import venues straight from a screenshot (paid plans).

## Organization & export

- **Sortable, searchable pin table** alongside every map, with filters for pending/approved and your own pins vs. others'.
- **CSV export** of a map's pins.
- **Map archiving** to tidy up your list without deleting anything (paid plans).

## Branding & customization

- **Custom pin colors and icons**, set per map or overridden per pin (paid plans).
- **Custom logo branding** on a map's public page (paid plans).

## Discover & social

- **Public profiles** with a username, bio, and the maps you choose to show.
- **Follow** other users and **like** maps you find useful.
- **A personalized feed** of activity from people you follow.
- **Discover** — browse curated public maps by category, country, and city.

## Mobile

The ${APP} mobile app (iOS & Android) covers the core of the experience — creating and browsing maps, adding and editing pins with photos, route planning, Discover, and your profile and feed — so a map you start on the web keeps working wherever you are.`,
  },
  {
    slug: "use-cases",
    title: `${APP} for business`,
    metaDescription: `Real-world ways teams and businesses use ${APP}: property tours, event logistics, community business directories, field operations, and curated local guides.`,
    navOrder: 4,
    content: `A map is a surprisingly general-purpose tool once you can share it, collaborate on it, and organize it properly. Here's how different kinds of businesses put ${APP} to work.

### Real estate & property services

Share a map of listings, showings, or a client's shortlisted neighborhoods. Notes on each pin can carry price, viewing times, or "client liked this one" flags — a lighter-weight alternative to a shared spreadsheet, and one clients can actually look at without asking what column means what.

### Event planning & hospitality

Map out venues, vendors, accommodation options, and nearby recommendations for an event, then share one link with attendees instead of a multi-page PDF. Route mode helps a planning team sequence site visits or a wedding weekend's shuttle stops.

### Community directories & local guides

Businesses and organizations serving a specific community — a neighborhood association, a cultural or diaspora community, a professional network — can maintain a public map of trusted local services (from healthcare providers to restaurants to tradespeople), with approval mode keeping quality high even when the community itself suggests additions.

### Field operations & site coordination

Teams that visit or manage multiple physical locations — installation crews, franchise operators, property managers, sales territories — use a shared map with notes and contact details per site, visible to whoever's in the field that day, editable the moment something changes.

### Tourism & travel services

Tour operators and travel planners can build public itinerary maps for a destination or trip package, using Route mode to lay out the actual day-by-day path, and Discover to put well-made maps in front of new travelers.

### Content, media & audience-building

Publications and creators covering a city, neighborhood, or niche can turn a "best of" list into a living, explorable map — easier to keep current than an article, and shareable in a way a list of text never quite is.

---

Have a use case that doesn't fit neatly into any of these? A shareable, collaborative map is flexible by design — if the core need is "a group of people should be able to see and add to a set of places," it's worth trying.`,
  },
];

async function main() {
  const client = await getSchemaClient();

  for (const page of pages) {
    const existing = (await client.request(
      readItems("pintogather_pages", { filter: { slug: { _eq: page.slug } }, fields: ["id"], limit: 1 }),
    )) as { id: string }[];

    const payload = {
      title: page.title,
      meta_description: page.metaDescription,
      content: page.content,
      nav_order: page.navOrder,
      published: true,
    };

    if (existing[0]) {
      await client.request(updateItem("pintogather_pages", existing[0].id, payload));
      console.log(`= updated page "${page.slug}"`);
    } else {
      await client.request(createItem("pintogather_pages", { slug: page.slug, ...payload }));
      console.log(`+ created page "${page.slug}"`);
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
