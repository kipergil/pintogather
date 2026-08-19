import { createItem, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";

/**
 * Seed for the static marketing pages — matched by slug, so re-running after
 * editing the copy below updates the existing rows rather than duplicating
 * them. Content here is a starting point: once seeded it can be edited
 * directly in the Directus admin panel.
 *
 * This script owns **how-it-works**, **who-its-for**, and **use-cases** only.
 * The **features** and **changelog** pages belong to update-content.ts, which
 * revises them as things ship. They used to be listed here as well, with the
 * original map-only copy still frozen in — so running this would quietly
 * revert the features page by years. If you add a page here, make sure
 * nothing else writes the same slug.
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
    metaDescription: `Choose what you're collecting — places, links, or recommendations — share one link, and let everyone add to it. ${APP} turns a scattered group chat into one collection worth keeping.`,
    navOrder: 1,
    content: `## One link, everyone adds, everyone sees it

"Send me your recommendations" produces a dozen messages nobody can find again. ${APP} gives that answer a home: one collection a group builds together, and can still read six months later.

### 1. Choose what you're collecting

A collection isn't only a map. When you create one you pick what it holds, and everything after that adapts — the views, the wording, the way things are added, the CSV export:

- **Places** — pins on a real map, with addresses, photos, and notes.
- **Links** — paste a URL and the page's title, description, and image fill themselves in.
- **Recommendations** — free-form entries for anything nameable: books, films, tools, dishes.

You choose once, when you create it, so the whole collection stays coherent.

### 2. Share the link

Every collection gets a short, shareable URL. Anyone with it can look; depending on the permissions you set, they can add too — **without an account**. That's usually the difference between a group actually contributing and one person doing all the work.

### 3. Everyone adds — one at a time, or a hundred at once

Adding lives on one screen, and you pick the way that suits what you've already got:

- **One at a time** — search a venue, drop a pin on the map, or type an entry in.
- **Paste a list** — one per line. Place names get looked up; links get their title and image fetched.
- **A screenshot or photo** — a chat thread, a post, a photo of a menu. AI reads the items out of it.
- **A file you already have** — .txt, .csv, or .xlsx.
- **A description** — tell the AI what you're after and review what comes back.

Whatever the source, everything lands in one review list first. You edit names, drop the wrong ones, and save the rest together. Nothing is added behind your back.

### 4. Keep it curated

An open collection doesn't have to become a mess. Turn on approval and anything contributed by someone other than you waits for your nod before it's public — so a collection can be genuinely open and still be worth reading.

### 5. Organize and explore

- **A sortable, searchable table** sits alongside every collection, with filters for pending, yours, and other people's — plus CSV export whenever you want the raw data elsewhere.
- **Clustering and route mode** for place collections: group dense pins, then drag them into a visiting order with a driving route to match.
- **Folders** for filing your own collections, visible only to you.

### 6. Make it yours

Set default pin colours and icons, add your own logo to a collection's public page, list a collection on your public profile, or submit it to Discover so other people can find it.

That's the loop: **choose → share → collect → curate.** No spreadsheet, no "reply with your suggestions", no losing track of who said what.`,
  },
  {
    slug: "who-its-for",
    title: `Who ${APP} is for`,
    metaDescription: `Anyone who's ever tried to collect a group's suggestions — places, links, or recommendations — and watched them scatter across a group chat nobody can search.`,
    navOrder: 2,
    content: `${APP} is for anyone who's ever asked a group for suggestions and ended up with them scattered across a chat thread, a spreadsheet nobody opens, and a dozen messages nobody can find again.

The thing being collected varies. The problem doesn't.

### Friends and travellers

Planning a trip? Start a collection, share the link, and let everyone drop the restaurants, sights, and "we have to go here" spots they've been saving. Route mode puts them in order once you're planning the actual days.

### Reading groups, teams, and anyone drowning in links

The article someone sent in March is gone. A links collection keeps them — paste a URL and the title, description, and image fill themselves in, so the list stays readable instead of turning into a wall of bare URLs. Book clubs, study groups, teams sharing what's worth reading this quarter.

### Groups who keep asking each other the same question

What should I watch? What's a good project-management tool? Where do I get a decent haircut around here? A recommendations collection answers it once, with everyone's contributions in one place, instead of the same thread every few months.

### Event organizers

Guests flying in from out of town, a conference with venues nearby, an offsite with options for every dietary need. One link is easier to send than a document, and it stays current as plans change.

### Community organizers and local guides

A neighbourhood group, an alumni network, a diaspora community, a hobby group — a curated collection of trusted businesses, services, links, or recommendations becomes something people come back to, rather than a pinned post buried in a week. Approval mode keeps the quality up while leaving it open.

### Teams and small businesses

Client sites, installation locations, partner offices — or the tools, suppliers, and references the team keeps re-sharing. Notes and contact details attached to each entry, visible to exactly the people who need them.

### Anyone building an audience

If you write about a city, a subject, or a niche, a public collection is a shareable, explorable format your audience can browse — and if it's good, it can be featured on Discover.

**In short:** if the question is "what should we…", and the answer used to live in someone's head or a dozen text messages, ${APP} gives that answer a home.`,
  },
  {
    slug: "use-cases",
    title: `${APP} for business`,
    metaDescription: `How teams and businesses use ${APP}: property shortlists, event logistics, curated resource libraries, community directories, field operations, and audience-facing guides.`,
    navOrder: 4,
    content: `A shared collection is a surprisingly general-purpose tool once a group can add to it, curate it, and organize it properly. Here's how different kinds of business put ${APP} to work — and note that not all of these are maps.

### Real estate & property services

Share a collection of listings, showings, or a client's shortlisted neighbourhoods. Notes on each entry carry price, viewing times, or "client liked this one" — a lighter alternative to a shared spreadsheet, and one clients will actually open.

### Event planning & hospitality

Venues, vendors, accommodation, and nearby recommendations for an event, behind one link instead of a multi-page PDF. Route mode sequences site visits or a wedding weekend's shuttle stops.

### Internal resource libraries

The tools, suppliers, templates, and reference material a team keeps re-sending each other. A links collection turns that into something searchable, with a note on each explaining why it's there — and paste a URL and it fills itself in, so keeping it current costs nothing.

### Onboarding & knowledge sharing

New starters get one link instead of six. The docs to read, the tools to install, the places to eat near the office — and because contributors don't need an account, the people who actually know can add to it.

### Community directories & local guides

Organizations serving a specific community — a neighbourhood association, a cultural network, a professional body — can maintain a public collection of trusted services, with approval mode keeping quality high even when the community itself suggests additions.

### Field operations & site coordination

Teams visiting or managing multiple locations — installation crews, franchise operators, property managers, sales territories — share one collection with notes and contact details per site, editable the moment something changes.

### Tourism & travel services

Tour operators and travel planners build public itinerary collections for a destination or package, using Route mode to lay out the day-by-day path, and Discover to put well-made ones in front of new travellers.

### Content, media & audience-building

A "best of" list that would go stale as an article becomes a living collection instead — easier to keep current, and shareable in a way a block of text never quite is. Places, links, or recommendations, depending on what you cover.

---

Have a use case that doesn't fit neatly? A shareable, collaborative collection is flexible by design — if the core need is "a group of people should be able to see and add to a set of things", it's worth trying.`,
  },
];

async function main() {
  const client = await getSchemaClient();

  for (const page of pages) {
    const existing = (await client.request(
      readItems("map_pages", { filter: { slug: { _eq: page.slug } }, fields: ["id"], limit: 1 }),
    )) as { id: string }[];

    const payload = {
      title: page.title,
      meta_description: page.metaDescription,
      content: page.content,
      nav_order: page.navOrder,
      published: true,
    };

    if (existing[0]) {
      await client.request(updateItem("map_pages", existing[0].id, payload));
      console.log(`= updated page "${page.slug}"`);
    } else {
      await client.request(createItem("map_pages", { slug: page.slug, ...payload }));
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
