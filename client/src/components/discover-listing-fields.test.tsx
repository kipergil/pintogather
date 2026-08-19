import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DiscoverListingFields, type DiscoverListingValue } from "./discover-listing-fields";

const UNFILED: DiscoverListingValue = {
  curatedCategory: null,
  curatedCountry: null,
  curatedCity: null,
  discoverStatus: "none",
};

const FILED: DiscoverListingValue = {
  curatedCategory: "food-drink",
  curatedCountry: "uk",
  curatedCity: "London",
  discoverStatus: "none",
};

function Harness({ initial = UNFILED }: { initial?: DiscoverListingValue }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DiscoverListingFields value={value} onChange={setValue} />
      <span data-testid="state">{JSON.stringify(value)}</span>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent!) as DiscoverListingValue;
const submitSwitch = () => screen.getByTestId("switch-discover-submit");

/** Radix Select doesn't respond to a plain click on an option in jsdom; keyboard selection does. */
async function pick(testId: string, optionLabel: string) {
  await userEvent.click(screen.getByTestId(testId));
  await userEvent.click(await screen.findByRole("option", { name: optionLabel }));
}

describe("filing a collection", () => {
  it("starts with nothing chosen and nothing submitted", () => {
    render(<Harness />);
    expect(state()).toEqual(UNFILED);
  });

  it("won't offer cities until a country is chosen", () => {
    render(<Harness />);
    expect(screen.getByTestId("select-discover-city")).toBeDisabled();
  });

  it("offers that country's cities once it is", async () => {
    render(<Harness initial={{ ...UNFILED, curatedCountry: "uk" }} />);
    await userEvent.click(screen.getByTestId("select-discover-city"));
    expect(await screen.findByRole("option", { name: "Manchester" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Paris" })).not.toBeInTheDocument();
  });

  it("clears the city when the country changes under it", async () => {
    // Otherwise a collection ends up filed as France / London, which no
    // Discover filter combination can ever reach.
    render(<Harness initial={FILED} />);
    await pick("select-discover-country", "France");
    expect(state().curatedCity).toBeNull();
    expect(state().curatedCountry).toBe("france");
  });
});

describe("asking to be featured", () => {
  it("can't be submitted before it's filed", () => {
    render(<Harness />);
    expect(submitSwitch()).toBeDisabled();
    expect(screen.getByTestId("text-discover-status")).toHaveTextContent(/choose a category, country, and city/i);
  });

  it("can be submitted once it is", async () => {
    render(<Harness initial={FILED} />);
    expect(submitSwitch()).toBeEnabled();
    await userEvent.click(submitSwitch());
    expect(state().discoverStatus).toBe("pending");
  });

  it("says a submission isn't live yet", () => {
    render(<Harness initial={{ ...FILED, discoverStatus: "pending" }} />);
    expect(screen.getByTestId("text-discover-status")).toHaveTextContent(/waiting for review/i);
  });

  it("lets a rejected collection ask again", async () => {
    render(<Harness initial={{ ...FILED, discoverStatus: "rejected" }} />);
    expect(screen.getByTestId("text-discover-status")).toHaveTextContent(/not accepted/i);
    await userEvent.click(submitSwitch());
    expect(state().discoverStatus).toBe("pending");
  });

  it("withdraws a live listing", async () => {
    render(<Harness initial={{ ...FILED, discoverStatus: "approved" }} />);
    expect(submitSwitch()).toBeChecked();
    await userEvent.click(submitSwitch());
    expect(state().discoverStatus).toBe("none");
  });

  it("leaves a live listing alone if you toggle it off and back on", async () => {
    // Turning it off then on again is a change of mind, not a resubmission
    // — coming back as "pending" would read as taken down and re-queued.
    render(<Harness initial={{ ...FILED, discoverStatus: "approved" }} />);
    await userEvent.click(submitSwitch());
    await userEvent.click(submitSwitch());
    expect(state().discoverStatus).toBe("approved");
  });
});
