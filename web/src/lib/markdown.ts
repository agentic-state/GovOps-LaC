import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Render a markdown string to safe HTML.
 * Uses `marked` for parsing and DOMPurify to strip <script>, <iframe>,
 * on* handlers, and other XSS vectors. Returns "" on the server (no window).
 */
export function renderMarkdown(src: string): string {
  if (typeof window === "undefined") {
    // SSR fallback: just escape and return as <pre>; the client will hydrate.
    return "";
  }
  const raw = marked.parse(src ?? "", { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
  });
}
