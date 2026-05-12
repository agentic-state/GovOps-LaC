/**
 * Synchronous SSR-only locale resolver.
 *
 * `getSsrLocale` (in `ssrLocale.ts`) is exposed as a `createServerFn` RPC,
 * which makes it asynchronous and therefore unusable from inside route
 * `head()` hooks (TanStack expects a sync return). This module exposes the
 * same cookie/Accept-Language resolution logic as a synchronous isomorphic
 * function, suitable for SSR `head()` calls.
 *
 * Implemented via `createIsomorphicFn` so the server-only `getCookie` /
 * `getRequestHeader` imports stay out of the client bundle. The client
 * branch returns `null`; head-i18n.ts then falls back to `document.cookie`
 * post-hydration.
 *
 * (Renamed from `ssrLocaleSync.server.ts` after the import-protection
 * plugin rejected static imports of `.server.ts` modules from non-server
 * files. The `.server.ts/.client.ts` swap convention Lovable assumed
 * doesn't exist in this version of TanStack Start; createIsomorphicFn is
 * the supported primitive.)
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { StorageKeys } from "@/lib/storageKeys";

const SUPPORTED = ["en", "fr", "es-MX", "pt-BR", "de", "uk"] as const;
type Locale = (typeof SUPPORTED)[number];

function pick(input: string | undefined): Locale | null {
  if (!input) return null;
  if ((SUPPORTED as readonly string[]).includes(input)) return input as Locale;
  const head = input.split(",")[0]?.trim() ?? "";
  if ((SUPPORTED as readonly string[]).includes(head)) return head as Locale;
  const two = head.slice(0, 2).toLowerCase();
  if (two === "es") return "es-MX";
  if (two === "pt") return "pt-BR";
  if (two === "fr") return "fr";
  if (two === "de") return "de";
  if (two === "uk") return "uk";
  return null;
}

// `createIsomorphicFn`'s transform strips the `.server()` branch (and any
// imports it references) from the client bundle, so the server-only
// `@tanstack/react-start/server` import above is safe at the top level.
// The previous `require(...)` form crashed in Vite's ESM SSR environment
// (`ReferenceError: require is not defined`), which silently swallowed
// every child route's `head()` and was the real cause of PLAN §12.3.x.1.
export const getSsrLocaleSync = createIsomorphicFn()
  .client(() => null as string | null)
  .server((): string | null => {
    try {
      const cookieLocale = getCookie(StorageKeys.locale);
      const fromCookie = pick(cookieLocale);
      if (fromCookie) return fromCookie;
      const accept = getRequestHeader("accept-language");
      return pick(accept);
    } catch {
      return null;
    }
  });
