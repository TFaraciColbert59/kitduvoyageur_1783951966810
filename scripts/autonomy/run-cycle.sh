#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

: "${LKDV_AUTONOMY_ENABLE:=0}"
: "${LKDV_PROVIDER_BUDGET_CONFIRMED:=0}"
: "${HERMES_PROVIDER:=deepseek}"
: "${HERMES_MODEL:=deepseek-v4-flash}"
: "${HERMES_MAX_TURNS:=100}"

if [[ "$LKDV_AUTONOMY_ENABLE" != "1" ]]; then
  echo "Autonomy disabled. Set LKDV_AUTONOMY_ENABLE=1 after completing docs/autonomy/BOOTSTRAP_WSL.md." >&2
  exit 78
fi
if [[ "$LKDV_PROVIDER_BUDGET_CONFIRMED" != "1" ]]; then
  echo "Budget guard: provider-side monthly cap <= 20 EUR must be configured and verified first." >&2
  exit 78
fi
if ! command -v hermes >/dev/null 2>&1; then
  echo "Hermes CLI not found. Install and configure Hermes first." >&2
  exit 127
fi

node scripts/autonomy/validate-registry.mjs

# Do not start over a dirty tree: preserve unreviewed human work.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit/stash or inspect changes before autonomous execution." >&2
  git status --short >&2
  exit 79
fi

if node -e 'const r=require("./docs/autonomy/TASKS.json"); process.exit(r.tasks.every(t=>t.status==="done")?0:1)'; then
  echo "All registry tasks are marked done. Check the master-dossier acceptance matrix before declaring project completion."
  exit 0
fi

MASTER_DOSSIER="${LKDV_MASTER_DOSSIER:-$HOME/work/LKDV_Dossier_Technique_Maitre.md}"
if [[ ! -f "$MASTER_DOSSIER" ]]; then
  echo "Master dossier not found at: $MASTER_DOSSIER" >&2
  echo "Copy the supplied dossier outside the public repository and set LKDV_MASTER_DOSSIER if needed." >&2
  exit 80
fi

PROMPT_FILE="$(mktemp)"
trap 'rm -f "$PROMPT_FILE"' EXIT
cat docs/autonomy/HERMES_MISSION.md > "$PROMPT_FILE"
cat >> "$PROMPT_FILE" <<'DOSSIER_START'

## Dossier technique maître — source de vérité privée
DOSSIER_START
cat "$MASTER_DOSSIER" >> "$PROMPT_FILE"
cat >> "$PROMPT_FILE" <<'PROMPT'

## Instruction for this run
Perform ONE independently verifiable task only, or make a bounded attempt to unblock it. Read docs/autonomy/TASKS.json and docs/autonomy/EVIDENCE.md first. Choose the highest-priority task whose dependencies are done; inspect real repository state before acting. Never claim a task is done without the required evidence fields (commitSha, commandsExecuted, result, timestamp). Update the registry and evidence as appropriate. If blocked, record exact cause and next action, then exit instead of repeating the same failure. Do not deploy production or apply production migrations from this cycle. Return a concise machine-readable summary at the end, but the files and command outputs are the source of truth.
PROMPT

echo "Starting one Hermes cycle for the next eligible LKDV task."
hermes chat --oneshot --quiet \
  --provider "$HERMES_PROVIDER" \
  --model "$HERMES_MODEL" \
  --max-turns "$HERMES_MAX_TURNS" \
  --query-file "$PROMPT_FILE"

echo "Hermes cycle ended. Verify git status, registry, evidence, and tests before the next cycle."
