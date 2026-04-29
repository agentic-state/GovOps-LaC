import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { StorageKeys } from "./storageKeys";

export type Locale = "en" | "fr" | "es-MX" | "pt-BR" | "de" | "uk";

// SSR-safe loader: import.meta.glob with eager+import:default ensures Vite re-evaluates
// the JSON modules on HMR, so edits to locale files are picked up without a server
// restart and without stale module-cache entries during SSR.
const localeModules = import.meta.glob<Record<string, string>>("../messages/*.json", {
  eager: true,
  import: "default",
});

const messagesByLocale: Record<Locale, Record<string, string>> = (() => {
  const out = {} as Record<Locale, Record<string, string>>;
  for (const [path, mod] of Object.entries(localeModules)) {
    const match = path.match(/\/([^/]+)\.json$/);
    if (!match) continue;
    out[match[1] as Locale] = mod;
  }
  return out;
})();
const RTL_LOCALES: Locale[] = []; // none of the supported locales are RTL
const STORAGE_KEY = StorageKeys.locale;

type LocaleContext = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: "ltr" | "rtl";
};

const LocaleCtx = createContext<LocaleContext | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && stored in messagesByLocale) return stored;
  const navFull = window.navigator.language; // e.g. "es-MX", "pt-BR", "de-DE"
  const nav2 = navFull.slice(0, 2).toLowerCase();
  // Exact match first (handles es-MX, pt-BR), then 2-letter fallback.
  if (navFull in messagesByLocale) return navFull as Locale;
  if (nav2 === "es") return "es-MX";
  if (nav2 === "pt") return "pt-BR";
  if (nav2 === "fr") return "fr";
  if (nav2 === "de") return "de";
  if (nav2 === "uk") return "uk";
  return "en";
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "en");

  // On the client, prefer the persisted locale (cookie/localStorage) over the
  // SSR-resolved value when they disagree (e.g. user changed it in another tab).
  useEffect(() => {
    const detected = detectInitialLocale();
    if (detected !== locale) setLocaleState(detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const value = useMemo<LocaleContext>(
    () => ({
      locale,
      dir: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
      setLocale: (l) => {
        setLocaleState(l);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, l);
          // Mirror to a cookie so the SSR loader can read it on next request.
          document.cookie = `${STORAGE_KEY}=${encodeURIComponent(l)};path=/;max-age=31536000;samesite=lax`;
        }
      },
    }),
    [locale],
  );

  return (
    <LocaleCtx.Provider value={value}>
      <IntlProvider
        locale={locale}
        defaultLocale="en"
        messages={messagesByLocale[locale]}
        onError={(err) => {
          // A single missing or malformed message must never blank the SSR
          // render. We swallow MISSING_TRANSLATION silently and log
          // FORMAT_ERROR (e.g. UNCLOSED_TAG) as a warning so it surfaces in
          // dev tools but the id-as-fallback keeps the page alive.
          if (err.code === "MISSING_TRANSLATION") {
            if (import.meta.env.DEV) console.warn(`[i18n] ${err.message}`);
            return;
          }
          if (err.code === "FORMAT_ERROR") {
            console.warn(`[i18n format] ${err.message}`);
            return;
          }
          console.error(err);
        }}
      >
        {children}
      </IntlProvider>
    </LocaleCtx.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx;
}
