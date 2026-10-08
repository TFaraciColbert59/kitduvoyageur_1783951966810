# Sauvegardes de la base (offre gratuite Supabase)

> Plan 1.1 (8 octobre 2026). L'offre gratuite de Supabase ne fait **aucune
> sauvegarde**. Une tâche GitHub Actions gratuite (`.github/workflows/db-backup.yml`)
> en fait une chaque nuit à 2 h 23 UTC.

## Ce qui est sauvegardé

- Schémas `public` (données de l'application), `auth` (comptes) et
  `marketplace_private` (fonctions du marché appelées par `public`), au format
  `pg_dump` personnalisé, **chiffré** (AES-256, phrase `BACKUP_PASSPHRASE`).
- Sans les données des caches et des référentiels réimportables (structure gardée) :
  `geo_cache`, `route_cache`, `rate_limit_windows`, `places_geo`,
  `admin_regions_geo`, `hub_telemetry`.
- Gardé **7 jours** en artefact GitHub (« sauvegarde-base » dans l'onglet Actions).

## À poser une fois (Tony)

GitHub → dépôt → **Settings → Secrets and variables → Actions → New repository secret** :

1. `SUPABASE_DB_URL` : Supabase → **Connect** → *Session pooler* → l'URI complète,
   mot de passe compris (`postgresql://postgres.icxyvwzfjbflcbqukpfz:…@…pooler.supabase.com:5432/postgres`).
2. `BACKUP_PASSPHRASE` : une phrase longue, gardée aussi hors de GitHub (gestionnaire
   de mots de passe). Sans elle, une sauvegarde est illisible.

Puis **Actions → Sauvegarde de la base → Run workflow** pour vérifier : un artefact
apparaît en quelques minutes. Sans secrets, la tâche s'arrête en le disant.

## Restaurer

1. Télécharger l'artefact du jour voulu (Actions → la tâche → *Artifacts*), le dézipper.
2. Déchiffrer :
   `gpg --decrypt --output lkdv.dump lkdv-AAAA-MM-JJ.dump.gpg` (la phrase est demandée).
3. **Toujours d'abord sur une base vide de test** (projet Supabase gratuit de secours,
   ou PostgreSQL 17 local) :
   `pg_restore --no-owner --no-privileges --dbname "$URL_DE_TEST" lkdv.dump`
4. Vérifier les comptes, les voyages et les étapes, puis seulement restaurer en
   production, table par table si possible (`pg_restore --table=…`).
5. Les caches se reconstruisent seuls ; les référentiels se réimportent avec leurs
   scripts (`scripts/geo/`).

## Purges planifiées (en base, `pg_cron`)

| Tâche | Quand (UTC) | Ce qu'elle fait |
|---|---|---|
| `purge-essais-anonymes` | 3 h 17 | essais sans compte inactifs depuis 7 jours |
| `purge-geo-cache` | 3 h 27 | lieux en cache expirés |
| `purge-route-cache` | 3 h 32 | trajets en cache expirés |
| `cap-shared-caches` | 3 h 37 | plafonds : 1 000 trajets, 25 000 lieux |
| `purge-hub-telemetry` | dimanche 3 h 42 | journal du tableau de bord de plus de 90 jours |
| `purge-lkv-events` | dimanche 3 h 47 | événements de plus de 13 mois |
| `purge-progression-*` | dimanche 3 h 52 / 3 h 57 | journaux de progression |
| `cleanup-trash-kits` | 4 h 02 | kits à la corbeille depuis 10 jours (`purge_expired_trash_kits`) |
| `ops-daily-report` | 4 h 07 | rapport de la veille dans `ops_daily_reports` |
| `purge-ops-preparation-events` | dimanche 4 h 12 | journal des préparations de plus de 90 jours |

Les purges (suppressions) sont lancées par Tony dans le SQL Editor
(`supabase/migrations/20261008190000_base_scheduled_purges.sql`) : le connecteur de la
session refuse toute suppression.
