import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SocialLinksFields, type SocialHandles } from "./social-links-fields";

const ME = { twitterHandle: "mypersonal", instagramHandle: "my.personal", linkedinHandle: "in/me" };

let currentUser: Record<string, unknown> | null = { ...ME };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

const apiRequest = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

/** Answers the discovery call with whatever the venue's site "linked to". */
function venueLinks(suggestions: Record<string, string>) {
  apiRequest.mockResolvedValue({ json: async () => ({ suggestions }) });
}

const empty: SocialHandles = { twitterHandle: "", instagramHandle: "", linkedinHandle: "" };

function Harness({ website, initial = empty }: { website?: string | null; initial?: SocialHandles }) {
  const [value, setValue] = useState(initial);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <SocialLinksFields value={value} onChange={setValue} website={website} />
      <span data-testid="state">{JSON.stringify(value)}</span>
    </QueryClientProvider>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent!) as SocialHandles;

beforeEach(() => {
  currentUser = { ...ME };
  apiRequest.mockReset();
  venueLinks({});
});
afterEach(() => vi.clearAllMocks());

describe("nothing is filled in on its own", () => {
  it("leaves every field empty on mount, even though the viewer has handles", async () => {
    // The bug this replaces: a restaurant's pin silently carried the
    // contributor's personal Instagram, and you had to notice the populated
    // field to know it had happened.
    render(<Harness website={null} />);
    expect(state()).toEqual(empty);
  });

  it("doesn't apply discovered handles without a click", async () => {
    venueLinks({ twitter: "thevenue", instagram: "the.venue" });
    render(<Harness website="https://venue.example" />);
    await screen.findByTestId("social-suggestions");
    expect(state()).toEqual(empty);
  });
});

describe("the viewer's own handles, on demand", () => {
  it("fills them in when asked", async () => {
    render(<Harness website={null} />);
    await userEvent.click(screen.getByTestId("button-use-my-socials"));
    expect(state()).toEqual(ME);
  });

  it("offers nothing to a viewer who has no handles saved", () => {
    currentUser = {};
    render(<Harness website={null} />);
    expect(screen.queryByTestId("button-use-my-socials")).not.toBeInTheDocument();
  });

  it("offers nothing to a signed-out contributor", () => {
    currentUser = null;
    render(<Harness website={null} />);
    expect(screen.queryByTestId("button-use-my-socials")).not.toBeInTheDocument();
  });
});

describe("suggestions from the venue's website", () => {
  it("asks the server once, with the venue's site", async () => {
    venueLinks({ twitter: "thevenue" });
    render(<Harness website="https://venue.example" />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/social-suggestions", {
      website: "https://venue.example",
    });
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask at all when the venue has no website", () => {
    render(<Harness website={null} />);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("applies one handle when its chip is clicked, leaving the others alone", async () => {
    venueLinks({ twitter: "thevenue", instagram: "the.venue" });
    render(<Harness website="https://venue.example" />);
    await userEvent.click(await screen.findByTestId("button-accept-twitter"));
    expect(state()).toEqual({ ...empty, twitterHandle: "thevenue" });
  });

  it("applies all of them at once", async () => {
    venueLinks({ twitter: "thevenue", instagram: "the.venue", linkedin: "company/the-venue" });
    render(<Harness website="https://venue.example" />);
    await userEvent.click(await screen.findByTestId("button-accept-all-socials"));
    expect(state()).toEqual({
      twitterHandle: "thevenue",
      instagramHandle: "the.venue",
      linkedinHandle: "company/the-venue",
    });
  });

  it("can be dismissed", async () => {
    venueLinks({ twitter: "thevenue" });
    render(<Harness website="https://venue.example" />);
    await userEvent.click(await screen.findByTestId("button-dismiss-socials"));
    expect(screen.queryByTestId("social-suggestions")).not.toBeInTheDocument();
    expect(state()).toEqual(empty);
  });

  it("shows nothing when the site linked no accounts", async () => {
    venueLinks({});
    render(<Harness website="https://venue.example" />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.queryByTestId("social-suggestions")).not.toBeInTheDocument();
  });

  it("stays quiet when discovery fails outright", async () => {
    // A venue with a dead website means "no suggestions", not an error on a
    // form the person didn't ask to interact with.
    apiRequest.mockRejectedValue(new Error("unreachable"));
    render(<Harness website="https://gone.example" />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.queryByTestId("social-suggestions")).not.toBeInTheDocument();
  });

  it("doesn't offer a handle the field already holds", async () => {
    venueLinks({ twitter: "thevenue", instagram: "the.venue" });
    render(<Harness website="https://venue.example" initial={{ ...empty, twitterHandle: "thevenue" }} />);
    await screen.findByTestId("social-suggestions");
    expect(screen.queryByTestId("button-accept-twitter")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-accept-instagram")).toBeInTheDocument();
  });
});

describe("typing by hand", () => {
  it("still works", async () => {
    render(<Harness website={null} />);
    await userEvent.type(screen.getByTestId("input-twitter"), "typedbyhand");
    expect(state().twitterHandle).toBe("typedbyhand");
  });
});
