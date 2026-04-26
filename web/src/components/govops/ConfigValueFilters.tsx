import { useIntl } from "react-intl";
import { DOMAINS, JURISDICTIONS, LANGUAGES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiltersState = {
  key_prefix: string;
  domain: string;
  jurisdiction_id: string;
  language: string;
};

type Props = {
  value: FiltersState;
  onChange: (next: Partial<FiltersState>) => void;
};

const labelClass = "mb-1 block text-xs uppercase tracking-[0.14em] text-foreground-subtle";
const labelStyle = { fontFamily: "var(--font-mono)" } as const;

export function ConfigValueFilters({ value, onChange }: Props) {
  const intl = useIntl();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <Label htmlFor="config-search" className={labelClass} style={labelStyle}>
          {intl.formatMessage({ id: "config.search.label" })}
        </Label>
        <Input
          id="config-search"
          type="search"
          value={value.key_prefix}
          onChange={(e) => onChange({ key_prefix: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange({ key_prefix: "" });
          }}
          placeholder={intl.formatMessage({ id: "config.search.placeholder" })}
          className="h-9 bg-surface"
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </div>

      <div>
        <Label htmlFor="config-domain" className={labelClass} style={labelStyle}>
          {intl.formatMessage({ id: "config.filter.domain.label" })}
        </Label>
        <Select value={value.domain} onValueChange={(v) => onChange({ domain: v })}>
          <SelectTrigger id="config-domain" className="h-9 w-[160px] bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {intl.formatMessage({ id: "config.filter.domain.all" })}
            </SelectItem>
            {DOMAINS.map((d) => (
              <SelectItem key={d} value={d}>
                {intl.formatMessage({ id: `config.filter.domain.${d}` })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="config-jurisdiction" className={labelClass} style={labelStyle}>
          {intl.formatMessage({ id: "config.filter.jurisdiction.label" })}
        </Label>
        <Select
          value={value.jurisdiction_id}
          onValueChange={(v) => onChange({ jurisdiction_id: v })}
        >
          <SelectTrigger id="config-jurisdiction" className="h-9 w-[160px] bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {intl.formatMessage({ id: "config.filter.jurisdiction.all" })}
            </SelectItem>
            <SelectItem value="global">
              {intl.formatMessage({ id: "config.filter.jurisdiction.global" })}
            </SelectItem>
            {JURISDICTIONS.map((j) => (
              <SelectItem key={j} value={j}>
                {j}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="config-language" className={labelClass} style={labelStyle}>
          {intl.formatMessage({ id: "config.filter.language.label" })}
        </Label>
        <Select value={value.language} onValueChange={(v) => onChange({ language: v })}>
          <SelectTrigger id="config-language" className="h-9 w-[140px] bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {intl.formatMessage({ id: "config.filter.language.all" })}
            </SelectItem>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
