#!/usr/bin/env bash
# Portes de qualité du Kit Studio. Sortie courte ; code 1 au premier groupe d'échecs.
set -uo pipefail
KS=src/features/kit-studio; fail=0
say(){ printf '%-34s %s\n' "$1" "$2"; }
# 1. Garde-fou /compas
if git diff --name-only origin/main...HEAD 2>/dev/null | grep -E '^src/(app|features)/compas/' >/dev/null; then say "compas intact" "ÉCHEC"; fail=1; else say "compas intact" ok; fi
# 2. Couleurs littérales hors palette
n=$(grep -rEn '#[0-9a-fA-F]{3,8}\b|rgba\(0, ?0, ?0' $KS src/app/kit-studio --include=*.ts --include=*.tsx --include=*.css 2>/dev/null | grep -v 'domain/palette' | grep -v '__tests__' | wc -l)
[ "$n" -eq 0 ] && say "couleurs littérales" ok || { say "couleurs littérales" "ÉCHEC ($n)"; grep -rEn '#[0-9a-fA-F]{3,8}\b|rgba\(0, ?0, ?0' $KS src/app/kit-studio --include=*.ts --include=*.tsx --include=*.css | grep -v 'domain/palette' | head -10; fail=1; }
# 3. innerHTML et console.log
n=$(grep -rEn 'innerHTML|dangerouslySetInnerHTML|console\.log' $KS src/app/kit-studio 2>/dev/null | grep -v __tests__ | wc -l)
[ "$n" -eq 0 ] && say "innerHTML / console.log" ok || { say "innerHTML / console.log" "ÉCHEC ($n)"; fail=1; }
# 4. Orange interdit
grep -rEn '#E4501C' $KS src/app/kit-studio 2>/dev/null | head -1 | grep -q . && { say "orange interdit" ÉCHEC; fail=1; } || say "orange interdit" ok
# 5. Typage, lint, tests du module
npx tsc --noEmit -p . 2>&1 | head -20 | tee /tmp/ks-tsc.log | grep -q 'error TS' && { say typage ÉCHEC; cat /tmp/ks-tsc.log; fail=1; } || say typage ok
npx eslint $KS src/app/kit-studio --max-warnings=0 2>&1 | tail -15 | tee /tmp/ks-eslint.log | grep -Eq 'error|warning' && { say eslint ÉCHEC; cat /tmp/ks-eslint.log; fail=1; } || say eslint ok
npx vitest run $KS --reporter=dot 2>&1 | tail -15 | tee /tmp/ks-vitest.log | grep -Eq 'FAIL|failed' && { say vitest ÉCHEC; cat /tmp/ks-vitest.log; fail=1; } || say vitest ok
# 6. Conformité identité / vie privée existantes
for s in scripts/verify/identity_compliance.mjs scripts/verify/traveller_privacy.mjs; do [ -f "$s" ] && { node "$s" >/dev/null 2>&1 && say "$(basename $s)" ok || { say "$(basename $s)" ÉCHEC; fail=1; }; }; done
exit $fail
