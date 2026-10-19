import { describe, it, expect } from "vitest";
import {
  looksLikeUrl,
  hostnameOf,
  parseNameLines,
  parseUrlLines,
  parseText,
  parseFile,
  ITEM_NOUN,
} from "./item-parsing";
import { ITEM_TYPE } from "@shared/enums";

describe("looksLikeUrl", () => {
  it.each(["https://example.com", "http://example.com/path?q=1", "https://sub.example.co.uk/a#b"])(
    "accepts %s",
    (url) => expect(looksLikeUrl(url)).toBe(true),
  );

  it.each(["example.com", "not a url", "", "  ", "/relative/path"])("rejects %s", (value) =>
    expect(looksLikeUrl(value)).toBe(false),
  );

  it("rejects non-http schemes, so a javascript: or file: string can't be treated as a link", () => {
    expect(looksLikeUrl("javascript:alert(1)")).toBe(false);
    expect(looksLikeUrl("file:///etc/passwd")).toBe(false);
    expect(looksLikeUrl("data:text/html,hi")).toBe(false);
  });
});

describe("hostnameOf", () => {
  it("strips the scheme, path, and a leading www.", () => {
    expect(hostnameOf("https://www.example.com/a/b?c=1")).toBe("example.com");
    expect(hostnameOf("http://sub.example.com/")).toBe("sub.example.com");
  });

  it("returns the input unchanged when it isn't a URL", () => {
    expect(hostnameOf("just some text")).toBe("just some text");
  });
});

describe("parseNameLines", () => {
  it("splits on newlines and trims", () => {
    expect(parseNameLines("  Dishoom  \nBorough Market\n")).toEqual([
      { name: "Dishoom" },
      { name: "Borough Market" },
    ]);
  });

  it("keeps only the first CSV column", () => {
    expect(parseNameLines("Dishoom,London,4.5\nCeremony,Bristol")).toEqual([
      { name: "Dishoom" },
      { name: "Ceremony" },
    ]);
  });

  it("drops blank lines", () => {
    expect(parseNameLines("A\n\n   \nB")).toEqual([{ name: "A" }, { name: "B" }]);
  });

  it("handles CRLF line endings, as a Windows-saved file would have", () => {
    expect(parseNameLines("A\r\nB")).toEqual([{ name: "A" }, { name: "B" }]);
  });

  it("returns [] for empty input", () => {
    expect(parseNameLines("")).toEqual([]);
    expect(parseNameLines("   \n  ")).toEqual([]);
  });

  describe("pasted lists arrive decorated", () => {
    it("strips emoji from a name", () => {
      expect(parseNameLines("\u{1F35C} Ichiran Ramen\n\u2728 Dishoom \u{1F525}")).toEqual([
        { name: "Ichiran Ramen" },
        { name: "Dishoom" },
      ]);
    });

    it("strips the bullets and numbering a list was formatted with", () => {
      expect(parseNameLines("- Dishoom\n\u2022 Padella\n1. Brat\n2) Hoppers")).toEqual([
        { name: "Dishoom" },
        { name: "Padella" },
        { name: "Brat" },
        { name: "Hoppers" },
      ]);
    });

    it("drops a line that was nothing but decoration", () => {
      // A heading row of stars or a divider line is not an item.
      expect(parseNameLines("Dishoom\n\u2b50\u2b50\u2b50\n---\nPadella")).toEqual([
        { name: "Dishoom" },
        { name: "Padella" },
      ]);
    });

    it("leaves real content alone, accents and symbols included", () => {
      expect(parseNameLines("Caf\u00e9 Rouge\nBen & Jerry's\nBar 360\u00b0\n\u4e00\u862d\u30e9\u30fc\u30e1\u30f3")).toEqual([
        { name: "Caf\u00e9 Rouge" },
        { name: "Ben & Jerry's" },
        { name: "Bar 360\u00b0" },
        { name: "\u4e00\u862d\u30e9\u30fc\u30e1\u30f3" },
      ]);
    });
  });
});

describe("parseUrlLines", () => {
  it("extracts a bare URL per line, leaving no title", () => {
    expect(parseUrlLines("https://example.com/a\nhttps://example.com/b")).toEqual([
      { name: "", url: "https://example.com/a" },
      { name: "", url: "https://example.com/b" },
    ]);
  });

  it("keeps surrounding text as the working title", () => {
    // Pasted link lists are rarely clean; the leftover becomes the title
    // until the preview fetch replaces it.
    expect(parseUrlLines("Great read: https://example.com/a")).toEqual([
      { name: "Great read", url: "https://example.com/a" },
    ]);
  });

  it.each([
    ["a dash separator", "My title - https://example.com", "My title"],
    ["an em dash", "My title — https://example.com", "My title"],
    ["a pipe", "My title | https://example.com", "My title"],
    ["a trailing title", "https://example.com — My title", "My title"],
  ])("strips %s from the leftover title", (_label, line, expected) => {
    expect(parseUrlLines(line)[0]).toEqual({ name: expected, url: "https://example.com" });
  });

  it("keeps a line with no URL as a plain name", () => {
    expect(parseUrlLines("just a title")).toEqual([{ name: "just a title" }]);
  });

  it("takes only the first URL when a line has several", () => {
    const parsed = parseUrlLines("see https://a.example.com and https://b.example.com");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].url).toBe("https://a.example.com");
  });

  it("does not swallow a trailing quote or bracket into the URL", () => {
    expect(parseUrlLines('"https://example.com/a"')[0].url).toBe("https://example.com/a");
  });

  describe("pasted link lists arrive decorated", () => {
    it("strips emoji from the title but never from the URL", () => {
      expect(parseUrlLines("\u{1F4DA} Worth reading \u2728 https://example.com/a")).toEqual([
        { name: "Worth reading", url: "https://example.com/a" },
      ]);
    });

    it("leaves a URL that contains something emoji-adjacent exactly as pasted", () => {
      // A link is opaque: tidying a character out of one quietly breaks it.
      const url = "https://example.com/path\u2192next?q=a\u2022b";
      expect(parseUrlLines(url)[0].url).toBe(url);
    });

    it("keeps a bare URL whose line had nothing else on it", () => {
      expect(parseUrlLines("\u2022 https://example.com/a")).toEqual([
        { name: "", url: "https://example.com/a" },
      ]);
    });

    it("drops a line that was only decoration", () => {
      expect(parseUrlLines("https://example.com/a\n\u2728\u2728\nhttps://example.com/b")).toEqual([
        { name: "", url: "https://example.com/a" },
        { name: "", url: "https://example.com/b" },
      ]);
    });
  });
});

describe("parseText", () => {
  it("uses URL parsing for link collections", () => {
    expect(parseText("Title: https://example.com", "link")).toEqual([
      { name: "Title", url: "https://example.com" },
    ]);
  });

  it.each(["location", "recommendation"] as const)("uses name parsing for %s collections", (itemType) => {
    // A location collection resolves names through Google Places, so a URL
    // on the line is just part of the search string, not a link to fetch.
    expect(parseText("Dishoom,London", itemType)).toEqual([{ name: "Dishoom" }]);
  });
});

describe("parseFile", () => {
  const textFile = (content: string, name = "list.txt") =>
    new File([content], name, { type: "text/plain" });

  it("reads a .txt file as names", async () => {
    await expect(parseFile(textFile("Dishoom\nCeremony"), "location")).resolves.toEqual([
      { name: "Dishoom" },
      { name: "Ceremony" },
    ]);
  });

  it("reads a .csv file's first column", async () => {
    const file = textFile("Dishoom,London\nCeremony,Bristol", "venues.csv");
    await expect(parseFile(file, "location")).resolves.toEqual([{ name: "Dishoom" }, { name: "Ceremony" }]);
  });

  it("applies link parsing to a text file on a link collection", async () => {
    const file = textFile("Read this: https://example.com/a");
    await expect(parseFile(file, "link")).resolves.toEqual([
      { name: "Read this", url: "https://example.com/a" },
    ]);
  });
});

describe("ITEM_NOUN", () => {
  it("covers every item type with singular and plural forms", () => {
    for (const itemType of ITEM_TYPE) {
      expect(ITEM_NOUN[itemType].one.length).toBeGreaterThan(0);
      expect(ITEM_NOUN[itemType].many.length).toBeGreaterThan(0);
      expect(ITEM_NOUN[itemType].one).not.toBe(ITEM_NOUN[itemType].many);
    }
  });
});
