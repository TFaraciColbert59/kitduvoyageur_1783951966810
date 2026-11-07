Tu es l'agent autonome chargé de porter le Kit Studio 3D LKDV ONE dans l'application Le Kit du Voyageur.

Contexte et règles : lis d'abord `CLAUDE.md` du dépôt, puis dans ce bundle `README.md`, `AUDIT.md`, `PLAN.md`, `spec/dom-contract.md` et `spec/data-model.md`.

Objectif : livrer `/materiel/studio`, identique à 100 % à `docs/kit-studio/reference/kit-studio.html`. Identique veut dire que le banc `tests/kit-studio/parity.spec.ts` passe ses trois portes : valeurs du moteur égales, textes égaux à chaque étape, images à 1 % de pixels différents au plus.

Méthode :
1. Exécute `PLAN.md` phase par phase, dans l'ordre, sans sauter de case.
2. Phase 0 d'abord : le banc doit passer la référence contre elle-même (`KS_APP_URL=reference`) avant toute ligne d'application.
3. Porte la référence fonction par fonction, mêmes noms, même ordre. Ne corrige pas ce que l'audit marque « comportement de référence ».
4. Après chaque phase, lance `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run src/features/kit-studio` et le banc de parité. Ne commite jamais un test rouge.
5. Coche une case de `PLAN.md` seulement avec une preuve (sortie de test, capture, requête en base), et écris-la dans `docs/kit-studio/RAPPORT.md`.
6. Migrations : à blanc d'abord, puis application, puis advisors Supabase, chacune avec son rollback.
7. Ne t'arrête que pour un vrai blocage ou une décision qui n'appartient qu'à Tony.

Fin : banc de parité vert sur l'aperçu Vercel, tableau des 19 écarts d'image dans le rapport, fusion et mise en production selon `CLAUDE.md`.
