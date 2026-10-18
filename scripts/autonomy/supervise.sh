#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

: "${LKDV_AUTONOMY_ENABLE:=0}"
: "${LKDV_MAX_CYCLES_PER_RUN:=20}"
: "${LKDV_CYCLE_DELAY_SECONDS:=15}"

if [[ "$LKDV_AUTONOMY_ENABLE" != "1" ]]; then
  echo "Autonomy disabled; no model calls made." >&2
  exit 78
fi

cycle=0
while (( cycle < LKDV_MAX_CYCLES_PER_RUN )); do
  if node -e 'const r=require("./docs/autonomy/TASKS.json"); process.exit(r.tasks.every(t=>t.status==="done")?0:1)'; then
    echo "Registry tasks complete. Run the dossier-wide acceptance audit before reporting completion."
    exit 0
  fi

  cycle=$((cycle + 1))
  echo "=== LKDV autonomy cycle $cycle/$LKDV_MAX_CYCLES_PER_RUN ==="
  set +e
  scripts/autonomy/run-cycle.sh
  result=$?
  set -e

  case "$result" in
    0)
      ;;
    78|79)
      echo "Supervisor paused by a safety/precondition gate (exit $result)." >&2
      exit "$result"
      ;;
    80)
      echo "Master dossier missing; copy it outside the repository and configure LKDV_MASTER_DOSSIER." >&2
      exit 80
      ;;
    127)
      echo "Hermes is not installed/configured; supervisor cannot continue." >&2
      exit 127
      ;;
    *)
      echo "Cycle exited with code $result; next cycle will re-check durable state before acting." >&2
      ;;
  esac

  sleep "$LKDV_CYCLE_DELAY_SECONDS"
done

echo "Cycle batch complete; durable task state is preserved. A service manager may restart the supervisor after a short delay."
exit 75
