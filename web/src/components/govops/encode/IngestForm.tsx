import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/button";
import { createEncodingBatch } from "@/lib/api";

export function IngestForm() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [citation, setCitation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [method, setMethod] = useState<"manual" | "llm">("llm");
  const [apiKey, setApiKey] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const dirty =
    title.length > 0 || citation.length > 0 || text.length > 0 || sourceUrl.length > 0 || apiKey.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const valid = title.trim() && citation.trim() && text.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const body = {
        document_title: title.trim(),
        document_citation: citation.trim(),
        source_url: sourceUrl.trim() || undefined,
        input_text: text,
        method,
        ...(method === "llm" && apiKey ? { api_key: apiKey } : {}),
      };
      const batch = await createEncodingBatch(body);
      if (method === "llm" && batch.method !== "llm:claude") {
        setAnnouncement(intl.formatMessage({ id: "encode.new.error.llm_fallback" }));
      }
      // Clear API key from memory immediately.
      setApiKey("");
      navigate({ to: "/encode/$batchId", params: { batchId: batch.id } });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "encode.new.field.title" })}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "encode.new.field.citation" })}
          </span>
          <input
            type="text"
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "encode.new.field.source_url" })}
        </span>
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <fieldset className="space-y-2 rounded-md border border-border bg-surface p-3">
        <legend className="px-1 text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "encode.new.field.method.label" })}
        </legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="method"
              value="llm"
              checked={method === "llm"}
              onChange={() => setMethod("llm")}
            />
            {intl.formatMessage({ id: "encode.new.field.method.llm" })}
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="method"
              value="manual"
              checked={method === "manual"}
              onChange={() => setMethod("manual")}
            />
            {intl.formatMessage({ id: "encode.new.field.method.manual" })}
          </label>
        </div>
        {method === "llm" && (
          <label className="mt-2 block space-y-1 text-sm">
            <span className="block text-xs uppercase tracking-wider text-foreground-muted">
              {intl.formatMessage({ id: "encode.new.field.api_key.label" })}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ fontFamily: "var(--font-mono)" }}
            />
            <span className="block text-xs text-foreground-muted">
              {intl.formatMessage({ id: "encode.new.field.api_key.help" })}
            </span>
          </label>
        )}
      </fieldset>

      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "encode.new.field.text.label" })}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: "var(--font-mono)", minHeight: "60vh" }}
        />
        <span className="block text-xs text-foreground-muted">
          {text.length.toLocaleString()} {intl.formatMessage({ id: "encode.new.field.text.help" })}
        </span>
      </label>

      <div className="flex items-center justify-between gap-2">
        {errorMsg ? (
          <p className="text-xs" style={{ color: "var(--verdict-rejected)" }}>
            {errorMsg}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" variant="agent" disabled={!valid || submitting}>
          {intl.formatMessage({
            id: submitting ? "encode.new.submitting" : "encode.new.submit",
          })}
        </Button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </form>
  );
}
