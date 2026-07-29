import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddMethodPicker, methodsFor, parseMethodParam, methodTitle } from "./add-method-picker";
import { ITEM_TYPE } from "@shared/enums";

describe("methodsFor", () => {
  it("offers all five ways on a map of locations", () => {
    expect(methodsFor("location")).toEqual(["paste", "file", "ai", "venue", "map"]);
  });

  it.each(["link", "recommendation"] as const)(
    "hides venue search and drop-on-map for a %s collection",
    (itemType) => {
      // Neither means anything without coordinates.
      expect(methodsFor(itemType)).toEqual(["paste", "file", "ai"]);
    },
  );
});

describe("parseMethodParam", () => {
  it("returns undefined when absent, so the picker shows", () => {
    expect(parseMethodParam(null, "location")).toBeUndefined();
    expect(parseMethodParam("", "location")).toBeUndefined();
  });

  it("returns undefined for a value that isn't a method", () => {
    expect(parseMethodParam("nonsense", "location")).toBeUndefined();
  });

  it.each(["paste", "file", "ai", "venue", "map"] as const)("accepts %s on a location map", (method) => {
    expect(parseMethodParam(method, "location")).toBe(method);
  });

  it.each(["venue", "map"] as const)(
    "falls back to the picker for %s on a link collection rather than showing an empty panel",
    (method) => {
      expect(parseMethodParam(method, "link")).toBeUndefined();
    },
  );
});

describe("<AddMethodPicker />", () => {
  it("renders a card per available method", () => {
    render(<AddMethodPicker itemType="location" onSelect={vi.fn()} />);
    for (const method of methodsFor("location")) {
      expect(screen.getByTestId(`card-method-${method}`)).toBeInTheDocument();
    }
  });

  it("shows only the three universal methods for a link collection", () => {
    render(<AddMethodPicker itemType="link" onSelect={vi.fn()} />);
    expect(screen.getByTestId("card-method-paste")).toBeInTheDocument();
    expect(screen.queryByTestId("card-method-venue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-method-map")).not.toBeInTheDocument();
  });

  it("reports the chosen method to the caller", async () => {
    const onSelect = vi.fn();
    render(<AddMethodPicker itemType="location" onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("card-method-ai"));
    expect(onSelect).toHaveBeenCalledWith("ai");
  });

  it("uses the collection's own noun in the heading", () => {
    render(<AddMethodPicker itemType="recommendation" onSelect={vi.fn()} />);
    expect(screen.getByText(/add recommendations\?/i)).toBeInTheDocument();
  });

  it("describes pasting differently for a link collection", () => {
    render(<AddMethodPicker itemType="link" onSelect={vi.fn()} />);
    expect(screen.getByTestId("card-method-paste")).toHaveTextContent(/one link per line/i);
  });

  it.each(ITEM_TYPE)("renders without crashing for every item type (%s)", (itemType) => {
    render(<AddMethodPicker itemType={itemType} onSelect={vi.fn()} />);
    expect(screen.getByTestId("add-method-picker")).toBeInTheDocument();
  });

  it("gives every method a title for the panel header", () => {
    for (const method of methodsFor("location")) {
      expect(methodTitle(method).length).toBeGreaterThan(0);
    }
  });
});
