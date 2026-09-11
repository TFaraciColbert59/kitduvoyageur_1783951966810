# A13 (S2) — Trois plans réellement comparables + sélection/matérialisation

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`), base locale
`postgresql://…@127.0.0.1:54322/postgres`. Plan source :
`docs/superpowers/plans/a13-l3-produit-bout-en-bout.md` (flux S2). Périmètre :
comparabilité réelle des candidats, tableau comparatif dérivé des prédictions
S1, route de sélection matérialisée, RPC transactionnelle idempotente, tests
vitest `TEST-A13-CAND-01..05` + `TEST-A13-SELECT-01..06`, pgTAP
`a13_materialize_candidate`. Aucun flag modifié, aucun secret, aucun push
distant.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `951d36d4` | `feat(db): A13 RPC a13_materialize_candidate (selection transactionnelle idempotente service_role)` | migration + pgTAP |
| `8873e23a` | `feat(ai): S2 trois plans comparables et selection materialisee (comparaison derivee S1, route select, GET candidateComparison)` | domaine + serveur + routes + tests |
| ce commit | `docs(a13): rapport S2 plans comparables et selection materialisee` | ce rapport |

## A. DDL — `a13_materialize_candidate` (`951d36d4`)

Fichier : `supabase/migrations/20260911430000_a13_materialize_candidate.sql`.
Signature : `public.a13_materialize_candidate(p_user_id uuid, p_plan_id uuid,
p_version jsonb, p_decision jsonb) RETURNS integer`.

- `SECURITY DEFINER` + `SET search_path = public, pg_temp`, `REVOKE public/anon/
  authenticated`, `GRANT EXECUTE service_role` uniquement.
- Transaction unique : propriété vérifiée sous `FOR UPDATE` (plan inexistant ⇒
  `… introuvable`, non-propriétaire ⇒ `… non détenu`), insertion de la version
  `GREATEST(current_version, MAX(version)) + 1`, mise à jour de
  `adventure_plans.current_version/updated_at`, décision `decision_type='other'`,
  `status='confirmed'`, `decided_by=p_user_id`, `decided_at=now()`.
- Idempotence : `snapshot->>'candidateId'` déjà matérialisé ⇒ renvoie la version
  existante, sans nouvelle version ni nouvelle décision.
- Garde-fous : `p_version.snapshot.candidateId` obligatoire (jamais de sélection
  implicite), `p_version.snapshot` objet obligatoire.
- Migration additive, `CREATE OR REPLACE` + grants idempotents, rejouable.

## B. Comparabilité réelle (`8873e23a`)

`domain/candidatePlans.ts` — les trois candidats partagent désormais **la même
route, les mêmes dates et les mêmes hébergements** (`activityRoutes`,
`terrainAnalysis`, `accommodations`, `dailyStages`, `plan.dates` strictement
égaux au plan de référence, clonés en profondeur). Les seules dimensions qui
diffèrent sont autorisées et documentées :

- **Stratégie d'allure** : les trois prédictions de la route partagée restent
  identiques ; chaque variante sélectionne sa primaire (`comfort` /
  `recommended` / `fast`).
- **Marges / pauses** : le delta de durée publié A6 est appliqué explicitement
  aux pauses de la primaire (P50/P90/ETA ajustés), jamais à la distance ni aux
  dates.
- **Budget** : delta publié appliqué au total, à la part par personne et au
  résumé.
- **Difficulté personnelle** : delta d'effort publié, borné 0..100.
- **Confort / risque / incertitude** : portés par les annotations
  `alternatives` et les raisons de confiance.

Nouveau type `AdventureCandidateComparison` (+ `…Row`) : durée P50/P90, pauses,
budget, difficulté, confort, risques, incertitude, avec provenance
`computed|estimated`, notes et `reasons[]`. `durationSource = computed` quand la
segmentation S1 est `map_matched` (valeur réellement dérivée des prédictions),
`estimated` pour le repli `uniform_from_blueprint` explicite ; budget et
difficulté sont des estimations documentées par les deltas A6.

`generateAdventure` expose `candidateComparison` à côté de `candidatePlans` et
le persiste dans `snapshot.candidateComparison`. `GET /api/adventure/[id]`
l'expose quand la version courante le contient.

## C. Sélection matérialisée (`8873e23a`)

- `POST /api/adventure/[id]/select` : auth (401), `{ candidateId }` Zod (400),
  plan inconnu (404), non-propriétaire (403) sans RPC, candidat inconnu (400),
  service requis (503). Appelle la RPC via le client service_role, renvoie
  `200 { version }`.
- `buildCandidateMaterialization` (domaine pur) construit le payload version :
  snapshot du candidat identifié par `snapshot.candidateId`, version suivante,
  `generated_by='a13-select'`, décision confirmée. Le snapshot matérialisé
  embarque `candidates` + `candidateComparison` pour que `GET` reste complet
  après sélection.
- L'identité de variante est lue dans `alternatives[].selected` — aucune
  correspondance par index implicite.

## D. Preuves TDD / TAP

TDD strict RED → GREEN :

| Étape | Preuve |
| --- | --- |
| RED vitest | `Error: Cannot find package '@/app/api/adventure/[id]/select/route' imported from …candidate-comparison.spec.ts` (0 test exécuté) |
| GREEN vitest (fichier seul) | `Tests 11 passed` (`TEST-A13-CAND-01..05` + `TEST-A13-SELECT-01..06`) |
| RED pgTAP | `ERROR: function public.a13_materialize_candidate(uuid, uuid, jsonb, jsonb) does not exist` — `Failed 19/19 subtests` |
| GREEN pgTAP (fichier seul) | `All tests successful. Files=1, Tests=19` |
| Suite pgTAP complète | `Files=12, Tests=188. Result: PASS` (0 `not ok`) |
| Suite vitest complète | `Test Files 265 passed | 1 skipped (266)` ; `Tests 1918 passed | 6 skipped (1924)` |
| Static | `npm run type-check` exit 0 ; `npm run lint` exit 0 ; `node scripts/verify/ci_invariants.mjs` exit 0 |
| Migration | appliquée en local (`supabase migration up --db-url …54322`) |

Couverture pgTAP : matérialisation propriétaire (version 2 + snapshot), atomicité
version/`current_version`/décision confirmée, idempotence sur rejeu (1 version,
1 décision), candidat suivant ⇒ version 3, refus non-propriétaire sans écriture,
plan inconnu, `candidateId` manquant, `SECURITY DEFINER` + `search_path`
verrouillé, EXECUTE réservé à service_role, refus `42501` en rôle
`authenticated`.

Couverture vitest : `CAND-01` route/dates/hébergements partagés, `CAND-02`
différences bornées et justifiées (`Allure`/`Marge`/`Effort`/`Budget`), `CAND-03`
comparaison dérivée des prédictions S1 (`computed`, P50/P90/pauses égaux aux
primaires), `CAND-04` repli explicite (`estimated`, notes non silencieuses),
`CAND-05` matérialisation idempotente/traçable, `SELECT-01..06` route mockée +
exposition GET conditionnelle.

## E. Écarts / points d'attention

- **S2 change volontairement la sémantique A11** : les distances ne sont plus
  mises à l'échelle par variante (comparabilité « même route ») ;
  `TEST-A11-CAND-02` est mis à jour en conséquence. Le delta d'effort migre sur
  la difficulté personnelle, le delta de durée sur les pauses. Les anciens
  totaux par variante (distance ×1.12, jours tampon) ne s'appliquent plus.
- Après sélection, `snapshot.candidates` reste exposé (embarqué dans la version
  matérialisée) : `GET` continue de servir les trois plans ; l'idempotence RPC
  reste clé sur `snapshot->>'candidateId'`.
- Le routeur de sélection renvoie 400 pour un `candidateId` inconnu (choix
  documenté) ; 404/403 sont mappés aussi sur les erreurs de la RPC.
- Migration appliquée à la base **locale** uniquement (pas de push distant,
  contrainte de mission).
- `durationSource` reste `computed` même quand une marge estimée est appliquée
  aux pauses : la base P50/P90 est la prédiction S1 réelle, la marge est
  documentée dans `durationNotes`/`reasons[]`.
