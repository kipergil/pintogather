import { describe, it, expect } from "vitest";
import { parseExtractedItems, EXTRACT_SYSTEM_PROMPTS } from "./extract-items.js";
import { ITEM_TYPE } from "../../shared/enums.js";
import { DESCRIPTION_MAX_CHARS } from "../../shared/text.js";

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

  describe("a note longer than the prompt asked for", () => {
    it("comes back within the limit rather than failing the import", () => {
      const note = "sentence ".repeat(400); // ~3600 characters
      const [item] = parseExtractedItems(JSON.stringify([{ name: "Item", note }]));

      expect(item.note!.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
      expect(item.note!.endsWith("\u2026")).toBe(true);
    });

    it("is left exactly as written when it already fits", () => {
      const note = "Go early — the queue after 7pm is brutal.";
      expect(parseExtractedItems(JSON.stringify([{ name: "Item", note }]))[0].note).toBe(note);
    });

    it("keeps a note of exactly the limit whole", () => {
      const note = "a".repeat(DESCRIPTION_MAX_CHARS);
      expect(parseExtractedItems(JSON.stringify([{ name: "Item", note }]))[0].note).toBe(note);
    });
  });

  describe("a name longer than the title column accepts", () => {
    it("is cut to 255 rather than failing the whole bulk insert", () => {
      // insertPinSchema caps title at 255; one overlong name used to reject
      // every item that came with it.
      const name = "x".repeat(400);
      expect(parseExtractedItems(JSON.stringify([{ name }]))[0].name).toHaveLength(255);
    });
  });

  describe("decoration the prompt asked it not to use", () => {
    it("strips emoji from a name", () => {
      expect(parseExtractedItems(JSON.stringify([{ name: "\u{1F35C} Ichiran Ramen \u2728" }]))).toEqual([
        { name: "Ichiran Ramen" },
      ]);
    });

    it("strips emoji from a note but keeps the sentence intact", () => {
      const parsed = parseExtractedItems(
        JSON.stringify([{ name: "Item", note: "\u2b50 Worth the queue, and the chai is excellent." }]),
      );
      expect(parsed[0].note).toBe("Worth the queue, and the chai is excellent.");
    });

    it("drops an item whose name was nothing but emoji", () => {
      expect(parseExtractedItems(JSON.stringify([{ name: "\u{1F525}\u{1F525}" }, { name: "Real" }]))).toEqual([
        { name: "Real" },
      ]);
    });

    it("cleans a bare string entry too", () => {
      expect(parseExtractedItems(JSON.stringify(["\u{1F4CD} Borough Market"]))).toEqual([
        { name: "Borough Market" },
      ]);
    });

    it("leaves a url alone, decoration-looking characters included", () => {
      const url = "https://example.com/a\u2022b";
      expect(parseExtractedItems(JSON.stringify([{ name: "Item", url }]))[0].url).toBe(url);
    });
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
