import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateMapForm } from "./create-map-form";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", userGroup: "premium" }, loading: false }),
}));

const apiRequest = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  apiUpload: vi.fn(),
}));

const FILED = {
  curatedCategory: "food-drink",
  curatedCountry: "uk",
  curatedCity: "London",
} as const;

function renderForm(props: Parameters<typeof CreateMapForm>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateMapForm {...props} />
    </QueryClientProvider>,
  );
}

/** The body of the single PUT the form makes when saved. */
function savedPayload() {
  const call = apiRequest.mock.calls.find(([method]) => method === "PUT");
  return call?.[2] as Record<string, unknown>;
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({ json: async () => ({ id: "map-1", name: "Test", shareUrl: "abc" }) });
});

describe("what a first-time collection creator sees", () => {
  it("asks for a name and a description, and nothing else up front", () => {
    renderForm({ itemType: "location" });
    expect(screen.getByTestId("input-map-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-map-description")).toBeInTheDocument();
    // Everything else is folded away — this form used to open with two
    // switches and three settings groups before you'd typed anything.
    expect(screen.queryByTestId("switch-require-pin-approval")).not.toBeInTheDocument();
    expect(screen.queryByTestId("input-note-label")).not.toBeInTheDocument();
  });

  it("keeps the settings reachable, just closed", async () => {
    renderForm({ itemType: "location" });
    await userEvent.click(screen.getByTestId("button-toggle-visibility"));
    expect(screen.getByTestId("switch-require-pin-approval")).toBeChecked();
  });

  it("doesn't offer Discover for a collection that doesn't exist yet", () => {
    // There'd be nothing for a reviewer to look at — the collection is
    // created empty and filled on the next screen.
    renderForm({ itemType: "location" });
    expect(screen.queryByTestId("button-toggle-discover")).not.toBeInTheDocument();
  });
});

describe("filing an existing collection under Discover", () => {
  it("offers the section once the collection exists", () => {
    renderForm({ mapId: "map-1", initialValues: { name: "Test", shareUrl: "abc" } });
    expect(screen.getByTestId("button-toggle-discover")).toBeInTheDocument();
  });

  it("opens it already showing a collection that's been submitted", () => {
    renderForm({
      mapId: "map-1",
      initialValues: { name: "Test", discover: { ...FILED, discoverStatus: "pending" } },
    });
    expect(screen.getByTestId("badge-discover-status")).toHaveTextContent("Waiting for review");
    expect(screen.getByTestId("select-discover-category")).toBeInTheDocument();
  });

  it("saves the filing and the submission together", async () => {
    renderForm({
      mapId: "map-1",
      initialValues: { name: "Test", discover: { ...FILED, discoverStatus: "none" } },
    });
    await userEvent.click(screen.getByTestId("button-toggle-discover"));
    await userEvent.click(screen.getByTestId("switch-discover-submit"));
    await userEvent.click(screen.getByTestId("button-submit-map-form"));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload()).toMatchObject({ ...FILED, discoverStatus: "pending" });
  });

  it("doesn't quietly unlist a live collection on an unrelated save", async () => {
    // The form models "approved" as the switch being on, and turning it off
    // means withdraw. Saving without touching it must therefore say nothing
    // about the status at all — sending "none" would take the collection
    // off Discover because the owner renamed it.
    renderForm({
      mapId: "map-1",
      initialValues: { name: "Test", discover: { ...FILED, discoverStatus: "approved" } },
    });
    await userEvent.type(screen.getByTestId("input-map-name"), " updated");
    await userEvent.click(screen.getByTestId("button-submit-map-form"));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload()).not.toHaveProperty("discoverStatus");
    expect(savedPayload()).toMatchObject(FILED);
  });

  it("sends the withdrawal when the owner does turn it off", async () => {
    renderForm({
      mapId: "map-1",
      initialValues: { name: "Test", discover: { ...FILED, discoverStatus: "approved" } },
    });
    await userEvent.click(screen.getByTestId("switch-discover-submit"));
    await userEvent.click(screen.getByTestId("button-submit-map-form"));

    await waitFor(() => expect(savedPayload()).toBeDefined());
    expect(savedPayload()).toMatchObject({ discoverStatus: "none" });
  });
});
