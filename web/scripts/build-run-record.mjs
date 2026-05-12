#!/usr/bin/env node
/**
 * Aggregates per-journey JSON records (written by journey-reporter.ts)
 * into a single markdown run record under docs/test-bench/runs/.
 *
 * The output filename encodes target + version + timestamp so two runs
 * are diffable with `diff -u`.
 *
 * Usage:
 *   node scripts/build-run-record.mjs
 *
 * Reads:
 *   web/test-results-deploy/journey-records/_run.json
 *   web/test-results-deploy/journey-records/J*.json
 *   web/test-results-deploy/journey-records/M*.json
 *
 * Writes:
 *   docs/test-bench/runs/YYYYMMDD-HHMM-{target-slug}-{version}.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const recordsDir = path.join(webRoot, "test-results-deploy", "journey-records");
const runsDir = path.join(repoRoot, "docs", "test-bench", "runs");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function slugifyTarget(url) {
  return url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function timestamp(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function aggregateStatus(tests) {
  if (tests.length === 0) return "skipped";
  if (tests.some((t) => t.status === "failed" || t.status === "timedOut" || t.status === "interrupted")) return "failed";
  if (tests.every((t) => t.status === "passed")) return "passed";
  if (tests.some((t) => t.status === "passed")) return "flaky";
  return "skipped";
}

function statusIcon(s) {
  return { passed: "PASS", failed: "FAIL", flaky: "FLAKY", skipped: "SKIP" }[s] ?? s.toUpperCase();
}

function main() {
  if (!fs.existsSync(recordsDir)) {
    console.error(`[build-run-record] no records at ${recordsDir} — did the bench run?`);
    process.exit(1);
  }
  const runMetaPath = path.join(recordsDir, "_run.json");
  if (!fs.existsSync(runMetaPath)) {
    console.error(`[build-run-record] missing _run.json — did the journey-reporter execute?`);
    process.exit(1);
  }
  const meta = readJson(runMetaPath);
  const journeyFiles = fs
    .readdirSync(recordsDir)
    .filter((f) => /^[JM]\d+\.json$/.test(f))
    .sort((a, b) => {
      const [, ka, na] = a.match(/^([JM])(\d+)/);
      const [, kb, nb] = b.match(/^([JM])(\d+)/);
      if (ka !== kb) return ka === "J" ? -1 : 1;
      return Number(na) - Number(nb);
    });
  const journeys = journeyFiles.map((f) => readJson(path.join(recordsDir, f)));

  fs.mkdirSync(runsDir, { recursive: true });
  const ts = timestamp(new Date(meta.started_at));
  const targetSlug = slugifyTarget(meta.target);
  const version = meta.target_version ?? "unknown";
  const filename = `${ts}-${targetSlug}-v${version}.md`;
  const outPath = path.join(runsDir, filename);

  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  const lines = [];
  lines.push(`# Test bench run — ${ts}`);
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Target | \`${meta.target}\` |`);
  lines.push(`| Target version | \`${version}\` |`);
  lines.push(`| Started at (UTC) | \`${meta.started_at}\` |`);
  lines.push(`| Duration | ${(meta.duration_ms / 1000).toFixed(1)}s |`);
  lines.push(`| Run status | \`${meta.status}\` |`);
  lines.push(`| Journeys executed | ${journeys.length} |`);
  if (meta.unattributed_count > 0) {
    lines.push(`| Unattributed tests | ${meta.unattributed_count} |`);
  }
  lines.push("");

  lines.push("## Journey results (sorted by ID)");
  lines.push("");
  lines.push("| ID | Title | Status | Tests | Duration | Browsers |");
  lines.push("|---|---|---|---|---|---|");
  for (const j of journeys) {
    const status = aggregateStatus(j.tests);
    counts[status] = (counts[status] ?? 0) + 1;
    const dur = j.tests.reduce((a, t) => a + t.duration_ms, 0);
    const browsers = Array.from(new Set(j.tests.map((t) => t.project))).sort().join(", ");
    lines.push(`| ${j.id} | ${j.title} | ${statusIcon(status)} | ${j.tests.length} | ${(dur / 1000).toFixed(1)}s | ${browsers} |`);
  }
  lines.push("");

  lines.push("## Aggregate");
  lines.push("");
  lines.push(`- passed: ${counts.passed ?? 0}`);
  lines.push(`- failed: ${counts.failed ?? 0}`);
  lines.push(`- flaky: ${counts.flaky ?? 0}`);
  lines.push(`- skipped: ${counts.skipped ?? 0}`);
  lines.push("");

  const failed = journeys.filter((j) => aggregateStatus(j.tests) === "failed");
  if (failed.length > 0) {
    lines.push("## Failures (full detail)");
    lines.push("");
    for (const j of failed) {
      lines.push(`### ${j.id} — ${j.title}`);
      lines.push("");
      for (const t of j.tests.filter((t) => ["failed", "timedOut", "interrupted"].includes(t.status))) {
        lines.push(`- **${t.project}** — ${t.title}`);
        if (t.error) {
          const err = t.error.split("\n").slice(0, 5).join("\n");
          lines.push("  ```");
          lines.push(`  ${err}`);
          lines.push("  ```");
        }
      }
      lines.push("");
    }
  }

  if (meta.unattributed_count > 0) {
    lines.push("## Unattributed tests (no [Jxx]/[Mxx] tag)");
    lines.push("");
    for (const t of meta.unattributed_titles) lines.push(`- ${t}`);
    lines.push("");
  }

  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`[build-run-record] wrote ${path.relative(repoRoot, outPath)}`);
  console.log(`  passed=${counts.passed ?? 0} failed=${counts.failed ?? 0} flaky=${counts.flaky ?? 0} skipped=${counts.skipped ?? 0}`);
}

main();
