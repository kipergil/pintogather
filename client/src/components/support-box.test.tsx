import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const KOFI = "https://ko-fi.com/kipergil";
let supportUrl = KOFI;

vi.mock("@/lib/branding", () => ({
  APP_NAME: "PinGather",
  get SUPPORT_URL() {
    return supportUrl;
  },
}));

// A static import is fine: vi.mock is hoisted above it, and the component
// reads SUPPORT_URL when it renders, so the getter above can be re-pointed
// per test.
import { SupportBox, SupportLink } from "./support-box";

beforeEach(() => {
  supportUrl = KOFI;
});

describe("SupportBox", () => {
  it("points at Ko-fi, in a new tab, without leaking the referrer window", () => {
    render(<SupportBox />);
    const link = screen.getByTestId("link-support-kofi");

    expect(link).toHaveAttribute("href", KOFI);
    expect(link).toHaveAttribute("target", "_blank");
    // Without noopener, the opened page gets a handle on this one.
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("says who it's for and what it's for", () => {
    render(<SupportBox />);
    expect(screen.getByText(/support the tools i build/i)).toBeInTheDocument();
    expect(screen.getByText(/built and run by one person/i)).toBeInTheDocument();
    expect(screen.getByText(/one-off or monthly/i)).toBeInTheDocument();
  });

  it("takes its own copy, so the pricing page can frame the ask differently", () => {
    render(<SupportBox title="Not ready for a plan?" description="A one-off coffee helps just as much." />);

    expect(screen.getByText("Not ready for a plan?")).toBeInTheDocument();
    expect(screen.queryByText(/support the tools i build/i)).not.toBeInTheDocument();
    // The link and the Ko-fi note stay whatever the copy says.
    expect(screen.getByTestId("link-support-kofi")).toHaveAttribute("href", KOFI);
  });

  it("renders nothing at all when no support URL is configured", () => {
    // A fork shouldn't quietly collect coffees for someone else, so an empty
    // VITE_KOFI_URL has to remove the whole panel, not just blank the link.
    supportUrl = "";
    const { container } = render(<SupportBox />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("support-box")).not.toBeInTheDocument();
  });
});

describe("SupportLink", () => {
  it("is a plain link to the same place", () => {
    render(<SupportLink />);
    const link = screen.getByTestId("link-footer-support");

    expect(link).toHaveAttribute("href", KOFI);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("disappears with the URL too", () => {
    supportUrl = "";
    const { container } = render(<SupportLink />);
    expect(container).toBeEmptyDOMElement();
  });
});
