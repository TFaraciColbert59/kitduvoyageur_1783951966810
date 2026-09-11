# A10 — Validation BDD (Étape 0-B) — preuve d'exécution

Date : 2026-09-11 · Environnement : Docker Desktop rétabli + Supabase CLI 2.117 local
(`supabase_db_ai-finalization`, PostgreSQL 17.6.1.141) · Dump prod : schema-only, hors dépôt.

## 1. Replay base vide — ✅ SUCCÈS

Procédure reproductible : `pwsh scripts/db/replay-from-empty.ps1`
(bootstrap replay → passe tolérante 173 fichiers → alignement prod→replay → passe stricte).

Résultat frais (schéma public recréé à zéro) :

```text
[replay] Passe A (tolérante) : 173 fichiers
[replay] Passe B (alignement prod→replay)
[replay] Passe C (stricte) sur 0 fichier(s) en échec
[replay] SUCCÈS : chaîne complète appliquée (2 passes + alignement).
```

Réparations committées rendant ce replay possible (toutes additives, déjà incluses dans la chaîne) :
- **Bootstrap de replay** `20260710000000_a10_replay_bootstrap.sql` : types enum de production,
  194 tables prod (sans FK), contraintes PK/UNIQUE gardées — généré depuis le dump **schema-only**
  (aucune donnée).
- **Alignement** `supabase/replay/a10_replay_alignment.sql` : colonnes prod absentes du dépôt.
- Réordonnancements `ALTER avant CREATE` (products, kits, kit_items, listings, shop_products,
  travel_groups/group_*) + `conversation_participants` avant policy.
- Idempotence : `DROP POLICY IF EXISTS` (22 fichiers), `CREATE TABLE/INDEX IF NOT EXISTS` (5 fichiers),
  réparation lots 7-10 (`\$\$`, `PRIMARY DEFAULT`, `profiles`→`user_profiles`, variables plpgsql,
  blocs de validation non bloquants en replay), PostGIS/tables distantes en amont
  (`trail_metadata/trail_scores/trail_pois` stand-ins, geodata place_names/geo up-front),
  restauration des colonnes après `DROP TYPE ... CASCADE`.

## 2. F1 — ✅ FERMÉ, vérifié après migration

`pg_policies` sur `user_profiles` (base rejouée) : **aucune** policy de lecture large.
Restantes : `users_read_own_profile`, `users_manage_own_profiles`, `users_update_own_profile`,
`profile_read_own_visibility`, `profile_update_own_visibility`, `profile_select_public_subset`
(anon/false), `user_profiles_select_admin` (is_admin), `Users insert own profile`
(auth.uid()=id). Vue `public.public_profiles` présente. Les trois policies larges
(`public_read_user_profiles`, `anon_read_profiles_basic`, dérive prod `Public read user_profiles`)
sont supprimées par la migration F1 (les deux premières existent en replay ; la dérive est
traitée sur la copie historique).

## 3. pgTAP — partiel (résultats réels)

| Suite | Résultat |
|---|---|
| `a1_domain_security` | ✅ toutes assertions |
| `a10_session_lease` | ✅ 12/12 (attendu DB-01 ajusté au comportement dead-letter) |
| `a2_segment_processing` | 🟠 13/14 — `DB-03` attend 1, obtient 2 (investigation en cours) |
| 6 suites historiques (attributions, conservation, field_proof, lineage, messaging_security, security_lignees) | ❌ échec à l'exécution (dette préexistante : hypothèses prod/données) — hors périmètre A1-A12 |
| Extension `pgtap` | installée localement (absent de l'instance par défaut) |

## 4. EXPLAIN (ANALYZE, BUFFERS) — proximité

```text
Function Scan on a5_terrain_reports_near(44.0, 6.0, 5000)
  actual time=19.392..19.392 rows=0
  Buffers: shared hit=695
Planning Time: 0.103 ms ; Execution Time: 19.448 ms
```

Acceptable sur base vide (index GiST `idx_terrain_reports_geog` en place, filtre statuts/site).

## 5. Hygiène

- Dump prod : **schema-only**, fichier temporaire hors dépôt, jamais commité ni copié en cloud,
  supprimé après usage (vérifié : absent de `git status`).
- Aucune écriture en production (connexion prod utilisée uniquement pour `db dump` schema-only).
- Flags de domaine : toujours OFF.

## 6. Reste à faire pour clore la gate B

1. `a2 DB-03` : trancher l'écart (2 vs 1) — comportement claim vs attente de test.
2. Suites historiques : soit les adapter aux hypothèses de replay (comme a1/a2/a10 : grants
   explicites, fixtures robustes), soit documenter leur dette.
3. Scénario **copie historique** : restaurer le dump schema-only + données synthétiques,
   appliquer la chaîne, rejouer F1 + pgTAP (le harnais est prêt : bootstrap/alignement).
4. Re-run CI HEAD après commits (Gate 4 build).
