#!/usr/bin/env bash
# Pre-commit gate: when Claude is about to run `git commit`, ensure pytest is green.
# Blocks the commit (exit 2) if tests fail. No-op for any other Bash call.
#
# Wired in .claude/settings.json under hooks.PreToolUse for matcher "Bash".
# See PLAN.md §6 (test budget per phase) and CLAUDE.md (tests must stay green at every phase exit).

input=$(cat)
command=$(printf '%s' "$input" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# Activate venv if present (cross-platform)
if [ -f .venv/Scripts/activate ]; then
  # shellcheck disable=SC1091
  source .venv/Scripts/activate
elif [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

LOG=/tmp/govops-pytest-pre-commit.log
if ! pytest -q >"$LOG" 2>&1; then
  echo "BLOCKED: pytest failed; commit cancelled." >&2
  echo "See $LOG (last 20 lines below):" >&2
  tail -20 "$LOG" >&2
  exit 2
fi

exit 0
