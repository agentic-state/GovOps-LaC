#!/usr/bin/env bash
# Post-edit warn: after Claude edits a .py file, run pytest --collect-only to
# catch syntax errors and import breaks immediately. Warn-only — does not block.
# The pre-commit hook is the actual gate.
#
# Wired in .claude/settings.json under hooks.PostToolUse for matcher "Edit|Write".

input=$(cat)
file_path=$(printf '%s' "$input" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

case "$file_path" in
  *.py) ;;
  *) exit 0 ;;
esac

# Only fire for files inside this project
case "$file_path" in
  *"/61-GovOps/"*|*"\\61-GovOps\\"*|*"/GovOps-LaC/"*|*"\\GovOps-LaC\\"*) ;;
  *) exit 0 ;;
esac

if [ -f .venv/Scripts/activate ]; then
  # shellcheck disable=SC1091
  source .venv/Scripts/activate
elif [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

LOG=/tmp/govops-pytest-collect.log
if ! pytest --collect-only -q >"$LOG" 2>&1; then
  echo "WARN: pytest --collect-only failed after editing $file_path" >&2
  echo "Likely a syntax error or import break. See $LOG (last 10 lines):" >&2
  tail -10 "$LOG" >&2
  # Do NOT exit non-zero — this is warn-only. The pre-commit hook gates commits.
fi

exit 0
