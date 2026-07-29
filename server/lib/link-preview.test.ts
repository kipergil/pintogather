import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPrivateAddress,
  assertPublicHost,
  assertFetchableUrl,
  parseHtmlPreview,
  fetchLinkPreview,
  LinkPreviewError,
} from "./link-preview.js";

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn() },
  lookup: vi.fn(),
}));
import dns from "node:dns/promises";

describe("isPrivateAddress — the SSRF blocklist", () => {
  it.each([
    ["127.0.0.1", "IPv4 loopback"],
    ["127.99.1.2", "anywhere in 127/8"],
    ["10.0.0.1", "RFC1918 10/8"],
    ["172.16.0.1", "RFC1918 172.16/12 lower bound"],
    ["172.31.255.255", "RFC1918 172.16/12 upper bound"],
    ["192.168.1.1", "RFC1918 192.168/16"],
    ["169.254.169.254", "link-local — the cloud metadata endpoint"],
    ["100.64.0.1", "CGNAT lower bound"],
    ["100.127.255.255", "CGNAT upper bound"],
    ["0.0.0.0", "this network"],
    ["::1", "IPv6 loopback"],
    ["::", "IPv6 unspecified"],
    ["fe80::1", "IPv6 link-local"],
    ["fc00::1", "IPv6 unique-local"],
    ["fd12:3456::1", "IPv6 unique-local fd"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata endpoint"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public DNS"],
    ["1.1.1.1", "public DNS"],
    ["93.184.216.34", "example.com"],
    ["172.15.0.1", "just below the RFC1918 172 range"],
    ["172.32.0.1", "just above the RFC1918 172 range"],
    ["100.63.255.255", "just below CGNAT"],
    ["100.128.0.1", "just above CGNAT"],
    ["2606:4700::1111", "public IPv6"],
  ])("allows %s (%s)", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it("fails closed on a malformed address", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("1.2.3")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

describe("assertFetchableUrl", () => {
  it.each(["http://example.com", "https://example.com"])("allows %s", (url) => {
    expect(() => assertFetchableUrl(new URL(url))).not.toThrow();
  });

  it.each(["file:///etc/passwd", "ftp://example.com", "gopher://example.com", "data:text/html,hi"])(
    "rejects %s",
    (url) => {
      expect(() => assertFetchableUrl(new URL(url))).toThrow(LinkPreviewError);
    },
  );
});

describe("assertPublicHost — DNS-resolved guard", () => {
  const lookup = vi.mocked(dns.lookup);

  beforeEach(() => {
    lookup.mockReset();
  });

  it("rejects a literal private IP without needing DNS", async () => {
    await expect(assertPublicHost("127.0.0.1")).rejects.toThrow(/private address/);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects the bare hostname 'localhost'", async () => {
    await expect(assertPublicHost("localhost")).rejects.toThrow(/private address/);
  });

  it("allows a hostname that resolves to a public address", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    await expect(assertPublicHost("example.com")).resolves.toBeUndefined();
  });

  it("rejects a hostname that resolves to a private address — the DNS-rebinding case", async () => {
    // The whole reason the guard resolves rather than pattern-matching the
    // URL string: a public-looking name can point straight at the metadata
    // endpoint.
    lookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }] as never);
    await expect(assertPublicHost("totally-innocent.example.com")).rejects.toThrow(/private address/);
  });

  it("rejects when ANY resolved address is private, not just the first", async () => {
    lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ] as never);
    await expect(assertPublicHost("mixed.example.com")).rejects.toThrow(/private address/);
  });

  it("rejects a hostname that resolves to nothing", async () => {
    lookup.mockResolvedValue([] as never);
    await expect(assertPublicHost("empty.example.com")).rejects.toThrow(/private address/);
  });

  it("rejects when resolution fails outright", async () => {
    lookup.mockImplementation(() => {
      throw new Error("ENOTFOUND");
    });
    await expect(assertPublicHost("nope.example.com")).rejects.toThrow(/Couldn't resolve/);
  });
});

describe("parseHtmlPreview", () => {
  const base = new URL("https://example.com/article");

  it("prefers Open Graph tags", () => {
    const html = `
      <html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="OG Title" />
        <meta property="og:description" content="OG description" />
        <meta property="og:image" content="https://cdn.example.com/img.png" />
      </head></html>`;
    expect(parseHtmlPreview(html, base)).toEqual({
      title: "OG Title",
      description: "OG description",
      imageUrl: "https://cdn.example.com/img.png",
    });
  });

  it("falls back to <title> and meta description", () => {
    const html = `
      <html><head>
        <title>Plain Title</title>
        <meta name="description" content="Plain description" />
      </head></html>`;
    const preview = parseHtmlPreview(html, base);
    expect(preview.title).toBe("Plain Title");
    expect(preview.description).toBe("Plain description");
    expect(preview.imageUrl).toBeNull();
  });

  it("resolves a relative og:image against the final URL", () => {
    const html = `<meta property="og:image" content="/images/hero.jpg" />`;
    expect(parseHtmlPreview(html, base).imageUrl).toBe("https://example.com/images/hero.jpg");
  });

  it("decodes HTML entities in the title", () => {
    const html = `<title>Caf&eacute; &amp; Bar &#8212; London</title>`;
    const title = parseHtmlPreview(html, base).title ?? "";
    expect(title).toContain("&");
    expect(title).not.toContain("&amp;");
  });

  it("returns all-null for HTML with no usable metadata", () => {
    expect(parseHtmlPreview("<html><body>nothing here</body></html>", base)).toEqual({
      title: null,
      description: null,
      imageUrl: null,
    });
  });
});

describe("fetchLinkPreview — end-to-end guard behaviour", () => {
  const lookup = vi.mocked(dns.lookup);
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("rejects a non-URL string without fetching", async () => {
    await expect(fetchLinkPreview("not a url")).rejects.toThrow(LinkPreviewError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(["http://localhost:5000/admin", "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/"])(
    "refuses %s without fetching",
    async (url) => {
      await expect(fetchLinkPreview(url)).rejects.toThrow(LinkPreviewError);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("refuses a file: URL without fetching", async () => {
    await expect(fetchLinkPreview("file:///etc/passwd")).rejects.toThrow(LinkPreviewError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns parsed metadata for a public URL", async () => {
    fetchSpy.mockResolvedValue(
      new Response('<html><head><meta property="og:title" content="Hello" /></head></html>', {
        status: 200,
        headers: { "content-type": "text/html" },
      }) as never,
    );
    const preview = await fetchLinkPreview("https://example.com/post");
    expect(preview.title).toBe("Hello");
  });
});
