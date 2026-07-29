interface PinCsvRow {
  title: string;
  city?: string | null;
  town?: string | null;
  country?: string | null;
  postcode?: string | null;
  url?: string | null;
  twitterHandle?: string | null;
  instagramHandle?: string | null;
  linkedinHandle?: string | null;
  note?: string | null;
  createdAt: string;
}

/** Doubles embedded quotes (the CSV escaping rule) so a field containing one doesn't truncate the row it's in. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** itemType defaults to "location" for callers that haven't been updated — city/town/country/postcode columns just come out blank for "link"/"recommendation" pins, which never have them. */
export function downloadPinsCsv(pins: PinCsvRow[], noteLabel: string, itemType: "location" | "link" | "recommendation" = "location") {
  const csvContent = [
    ["Title", "Town", "Country", "Postcode", "Link", "Twitter", "Instagram", "LinkedIn", noteLabel, "Added Date"].join(","),
    ...pins.map(pin => [
      pin.title,
      [pin.city, pin.town].filter(Boolean).join(", ") || "",
      pin.country || "",
      pin.postcode || "",
      pin.url || "",
      pin.twitterHandle || "",
      pin.instagramHandle || "",
      pin.linkedinHandle || "",
      pin.note || "",
      new Date(pin.createdAt).toLocaleDateString(),
    ].map(csvField).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = itemType === "location" ? "map-pins.csv" : "collection-items.csv";
  a.click();
  URL.revokeObjectURL(url);
}
