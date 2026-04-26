import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { IngestForm } from "@/components/govops/encode/IngestForm";

export const Route = createFileRoute("/encode/new")({
  head: () => ({
    meta: [{ title: "New extraction — GovOps" }],
  }),
  component: NewEncodePage,
});

function NewEncodePage() {
  const intl = useIntl();
  return (
    <div className="space-y-6">
      <header>
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "encode.new.heading" })}
        </h1>
      </header>
      <IngestForm />
    </div>
  );
}
