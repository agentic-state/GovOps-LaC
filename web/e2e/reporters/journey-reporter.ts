/**
 * Custom Playwright reporter — extracts journey IDs (e.g. "[J24]") from test
 * titles and emits a per-journey JSON artifact that the post-run aggregator
 * (web/scripts/build-run-record.mjs) folds into a structured markdown record.
 *
 * Each test title MUST start with "[Jxx]" or "[Mxx]" to participate. Tests
 * without a journey tag fall into the "unattributed" bucket and emit a
 * warning at run end.
 *
 * The reporter writes:
 *   test-results-deploy/journey-records/{JID}.json
 *     One file per journey; multiple tests with the same JID are aggregated.
 *   test-results-deploy/journey-records/_run.json
 *     Run-level metadata (target, start time, total duration, target version).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

type JourneyEntry = {
  id: string;
  title: string;
  tests: Array<{
    project: string;
    title: string;
    status: TestResult["status"];
    duration_ms: number;
    error?: string;
    annotations?: Array<{ type: string; description?: string }>;
    attachments?: Array<{ name: string; path?: string }>;
  }>;
};

const JID_RE = /\[(J\d+|M\d+)\]/;

function parseJourneyId(titlePath: string[]): { id: string | null; clean: string } {
  // Search the full title path (file > describe > test) for the first [Jxx] tag.
  // This lets a describe-block tag flow down to every test inside it without
  // requiring per-test prefixing.
  for (const segment of titlePath) {
    const m = segment.match(JID_RE);
    if (m) return { id: m[1], clean: titlePath[titlePath.length - 1].replace(JID_RE, "").trim() };
  }
  return { id: null, clean: titlePath[titlePath.length - 1] };
}

export default class JourneyReporter implements Reporter {
  private records = new Map<string, JourneyEntry>();
  private unattributed: string[] = [];
  private startedAt = 0;
  private outDir = "";
  private target = "";

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startedAt = Date.now();
    // Anchor on process.cwd() — bench is always invoked from web/ via the
    // npm scripts. config.rootDir returns the testDir, which would put the
    // records under web/e2e/ and break the build-run-record.mjs aggregator.
    this.outDir = path.join(process.cwd(), "test-results-deploy", "journey-records");
    fs.mkdirSync(this.outDir, { recursive: true });
    this.target = (process.env.TEST_BENCH_TARGET ?? "https://agentic-state-govops-lac.hf.space").replace(/\/$/, "");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const titlePath = test.titlePath();
    const { id, clean } = parseJourneyId(titlePath);
    if (!id) {
      this.unattributed.push(titlePath.join(" > "));
      return;
    }
    const entry = this.records.get(id) ?? { id, title: clean, tests: [] };
    entry.tests.push({
      project: test.parent.project()?.name ?? "unknown",
      title: clean,
      status: result.status,
      duration_ms: result.duration,
      error: result.error?.message,
      annotations: test.annotations.map((a) => ({ type: a.type, description: a.description })),
      attachments: result.attachments.map((a) => ({ name: a.name, path: a.path })),
    });
    this.records.set(id, entry);
  }

  async onEnd(result: FullResult) {
    for (const [id, entry] of this.records) {
      fs.writeFileSync(path.join(this.outDir, `${id}.json`), JSON.stringify(entry, null, 2));
    }

    let targetVersion: string | undefined;
    try {
      const res = await fetch(`${this.target}/api/health`);
      if (res.ok) {
        const j = (await res.json()) as { version?: string };
        targetVersion = j.version;
      }
    } catch {
      // best-effort
    }

    const run = {
      target: this.target,
      target_version: targetVersion,
      started_at: new Date(this.startedAt).toISOString(),
      duration_ms: Date.now() - this.startedAt,
      status: result.status,
      journeys: Array.from(this.records.keys()).sort(),
      unattributed_count: this.unattributed.length,
      unattributed_titles: this.unattributed,
    };
    fs.writeFileSync(path.join(this.outDir, "_run.json"), JSON.stringify(run, null, 2));

    if (this.unattributed.length > 0) {
      console.warn(
        `\n[journey-reporter] ${this.unattributed.length} test(s) without a [Jxx]/[Mxx] tag — they will not appear in the run record:`,
      );
      for (const t of this.unattributed.slice(0, 10)) console.warn(`  - ${t}`);
      if (this.unattributed.length > 10) console.warn(`  ... and ${this.unattributed.length - 10} more`);
    }
    console.log(`\n[journey-reporter] wrote ${this.records.size} journey records to ${this.outDir}`);
  }
}
