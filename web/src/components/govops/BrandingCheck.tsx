import { useIntl } from "react-intl";
import enMsgs from "@/messages/en.json";
import frMsgs from "@/messages/fr.json";
import esMsgs from "@/messages/es-MX.json";
import ptMsgs from "@/messages/pt-BR.json";
import deMsgs from "@/messages/de.json";
import ukMsgs from "@/messages/uk.json";
import { Wordmark } from "./Wordmark";

const EXPECTED = "GovOps";

const LOCALE_BUNDLES: { code: string; label: string; msgs: Record<string, string> }[] = [
  { code: "en", label: "English", msgs: enMsgs },
  { code: "fr", label: "Français", msgs: frMsgs },
  { code: "es-MX", label: "Español (MX)", msgs: esMsgs },
  { code: "pt-BR", label: "Português (BR)", msgs: ptMsgs },
  { code: "de", label: "Deutsch", msgs: deMsgs },
  { code: "uk", label: "Українська", msgs: ukMsgs },
];

/**
 * Confirms each locale's `app.name` and `home.hello` resolve to "GovOps",
 * and shows the literal wordmark glyph in use. Read-only audit panel.
 */
export function BrandingCheck() {
  const intl = useIntl();
  return (
    <section aria-labelledby="branding-check-heading" className="space-y-4">
      <div>
        <h2
          id="branding-check-heading"
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "branding.check.title" })}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "branding.check.caption" })}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-sunken text-left">
              <th
                className="px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: "branding.check.col.locale" })}
              </th>
              <th
                className="px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: "branding.check.col.title" })}
              </th>
              <th
                className="px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: "branding.check.col.wordmark" })}
              </th>
              <th
                className="px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: "branding.check.col.status" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {LOCALE_BUNDLES.map((b) => {
              const appName = b.msgs["app.name"] ?? "";
              const homeHello = b.msgs["home.hello"] ?? "";
              const ok = appName === EXPECTED && homeHello === EXPECTED;
              return (
                <tr key={b.code} className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">{b.label}</td>
                  <td
                    className="px-4 py-3 text-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {appName}
                  </td>
                  <td className="px-4 py-3">
                    <Wordmark />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: ok
                          ? "color-mix(in oklch, var(--verdict-enacted) 14%, transparent)"
                          : "color-mix(in oklch, var(--verdict-rejected) 14%, transparent)",
                        color: ok ? "var(--verdict-enacted)" : "var(--verdict-rejected)",
                      }}
                      aria-label={
                        ok
                          ? intl.formatMessage({ id: "branding.check.status.pass" })
                          : intl.formatMessage({ id: "branding.check.status.fail" })
                      }
                    >
                      {ok
                        ? intl.formatMessage({ id: "branding.check.status.pass" })
                        : intl.formatMessage({ id: "branding.check.status.fail" })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
