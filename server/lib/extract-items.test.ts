import { describe, it, expect } from "vitest";
import { parseExtractedItems, EXTRACT_SYSTEM_PROMPTS } from "./extract-items.js";
import { ITEM_TYPE } from "../../shared/enums.js";

describe("parseExtractedItems", () => {
  it("parses the object array the prompts ask for", () => {
    const raw = JSON.stringify([
      { name: "Dishoom", url: "https://dishoom.com", note: "Bombay cafe" },
      { name: "Borough Market" },
    ]);
    expect(parseExtractedItems(raw)).toEqual([
      { name: "Dishoom", url: "https://dishoom.com", note: "Bombay cafe" },
      { name: "Borough Market" },
    ]);
  });

  it("still parses a bare string array, for back-compat", () => {
    expect(parseExtractedItems('["Dishoom", "Borough Market"]')).toEqual([
      { name: "Dishoom" },
      { name: "Borough Market" },
    ]);
  });

  it("handles a mixed array of strings and objects", () => {
    const raw = '["Plain", {"name": "Rich", "note": "with a note"}]';
    expect(parseExtractedItems(raw)).toEqual([{ name: "Plain" }, { name: "Rich", note: "with a note" }]);
  });

  it("digs the array out of surrounding prose or markdown fences", () => {
    const raw = 'Here you go:\n```json\n[{"name": "Dishoom"}]\n```\nHope that helps!';
    expect(parseExtractedItems(raw)).toEqual([{ name: "Dishoom" }]);
  });

  it("drops entries with no usable name", () => {
    const raw = JSON.stringify([{ name: "" }, { name: "   " }, { note: "orphan note" }, { name: "Keeper" }]);
    expect(parseExtractedItems(raw)).toEqual([{ name: "Keeper" }]);
  });

  it("trims whitespace off every field", () => {
    const raw = JSON.stringify([{ name: "  Spaced  ", url: "  https://example.com  ", note: "  note  " }]);
    expect(parseExtractedItems(raw)).toEqual([
      { name: "Spaced", url: "https://example.com", note: "note" },
    ]);
  });

  it.each([
    ["relative", "/not-absolute"],
    ["protocol-relative", "//example.com"],
    ["javascript", "javascript:alert(1)"],
    ["file", "file:///etc/passwd"],
    ["nonsense", "just some words"],
  ])("drops a %s url rather than passing it on", (_label, url) => {
    // A non-absolute or non-http(s) URL would only fail the client's preview
    // fetch later with a confusing error, so it's stripped here.
    const parsed = parseExtractedItems(JSON.stringify([{ name: "Item", url }]));
    expect(parsed).toEqual([{ name: "Item" }]);
  });

  it.each(["http://example.com/x", "https://example.com/x?a=1#f"])("keeps the absolute url %s", (url) => {
    expect(parseExtractedItems(JSON.stringify([{ name: "Item", url }]))).toEqual([{ name: "Item", url }]);
  });

  it("omits an empty note rather than sending an empty string", () => {
    expect(parseExtractedItems(JSON.stringify([{ name: "Item", note: "   " }]))).toEqual([{ name: "Item" }]);
  });

  it.each([
    ["not json at all", "sorry, I can't help with that"],
    ["an empty array", "[]"],
    ["a JSON object rather than an array", '{"name": "Dishoom"}'],
    ["an empty string", ""],
  ])("returns [] for %s", (_label, raw) => {
    expect(parseExtractedItems(raw)).toEqual([]);
  });

  it("ignores non-object, non-string entries", () => {
    expect(parseExtractedItems("[null, 42, true, [], {\"name\": \"Real\"}]")).toEqual([{ name: "Real" }]);
  });
});

describe("EXTRACT_SYSTEM_PROMPTS", () => {
  it("covers every item type in both directions", () => {
    for (const itemType of ITEM_TYPE) {
      expect(EXTRACT_SYSTEM_PROMPTS[itemType]).toBeDefined();
      expect(EXTRACT_SYSTEM_PROMPTS[itemType].fromPrompt.length).toBeGreaterThan(0);
      expect(EXTRACT_SYSTEM_PROMPTS[itemType].fromImages.length).toBeGreaterThan(0);
    }
  });

  it("asks every prompt for the same JSON object shape", () => {
    // The client's staging pipeline treats all sources identically, which
    // only holds if every prompt requests the same contract.
    for (const itemType of ITEM_TYPE) {
      for (const prompt of Object.values(EXTRACT_SYSTEM_PROMPTS[itemType])) {
        expect(prompt).toContain('"name"');
        expect(prompt).toContain("JSON array");
      }
    }
  });

  it("gives each item type a genuinely different prompt", () => {
    const prompts = ITEM_TYPE.map((t) => EXTRACT_SYSTEM_PROMPTS[t].fromPrompt);
    expect(new Set(prompts).size).toBe(ITEM_TYPE.length);
  });
});
