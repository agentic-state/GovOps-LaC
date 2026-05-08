import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronLeft } from "lucide-react";
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
      <Link
        to="/encode"
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        {intl.formatMessage({ id: "encode.list.heading" })}
      </Link>
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
