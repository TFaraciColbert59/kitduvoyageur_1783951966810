# Task 6 — Rapport pgTAP sécurité domaine A1

**Fichier livré** : `supabase/tests/database/a1_domain_security.test.sql`
**Commit** : `test(db): suite pgTAP a1 — RLS et seuils publics`
**Statut** : écrit + revue statique complète ; exécution BDD impossible ici (aucune base locale — ruling a0).
**Plan** : `SELECT plan(22)` — 22 assertions, toutes numérotées 1..22 dans les descriptions.

## Checklist des 9 tests

| ID | Assertion(s) | Rôle(s) testé(s) | Statut statique |
|---|---|---|---|
| TEST-A1-RLS-01 | 1–2 : B `is_empty` sur `adventure_data_consents` ; A voit 1 (fixture valide) | authenticated | OK |
| TEST-A1-RLS-02 | 3 : `external_readiness` + `granted=true` ⇒ violation policy (rôle authenticated) ; 4 : même insert hors RLS ⇒ violation contrainte `adventure_data_consents_external_readiness_disabled` | authenticated puis rôle session (RESET ROLE) | OK |
| TEST-A1-RLS-03 | 5 : A lit 1 passage (via sa session) ; 6 : B `is_empty` | authenticated | OK |
| TEST-A1-RLS-04 | 7 : A lit 1 profil ; 8 : B `is_empty` | authenticated | OK |
| TEST-A1-RLS-05 | 9 : agrégat `distinct_user_count=4` invisible ; 10 : `=5` visible (1) | anon | OK |
| TEST-A1-RLS-06 | 11 : `reporter_id` absent de `terrain_reports_public` (`information_schema.columns`) ; 12 : `confirmed` non expiré visible ; 13 : `active` non expiré visible ; 14 : `pending` filtré ; 15 : `active` expiré filtré ; 16 : `SELECT` direct sur `terrain_reports` sous tiers authentifié ⇒ 0 ligne | anon (11–15), authenticated tiers (16) | OK |
| TEST-A1-RLS-07 | 17 : A lit son plan ; 18 : B `is_empty` ; 19 : C (collaborateur `trip_collaborators` du trip lié) lit 1 plan via `can_read_trip` | authenticated | OK |
| TEST-A1-RLS-08 | 20 : A voit 1 événement (pas celui de B, pas l'événement `actor_id NULL`) ; 21 : B voit 1 événement | authenticated | OK |
| TEST-A1-RLS-09 | 22 : `claim_pending_adventure_events(10)` ⇒ `permission denied for function` | authenticated | OK |

## Comptage plan(N)

- `plan(22)` ; assertions émises : 22 (2× `is_empty`+1× `is` pour 01 ; 2× `throws_ok` pour 02 ; 2 pour 03 ; 2 pour 04 ; 2 pour 05 ; 1× `ok` + 2× `ok` + 2× `is_empty` + 1× `is_empty` pour 06 ; 3 pour 07 ; 2 pour 08 ; 1 pour 09).
- Vérifié mécaniquement : `rg "SELECT (is_empty|is|ok|throws_ok)\("` = 22 occurrences ; comptage identique au `plan(22)`.
- Fin : `SELECT * FROM finish(); ROLLBACK;` — aucune écriture persistante.

## Décisions de fixtures

- **Rôles/claims** : pattern existant (`field_proof`, `messaging_security`) — `SET LOCAL ROLE authenticated|anon` puis `SET LOCAL "request.jwt.claim.sub" = '<uuid>'`. `auth.uid()` pilote les policies owner/acteur.
- **3 utilisateurs** : A propriétaire (`a1111111…`), B tiers (`b1111111…`), C collaborateur (`c1111111…`) ; insertion `auth.users` calquée sur `field_proof.test.sql` (pas de `user_profiles`, non requis par les FK testées).
- **Fixture RLS-02** : insert policy testé sous `authenticated` (la policy WITH CHECK échoue) puis, après `RESET ROLE`, même insert ⇒ la contrainte CHECK échoue. Ordre policy-avant-contrainte vérifié dans le code PostgreSQL (`ExecInsert` : `ExecWithCheckOptions(WCO_RLS_INSERT_CHECK)` avant `ExecConstraints`, REL_15 et REL_17) ; les deux messages d'erreur sont donc déterministes.
- **Réseau** : 2 `trail_segments` (id 8800001/8800002, `osm_id` 12 chiffres pour éviter toute collision OSM, `ST_GeomFromText` PostGIS), un par palier d'agrégat.
- **RLS-03** : passage rattaché à une `hike_sessions` de A + `user_id=A` (la policy exige les deux).
- **RLS-05** : 2 agrégats `dry/forward`, `distinct_user_count` 4 et 5 (`processor_version='a1-test-v1'`).
- **RLS-06** : 4 `terrain_reports` du même reporter A : `pending`, `confirmed` (expires NULL), `active` (expires +2 j), `active` (expires −1 h) ⇒ couvre statuts et expiration. La vue est SECURITY DEFINER : visible sous `anon` ; la table de base n'a aucune policy publique ⇒ 0 ligne pour un tiers.
- **RLS-07** : `trips` privé de A (le trigger `handle_trip_owner_collaborator` ajoute A en owner), C ajouté en `viewer` via `trip_collaborators`, plan de A lié (`trip_id`) ⇒ `can_read_trip` vrai pour C, faux pour B.
- **RLS-08** : 3 événements (`actor_id` = A, B, NULL) avec `idempotency_key` uniques ; chaque acteur n'en voit qu'un ⇒ prouve l'exclusion des tiers et des événements système.
- **Isolation** : UUID/PK fixes préfixés par domaine (`0a…`, `70…`–`77…`, segments 880000x) ; rollback total, aucune empreinte.

## Revue statique effectuée

- `plan(22)` == 22 assertions ; describe/commentaires alignés sur les IDs `TEST-A1-RLS-01..09`.
- Littéraux SQL équilibrés (scanner quote simple/double/dollar-quote), parenthèses 121/121.
- Chaque table/colonne/contrainte/fonction référencée existe dans les 8 migrations A1 (`20260911130000..20260911137000`) ou dans les tables préexistantes (`auth.users`, `trips`, `trip_collaborators`, `trail_segments`, `hike_sessions`).
- Aucun `SET ROLE` laissé actif à la fin ; `ROLLBACK` final ; aucun autre fichier modifié.
- Seul `RESET ROLE` (pas de DDL) entre les asserts et les fixtures déjà posées en tête de transaction.

## Points non vérifiables sans base (à contrôler sur la copie)

1. **Privilèges EXECUTE de `claim_pending_adventure_events` (RLS-09)** : la migration M8 fait `REVOKE ALL … FROM public` + `GRANT … TO service_role`. Sur un projet Supabase aux *default privileges* classiques, `anon`/`authenticated` reçoivent `EXECUTE` à la création de la fonction ; `REVOKE … FROM public` ne retire pas ces grants directs. Si la copie est dans ce cas, l'assertion 22 échouera (l'insert de durcissement M8 devrait être `REVOKE … FROM anon, authenticated`). Fort probablement OK si la copie applique les nouveaux défauts « opt-in » (mêmes hypothèses que `security_lignees` test 10).
2. **Grants SELECT des nouvelles tables** : les 8 migrations A1 ne contiennent aucun `GRANT` explicite ; les tests 1, 3–8, 12–21 supposent les grants par défaut (anon/authenticated/service_role) sur les tables `public` créées par `postgres`. Sans eux, les erreurs seraient `permission denied for table` au lieu des comportements RLS attendus.
3. **Rôle de session des fixtures** : les inserts de fixtures dans des tables `FORCE ROW LEVEL SECURITY` (`adventure_data_consents`, `session_segment_passages`, `user_performance_profiles`, `segment_collective_aggregates`) requièrent que le rôle de session (postgres) soit superuser ou `BYPASSRLS` — hypothèse des suites existantes et du runner `supabase test db`/SQL editor.
4. **Version d'`auth.users`** : liste de colonnes de fixture reprise de `field_proof.test.sql` ; si la copie a un schéma GoTrue plus récent, l'insert minimal pourrait nécessiter un ajustement (risque connu documenté dans `LIGNEES_VALIDATION_BASE.md`).
5. **Message exact de la contrainte** (assertion 4) : format PostgreSQL `new row for relation "…" violates check constraint "…"` — stable PG 11+, à confirmer sur la copie si elle utilise une version différente.
