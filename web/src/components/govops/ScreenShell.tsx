import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { Wordmark } from "./Wordmark";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * Minimal citizen-facing shell. Intentionally omits the Masthead nav so the
 * /screen surface stays uncluttered (govops-015 cross-cutting requirement).
 * The only chrome is the wordmark, the language switcher, an optional Back
 * link, and the open-source attribution footer.
 */
export function ScreenShell({
  children,
  showBack,
}: {
  children: ReactNode;
  showBack?: boolean;
}) {
  const intl = useIntl();
  return (
    <div className="min-h-screen flex flex-col bg-surface text-foreground screen-shell">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <Link to="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          <Wordmark className="text-xl" />
        </Link>
        <div className="flex items-center gap-4">
          {showBack && (
            <Link
              to="/screen"
              className="text-sm text-foreground-muted hover:text-foreground underline-offset-2 hover:underline"
            >
              {intl.formatMessage({ id: "screen.back" })}
            </Link>
          )}
          <LanguageSwitcher />
        </div>
      </header>
      <main id="main" className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        {children}
      </main>
      <footer className="px-6 py-6 border-t border-border text-center text-sm text-foreground-muted screen-footer">
        {intl.formatMessage({ id: "screen.footer.disclaimer" })}
      </footer>
    </div>
  );
}
