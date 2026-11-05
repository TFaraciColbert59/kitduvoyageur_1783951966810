#!/usr/bin/env bash
# Portes de qualité du Kit Studio v2 (T20). Sortie courte ; code 1 au premier groupe d'échecs.
# Usage : bash scripts/verify-kit-studio.sh   (depuis la racine du dépôt)
set -uo pipefail
KS=src/features/kit-studio
APP=src/app/kit-studio
fail=0
say(){ printf '%-34s %s\n' "$1" "$2"; }

# 1. Garde-fou /compas : aucun fichier du Compas touché par la branche.
if git diff --name-only origin/main...HEAD 2>/dev/null | grep -E '^src/(app|features)/compas/' >/dev/null; then
  say "compas intact" "ÉCHEC"; fail=1
else
  say "compas intact" ok
fi

# 2. Couleurs littérales : uniquement dans les palettes (domain/palette*.ts, palette.scene.ts).
n=$(grep -rEn '#[0-9a-fA-F]{3,8}\b|rgba\(0, ?0, ?0' $KS $APP \
  --include=*.ts --include=*.tsx --include=*.css 2>/dev/null \
  | grep -v 'domain/palette' | grep -v '__tests__' | wc -l | tr -d ' ')
[ "$n" -eq 0 ] && say "couleurs littérales" ok || { say "couleurs littérales" "ÉCHEC ($n)"; fail=1; }

# 3. Pas d'innerHTML, de HTML injecté ni de console.log.
n=$(grep -rEn 'innerHTML|dangerouslySetInnerHTML|console\.log' $KS $APP 2>/dev/null | grep -v __tests__ | wc -l | tr -d ' ')
[ "$n" -eq 0 ] && say "innerHTML / console.log" ok || { say "innerHTML / console.log" "ÉCHEC ($n)"; fail=1; }

# 4. Orange interdit (identité LKDV).
if grep -rEn '#E4501C' $KS $APP 2>/dev/null | head -1 | grep -q .; then
  say "orange interdit" ÉCHEC; fail=1
else
  say "orange interdit" ok
fi

# 5. Typage complet, lint et tests du module.
# Le typage complet dépasse le tas Node par défaut sur un Mac de 8 Go.
if NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}" npx tsc --noEmit -p . >/tmp/ks-tsc.log 2>&1; then say typage ok; else say typage ÉCHEC; tail -10 /tmp/ks-tsc.log; fail=1; fi
if npx eslint $KS $APP --max-warnings=0 >/tmp/ks-eslint.log 2>&1; then say eslint ok; else say eslint ÉCHEC; tail -15 /tmp/ks-eslint.log; fail=1; fi
if npx vitest run $KS --reporter=dot >/tmp/ks-vitest.log 2>&1; then say vitest ok; else say vitest ÉCHEC; tail -15 /tmp/ks-vitest.log; fail=1; fi

# 6. Conformité identité / vie privée existantes.
for s in scripts/verify/identity_compliance.mjs scripts/verify/traveller_privacy.mjs; do
  [ -f "$s" ] || continue
  if node "$s" >/dev/null 2>&1; then say "$(basename "$s")" ok; else say "$(basename "$s")" ÉCHEC; fail=1; fi
done

exit $fail
