import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

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
  createdAt: string | Date;
}

/**
 * Same column layout as client/src/lib/csv-export.ts's downloadPinsCsv, but
 * written via expo-file-system's File API + shared via expo-sharing instead
 * of a Blob/URL.createObjectURL download link — there's no browser download
 * mechanism on native, so the OS share sheet (Save to Files, AirDrop, email,
 * etc.) is the mobile equivalent of "downloading" a file.
 */
export async function sharePinsCsv(pins: PinCsvRow[], noteLabel: string): Promise<void> {
  const csvContent = [
    ["Name", "Town", "Country", "Postcode", "Twitter", "Instagram", "LinkedIn", noteLabel, "Added Date"].join(","),
    ...pins.map((pin) =>
      [
        pin.userName,
        [pin.city, pin.town].filter(Boolean).join(", ") || "",
        pin.country || "",
        pin.postcode || "",
        pin.twitterHandle || "",
        pin.instagramHandle || "",
        pin.linkedinHandle || "",
        pin.note || "",
        new Date(pin.createdAt).toLocaleDateString(),
      ]
        .map((field) => `"${field}"`)
        .join(","),
    ),
  ].join("\n");

  const file = new File(Paths.cache, "map-pins.csv");
  file.create({ overwrite: true });
  file.write(csvContent);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export pins" });
  }
}
