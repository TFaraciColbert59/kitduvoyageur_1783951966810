# Rapport a10 — Lot 10.2 (code) — Replay lots 7-10 + fermeture F1

Date : 2026-09-11 · Branche : `audit/adventure-intelligence` · Worktree : `ai-finalization`
Références : spec `docs/superpowers/specs/2026-09-11-a10-p0-finalization-design.md` §10.2 ;
audit `docs/architecture/adventure-intelligence-audit-31bdb279.md` items #2/#3 ;
`docs/reports/A9_SECURITY_AUDIT.md` F1.
Commit : `fix(db): a10 replay lots 7-10 et fermeture F1 public_profiles`.

---

## Deliverable A — Réparation replay des migrations legacy

4 fichiers réparés, édition replay-only, aucune autre migration touchée. Aucun changement
de sémantique métier : uniquement des délimiteurs dollar-quote (déjà appliqués en prod), la
sortie d'`INDEX` inline syntaxiquement invalides, et la normalisation de littéraux JSONB
échappés (voir classe C, indispensable au replay).

| Fichier | Classes de changement | Détail |
| --- | --- | --- |
| `20260810212500_lot7_weight_calculations_and_optimizations.sql` | A (dollar-quotes) | 8 délimiteurs `\$\$` → `$$` (4 fonctions : `calculate_kit_total_weight`, `generate_weight_optimizations`, `get_recommended_weight_profile`, `update_updated_at_column`). Aucun INDEX inline. |
| `20260810213000_lot8_messaging_and_notifications.sql` | A + C | 14 délimiteurs `\$\$` → `$$` (7 fonctions). 30 séquences `\"` → `"` sur 7 lignes de littéraux JSONB (`notification_preferences` : défaut colonne l.25 et défaut `preferences` l.155-160). Aucun INDEX inline. |
| `20260810213500_lot9_security_definer_functions.sql` | A + B (INDEX) | 10 délimiteurs `\$\$` → `$$` (5 fonctions). 3 `INDEX` inline sortis de `security_definer_execution_log` → `CREATE INDEX IF NOT EXISTS` : `idx_execution_log_function_name`, `idx_execution_log_execution_timestamp`, `idx_execution_log_called_by_user`. |
| `20260810214000_lot10_global_validations.sql` | A + B (INDEX) | 20 délimiteurs `\$\$` → `$$` (8 fonctions + 2 blocs `DO`). 5 `INDEX` inline sortis : 3 sur `global_validation_results` (`idx_validation_results_category`, `..._result`, `..._severity`) et 2 sur `lkdv_lot_completion` (`idx_lot_completion_status`, `..._validation`). Virgules de fin de colonne ajustées en conséquence. |

Classe C : les `\"` des deux défauts JSONB de lot8 auraient fait échouer le replay depuis une
base vide (`'{\"...\"}'::jsonb` est un JSON invalide avec `standard_conforming_strings = on`,
défaut PostgreSQL/Supabase). La conversion en `"` restitue le JSON voulu (même valeur que
celle obtenue si le fichier avait été appliqué avec échappement interprété) ; c'est un édit
replay-only, pas un changement sémantique.

Réparations vérifiées :

- `Select-String '\\\$|\\"'` sur les 4 fichiers → **0 occurrence**.
- `Select-String '^\s*INDEX\s'` → **0 occurrence** (plus aucun `INDEX` inline).
- Délimiteurs appariés : lot7 = 4 paires, lot8 = 7, lot9 = 5, lot10 = 10 (fonctions/blocs).
- `git diff` : 76 insertions / 76 suppressions, strictement ces 3 classes.

## Deliverable B — Fermeture F1 (`public_profiles`)

### Migration `supabase/migrations/20260911290000_a10_f1_public_profiles.sql`

- Nom : `20260911290000` (le `20260911280000` cité par la spec est déjà pris par
  `a10_shadow_runs`).
- Colonnes réelles vérifiées : `user_profiles` n'a **pas** de colonne `username`
  (grep sur toutes les migrations : 0 occurrence). Projection retenue :
  `id, full_name, avatar_url, trust_score` — ni email, ni téléphone, ni `role`, ni
  `signature_visibility`, ni préférences.
- Vue SECURITY DEFINER volontaire (défaut PostgreSQL) : RLS activée mais pas FORCE sur
  `user_profiles`, le propriétaire (postgres) contourne la RLS ; `COMMENT ON VIEW` en
  français documente ce point, même patron que `terrain_reports_public`
  (`20260911134000_a1_terrain_live.sql:210-242`).
- `GRANT SELECT ... TO anon, authenticated` + `service_role`.
- `DROP POLICY IF EXISTS "public_read_user_profiles" ON public.user_profiles;` — policy
  legacy confirmée créée en `20260713210000_auth_trigger_and_rls_cleanup.sql:61-65`
  (`FOR SELECT TO public USING (true)`), jamais recréée ensuite.
- Police admin : aucune policy admin SELECT n'existait → ajout gardée
  `user_profiles_select_admin FOR SELECT TO authenticated USING (public.is_admin())`
  (nécessaire aux lectures `src/app/admin/page.tsx`, client navigateur, profils + emails).
- Self-select : déjà couvert par `profile_read_own_visibility` (`id = auth.uid()`,
  `20260904020000`) et `users_manage_own_profiles` → aucune policy ajoutée.
- `anon` reste explicitement refusé en direct par `profile_select_public_subset USING (false)`.

### Helper

- `src/lib/queries/publicProfiles.ts` : `fetchPublicProfiles(ids)` (spec exacte) avec
  `createClient` de `@/lib/supabase/server`, `.in('id', ids)`, dédup + cap 200, `{}` sur
  erreur/exception. Exporte `PublicProfile` (+ constantes/pures réexportées).
- `src/lib/queries/publicProfilesCore.ts` (nouveau, partagé) : type, constantes,
  `limitPublicProfileIds`, `indexPublicProfiles`, `fetchPublicProfilesWith(client, ids)`.
- Écart d'implémentation assumé et documenté : la spec listait carnets/avis (composants
  `'use client'`) pour appeler le helper. Or `publicProfiles.ts` importe statiquement
  `@/lib/supabase/server`, qui charge dynamiquement `next/headers` — aucun composant client
  du dépôt n'importe ce module (le patron client existant est `@/lib/supabase/client`, cf.
  `src/lib/queries/groupe.ts:1`) et la Gate 4 CI est un `next build`. Les pages client
  utilisent donc `fetchPublicProfilesWith(supabase, ids)` du core avec leur client
  navigateur (même logique de dédup/cap/map) ; le serveur garde `fetchPublicProfiles`.

### Call sites migrés (two-step, sans embed FK)

| Fichier | Avant | Après |
| --- | --- | --- |
| `src/app/carnets/page.tsx:261` (commentaires du modal) | embed `author:user_profiles(full_name, avatar_url)` | select sans embed + `fetchPublicProfilesWith` puis merge `author` |
| `src/app/carnets/page.tsx:280` (insert commentaire) | idem | select sans embed + fetch du profil auteur + merge |
| `src/app/carnets/page.tsx:814` (liste carnets) | embed `author:user_profiles(full_name, avatar_url, trust_score)` | select sans embed + fetch batch + merge (mêmes champs affichés) |
| `src/app/avis/page.tsx:204` | embed `author:user_profiles!reviews_user_id_fkey(full_name, trust_score)` | `select('*')` + fetch batch `user_id` + merge |
| `src/features/hub/server/getHubAdventureData.ts:246` | embed `profile:user_profiles!..._fkey(full_name, username, avatar_url)` | `crew_members` sans embed + `fetchPublicProfiles` + `fullName`/`avatarUrl` (username n'existe pas) |

`rg "user_profiles"`sur ces 3 fichiers → **0 occurrence**. `src/app/admin/page.tsx` non
touché (lectures table + policy admin).

### Tests `tests/adventure-intelligence/public-profiles.spec.ts`

- `TEST-A10-F1-01` : dédup + cap 200 (250 ids + doublons + vides) ; `.from('public_profiles')`,
  `select` exact, `.in('id', ...)` borné.
- `TEST-A10-F1-02` : map indexée par id.
- `TEST-A10-F1-03` : `{}` sur erreur PostgREST, sur exception, et sans appel client si liste vide.
- `TEST-A10-F1-04` (statique) : dans `supabase/migrations/`, `public_read_user_profiles`
  n'apparaît plus que dans des `DROP POLICY IF EXISTS` (hors fichier de création historique
  `20260713210000`) ; la migration a10 contient le DROP et aucune recréation.

## Preuves d'exécution

| Commande | Résultat |
| --- | --- |
| `npx vitest run tests/adventure-intelligence` | 50 fichiers / **317 tests verts** |
| `npm run test` (suite complète) | 249 fichiers / **1838 tests verts** |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 (warnings préexistants uniquement ; aucun sur les fichiers a10) |
| `npm run build` | **non lancé** (contrainte de la tâche) |

Aucune commande Supabase lancée (pas de base). `supabase db push` / `supabase test db` sur
la copie fournie par l'humain restent l'étape de validation restante du lot 10.2.

## Concerns

1. **Blast radius F1 (bloquant release)** : après ce DROP, il reste **42 fichiers / 98
   références** à `user_profiles` dans `src/`, dont de nombreux embeds inter-utilisateurs
   côté client qui ne sont pas couverts par les policies restantes (`profile_read_own_visibility`
   = soi-même, `profile_select_public_subset` anon = false, admin). Exemples : clubs
   (`src/app/clubs/**`), communauté (`src/app/communaute/page.tsx`, `PostCard.tsx`,
   `CommentItem.tsx`), événements, guides, pays (`PaysCarnetsList`, `BouteilleALaMer`),
   messagerie, `queries-crews.ts`, `queries/groupe.ts`, `terrainReports.ts`. Sans
   migration complémentaire (ou sans garder la policy jusqu'à la fin de la vague), ces
   lectures inter-utilisateurs casseront pour anon ET authenticated. Le lot 10.2 ne couvre
   que les 3 call sites listés par la spec — à traiter avant exécution en production.
2. Classe C (`\"` → `"`) ajoutée au-delà des deux classes prescrites : indispensable au
   replay depuis une base vide ; concern si un diff strict était attendu.
3. Le helper client passe par `publicProfilesCore` (et non `publicProfiles.ts`) pour ne pas
   embarquer `next/headers` dans le bundle client — à valider implicitement par la Gate 4 CI.
4. Le timestamp `20260911290000` diffère de la spec (`20260911280000` déjà utilisé).
5. Validation BDD non faite : replay vide + copie, `pg_policies` et pgTAP restent à exécuter
   par l'humain (URL de copie non fournie).
