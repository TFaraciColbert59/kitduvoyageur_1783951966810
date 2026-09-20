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

Application manuelle (base de production), une fois la condition remplie :

```powershell
psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260922000000_claim_revoke_after_app_deploy.sql
npx supabase migration repair --status applied 20260922000000 --linked

psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260923000000_deprecate_empty_duplicates.sql
npx supabase migration repair --status applied 20260923000000 --linked

psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260923010000_deprecate_legacy_groupes.sql
npx supabase migration repair --status applied 20260923010000 --linked
```
