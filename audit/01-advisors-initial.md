# Supabase Security Advisors — Baseline Initiale

**Projet audité** : `icxyvwzfjbflcbqukpfz` (lekitduvoyageur2, eu-west-3, PG 17.6)
**Date** : 17 septembre 2026 - 19:30 UTC

## Constats Initiaux

| Linter Rule | Gravité | Nombre de constats | Statut |
|---|---|---|---|
| `security_definer_view` | ERROR | 2 | Vues `terrain_reports_public` et `public_profiles` définies avec SECURITY DEFINER |
| `rls_disabled_in_public` | ERROR | 1 | Table `spatial_ref_sys` (PostGIS) sans RLS explicite |
| `function_search_path_mutable` | WARN | 61 | 61 fonctions applicatives sans `search_path` fixé |
| `anon_security_definer_function_executable` | WARN | 75 | Fonctions SECURITY DEFINER exécutables par `anon` |
| `rls_enabled_no_policy` | INFO | 4 | Tables `message_mentions`, `notification_deliveries`, `royalty_config`, `stripe_events` |
| `extension_in_public` | WARN | 3 | Extensions `postgis`, `pg_trgm`, `unaccent` dans `public` |
| `materialized_view_in_api` | WARN | 6 | Vues matérialisées exposées via PostgREST |
