# EVIDENCE — Journal de preuves LKDV (OpenCode + Ralph)

Règle : une entrée = une commande réellement exécutée + le résultat observé.
Aucun secret, token, coordonnée ou donnée personnelle dans ce fichier.
« SPÉCIFIÉ » n'est jamais une preuve.

## EV-0001 — Audit initial du dépôt (2026-10-18)

Commandes : `git status`, `git log --oneline -5`, lecture ciblée des fichiers
d'intégration, `rg` sur les migrations.

Résultats observés :
- Local = `main` au commit `61963cc9…` = commit figé du dossier maître. ✔
- `docs/autonomy/` absent → registre créé (cet EV).
- `src/features/kit-simulation/` absent → KIT-001 créé.
- `enforceRateLimit` (src/lib/rate-limit/routes.ts:25) : signature
  `(identifier, {scope, limit, windowMs, failMode})` — compatible avec la route de référence. ✔
- `createClient` (src/lib/supabase/server.ts:23) asynchrone — compatible. ✔
- `gear_items.product_id uuid REFERENCES shop_products(id)` —
  migration 20260720110000 ligne 7 — précondition SQL du dossier satisfaite localement. ✔
- CI pgTAP : `scripts/db/ci/run_pgtap.sh` ne collecte que
  `supabase/tests/database/*.test.sql` → le fichier copié
  `supabase/tests/kit_simulation_structure.sql` reste inerte (voulu tant que les
  propositions ne sont pas des migrations). ✔
- Dépôt : 361 fichiers de migration (conforme au dossier §3). ✔
- CI : portes type-check, lint, vitest, build, verify:invariants, pgTAP — inchangées. ✔

Non exécuté (à ne pas confondre avec un échec) : accès Supabase staging (P0A-001
bloqué sans identifiants), flux Awin (P2A-001 bloqué).

## EV-0002 — KIT-001 : intégration du socle kit-simulation (2026-10-18)

Contexte de branche : base `main` = `a6b996b6` (contient le commit audité
`61963cc9` comme ancêtre, vérifié par `git merge-base --is-ancestor`).
Commit d'intégration : `edfab012`.

Fidélité des copies (vérifiée par `git cat-file blob` + SHA-256) :
- `core.ts`, `route.ts` : blob Git du dépôt == fichier de l'archive de référence. ✔
- Fichiers réutilisés inchangés : les blobs Git de `shakedownEngine.ts`
  (`f2497d18…`) et `gtin.ts` (`f4aaa33d…`) correspondent aux SHA-256 de
  l'Annexe A du dossier maître. La différence de hash on-disk constatée d'abord
  était le CRLF du checkout Windows (confirmé par comparaison de blobs LF). ✔
- `scripts/security-preflight.sql` : identique à l'archive. ✔

Commandes exécutées et résultats observés :
- `npx vitest run tests/kit-simulation` → 2 fichiers, **45/45 tests passés**,
  durée 574 ms (les 45 tests TAP de l'Annexe C, portés vers vitest sans
  changement de sémantique).
- `npm run type-check` → **EXIT=0** (aucune erreur, sortie vide).
- `node scripts/verify/ci_invariants.mjs` → **EXIT=0**, tous les invariants
  anti-dérive validés (invariants 1a→9).
- `npx eslint src/features/kit-simulation src/app/api/kit-simulation tests/kit-simulation`
  → **EXIT=0** (aucun avertissement).

Décisions d'intégration explicitement prises (fidèles au dossier §29) :
- `package.json` / `package-lock.json` de l'archive **non copiés** : le dossier
  interdit de remplacer ceux de l'application LKDV.
- Workflow `.github/workflows/kit-simulation-reference.yml` **non copié** : la
  CI du dépôt couvre ces tests via Gate 3 (`npm test` vitest). Le workflow de
  référence ne concerne que le sous-projet autonome.
- `tsconfig.reference.json` **non copié** : l'application compile via
  `tsconfig.json` (alias `@/*`, strict) et le type-check complet est vert.
- Tests `.cjs` **non copiés** : portés en specs vitest strictes
  (`tests/kit-simulation/*.spec.ts`), imports directs `src/` sans build dist.
- SQL sous `supabase/proposals/` : inertes (la CI pgTAP ne collecte que
  `supabase/tests/database/*.test.sql` — vérifié dans `run_pgtap.sh`).
- Route `src/app/api/kit-simulation/route.ts` : désactivée par défaut
  (`KIT_SIMULATION_ENABLED !== 'true'` ⇒ 404) ; tables non migrées ⇒ aucun
  risque en production à ce stade.

Blocages inchangés (non exécutés, à ne pas confondre avec des échecs) :
P0A-001 (accès Supabase staging), P2A-001 (compte Awin réel).
PR : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/113

## EV-0003 — KIT-002 : comparaison fantôme noyau vs moteurs historiques (2026-10-18)

Livrables : `tests/kit-simulation/shadow-comparison.spec.ts` (11 tests) et
`docs/kit-simulation/SHADOW-COMPARISON.md` (tableau d'attribution).

Commandes exécutées et résultats observés :
- `npx vitest run tests/kit-simulation/shadow-comparison.spec.ts` →
  **11/11 passés**, 216 ms.
- `npm run type-check` → **EXIT=0**.

Écarts attribués par exécution réelle (fixtures synthétiques, hors ligne) :
- C2 : `departCalculations.calcBaseWeight` ne multiplie pas par la quantité
  (100 g au lieu de 200 g) — comportement historique conservé, anticipé par le
  dossier §8 ; noyau/shakedown/contextual alignés.
- C3/C7 : les historiques shakedown + checklist assimilent un poids inconnu à
  0 g silencieusement ; le noyau publie `null` + `knownPackWeightG` ; le
  contextual expose `unweighedItemsCount` (« incomplet ») — E03/E10.
- C5 : shakedown (4500/9000) et contextual (5000/8000/12000) classifient
  4800 g différemment (light vs ultralight) ; 10000 g (traditional vs
  standard). Le noyau n'expose aucun badge MUL (§10).
- C6 : sac vide → shakedown « ultralight », contextual « none », noyau besoin
  structuré sans badge.
- C7 bis : constante 1000 g/L inventée côté checklist ; le noyau exige des
  grammes en entrée.
- C8/C9 : configurateur jamais de produit inventé (missingItems=[] sans
  catalogue), prix en EUR flottants vs cents entiers du noyau.
- Aucun moteur historique modifié ; aucune écriture en base ; aucun appel
  réseau (garde réseau des tests actif).

## EV-0004 — KIT-004A : tests unitaires de la route à frontières mockées (2026-10-18)

Livrable : `tests/kit-simulation/route.spec.ts` (18 tests). Frontières mockées :
`@/lib/supabase/server` et `@/lib/rate-limit/routes` (convention dépôt
`vi.hoisted` + `vi.mock`, alignée sur `tests/materiel/inventory-routes.spec.ts`).
Aucune connexion réelle ; le garde réseau des tests reste actif.

Commandes exécutées et résultats observés :
- `npx vitest run tests/kit-simulation` → **74/74 passés** (12 affiliate +
  11 comparaison + 33 noyau + 18 route), 290 ms.
- `npm run type-check` → **EXIT=0** (une première passe a révélé une erreur de
  typage du mock — `Mock<Procedure|Constructable>` non callable — corrigée par
  `vi.fn<(...args: unknown[]) => Promise<unknown>>()` ; re-exécution verte).
- `npx eslint tests/kit-simulation` → **EXIT=0**.

Cas couverts (tous exécutés) : 404 drapeau désactivé, 403 Origin, 401 session,
429 quota (Cache-Control no-store conservé), 400 clé d'idempotence, 415 media
type, 400 JSON invalide, 400 schéma strict (commission refusée), 400 borne
invalide, 503 lecture préalable, 503 catalogue, rejeu clé+entrée identiques
(résultat figé, aucune réinsertion), 409 entrée divergente, course 23505
(gagnant servi / divergent 409), 503 insertion, ordre quota-avant-calcul,
candidats bornés par slot (p_limit=24), insert avec user_id + hash 64 hex.

Reste pour KIT-004 (non exécuté, nécessite staging) : session Supabase réelle,
quota Upstash réel, concurrence réelle sur la contrainte UNIQUE.
