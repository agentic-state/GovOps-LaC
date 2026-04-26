import { useIntl } from "react-intl";
import { Languages } from "lucide-react";
import { useLocale, type Locale } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LOCALES: Locale[] = ["en", "fr", "es-MX", "pt-BR", "de", "uk"];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const intl = useIntl();
  const label = intl.formatMessage({ id: "lang.switcher.label" });

  return (
    <div className="inline-flex items-center gap-2 text-sm text-foreground-muted">
      <Languages className="size-4" aria-hidden />
      <span className="sr-only" id="lang-switcher-label">
        {label}
      </span>
      <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
        <SelectTrigger
          aria-labelledby="lang-switcher-label"
          className="h-9 w-[120px] bg-surface text-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALES.map((l) => (
            <SelectItem key={l} value={l}>
              {intl.formatMessage({ id: `lang.${l}` })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
