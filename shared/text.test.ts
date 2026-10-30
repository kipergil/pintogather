import { describe, it, expect } from "vitest";
import { DESCRIPTION_MAX_CHARS, stripDecoration, stripLineDecoration, truncateDescription } from "./text.js";

describe("stripDecoration", () => {
  it.each([
    ["🍜 Ichiran Ramen Shibuya", "Ichiran Ramen Shibuya"],
    ["Dishoom Shoreditch 🔥🔥", "Dishoom Shoreditch"],
    ["✨ Hidden gem ✨", "Hidden gem"],
    ["Padella ⭐⭐⭐⭐⭐", "Padella"],
    ["👨‍👩‍👧‍👦 Family spot", "Family spot"],
    ["Flag test 🇬🇧", "Flag test"],
    ["1️⃣ First stop", "First stop"],
    ["✓ Booked", "Booked"],
    ["➤ Next one", "Next one"],
    ["Bar │ Soho", "Bar Soho"],
  ])("strips decoration from %s", (input, expected) => {
    expect(stripDecoration(input)).toBe(expected);
  });

  it("removes zero-width characters, which are invisible but still count as length", () => {
    // Removed outright, not turned into a gap: a zero-width space sits
    // inside a word, so replacing it with one would split the name in two.
    expect(stripDecoration("Dis​hoom")).toBe("Dishoom");
    expect(stripDecoration("‎‏Brat‎")).toBe("Brat");
  });

  it("collapses the gap a removed emoji leaves mid-string", () => {
    expect(stripDecoration("Brat 🍴 Hackney")).toBe("Brat Hackney");
  });

  describe("what it must not touch", () => {
    it.each([
      "Café Rouge",
      "Nando's",
      "Bar 360°",
      "Ben & Jerry's",
      "Dishoom — Shoreditch",
      "£15 set menu",
      "Noma 2.0",
      "一蘭ラーメン",
      "Döner & Gyros",
      "Tony's Trademark™",
    ])("leaves %s alone", (name) => {
      expect(stripDecoration(name)).toBe(name);
    });

    it("keeps a sentence's own punctuation, since notes are prose", () => {
      const note = "Go early — the queue after 7pm is brutal, and they don't take bookings.";
      expect(stripDecoration(note)).toBe(note);
    });
  });

  it("returns empty for a line that was nothing but emoji", () => {
    expect(stripDecoration("🍜🔥✨")).toBe("");
  });
});

describe("stripLineDecoration", () => {
  it.each([
    ["- Dishoom", "Dishoom"],
    ["• Padella", "Padella"],
    ["* Brat", "Brat"],
    ["1. Ichiran Ramen", "Ichiran Ramen"],
    ["2) Tonkotsu", "Tonkotsu"],
    ["› Hoppers", "Hoppers"],
    ["— Barrafina", "Barrafina"],
    ["  •  🍣 Sushi Tetsu  ", "Sushi Tetsu"],
    ["1. 🍜 Ichiran — ", "Ichiran"],
  ])("strips list furniture from %s", (input, expected) => {
    expect(stripLineDecoration(input)).toBe(expected);
  });

  it("leaves a number that's part of the name", () => {
    expect(stripLineDecoration("1984 Bar")).toBe("1984 Bar");
    expect(stripLineDecoration("28°-50° Wine Workshop")).toBe("28°-50° Wine Workshop");
  });

  it("strips a separator stranded by a removed trailing icon", () => {
    expect(stripLineDecoration("Dishoom — ✨")).toBe("Dishoom");
    expect(stripLineDecoration("Padella:")).toBe("Padella");
  });

  it("is empty for a line with nothing but furniture", () => {
    expect(stripLineDecoration("- • ✨")).toBe("");
    expect(stripLineDecoration("---")).toBe("");
  });
});

describe("truncateDescription", () => {
  it("leaves text within the limit exactly as it is", () => {
    expect(truncateDescription("Short and sweet.")).toBe("Short and sweet.");
  });

  it("leaves text of exactly the limit alone", () => {
    const exact = "a".repeat(DESCRIPTION_MAX_CHARS);
    expect(truncateDescription(exact)).toBe(exact);
  });

  it("never returns more than the limit, ellipsis included", () => {
    const long = "word ".repeat(500);
    const result = truncateDescription(long);
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(result.endsWith("…")).toBe(true);
  });

  it("cuts at a word boundary rather than mid-word", () => {
    expect(truncateDescription("alpha bravo charlie delta", 18)).toBe("alpha bravo…");
  });

  it("cuts mid-word rather than returning almost nothing, when there's no boundary to use", () => {
    // A long URL or a Chinese sentence has no spaces to break at; coming
    // back as a lone ellipsis would be worse than a hard cut.
    const result = truncateDescription(`short ${"x".repeat(80)}`, 40);
    expect(result).toHaveLength(40);
    expect(result).toContain("xxx");
  });

  it("doesn't leave a dangling separator in front of the ellipsis", () => {
    expect(truncateDescription("alpha bravo, charlie", 15)).toBe("alpha bravo…");
  });

  it("honours a caller's own limit", () => {
    expect(truncateDescription("alpha bravo charlie", 11)).toHaveLength(11);
  });

  it("trims before measuring, so trailing whitespace can't trip the limit", () => {
    const padded = `${"a".repeat(DESCRIPTION_MAX_CHARS)}     `;
    expect(truncateDescription(padded)).toHaveLength(DESCRIPTION_MAX_CHARS);
  });
});
