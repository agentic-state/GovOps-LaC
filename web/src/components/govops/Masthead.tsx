import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { Menu } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type NavItem = { to: string; id: string; exact?: boolean };
const NAV_ITEMS: NavItem[] = [
  { to: "/", id: "nav.home", exact: true },
  { to: "/policies", id: "nav.policies" },
  { to: "/authority", id: "nav.authority" },
  { to: "/cases", id: "nav.cases" },
  { to: "/encode", id: "nav.encode" },
  { to: "/config", id: "nav.config" },
  { to: "/config/approvals", id: "nav.approvals" },
  { to: "/config/prompts", id: "nav.prompts" },
  { to: "/about", id: "nav.about" },
  { to: "/admin", id: "nav.admin" },
];

export function Masthead() {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <Link to="/" className="whitespace-nowrap text-2xl text-foreground">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-4 text-sm md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-foreground-muted transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
              activeOptions={item.exact ? { exact: true } : undefined}
            >
              {intl.formatMessage({ id: item.id })}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label={intl.formatMessage({ id: "nav.menu" })}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-surface-sunken md:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle>{intl.formatMessage({ id: "nav.menu" })}</SheetTitle>
              <nav aria-label="Primary mobile" className="mt-6 flex flex-col gap-1 text-sm">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                    activeProps={{
                      className:
                        "rounded-md px-3 py-2 text-foreground font-medium bg-surface-sunken",
                    }}
                    activeOptions={item.exact ? { exact: true } : undefined}
                  >
                    {intl.formatMessage({ id: item.id })}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
