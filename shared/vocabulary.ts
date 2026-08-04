import type { ItemType } from "./enums.js";

/**
 * The words the product uses for its own concepts, in one place.
 *
 * Two nouns matter, and they used to be tangled together:
 *
 *  - The **container** a user creates. It's a "collection" — not a "map".
 *    A links collection has no map in it at all, and calling the container a
 *    map left half the interface describing something that wasn't on screen.
 *    "Map" now means only the actual Google Map inside a place collection.
 *  - The **item** inside it, which does vary by type: a pin, a link, or a
 *    recommendation.
 *
 * Everything user-facing reads from here rather than hardcoding either.
 * Shared rather than client-local because the Expo app needs the same words,
 * and drift between the two is exactly what this file exists to stop.
 */

/** The container. Deliberately type-independent — a collection is a collection whatever it holds. */
export const COLLECTION_NOUN = { one: "collection", many: "collections" } as const;

export interface Noun {
  one: string;
  many: string;
}

/** What a single entry is called, per collection type. */
export const ITEM_NOUN: Record<ItemType, Noun> = {
  location: { one: "pin", many: "pins" },
  link: { one: "link", many: "links" },
  recommendation: { one: "recommendation", many: "recommendations" },
};

/**
 * The type-neutral word for entries, for places that span collections of
 * different types — a total on a profile, a sort option over a mixed list,
 * a plan quota. Never use this where the type is known; use ITEM_NOUN.
 */
export const GENERIC_ITEM_NOUN: Noun = { one: "item", many: "items" };

/** `count` with the right singular/plural, e.g. "1 pin", "4 links". */
export function pluralize(count: number, noun: Noun): string {
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

/** The item noun for a collection type, falling back to the neutral word when the type isn't known yet. */
export function itemNoun(itemType: ItemType | undefined | null): Noun {
  return itemType ? ITEM_NOUN[itemType] : GENERIC_ITEM_NOUN;
}

/**
 * What someone is invited to do with a collection, used in copy like
 * "Add links" or "You'll be able to add and edit pins".
 */
export function addLabel(itemType: ItemType | undefined | null): string {
  return `Add ${itemNoun(itemType).many}`;
}
