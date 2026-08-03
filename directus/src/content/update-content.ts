import { readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";

/**
 * Keeps the public changelog and features pages in step with what's shipped.
 *
 * Deliberately not part of seed-pages.ts: that script is "seed once"
 * idempotent and would flatten the changelog's accumulated history on every
 * re-run. This prepends any dated section the page doesn't already carry and
 * leaves the rest alone, so re-running is safe and adding a release means
 * adding one entry to CHANGELOG_SECTIONS below.
 */

/** Newest first — the order they'll appear on the page. */
const CHANGELOG_SECTIONS = [
  `## August 3, 2026

### Screenshots and photos are their own way of adding
Adding from a picture used to be tucked in under three other methods as a
second, smaller uploader. It's now a method in its own right — "Screenshot
or photo" sits alongside pasting a list and uploading a file, with room to
add up to four pictures and an optional line of context to help the AI read
them ("these are all in Lisbon").

### A Paste button that works on a phone
Pasting a screenshot used to rely on Ctrl/Cmd-V, which doesn't exist on a
phone — so on iPhone and Android there was no way to paste at all. There's
now a Paste button next to the uploader that reads the clipboard directly.
It appears only where the browser actually allows it, and says what went
wrong when there's nothing on the clipboard to paste, rather than looking
broken.

### "Generate with AI" is just the prompt again
With pictures on their own screen, the AI screen is back to one job:
describe what you want and get suggestions to review.
`,
  `## July 29, 2026

### Tidier buttons on the map page
The "Add pins" button now sits on the same line as the like and share
controls instead of stacking above them on a phone, and the map's own
toolbar wraps neatly rather than running a button off the edge of the
screen. "Bulk add with AI" is now just "Add with AI", to match the "Add
pin" and "Add venue" buttons beside it.

### Choose how you're adding, in one clear step
The add screen now opens by asking how you want to add things — paste a
list, upload a file, generate with AI, search a venue, or drop a pin on the
map — as a set of cards, the same way the template picker works when you
create a collection. The old row of tabs was unreadable on a phone once
there were five of them.

### Screenshots and photos work everywhere
You can now paste a screenshot straight from your clipboard, drag an image
in, or pick up to four at once — on any of the add methods, not just the AI
one. Most screenshots live on the clipboard rather than as a file on your
computer, so pasting is now the quickest way to get a list of places out of
a chat, a post, or a photo of a menu.

### AI screenshot import is now on every plan
Reading places out of a screenshot used to be a paid-plan feature. It's now
available on the free plan too, using the same daily AI allowance as the
text prompts — plans differ on how many generations you get a day, not on
whether you can do it at all.

### Everything you add now lives in one place
Searching for a venue and dropping a pin on the map have joined pasting,
uploading, and AI suggestions on a single "Add items" screen. Anything you
add from any of them collects in one review list, so you can mix a pasted
list with a couple of venue searches and a dropped pin, tidy up the names,
and save the lot together.

### Bulk and AI adding are no longer hidden in a menu
Adding a whole list at once used to live behind an unlabelled menu, under
the name "Import pins". It now has its own button on every collection, a
shortcut from the map toolbar, and cards on an empty collection showing
each way in — and creating a new collection takes you straight there.

### Collections can hold links and recommendations, not just places
A collection no longer has to be a map. When you create one you can now
choose what it holds: **places** on a map as before, **links** — paste a
URL and its title, description, and image fill themselves in — or
**recommendations**, free-form entries for anything nameable, from books to
films to a good bakery. The choice is made once when you create the
collection, and everything after that adapts to it: the views, the wording,
the CSV export, and how items are added.

### Fixes for the new collection types
Pasting a link now fetches its preview reliably instead of occasionally
skipping it. Notifications say "Link added" or "Recommendation added"
rather than calling everything a pin. And the Back button while creating a
collection now steps back to the type picker rather than jumping all the
way home.
`,
];

/** The `## <date>` line a section leads with, used to tell if it's already on the page. */
function headingOf(section: string): string {
  const heading = section.split("\n", 1)[0].trim();
  if (!heading.startsWith("## ")) throw new Error(`Changelog section must start with a '## <date>' heading`);
  return heading;
}

const FEATURES_CONTENT = `## What you can collect

Not every list is a map. When you create a collection you choose what it
holds, and everything after that — the views, the wording, the way things
are added, the CSV export — adapts to your choice:

- **Places** — pins on a real map, with addresses, photos, and notes. The classic PinGather collection.
- **Links** — paste a URL and the page's title, description, and image fill themselves in.
- **Recommendations** — free-form entries for anything nameable: books, films, tools, dishes, places.

## Mapping & pins

- **Shareable collections** with a short, memorable link — no account needed to view or contribute, unless you want to require one.
- **Click-to-drop or search-to-add** pins, backed by place search so you can pin a real venue by name instead of guessing coordinates.
- **Custom note fields** — change the label and prompt so each collection asks contributors the right question for its purpose.
- **Photos per pin**, so a map shows what a place looks like, not just its name.
- **Social links** per pin (Twitter/X, Instagram, LinkedIn) for pins about people or businesses with an online presence.
- **Marker clustering** keeps dense maps readable as they grow.
- **Route/itinerary mode** — drag pins into a visiting order, see the distance between stops, and follow a driving-route line on the map.
- **Templates** for common map types: weekend trip, neighborhood guide, wedding guest list, team locations, event guide.

## Adding things

Every way of adding lives on one screen, reachable from any collection — pick a method, and whatever you add collects in a single review list you can edit before saving. Sources mix freely: paste a list, add a couple of venue searches, drop a pin, then save them together.

- **Paste a list** — one per line. Place names get looked up on Google Maps; links get their page title and image fetched automatically.
- **Screenshot or photo** — its own way of adding: upload, drag in, or tap Paste to take an image straight off your clipboard, up to four at a time, and AI reads the items out of them. The Paste button works on a phone, where there's no Ctrl+V. Available on every plan, within your daily AI allowance.
- **Upload a file** — a .txt, .csv, or .xlsx you already have.
- **Generate with AI** — describe a theme and get suggestions back to review before anything is saved.
- **Search a venue** — look a place up on Google Maps and add it, as many times as you like.
- **Drop on the map** — click exactly where you want a pin, with a confirmation step so a mis-aimed click costs nothing.

## Collaboration & permissions

- **Anonymous contribution** on public collections — no sign-up required to add something.
- **Approval mode** — contributions from anyone but the owner stay pending until approved, so a collection stays curated even when it's open.
- **Invite collaborators** by email with view or edit permissions.
- **Public/private** — keep a collection fully private, or share it with the world.

## Organization & export

- **Sortable, searchable item table** alongside every collection, with filters for pending/approved and your own entries vs. others'.
- **Private folders** for filing your own collections — visible only to you.
- **CSV export**, with columns that match what the collection holds.
- **Archiving** to tidy up your list without deleting anything (paid plans).

## Branding & customization

- **Custom pin colors and icons**, set per map or overridden per pin (paid plans).
- **Custom logo branding** on a collection's public page (paid plans).

## Discover & social

- **Public profiles** with a username, bio, and the collections you choose to show.
- **Follow** other users and **like** collections you find useful.
- **A personalized feed** of activity from people you follow.
- **Discover** — browse curated public maps by category, country, and city.

## Mobile

The PinGather mobile app (iOS & Android) covers the core of the experience — creating and browsing collections, adding and editing items with photos, route planning, Discover, and your profile and feed. Adding in bulk works there too: paste a list, describe what you want to AI, or hand it a screenshot or photo from your camera roll and let it read the items out. A collection you start on the web keeps working wherever you are.`;

interface Page {
  id: string;
  slug: string;
  content: string;
}

async function getPage(client: Awaited<ReturnType<typeof getSchemaClient>>, slug: string): Promise<Page> {
  const rows = (await client.request(
    readItems("map_pages", { filter: { slug: { _eq: slug } }, limit: 1 }),
  )) as unknown as Page[];
  const page = rows[0];
  if (!page) throw new Error(`No map_pages row with slug "${slug}"`);
  return page;
}

async function main() {
  const client = await getSchemaClient();

  const changelog = await getPage(client, "changelog");
  // Oldest first, so each prepend lands above the one before it and the page
  // ends up newest-first.
  const missing = CHANGELOG_SECTIONS.filter((section) => !changelog.content.includes(headingOf(section))).reverse();
  if (missing.length === 0) {
    console.log("Changelog already has every section — leaving it alone.");
  } else {
    let content = changelog.content;
    for (const section of missing) {
      // New entries go directly above the most recent existing date heading,
      // preserving everything below.
      const firstHeading = content.indexOf("\n## ");
      if (firstHeading === -1) throw new Error("Changelog has no '## <date>' heading to insert above");
      content = `${content.slice(0, firstHeading + 1)}\n${section}\n${content.slice(firstHeading + 1)}`;
    }
    await client.request(updateItem("map_pages", changelog.id, { content }));
    console.log(`Prepended to the changelog: ${missing.map(headingOf).reverse().join(", ")}`);
  }

  const features = await getPage(client, "features");
  if (features.content.trim() === FEATURES_CONTENT.trim()) {
    console.log("Features page already up to date.");
  } else {
    await client.request(updateItem("map_pages", features.id, { content: FEATURES_CONTENT }));
    console.log("Updated the features page.");
  }

  console.log("Done.");
}

// The SDK's auth refresh timer keeps the event loop alive, so exit
// explicitly — same ending as the other scripts in this directory.
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
