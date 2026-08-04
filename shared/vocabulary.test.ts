import { describe, it, expect } from "vitest";
import { ITEM_TYPE } from "./enums.js";
import {
  COLLECTION_NOUN,
  GENERIC_ITEM_NOUN,
  ITEM_NOUN,
  addLabel,
  itemNoun,
  pluralize,
} from "./vocabulary.js";

describe("COLLECTION_NOUN", () => {
  it("is 'collection', not 'map'", () => {
    // The whole point of this module: a links collection has no map in it,
    // so the container can't be called one.
    expect(COLLECTION_NOUN.one).toBe("collection");
    expect(COLLECTION_NOUN.many).toBe("collections");
  });
});

describe("ITEM_NOUN", () => {
  it.each(ITEM_TYPE)("has a distinct singular and plural for %s", (itemType) => {
    expect(ITEM_NOUN[itemType].one).toBeTruthy();
    expect(ITEM_NOUN[itemType].many).toBeTruthy();
    expect(ITEM_NOUN[itemType].one).not.toBe(ITEM_NOUN[itemType].many);
  });

  it("only says 'pin' for a collection of places", () => {
    expect(ITEM_NOUN.location.one).toBe("pin");
    for (const itemType of ITEM_TYPE) {
      if (itemType === "location") continue;
      expect(ITEM_NOUN[itemType].one).not.toContain("pin");
      expect(ITEM_NOUN[itemType].many).not.toContain("pin");
    }
  });

  it("gives every type its own word rather than sharing a generic one", () => {
    const words = ITEM_TYPE.map((t) => ITEM_NOUN[t].many);
    expect(new Set(words).size).toBe(ITEM_TYPE.length);
    expect(words).not.toContain(GENERIC_ITEM_NOUN.many);
  });
});

describe("itemNoun", () => {
  it.each(ITEM_TYPE)("returns the specific noun for %s", (itemType) => {
    expect(itemNoun(itemType)).toEqual(ITEM_NOUN[itemType]);
  });

  it.each([undefined, null])("falls back to the neutral word for %s", (missing) => {
    // Reached while a collection is still loading — "items" is vague but
    // never wrong, which "pins" would be.
    expect(itemNoun(missing)).toEqual(GENERIC_ITEM_NOUN);
  });
});

describe("pluralize", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralize(1, ITEM_NOUN.link)).toBe("1 link");
  });

  it.each([0, 2, 17])("uses the plural for %i", (count) => {
    expect(pluralize(count, ITEM_NOUN.link)).toBe(`${count} links`);
  });

  it("reads correctly for every type", () => {
    expect(pluralize(3, ITEM_NOUN.location)).toBe("3 pins");
    expect(pluralize(1, ITEM_NOUN.recommendation)).toBe("1 recommendation");
  });
});

describe("addLabel", () => {
  it.each([
    ["location", "Add pins"],
    ["link", "Add links"],
    ["recommendation", "Add recommendations"],
  ] as const)("labels the %s button %s", (itemType, expected) => {
    expect(addLabel(itemType)).toBe(expected);
  });

  it("stays type-neutral before the collection has loaded", () => {
    expect(addLabel(undefined)).toBe("Add items");
  });
});
