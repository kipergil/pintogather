import { describe, it, expect } from "vitest";
import { parseSocialLinks, socialHandleFromUrl } from "./social-discovery";

const base = new URL("https://example-bistro.co.uk/");

describe("socialHandleFromUrl", () => {
  it.each([
    ["https://twitter.com/examplebistro", "twitter", "examplebistro"],
    ["https://x.com/examplebistro", "twitter", "examplebistro"],
    ["https://www.twitter.com/examplebistro", "twitter", "examplebistro"],
    ["https://instagram.com/example.bistro", "instagram", "example.bistro"],
    ["https://www.instagram.com/example_bistro/", "instagram", "example_bistro"],
    ["https://linkedin.com/company/example-bistro", "linkedin", "company/example-bistro"],
    ["https://uk.linkedin.com/in/jane-doe", "linkedin", "in/jane-doe"],
  ])("reads %s as %s/%s", (url, platform, handle) => {
    expect(socialHandleFromUrl(url)).toEqual({ platform, handle });
  });

  it("strips a leading @ and a trailing slash", () => {
    expect(socialHandleFromUrl("https://twitter.com/@examplebistro/")).toEqual({
      platform: "twitter",
      handle: "examplebistro",
    });
  });

  it("ignores query strings and fragments", () => {
    expect(socialHandleFromUrl("https://instagram.com/examplebistro?hl=en#top")).toEqual({
      platform: "instagram",
      handle: "examplebistro",
    });
  });

  describe("share buttons, which nearly every site has", () => {
    it.each([
      "https://twitter.com/intent/tweet?url=https%3A%2F%2Fexample.com",
      "https://twitter.com/share?url=https://example.com",
      "https://x.com/intent/post?text=hello",
      "https://www.linkedin.com/shareArticle?mini=true&url=https://example.com",
      "https://www.linkedin.com/sharing/share-offsite/?url=https://example.com",
    ])("refuses %s", (url) => {
      // Without this, virtually every pin would get the handle "intent".
      expect(socialHandleFromUrl(url)).toBeNull();
    });
  });

  describe("platform pages that aren't an account", () => {
    it.each([
      "https://instagram.com/p/Cabcdef123/",
      "https://instagram.com/reel/Cabcdef123/",
      "https://instagram.com/explore/tags/food/",
      "https://twitter.com/hashtag/food",
      "https://twitter.com/home",
      "https://twitter.com/login",
      "https://twitter.com/i/flow/signup",
      "https://linkedin.com/jobs/view/12345",
      "https://linkedin.com/pulse/some-article",
      "https://linkedin.com/feed/",
    ])("refuses %s", (url) => {
      expect(socialHandleFromUrl(url)).toBeNull();
    });
  });

  it("takes the account out of a link to one of its tweets", () => {
    expect(socialHandleFromUrl("https://twitter.com/examplebistro/status/1234567890")).toEqual({
      platform: "twitter",
      handle: "examplebistro",
    });
  });

  it("refuses a bare linkedin.com/slug, which isn't a profile URL", () => {
    expect(socialHandleFromUrl("https://linkedin.com/examplebistro")).toBeNull();
  });

  it.each([
    "https://facebook.com/examplebistro",
    "https://youtube.com/@examplebistro",
    "https://tiktok.com/@examplebistro",
  ])("ignores %s — not a platform this app stores", (url) => {
    expect(socialHandleFromUrl(url)).toBeNull();
  });

  it.each([
    "not a url",
    "javascript:alert(1)",
    "mailto:hello@example.com",
    "https://twitter.com",
    "https://twitter.com/",
  ])("returns null for %s", (url) => {
    expect(socialHandleFromUrl(url)).toBeNull();
  });

  it("refuses a handle with characters a handle can't contain", () => {
    expect(socialHandleFromUrl("https://twitter.com/not a handle")).toBeNull();
  });
});

describe("parseSocialLinks", () => {
  it("finds the three platforms from a typical footer", () => {
    const html = `
      <footer>
        <a href="https://www.instagram.com/example_bistro/">Instagram</a>
        <a href="https://x.com/examplebistro">X</a>
        <a href="https://www.linkedin.com/company/example-bistro/">LinkedIn</a>
        <a href="/contact">Contact</a>
      </footer>`;
    expect(parseSocialLinks(html, base)).toEqual({
      instagram: "example_bistro",
      twitter: "examplebistro",
      linkedin: "company/example-bistro",
    });
  });

  it("prefers the account in the header over a share button further down", () => {
    // Share buttons live at the bottom of articles; the real account is in
    // the nav. First-match-wins gets this right only because the share URLs
    // are rejected outright.
    const html = `
      <header><a href="https://twitter.com/examplebistro">Follow us</a></header>
      <article>…</article>
      <a href="https://twitter.com/intent/tweet?url=x">Tweet this</a>`;
    expect(parseSocialLinks(html, base).twitter).toBe("examplebistro");
  });

  it("returns nothing when a page only has share buttons", () => {
    const html = `
      <a href="https://twitter.com/intent/tweet?url=x">Tweet</a>
      <a href="https://www.linkedin.com/shareArticle?url=x">Share</a>`;
    expect(parseSocialLinks(html, base)).toEqual({});
  });

  it("keeps the first handle when a page links two accounts on one platform", () => {
    const html = `
      <a href="https://instagram.com/example_bistro">Us</a>
      <a href="https://instagram.com/some_supplier">Our supplier</a>`;
    expect(parseSocialLinks(html, base).instagram).toBe("example_bistro");
  });

  it("resolves protocol-relative and root-relative hrefs against the page", () => {
    const html = `<a href="//twitter.com/examplebistro">X</a>`;
    expect(parseSocialLinks(html, base).twitter).toBe("examplebistro");
  });

  it.each([
    [`<a href='https://x.com/examplebistro'>X</a>`, "single quotes"],
    [`<a href=https://x.com/examplebistro>X</a>`, "no quotes"],
    [`<a class="soc" target="_blank" href="https://x.com/examplebistro">X</a>`, "other attributes first"],
    [`<A HREF="https://x.com/examplebistro">X</A>`, "uppercase tags"],
  ])("handles %s (%s)", (html) => {
    expect(parseSocialLinks(html, base).twitter).toBe("examplebistro");
  });

  it("returns an empty object for a page with no links at all", () => {
    expect(parseSocialLinks("<html><body><p>Hello</p></body></html>", base)).toEqual({});
  });

  it("doesn't invent handles from the venue's own domain", () => {
    const html = `<a href="/about">About</a><a href="https://example-bistro.co.uk/x">x</a>`;
    expect(parseSocialLinks(html, base)).toEqual({});
  });
});
