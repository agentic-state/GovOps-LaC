"""Phase 2 regression guard.

Fails CI if any business constant slips back into seed.py, jurisdictions.py,
i18n.py, or engine.py. Per ADR-004, every business constant must resolve
through the LEGACY_CONSTANTS registry (Phase 2) or the YAML substrate
(Phase 3+). New inline literals are a regression.

Forbidden patterns (regex per file):
- seed.py / jurisdictions.py: ``parameters={...inline-literal-dict...}``
  Any LegalRule.parameters dict whose values are not resolve_param() calls.
- i18n.py: an inline ``_TRANSLATIONS`` dict, or any direct dict literal that
  encodes locale-keyed strings.
- engine.py: hardcoded evidence-type tuples like ``("birth_certificate", ...)``
  or hardcoded country lists like ``("CA", "CANADA", "CAN")``.

Run: ``python scripts/check_no_hardcoded_constants.py``
Exit 0 on clean, 1 on any hit.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "govops"

# (file, regex pattern, human description)
CHECKS = [
    (
        SRC / "seed.py",
        # parameters={"foo": <not-resolve-param>...}
        re.compile(r'parameters=\{[^}]*"[a-z_]+":\s*(?!resolve_param\b)[\d\["]'),
        "inline rule.parameters literal in seed.py",
    ),
    (
        SRC / "jurisdictions.py",
        re.compile(r'parameters=\{[^}]*"[a-z_]+":\s*(?!resolve_param\b)[\d\["]'),
        "inline rule.parameters literal in jurisdictions.py",
    ),
    (
        SRC / "i18n.py",
        re.compile(r'_TRANSLATIONS\s*[:=]\s*\{', re.MULTILINE),
        "inline _TRANSLATIONS dict in i18n.py (use LEGACY_CONSTANTS)",
    ),
    (
        SRC / "engine.py",
        # Hardcoded evidence-type or country tuples (specific known sets).
        re.compile(
            r'\(\s*"birth_certificate"|'
            r'\(\s*"tax_record"|'
            r'\(\s*"CA",\s*"CANADA"'
        ),
        "hardcoded engine.threshold tuple in engine.py",
    ),
]


def main() -> int:
    failures: list[str] = []
    for path, pattern, label in CHECKS:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for match in pattern.finditer(text):
            line_no = text[: match.start()].count("\n") + 1
            failures.append(f"  {path.relative_to(ROOT)}:{line_no}: {label}")

    if failures:
        print("Phase 2 regression check failed.")
        print("Forbidden inline constants found:")
        for line in failures:
            print(line)
        print(
            "\nFix: move the value into src/govops/legacy_constants.py via "
            "register_legacy(<key>, <value>) and read it through "
            "resolve_param(<key>)."
        )
        return 1

    print("Phase 2 regression check passed: no business constants in code.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
