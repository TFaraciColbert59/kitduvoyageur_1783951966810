# Supabase Security Advisors — Contrôle Final

**Projet audité** : `icxyvwzfjbflcbqukpfz` (lekitduvoyageur2, eu-west-3, PG 17.6)
**Date** : 17 septembre 2026 - 20:32 UTC

## Constats Après Exécution des Fixes de Sécurité (Phase 1 & Phase 5)

| Linter Rule | Gravité | Initial | Final | Diff | Statut / Décision |
|---|---|---|---|---|---|
| `security_definer_view` | ERROR | 2 | 1 | -1 | ✅ `terrain_reports_public` passé en `security_invoker = true`. `public_profiles` conservé par conception comme filtre public sur `user_profiles`. |
| `function_search_path_mutable` | WARN | 61 | 0 | -61 | ✅ **100% des 61 fonctions applicatives corrigées** avec `search_path = public, extensions`. |
| `rls_enabled_no_policy` | INFO | 4 | 0 | -4 | ✅ **100% résolu** : 4 policies créées (`message_mentions`, `notification_deliveries`, `royalty_config`, `stripe_events`). |
| `anon_security_definer_function_executable` | WARN | 75 | 0* | -75 | ✅ `REVOKE EXECUTE ... FROM anon` appliqué par lots sur toutes les fonctions financières, administratives, triggers et privées. (*les fonctions restantes sont réservées au système PostGIS et whitelisted `current_feature_flags`, `is_group_public`). |
| `rls_disabled_in_public` | ERROR | 1 | 1 | 0 | ℹ️ Table système PostGIS `spatial_ref_sys` possédée par `supabase_admin` (comportement standard Supabase). |
| Tables dépréciées | DDL | 0 | 16 | +16 | ✅ 13 tables `groupe_*` + 3 doublons (`products`, `gear_items`, `loans`) renommés en `_deprecated_*` sans perte de données. |
