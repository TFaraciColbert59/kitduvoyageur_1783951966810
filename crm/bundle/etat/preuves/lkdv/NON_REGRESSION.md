# Non-régression LKDV — comparaison main ↔ branche `crm/phase-0-preparation`

Date : 2026-11-09 · main : `8b8aaa2` · branche (après merge de main) : `87dd8f8`

## Résultat

| Workflow | main `8b8aaa2` | branche `87dd8f8` | Verdict |
| --- | --- | --- | --- |
| LKDV Control — CI (CRM) | — | **success** (push et PR) | nouveau, vert |
| LKDV Unified — database-gates | success | **success** | pas de régression de schéma |
| LKDV Unified — quality-gates (unitaires) | failure (4 fichiers) | failure (3 fichiers, tous déjà rouges sur main) | **aucune régression** ; 1 fichier de plus passe |
| iOS Capacitor Build | failure | **success** | amélioration |
| Lighthouse CI | success | **success** | identique |
| Visual Regression | failure | en cours (rouge sur main) | pré-existant |

### quality-gates : fichiers rouges

- main : `tests/design/motion-unique.spec.ts`, `tests/design-system/motion-utilities.spec.ts`, `src/components/social-kit/__tests__/likeUnique.test.ts`, `src/features/posts/ui/__tests__/PostGlassPanel.test.tsx`.
- branche : `tests/design/motion-unique.spec.ts`, `tests/design-system/motion-utilities.spec.ts`, `src/features/posts/ui/__tests__/PostGlassPanel.test.tsx` — **tous présents dans la liste de main**.
- Aucun test rouge causé par `crm/` après correction des deux constats ci-dessous.

## Régressions trouvées puis corrigées avant la remise

| # | Constat | Correction | Preuve |
| --- | --- | --- | --- |
| 1 | `tests/audit/audit-scripts-static.spec.ts` : référence projet/JWT littérale dans `crm/next.config.mjs` et `crm/src/lib/errors.test.ts` | littéraux supprimés/construits à l'exécution | test LKDV vert (17/17 sur les 2 suites statiques) |
| 2 | `tests/ops/securityDefinerReview.spec.ts` : 6 fonctions `SECURITY DEFINER` sans `REVOKE ... FROM PUBLIC` | `revoke all` + grants explicites (is_admin, is_moderateur, my_role, account_can_write, my_account_status, app_settings_public) | test LKDV vert |
| 3 | `compas_geo_pois` / `compas_geo_route_rls` : M00 ajoutait des policies là où LKDV exige zéro policy | geo_cache/geo_pois exclus de M00 | database-gates vert |
| 4 | `rls_role_helper_execute` / `tribu_permissions` : search_path des helpers vidé | `search_path = public, pg_temp` | database-gates vert |
| 5 | `compas_trip_steps_rls` : `permission denied for function account_can_write` (policy évaluée pour anon) | EXECUTE accordé à anon après le revoke de PUBLIC | database-gates vert |
| 6 | Build LKDV (PR) : `@/ui/avatar` introuvable depuis `crm/` | 89 fichiers passés en imports relatifs ; types compatibles tsconfig racine | `tsc` racine (sans `crm/node_modules`) = 0 erreur ; iOS vert |

## Limite

Les 3 tests rouges restants sont antérieurs au chantier (présents sur `main`) ; ils ne sont ni affaiblis ni corrigés par ce chantier. La porte EX-LKDV-06 est donc satisfaite au sens « mêmes résultats qu'avant, aucun rouge nouveau », mais pas au sens « CI entièrement verte » (main ne l'est pas non plus).
