/**
 * Server-only locale resolver exposed as a TanStack Start server function.
 * Lives in a `.server.ts` file so the import-protection plugin keeps the
 * `@tanstack/react-start/server` request APIs out of the client bundle.
 *
 * The server fn is callable from the root route loader on both the SSR
 * pass and on subsequent client navigations (the client sends an RPC).
 */
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import type { Locale } from "@/lib/i18n";
import { StorageKeys } from "@/lib/storageKeys";

const SUPPORTED: Locale[] = ["en", "fr", "es-MX", "pt-BR", "de", "uk"];

function pickLocale(input: string | undefined): Locale {
  if (!input) return "en";
  if ((SUPPORTED as string[]).includes(input)) return input as Locale;
  const head = input.split(",")[0]?.trim() ?? "";
  if ((SUPPORTED as string[]).includes(head)) return head as Locale;
  const two = head.slice(0, 2).toLowerCase();
  if (two === "es") return "es-MX";
  if (two === "pt") return "pt-BR";
  if (two === "fr") return "fr";
  if (two === "de") return "de";
  if (two === "uk") return "uk";
  return "en";
}

export const getSsrLocale = createServerFn({ method: "GET" }).handler((): Locale => {
  try {
    const cookieLocale = getCookie(StorageKeys.locale);
    if (cookieLocale) return pickLocale(cookieLocale);
    const accept = getRequestHeader("accept-language");
    return pickLocale(accept);
  } catch {
    return "en";
  }
});
