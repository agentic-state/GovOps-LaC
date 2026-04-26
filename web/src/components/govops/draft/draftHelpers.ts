import type { ValueType } from "@/lib/types";

/** Today midnight UTC, ISO-8601 with Z. */
export function todayMidnightUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}T00:00:00.000Z`;
}

/** Hydrate a URL-serialized value back into its in-form runtime shape. */
export function hydrateValue(raw: string, type: ValueType): unknown {
  if (raw === "") return type === "list" || type === "enum" ? [] : type === "bool" ? false : "";
  if (type === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (type === "bool") return raw === "true";
  if (type === "list" || type === "enum") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fallthrough */
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

export const VALUE_TYPES: ValueType[] = [
  "number",
  "string",
  "bool",
  "list",
  "enum",
  "prompt",
  "formula",
];
