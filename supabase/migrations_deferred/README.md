# Migrations différées (hors `supabase db push`)

Ces migrations ne doivent **pas** partir avec le lot automatique initial : elles
dépendent d'un état ultérieur de l'application déployée et des clients mobiles.

Principe directeur : **Déploiement en deux temps (Expand-Contract)** :
1. **Étape 1 (Lot initial / Expand)** : Déployer le nouveau moteur, créer les adaptateurs de compatibilité bidirectionnelle (`20260917020000_compatibility_adapters.sql`), préserver les droits d'exécution et les vues.
2. **Étape 2 (Différé / Contract)** : Révoquer et déprécier uniquement une fois que 100 % du trafic web est sur la nouvelle version ET que les anciens binaires mobiles ont été mis à jour ou retirés.

| Fichier | À appliquer quand | Pourquoi |
|---|---|---|
| `20260922000000_claim_revoke_after_app_deploy.sql` | **Après** que la nouvelle app (route `/api/rewards/claim` en service role) soit servie à 100 % et les anciens clients mobiles migrés | L'ancienne app appelle `claim_reward_points` avec une session utilisateur ; révoquer avant le déploiement interromprait les récompenses |
| `20260923000000_deprecate_empty_duplicates.sql` | **Après** extinction complète des anciens clients web et mobiles utilisant `products`, `gear_items`, `loans` | Permet le rollback instantané sans rupture vers l'ancienne version |
| `20260923010000_deprecate_legacy_groupes.sql` | **Après** extinction complète des anciens clients utilisant `groupes` et `groupe_*` | Permet aux anciennes sessions et clients de continuer à lire le collectif |
| `20261018120000_geo_place_names.sql` | **Quand** la base a la place (essai de `scripts/geo/import_geo_place_names.ts --cache-dir … --places-dir …` lu : nombre de noms et place estimée), après `20261017140000_geo_places_search.sql` (déjà en base) | Noms par langue des lieux habités (PLAN-100 6.4) : table `geo_place_names` (RLS sans politique, clé de service seule) et RPC `geo_places_search_names`. Le Compas la lit derrière `COMPAS_GEO_PLACES_SEARCH` ; sans elle, il garde la recherche d'avant (`geo_places_search`) |
| `20261017000000_kit_attribution_reverse_bounded.sql` | **Avant** de rallumer Stripe ou de planifier `finalize-kit-attributions`, après `supabase/replay/kit_attribution_reverse_check.sql` passé avec `-v fix=1` sur une base jetable | Un crédit créateur versé puis remboursé n'était pas repris ; la reprise est bornée au solde et le registre écrit le montant repris (PLAN-100 1.1) |

Application manuelle (base de production), une fois la condition remplie :

```powershell
psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260922000000_claim_revoke_after_app_deploy.sql
npx supabase migration repair --status applied 20260922000000 --linked

psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260923000000_deprecate_empty_duplicates.sql
npx supabase migration repair --status applied 20260923000000 --linked

psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260923010000_deprecate_legacy_groupes.sql
npx supabase migration repair --status applied 20260923010000 --linked
```

### Noms par langue des lieux (`20261018120000_geo_place_names.sql`, PLAN-100 6.4) — note pour Tony

Rien n'est appliqué. Dans l'ordre, une fois la place en base vérifiée :

```powershell
# 1. Essai (n'écrit rien) : nombre de noms gardés et place estimée, langues de l'interface
npx tsx scripts/geo/import_geo_place_names.ts --cache-dir C:\tmp\geonames --places-dir C:\tmp\geonames
# 2. Migration (sur une copie d'abord, puis en production)
psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20261018120000_geo_place_names.sql
npx supabase migration repair --status applied 20261018120000 --linked
# 3. Import (SUPABASE_DB_URL dans l'environnement ; refuse d'écrire au-dessus de 250 Mo)
npx tsx scripts/geo/import_geo_place_names.ts --cache-dir C:\tmp\geonames --apply --max-db-mb 250
```

Puis, pour le rejeu mensuel (`geo-places-monthly.yml`), la variable GitHub `GEO_PLACE_NAMES_IMPORT=on`.
Aucun nouveau drapeau Vercel : le Compas lit la RPC derrière `COMPAS_GEO_PLACES_SEARCH` (déjà existant) ;
tant que la migration n'est pas appliquée, il revient à `geo_places_search` (comportement d'avant).
La migration ne supprime rien ; rejouée deux fois sur un PostgreSQL 16 jetable (18 oct.).
