#!/usr/bin/env bash
# Recette Communauté v2 — exécution des preuves déterministes sur le serveur v2.
#
# Prérequis (faits par le Lead) :
#   NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key npm run build
#   NEXT_PUBLIC_COMMUNAUTE_V2=true NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key npm run start   # 4028
#
# Usage : bash docs/audit/communaute-v2-2026-11-08/recette/run-preuves.sh
#
# Sorties dans docs/audit/communaute-v2-2026-11-08/recette/preuves-run/ :
#   e2e-mobile-chromium.log, e2e-mobile-webkit.log, a11y.log, visual.log,
#   capture.log, RESUME.txt (comptages exacts à recopier dans PREUVES.md).
# Le script n'invente rien : si le serveur ne répond pas, il sort en code 2.

set -uo pipefail

export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://fixture.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-fixture-anon-key}"
export PW_BASE_URL="${PW_BASE_URL:-http://127.0.0.1:4028}"
export NEXT_PUBLIC_COMMUNAUTE_V2=true

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT" || exit 2
OUT="docs/audit/communaute-v2-2026-11-08/recette/preuves-run"
mkdir -p "$OUT"

echo "[preuves] racine : $ROOT"
echo "[preuves] base   : $PW_BASE_URL"

STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$PW_BASE_URL/" || true)"
if [ "$STATUS" = "000" ] || [ -z "$STATUS" ]; then
  echo "[preuves] ERREUR : serveur injoignable sur $PW_BASE_URL — aucune preuve écrite (pas de faux vert)."
  exit 2
fi
echo "[preuves] serveur HTTP $STATUS"

E2E_CONFIG="docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts"
SUMMARY="$OUT/RESUME.txt"
: > "$SUMMARY"
echo "Recette Communauté v2 — $(date -Iseconds)" >> "$SUMMARY"
echo "base=$PW_BASE_URL build=NEXT_PUBLIC_COMMUNAUTE_V2=true supabase=$NEXT_PUBLIC_SUPABASE_URL" >> "$SUMMARY"
echo >> "$SUMMARY"

run_step() {
  local name="$1"; shift
  echo "[preuves] === $name ==="
  "$@" 2>&1 | tee "$OUT/$name.log"
  local code="${PIPESTATUS[0]}"
  local counts
  counts="$(grep -E '[0-9]+ (passed|failed|skipped|did not run)' "$OUT/$name.log" | tail -3 | tr '\n' ' ')"
  echo "$name : exit=$code ${counts:-'(pas de comptage)'}" >> "$SUMMARY"
  return 0
}

# 1) e2e @ui-mock — les deux projets mobiles (compte + exécution).
run_step e2e-mobile-chromium npx playwright test \
  --config="$E2E_CONFIG" tests/e2e/communaute-v2-explorer.spec.ts \
  tests/e2e/communaute-v2-creation.spec.ts tests/e2e/communaute-v2-invite.spec.ts \
  tests/e2e/communaute-v2-flag.spec.ts \
  --project=mobile-chromium --reporter=list

run_step e2e-mobile-webkit npx playwright test \
  --config="$E2E_CONFIG" tests/e2e/communaute-v2-explorer.spec.ts \
  tests/e2e/communaute-v2-creation.spec.ts tests/e2e/communaute-v2-invite.spec.ts \
  --project=mobile-webkit --reporter=list

# 2) axe — deux tiroirs ouverts.
run_step a11y npx playwright test tests/a11y/e2e/communaute-v2-a11y.spec.ts \
  --config=playwright.a11y.config.ts --project=iphone-14-pro --reporter=list

# 3) Visuel — génère les références (si absentes), puis vérifie qu'elles passent.
run_step visual-update npx playwright test tests/visual/communaute-v2-visual.spec.ts \
  --config=playwright.visual.config.ts --project=iphone-14-pro-chromium \
  --update-snapshots --reporter=list
run_step visual-verify npx playwright test tests/visual/communaute-v2-visual.spec.ts \
  --config=playwright.visual.config.ts --project=iphone-14-pro-chromium --reporter=list

# 4) Captures de recette (harnais d'intégration des fondations).
run_step capture node docs/audit/communaute-v2-2026-11-08/recette/capture-v2.mjs

echo
echo "[preuves] résumé : $SUMMARY"
cat "$SUMMARY"
echo "[preuves] Logs complets : $OUT/"
