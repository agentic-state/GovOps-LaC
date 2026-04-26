import type { FixtureRunResult } from "./api";

/**
 * Generate a downloadable PDF summary of one or more fixture runs.
 *
 * Layout: cover with prompt key + run count; per-run section with metrics,
 * proposals list, and a truncated raw response. Pure client-side — no
 * backend hop, so it works in preview against the mock pipeline.
 *
 * `jspdf` weighs ~360 kB gzipped — imported dynamically so it's only
 * loaded when the maintainer actually clicks "Export". This trims the
 * prompt-editor route chunk by ~1.7 MB.
 */
export async function exportFixtureReport(opts: { promptKey: string; runs: FixtureRunResult[] }) {
  const { promptKey, runs } = opts;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (text: string, size: number, opts2?: { mono?: boolean; bold?: boolean }) => {
    doc.setFont(opts2?.mono ? "courier" : "helvetica", opts2?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  // Cover
  writeLines("GovOps — Fixture test report", 20, { bold: true });
  y += 6;
  writeLines(`Prompt key: ${promptKey}`, 11, { mono: true });
  writeLines(`Generated: ${new Date().toISOString()}`, 10);
  writeLines(`Runs included: ${runs.length}`, 10);
  y += 12;

  runs.forEach((r, i) => {
    ensureSpace(60);
    writeLines(`Run ${i + 1} of ${runs.length}`, 14, { bold: true });
    writeLines(`Fixture: ${r.fixture_id}`, 10, { mono: true });
    writeLines(
      `Proposals: ${r.proposals_count}   Latency: ${r.latency_ms} ms   Tokens: ${r.token_count ?? "—"}`,
      10,
    );
    y += 4;

    writeLines("Proposals", 12, { bold: true });
    r.proposals.forEach((p, j) => {
      writeLines(`${j + 1}. ${p.rule_type}`, 10, { mono: true, bold: true });
      writeLines(p.description, 10);
      writeLines(`   citation: ${p.citation}`, 9, { mono: true });
      const params = JSON.stringify(p.parameters);
      writeLines(`   parameters: ${params}`, 9, { mono: true });
      y += 2;
    });

    y += 6;
    writeLines("Raw response (truncated)", 11, { bold: true });
    writeLines(r.raw_response.slice(0, 2000), 9, { mono: true });
    y += 14;
  });

  const safeKey = promptKey.replace(/[^a-z0-9._-]+/gi, "_");
  doc.save(`govops-fixture-report-${safeKey}-${Date.now()}.pdf`);
}
