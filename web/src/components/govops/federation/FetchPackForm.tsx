import { useIntl } from "react-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FederationRegistryEntry } from "@/lib/federation-types";

export interface FetchPackFormProps {
  registry: FederationRegistryEntry[];
  publisherId: string;
  onPublisherChange: (id: string) => void;
  dryRun: boolean;
  onDryRunChange: (v: boolean) => void;
  allowUnsigned: boolean;
  onAllowUnsignedChange: (v: boolean) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function FetchPackForm({
  registry,
  publisherId,
  onPublisherChange,
  dryRun,
  onDryRunChange,
  allowUnsigned,
  onAllowUnsignedChange,
  submitting,
  onSubmit,
}: FetchPackFormProps) {
  const intl = useIntl();
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="fed-publisher">
          {intl.formatMessage({ id: "admin.federation.fetch.publisher_id" })}
        </Label>
        {registry.length > 0 ? (
          <Select value={publisherId} onValueChange={onPublisherChange}>
            <SelectTrigger id="fed-publisher">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {registry.map((r) => (
                <SelectItem key={r.publisher_id} value={r.publisher_id}>
                  {r.publisher_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="fed-publisher"
            placeholder={intl.formatMessage({ id: "admin.federation.empty_registry" })}
            value={publisherId}
            onChange={(e) => onPublisherChange(e.target.value)}
            disabled
          />
        )}
      </div>
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dryRun} onCheckedChange={(v) => onDryRunChange(v === true)} />
          {intl.formatMessage({ id: "admin.federation.fetch.dry_run" })}
        </label>
        <label
          className="flex items-center gap-2 text-sm"
          title={intl.formatMessage({ id: "admin.federation.allow_unsigned_warning" })}
        >
          <Checkbox
            checked={allowUnsigned}
            onCheckedChange={(v) => onAllowUnsignedChange(v === true)}
          />
          {intl.formatMessage({ id: "admin.federation.fetch.allow_unsigned" })}
        </label>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={submitting || !publisherId}>
          {submitting
            ? intl.formatMessage({ id: "admin.federation.fetch_in_progress" })
            : intl.formatMessage({ id: "admin.federation.fetch.submit" })}
        </Button>
      </div>
    </form>
  );
}
