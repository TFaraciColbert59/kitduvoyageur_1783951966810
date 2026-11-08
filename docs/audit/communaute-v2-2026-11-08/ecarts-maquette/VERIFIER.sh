#!/usr/bin/env bash
# Vérification de la fidélité maquette — Communauté v2
# Usage : bash docs/audit/communaute-v2-2026-11-08/ecarts-maquette/VERIFIER.sh
#
# Prérequis : Node, dépendances installées, port 4028 libre, ~8 Go de RAM.
# Le script reconstruit le build V2 à backend simulé, lance le serveur, puis
# exécute les portes de vérification. Sortie non nulle à la première porte rouge.
set -euo pipefail
cd "$(dirname "$0")/../../../.."

export NEXT_PUBLIC_COMMUNAUTE_V2=true
export NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key
export CIRCLE_NODE_TOTAL=1
export NODE_OPTIONS=--max-old-space-size=6144
export NEXT_TELEMETRY_DISABLED=1
export PW_BASE_URL=http://127.0.0.1:4028

echo '▸ [1/6] Build V2 (backend simulé)'
pkill -f "next start" 2>/dev/null || true
npx next build > /tmp/fid-build.log 2>&1 || { tail -40 /tmp/fid-build.log; exit 1; }
grep -E 'Compiled successfully|Failed' /tmp/fid-build.log | head -2

echo '▸ [2/6] Serveur 4028'
nohup env CIRCLE_NODE_TOTAL=1 NEXT_PUBLIC_COMMUNAUTE_V2=true \
  NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
  NODE_OPTIONS=--max-old-space-size=6144 npx next start -p 4028 > /tmp/fid-start.log 2>&1 &
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:4028/communaute || true)
  [ -n "$code" ] && [ "$code" != "000" ] && break
  sleep 1
done
echo "  /communaute → $code"

echo '▸ [3/6] Unitaires v2 (création + data + shared + drawer)'
npx vitest run src/features/community/v2 src/components/ui/drawer src/features/community/v2/create \
  > /tmp/fid-vitest.log 2>&1 || { tail -40 /tmp/fid-vitest.log; exit 1; }
grep -E 'Tests  ' /tmp/fid-vitest.log | tail -1

echo '▸ [4/6] e2e Explorer + Création + Invité (Chromium puis WebKit)'
npx playwright test \
  --config=docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts \
  tests/e2e/communaute-v2-explorer.spec.ts tests/e2e/communaute-v2-creation.spec.ts \
  tests/e2e/communaute-v2-invite.spec.ts \
  --project=mobile-chromium --project=mobile-webkit --workers=2 > /tmp/fid-e2e.log 2>&1 \
  || { tail -60 /tmp/fid-e2e.log; exit 1; }
grep -E '[0-9]+ passed' /tmp/fid-e2e.log | tail -1

echo '▸ [5/6] Accessibilité axe'
npx playwright test --config=docs/audit/communaute-v2-2026-11-08/recette/playwright.communaute-v2.config.ts \
  tests/a11y/e2e/communaute-v2-a11y.spec.ts --project=mobile-chromium > /tmp/fid-a11y.log 2>&1 \
  || { tail -40 /tmp/fid-a11y.log; exit 1; }
grep -E '[0-9]+ passed' /tmp/fid-a11y.log | tail -1

echo '▸ [6/6] Recaptures 390×844 (+ 360/430)'
npx playwright test \
  --config=docs/audit/communaute-v2-2026-11-08/ecarts-maquette/playwright.capture.config.ts \
  > /tmp/fid-captures.log 2>&1 || { tail -40 /tmp/fid-captures.log; exit 1; }
python3 - <<'PY'
import json
d = json.load(open('docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2/MANIFEST.json'))
print(f"  captures : {d['ok']}/{d['total']} OK, échecs : {len(d['failed'])}")
PY

echo '✓ Vérification terminée (voir /tmp/fid-*.log)'
