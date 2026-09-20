# Migrations différées (hors `supabase db push`)

Ces migrations ne doivent **pas** partir avec le lot automatique : elles
dépendent d'un état de l'application déployée.

| Fichier | À appliquer quand | Pourquoi |
|---|---|---|
| `20260922000000_claim_revoke_after_app_deploy.sql` | **Après** que la nouvelle app (route `/api/rewards/claim` en service role) soit servie à 100 % | L'ancienne app appelle `claim_reward_points` avec une session utilisateur ; révoquer avant le déploiement interromprait les récompenses pendant la fenêtre |

Application manuelle (base de production), une fois la condition remplie :

```powershell
psql "$env:LKDV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations_deferred/20260922000000_claim_revoke_after_app_deploy.sql
npx supabase migration repair --status applied 20260922000000 --linked
```

Vérification :

```sql
SELECT has_function_privilege('authenticated','public.claim_reward_points(uuid,text,uuid,text,jsonb)','EXECUTE');
-- attendu : false
```
