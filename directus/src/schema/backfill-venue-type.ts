import { readFieldsByCollection, readItems, updateField, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { VENUE_TYPE, VENUE_TYPE_LABELS, type VenueType } from "../../../shared/enums.js";

/**
 * One-time historical fix, run once this repo's schema had a plain-text
 * `pins.venue_type` field (added before VENUE_TYPE existed as a curated
 * Directus dropdown enum). `apply.ts`'s field bootstrapping is
 * create-only — it never updates an already-existing field's meta — so
 * flipping venue_type's `definitions.ts` entry from textField to
 * selectField had no effect on the live instance until this script
 * patched the existing field's interface/options directly.
 *
 * Also backfills every pre-existing pin's venue_type from Google Places,
 * on a best-effort basis: pins whose google_maps_url embeds a place_id
 * get an exact Place Details lookup; pins with a URL but no place_id (or
 * no URL at all) fall back to a Find Place From Text search, accepted
 * only when the result's name closely matches the pin's own name — a
 * mismatch there is worse than leaving venue_type null. Safe to re-run:
 * it only touches pins still sitting at venue_type: null.
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY must be set in the environment to run this backfill.");
}

interface PinRow {
  id: string;
  user_name: string;
  latitude: string;
  longitude: string;
  google_maps_url: string | null;
}

function extractPlaceId(googleMapsUrl: string | null): string | null {
  if (!googleMapsUrl) return null;
  const match = googleMapsUrl.match(/query_place_id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractQueryText(googleMapsUrl: string | null): string | null {
  if (!googleMapsUrl) return null;
  const match = googleMapsUrl.match(/[?&]query=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
}

/** Walks VENUE_TYPE's own order (not the API response's) so ties resolve deterministically — see the matching client helper's comment for why. */
function pickVenueType(types: string[] | undefined): VenueType | null {
  if (!types) return null;
  const placeTypes = new Set(types);
  return VENUE_TYPE.find((venueType) => placeTypes.has(venueType)) ?? null;
}

/** Loose match: same normalized text, or one contains the other — good enough to reject an obviously-wrong Find Place result without being so strict it rejects trivial punctuation/casing differences. */
function namesLooselyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function getTypesByPlaceId(placeId: string): Promise<string[] | undefined> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=types&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = (await res.json()) as { status: string; result?: { types?: string[] } };
  if (data.status !== "OK") return undefined;
  return data.result?.types;
}

async function findPlace(
  input: string,
  locationBias?: { lat: number; lng: number },
): Promise<{ name: string; types: string[] } | undefined> {
  const params = new URLSearchParams({
    input,
    inputtype: "textquery",
    fields: "name,types",
    key: GOOGLE_MAPS_API_KEY!,
  });
  if (locationBias) params.set("locationbias", `circle:500@${locationBias.lat},${locationBias.lng}`);
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`);
  const data = (await res.json()) as { status: string; candidates?: { name: string; types?: string[] }[] };
  if (data.status !== "OK" || !data.candidates?.length) return undefined;
  const top = data.candidates[0];
  return top.types ? { name: top.name, types: top.types } : undefined;
}

async function resolveVenueType(pin: PinRow): Promise<VenueType | null> {
  const placeId = extractPlaceId(pin.google_maps_url);
  if (placeId) {
    const types = await getTypesByPlaceId(placeId);
    return pickVenueType(types);
  }

  const queryText = extractQueryText(pin.google_maps_url);
  if (queryText) {
    const found = await findPlace(queryText);
    if (found && namesLooselyMatch(found.name, pin.user_name)) {
      return pickVenueType(found.types);
    }
    return null;
  }

  const lat = Number(pin.latitude);
  const lng = Number(pin.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const found = await findPlace(pin.user_name, { lat, lng });
    if (found && namesLooselyMatch(found.name, pin.user_name)) {
      return pickVenueType(found.types);
    }
  }
  return null;
}

async function main() {
  const client = await getSchemaClient();

  console.log("Updating pins.venue_type field to a select-dropdown (was plain text)...");
  const fields = await client.request(readFieldsByCollection("pins"));
  const venueTypeField = fields.find((f) => f.field === "venue_type");
  if (venueTypeField) {
    await client.request(
      updateField("pins", "venue_type", {
        meta: {
          interface: "select-dropdown",
          options: { choices: VENUE_TYPE.map((value) => ({ text: VENUE_TYPE_LABELS[value], value })) },
          display: "labels",
        },
      }),
    );
    console.log("  field meta updated.");
  } else {
    console.log("  pins.venue_type doesn't exist yet — run `npm run schema:apply` first.");
    return;
  }

  console.log("Finding pins with venue_type: null...");
  const pins = (await client.request(
    readItems("pins", {
      filter: { venue_type: { _null: true } },
      fields: ["id", "user_name", "latitude", "longitude", "google_maps_url"],
      limit: -1,
    }),
  )) as PinRow[];

  console.log(`Found ${pins.length} pin(s) to backfill.`);
  let matched = 0;
  let skipped = 0;
  let errored = 0;

  for (const pin of pins) {
    try {
      const venueType = await resolveVenueType(pin);
      if (venueType) {
        await client.request(updateItem("pins", pin.id, { venue_type: venueType }));
        matched++;
        console.log(`  + ${pin.user_name} -> ${venueType}`);
      } else {
        skipped++;
      }
    } catch (error) {
      errored++;
      console.error(`  ! ${pin.user_name}:`, error);
    }
    // Stay well under Google's rate limits — this is a one-time job, not latency-sensitive.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(`Backfill complete — ${matched} matched, ${skipped} skipped (no confident match), ${errored} errored.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
