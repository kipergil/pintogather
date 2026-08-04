import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AddMethodsEmptyState } from "./add-methods-empty-state";
import { ITEM_TYPE } from "@shared/enums";
import { methodMeta } from "./add-method-picker";

function renderAt(ui: React.ReactElement) {
  const { hook } = memoryLocation({ path: "/map/abc123" });
  return render(<Router hook={hook}>{ui}</Router>);
}

describe("<AddMethodsEmptyState />", () => {
  it("offers all four add methods to someone who can add", () => {
    renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType="location" canAdd />);
    expect(screen.getByTestId("button-empty-method-paste")).toBeInTheDocument();
    expect(screen.getByTestId("button-empty-method-image")).toBeInTheDocument();
    expect(screen.getByTestId("button-empty-method-file")).toBeInTheDocument();
    expect(screen.getByTestId("button-empty-method-ai")).toBeInTheDocument();
  });

  it("deep-links each card to its own panel in the add hub", () => {
    const { container } = renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType="location" canAdd />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/map/abc123/add?method=paste",
      "/map/abc123/add?method=image",
      "/map/abc123/add?method=file",
      "/map/abc123/add?method=ai",
    ]);
  });

  it("shows a plain message instead of cards when the viewer can't add", () => {
    // Method cards would dead-end at a sign-in wall for a signed-out visitor.
    renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType="location" canAdd={false} />);
    expect(screen.getByTestId("empty-state-signed-out")).toBeInTheDocument();
    expect(screen.queryByTestId("button-empty-method-ai")).not.toBeInTheDocument();
  });

  it.each([
    ["location", "pins"],
    // Not "items": the collection's own noun is what F11 fixed — a links
    // collection saying "add your first items" was the generic fallback.
    ["link", "links"],
    ["recommendation", "recommendations"],
  ] as const)("uses the right noun in the heading for a %s collection", (itemType, expected) => {
    renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType={itemType} canAdd />);
    expect(screen.getByText(new RegExp(`add your first ${expected}`, "i"))).toBeInTheDocument();
  });

  it.each(ITEM_TYPE)("renders without crashing for every item type (%s)", (itemType) => {
    renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType={itemType} canAdd />);
    expect(screen.getByTestId("empty-state-add-methods")).toBeInTheDocument();
  });

  it("describes the paste method using the collection's own vocabulary", () => {
    renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType="link" canAdd />);
    const card = screen.getByTestId("button-empty-method-paste");
    expect(card).toHaveTextContent(/link/i);
    expect(card).not.toHaveTextContent(/pin/i);
  });

  it("shares its wording with the add hub's picker, so the two can't drift", () => {
    renderAt(<AddMethodsEmptyState shareUrl="abc123" itemType="location" canAdd />);
    expect(screen.getByTestId("button-empty-method-paste")).toHaveTextContent(
      methodMeta("paste", "location").description,
    );
  });
});
