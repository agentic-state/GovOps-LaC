import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";

/**
 * Mirror of scripts/check-i18n-icu.mjs as a unit test so CI / local `bun test`
 * catches malformed ICU strings (UNCLOSED_TAG, INVALID_ARGUMENT_TYPE, …) at
 * the same time as the rest of the suite.
 */

const MSG_DIR = resolve(__dirname, "../messages");

describe("i18n ICU syntax", () => {
  const files = readdirSync(MSG_DIR).filter((f) => f.endsWith(".json"));

  it("loads at least one locale file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const locale = file.replace(/\.json$/, "");
    const raw = readFileSync(join(MSG_DIR, file), "utf8");
    const messages = JSON.parse(raw) as Record<string, string>;

    it(`[${locale}] every message parses as valid ICU`, () => {
      const errors: string[] = [];
      for (const [key, value] of Object.entries(messages)) {
        if (typeof value !== "string") {
          errors.push(`${key}: not a string (${typeof value})`);
          continue;
        }
        try {
          parse(value);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${key}: ${msg}  →  ${JSON.stringify(value)}`);
        }
      }
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
});