import { useIntl } from "react-intl";
import type { EncodeMethod } from "@/lib/types";

const KEY: Record<EncodeMethod, string> = {
  manual: "encode.method.manual",
  "llm:claude": "encode.method.llm",
  "manual:llm-fallback": "encode.method.llm_fallback",
};

export function MethodChip({ method }: { method: EncodeMethod }) {
  const intl = useIntl();
  return (
    <span
      className="inline-flex items-center rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-xs"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {intl.formatMessage({ id: KEY[method] })}
    </span>
  );
}
