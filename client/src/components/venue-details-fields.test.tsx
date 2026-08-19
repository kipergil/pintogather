import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { VenueDetailsFields, type VenueDetails } from "./venue-details-fields";

const EMPTY: VenueDetails = {
  website: "",
  venueType: null,
  priceLevel: null,
  editorialSummary: "",
  city: "",
  state: "",
  town: "",
  borough: "",
  postcode: "",
  country: "",
};

const FROM_GOOGLE: VenueDetails = {
  ...EMPTY,
  website: "https://dishoom.com",
  venueType: "restaurant",
  priceLevel: 2,
  city: "London",
  country: "United Kingdom",
};

function Harness({ initial = EMPTY }: { initial?: VenueDetails }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <VenueDetailsFields value={value} onChange={setValue} noteLabel="Favourite dish" />
      <span data-testid="state">{JSON.stringify(value)}</span>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent!) as VenueDetails;

describe("what's visible before you open anything", () => {
  it("stays closed on a pin Google left blank", () => {
    render(<Harness />);
    expect(screen.queryByTestId("input-website")).not.toBeInTheDocument();
    expect(screen.queryByTestId("input-city")).not.toBeInTheDocument();
  });

  it("opens the venue section when the pin already carries those facts", () => {
    // Nobody should have to hunt for a setting whose effects they can see.
    render(<Harness initial={FROM_GOOGLE} />);
    expect(screen.getByTestId("input-website")).toHaveValue("https://dishoom.com");
  });

  it("keeps the address closed even so — it's the one you least often want", () => {
    render(<Harness initial={FROM_GOOGLE} />);
    expect(screen.queryByTestId("input-city")).not.toBeInTheDocument();
  });
});

describe("correcting what the import got wrong", () => {
  it("edits the website", async () => {
    render(<Harness initial={FROM_GOOGLE} />);
    const field = screen.getByTestId("input-website");
    await userEvent.clear(field);
    await userEvent.type(field, "https://moved.example");
    expect(state().website).toBe("https://moved.example");
  });

  it("changes the venue type", async () => {
    render(<Harness initial={FROM_GOOGLE} />);
    await userEvent.click(screen.getByTestId("select-venue-type"));
    await userEvent.click(await screen.findByRole("option", { name: "Cafe" }));
    expect(state().venueType).toBe("cafe");
  });

  it("clears a venue type Google guessed wrong", async () => {
    render(<Harness initial={FROM_GOOGLE} />);
    await userEvent.click(screen.getByTestId("select-venue-type"));
    await userEvent.click(await screen.findByRole("option", { name: "Not set" }));
    expect(state().venueType).toBeNull();
  });

  it("stores the price level as the number 0, not as 'nothing chosen'", async () => {
    // "Free" is level 0, which is falsy — the tempting `Number(v) || null`
    // would silently drop it.
    render(<Harness initial={FROM_GOOGLE} />);
    await userEvent.click(screen.getByTestId("select-price-level"));
    await userEvent.click(await screen.findByRole("option", { name: "Free" }));
    expect(state().priceLevel).toBe(0);
  });

  it("clears the price level", async () => {
    render(<Harness initial={FROM_GOOGLE} />);
    await userEvent.click(screen.getByTestId("select-price-level"));
    await userEvent.click(await screen.findByRole("option", { name: "Not set" }));
    expect(state().priceLevel).toBeNull();
  });

  it("edits an address part once the section is opened", async () => {
    render(<Harness initial={FROM_GOOGLE} />);
    await userEvent.click(screen.getByTestId("button-toggle-address"));
    await userEvent.type(screen.getByTestId("input-postcode"), "E1 6JJ");
    expect(state().postcode).toBe("E1 6JJ");
  });

  it("points the description at the collection's own word for the note", () => {
    render(<Harness initial={FROM_GOOGLE} />);
    expect(screen.getByTestId("input-editorial-summary")).toBeInTheDocument();
    expect(screen.getByText(/favourite dish/i)).toBeInTheDocument();
  });
});
