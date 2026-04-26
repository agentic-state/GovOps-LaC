import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/button";
import type { RuleProposal } from "@/lib/types";

export function ProposalEditor({
  proposal,
  onSave,
  onCancel,
}: {
  proposal: RuleProposal;
  onSave: (overrides: {
    description: string;
    formal_expression: string;
    citation: string;
    parameters: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const intl = useIntl();
  const [description, setDescription] = useState(proposal.description);
  const [formal, setFormal] = useState(proposal.formal_expression);
  const [citation, setCitation] = useState(proposal.citation);
  const [paramsText, setParamsText] = useState(JSON.stringify(proposal.parameters, null, 2));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parameters: Record<string, unknown>;
    try {
      parameters = paramsText.trim() ? JSON.parse(paramsText) : {};
    } catch {
      setErrorMsg("Parameters must be valid JSON");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave({ description, formal_expression: formal, citation, parameters });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border border-border bg-surface-sunken p-3"
    >
      <h4 className="text-sm font-medium text-foreground">
        {intl.formatMessage({ id: "encode.proposal.modify.heading" })}
      </h4>
      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "encode.list.column.title" })}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: "var(--font-serif)" }}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "authority.rules.formal_expression" })}
        </span>
        <textarea
          value={formal}
          onChange={(e) => setFormal(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "encode.list.column.citation" })}
        </span>
        <input
          value={citation}
          onChange={(e) => setCitation(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "authority.rules.parameters" })} (JSON)
        </span>
        <textarea
          value={paramsText}
          onChange={(e) => setParamsText(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        {errorMsg ? (
          <p className="text-xs" style={{ color: "var(--verdict-rejected)" }}>
            {errorMsg}
          </p>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            {intl.formatMessage({ id: "encode.proposal.modify.cancel" })}
          </Button>
          <Button type="submit" variant="default" size="sm" disabled={saving}>
            {intl.formatMessage({ id: "encode.proposal.modify.save" })}
          </Button>
        </div>
      </div>
    </form>
  );
}
