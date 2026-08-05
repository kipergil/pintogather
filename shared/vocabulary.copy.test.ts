import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the rule the vocabulary module exists to enforce: the container a
 * user creates is a "collection", never a "map".
 *
 * This scans source rather than rendered output because the first pass at
 * this audit swept only for quoted strings and missed JSX text nodes — the
 * literal words sitting between two tags, which is where "Create new map"
 * and "Back to map" were hiding. Buttons are exactly the case a
 * quoted-string sweep can't see.
 */

const ROOTS = ["client/src", "shared"];

/** Where "map" is the real Google Map, a verb, or a code identifier. */
const LEGITIMATE = [
  /google maps/i,
  /\bon (a|the|a real) map\b/i,
  /view in maps/i,
  /\bmap\b(?=\s+(where|club|the places))/i, // "Map where colleagues are based"
  /drop (a pin )?on the map/i,
  /click the map/i,
  /click anywhere on the map/i,
  /place a pin/i,
  /pick a spot on the map/i,
  /couldn't load the map/i,
  /map error/i,
  /show all pins/i,
  /drop a pin/i,
  /^[a-z]+([A-Z][a-z]*)+$/, // camelCase identifiers
];

/** The phrases that mean the container is still being called a map. */
const CONTAINER_AS_MAP = [
  /\b(create|edit|delete|open|view|share|new|archived?|unfiled|curate|curated)\s+(a\s+|your\s+|this\s+|new\s+)?maps?\b/i,
  /\bmaps?\s+(created|found|yet|management)\b/i,
  /\bback to map\b/i,
  /\bgo to map\b/i,
  /\bthis map\b/i,
  /\byour maps?\b/i,
  /\bmy maps\b/i,
  /\bthe map owner\b/i,
  /\bmap (not found|name|limit|invitation)\b/i,
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "ui" || entry === "node_modules") continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) {
        out.push(full);
      }
    }
  };
  for (const root of ROOTS) walk(root);
  return out;
}

/** Strips comments, then pulls out quoted strings, template literals, and JSX text nodes. */
function userFacingStrings(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const found: string[] = [];
  for (const rx of [
    /"((?:[^"\\\n]|\\.){4,})"/g,
    // [\s\S] rather than the `s` flag, which this tsconfig target rejects.
    /`((?:[^`\\]|\\[\s\S]){4,}?)`/g,
    />\s*([A-Z][^<>{}\n]{3,})\s*(?:<|\{)/g,
  ]) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(code)) !== null) found.push(m[1].trim());
  }
  return found;
}

describe("the container is called a collection, not a map", () => {
  const offenders: string[] = [];

  for (const file of sourceFiles()) {
    for (const text of userFacingStrings(readFileSync(file, "utf8"))) {
      if (LEGITIMATE.some((rx) => rx.test(text))) continue;
      if (/className|data-testid|aria-hidden|\/api\/|\/map\/|\/admin\//.test(text)) continue;
      if (CONTAINER_AS_MAP.some((rx) => rx.test(text))) {
        offenders.push(`${file}: ${text.slice(0, 90)}`);
      }
    }
  }

  it("finds no user-facing copy calling a collection a map", () => {
    expect(offenders).toEqual([]);
  });
});
