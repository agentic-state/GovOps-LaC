# Security Policy

## Scope

GovOps is an independent open-source prototype published as a public good under Apache 2.0. It is **not** an authoritative operational system, **not** affiliated with any government, agency, or initiative, and the legislative text shipped with the demo is publicly available law interpreted by the author for illustrative purposes only — see the disclaimer in [README.md](README.md).

That said, the codebase implements load-bearing primitives (deterministic rule engine, dated configuration substrate, Ed25519 federation, dual-approval governance) that other projects may fork and run. Vulnerabilities in those primitives matter, and we want to know about them.

## Supported versions

| Version | Status |
| --- | --- |
| `v2.0.x` (`main`) | Supported — security fixes accepted as PRs or via the disclosure path below |
| Pre-`v2.0.0` | Not supported — squashed at v2 launch; older tags do not exist |

## Reporting a vulnerability

**Please do not open a public issue.** Use one of these private channels:

- **GitHub private vulnerability report**: [github.com/agentic-state/GovOps-LaC/security/advisories/new](https://github.com/agentic-state/GovOps-LaC/security/advisories/new) — preferred; preserves coordinated-disclosure timing
- **Email** (back-up): the maintainer's contact is on the GitHub profile linked from any commit

What to include:
- A minimal reproduction (code snippet, request, or steps)
- The affected file(s) and line numbers if known
- The impact (information disclosure, code execution, integrity bypass, etc.)
- Whether you've already disclosed elsewhere

## What you can expect

- **Acknowledgement** within 7 days of report
- **Initial assessment** within 14 days
- **Coordinated fix and disclosure** — for credible reports, a fix lands on `main` and a security advisory is published. Severity follows [GitHub's CVSS scoring](https://docs.github.com/en/code-security/security-advisories)
- **Credit** in the advisory unless you ask to remain anonymous

## Out of scope

- Vulnerabilities in third-party dependencies — please report those upstream first; GitHub's Dependabot already monitors this repo's dependency graph and security updates land automatically
- Issues that require physical access to a maintainer's machine
- "Best practice" suggestions that aren't actual vulnerabilities (those are welcome as regular issues or PRs)
- The accuracy of the legislative interpretation in seed data — it is illustrative, not authoritative; see the disclaimer

## Security posture in v2.0

The `main` branch CI matrix runs:
- **CodeQL** code-scanning on every push
- **Gitleaks** secret-scanning on every push
- **GitHub native secret scanning + push protection** (enabled at the repo level)
- **Dependabot security updates** (auto-PRs for vulnerable dependencies)

The federation pipeline (Phase 8, [ADR-009](docs/design/ADRs/ADR-009-federation-trust-model.md)) ships fail-closed: unsigned packs are rejected by default; trust decisions are YAML PRs reviewed by humans, not API calls.

There is **no AuthN / AuthZ** in v2.0 — the demo runs anonymous everywhere. Production hardening (auth, multi-tenancy, rate limiting, observability) is parked in PLAN.md §11 as a separate track.
