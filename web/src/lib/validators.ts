import type { ValueType } from "./types";

export const KEY_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

/** Returns an i18n message id, or null if valid. */
export function validateKey(key: string): string | null {
  if (!key) return "validators.key.required";
  if (!KEY_REGEX.test(key)) return "validators.key.format";
  if (key.split(".").length < 3) return "validators.key.too_shallow";
  return null;
}

/** Returns an i18n message id, or null if valid. */
export function validateRationale(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 20) return "validators.rationale.too_short";
  if (trimmed.length > 2000) return "validators.rationale.too_long";
  return null;
}

/**
 * Strict ISO-8601 UTC datetime validator. Accepts YYYY-MM-DDTHH:mm[:ss[.sss]]Z.
 * Returns an i18n message id, or null if valid.
 */
const ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
export function validateIsoUtc(value: string): string | null {
  if (!value) return "validators.effective_from.required";
  if (!ISO_UTC_REGEX.test(value)) return "validators.effective_from.format";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "validators.effective_from.invalid";
  return null;
}

/**
 * Coerces a raw form string (or already-typed value) into the appropriate
 * ConfigValue runtime shape. Throws an Error whose message is an i18n key.
 */
export function coerceValue(raw: unknown, type: ValueType): unknown {
  switch (type) {
    case "number": {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error("validators.value.not_a_number");
      return n;
    }
    case "bool":
      return raw === true || raw === "true";
    case "list":
    case "enum":
      if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
      return String(raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    case "formula":
      try {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        throw new Error("validators.value.bad_json");
      }
    case "string":
    case "prompt":
    default:
      return String(raw ?? "");
  }
}

// ---- Prompt-specific validation (govops-008) -------------------------------

export const PROMPT_TEXT_MIN = 10;
export const PROMPT_TEXT_MAX = 8000;

/**
 * Validate a prompt key. Reuses the shared key regex but ALSO requires the
 * domain segment (the second-to-last `.`-separated part) to literally be
 * `prompt` — every prompt is registered as `<scope>.prompt.<name>`.
 *
 * Returns an i18n message id, or null if valid.
 */
export function validatePromptKey(key: string): string | null {
  const base = validateKey(key);
  if (base) return base;
  const parts = key.split(".");
  if (!parts.includes("prompt")) return "validators.prompt_key.must_contain_prompt";
  return null;
}

/**
 * Length check for the prompt body. Returns an i18n message id, or null if
 * valid. The bounds are advisory — the FastAPI backend will revalidate.
 */
export function validatePromptText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "validators.prompt_text.required";
  if (trimmed.length < PROMPT_TEXT_MIN) return "validators.prompt_text.too_short";
  if (trimmed.length > PROMPT_TEXT_MAX) return "validators.prompt_text.too_long";
  return null;
}
