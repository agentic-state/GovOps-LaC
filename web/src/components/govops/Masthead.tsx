import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronDown, Menu } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HelpDrawer } from "./HelpDrawer";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; id: string; exact?: boolean };

// Top-level navigation: the conceptual / narrative spine. Operational surfaces
// are grouped under a "Console" dropdown so the front door stays uncluttered.
const TOP_NAV: NavItem[] = [
  { to: "/", id: "nav.home", exact: true },
  { to: "/walkthrough", id: "nav.walkthrough" },
  { to: "/authority", id: "nav.authority" },
  { to: "/about", id: "nav.about" },
];

// Console group: the operational surfaces. Reachable from a single entry on
// desktop (dropdown), and listed inline on the mobile sheet under a heading.
const CONSOLE_NAV: NavItem[] = [
  { to: "/cases", id: "nav.cases" },
  { to: "/encode", id: "nav.encode" },
  { to: "/config", id: "nav.config" },
  { to: "/config/approvals", id: "nav.approvals" },
  { to: "/config/prompts", id: "nav.prompts" },
  { to: "/policies", id: "nav.policies" },
  { to: "/admin", id: "nav.admin" },
];

export function Masthead() {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const consoleLabel = intl.formatMessage({ id: "nav.console" });

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
          {TOP_NAV.map((item) => (
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

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1 text-foreground-muted transition-colors hover:text-foreground data-[state=open]:text-foreground"
              aria-label={consoleLabel}
            >
              {consoleLabel}
              <ChevronDown className="size-3" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuLabel className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">
                {consoleLabel}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CONSOLE_NAV.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link
                    to={item.to}
                    className="cursor-pointer"
                    activeProps={{ className: "font-medium" }}
                  >
                    {intl.formatMessage({ id: item.id })}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
            <HelpDrawer />
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
                {TOP_NAV.map((item) => (
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
                <p
                  className="mt-4 px-3 pb-1 text-xs uppercase tracking-[0.18em] text-foreground-subtle"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {consoleLabel}
                </p>
                {CONSOLE_NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                    activeProps={{
                      className:
                        "rounded-md px-3 py-2 text-foreground font-medium bg-surface-sunken",
                    }}
                  >
                    {intl.formatMessage({ id: item.id })}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                <LanguageSwitcher />
                <ThemeToggle />
                <HelpDrawer />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
