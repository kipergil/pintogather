interface PinCsvRow {
  userName: string;
  city?: string | null;
  town?: string | null;
  country?: string | null;
  postcode?: string | null;
  twitterHandle?: string | null;
  instagramHandle?: string | null;
  linkedinHandle?: string | null;
  note?: string | null;
  createdAt: string;
}

export function downloadPinsCsv(pins: PinCsvRow[], noteLabel: string) {
  const csvContent = [
    ["Name", "Town", "Country", "Postcode", "Twitter", "Instagram", "LinkedIn", noteLabel, "Added Date"].join(","),
    ...pins.map(pin => [
      pin.userName,
      [pin.city, pin.town].filter(Boolean).join(", ") || "",
      pin.country || "",
      pin.postcode || "",
      pin.twitterHandle || "",
      pin.instagramHandle || "",
      pin.linkedinHandle || "",
      pin.note || "",
      new Date(pin.createdAt).toLocaleDateString(),
    ].map(field => `"${field}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "map-pins.csv";
  a.click();
  URL.revokeObjectURL(url);
}
