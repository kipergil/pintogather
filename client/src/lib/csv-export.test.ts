import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadPinsCsv } from "./csv-export";

/**
 * downloadPinsCsv triggers a browser download rather than returning a
 * string, so these capture the Blob it builds and read the CSV back out.
 */
let captured: string | null = null;

beforeEach(() => {
  captured = null;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
    // Blob.text() is async and the caller is sync, so read the parts directly.
    captured = (blob as Blob & { __parts?: string }).__parts ?? null;
    return "blob:mock";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

  // Wrap Blob so the exact text handed to it is recoverable synchronously.
  const RealBlob = globalThis.Blob;
  vi.stubGlobal(
    "Blob",
    class extends RealBlob {
      __parts: string;
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        this.__parts = parts.join("");
      }
    },
  );

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const basePin = {
  title: "Dishoom",
  city: "London",
  country: "UK",
  postcode: "E1 6JJ",
  createdAt: "2026-01-15T10:00:00Z",
};

function rows(): string[] {
  return (captured ?? "").split("\n");
}

describe("downloadPinsCsv", () => {
  it("writes a header row with the collection's own note label", () => {
    downloadPinsCsv([basePin], "Why I love it");
    expect(rows()[0]).toContain("Why I love it");
    expect(rows()[0]).toContain("Title");
    expect(rows()[0]).toContain("Link");
  });

  it("writes one row per pin", () => {
    downloadPinsCsv([basePin, { ...basePin, title: "Ceremony" }], "Note");
    expect(rows()).toHaveLength(3);
  });

  it("quotes every field so a comma in the data can't split the row", () => {
    downloadPinsCsv([{ ...basePin, title: "Smith, Jones & Co" }], "Note");
    expect(rows()[1]).toContain('"Smith, Jones & Co"');
  });

  it("doubles embedded quotes rather than truncating the field", () => {
    downloadPinsCsv([{ ...basePin, title: 'The "Best" Cafe' }], "Note");
    expect(rows()[1]).toContain('"The ""Best"" Cafe"');
  });

  it("survives a newline inside a note without corrupting the file", () => {
    downloadPinsCsv([{ ...basePin, note: "line one\nline two" }], "Note");
    // The newline stays inside a quoted field, which is valid CSV; what
    // matters is that the field is quoted so a parser reads it as one cell.
    expect(captured).toContain('"line one\nline two"');
  });

  it("emits empty cells rather than 'null' or 'undefined' for absent fields", () => {
    downloadPinsCsv([{ title: "Bare", createdAt: "2026-01-15T10:00:00Z" }], "Note");
    expect(rows()[1]).not.toContain("null");
    expect(rows()[1]).not.toContain("undefined");
  });

  it("includes a link item's URL in the Link column", () => {
    downloadPinsCsv(
      [{ title: "An article", url: "https://example.com/a", createdAt: "2026-01-15T10:00:00Z" }],
      "Note",
      "link",
    );
    expect(rows()[1]).toContain("https://example.com/a");
  });

  it("leaves the geography columns blank for a recommendation item", () => {
    downloadPinsCsv([{ title: "Dune", note: "the novel", createdAt: "2026-01-15T10:00:00Z" }], "Note", "recommendation");
    const cells = rows()[1].split(",");
    // Title, Town, Country, Postcode, Link — the middle four are empty.
    expect(cells[0]).toBe('"Dune"');
    expect(cells.slice(1, 5)).toEqual(['""', '""', '""', '""']);
  });

  it("combines city and town into one Town cell", () => {
    downloadPinsCsv([{ ...basePin, city: "London", town: "Shoreditch" }], "Note");
    expect(rows()[1]).toContain('"London, Shoreditch"');
  });

  it("handles an empty pin list without producing a broken file", () => {
    downloadPinsCsv([], "Note");
    expect(rows()).toHaveLength(1);
  });
});
