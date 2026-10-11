# Exploitation du moteur de progression — runbook

Mise à jour : 11 octobre 2026 · Périmètre : outbox P1, file de classement P3, rétention P4, jobs SQL T04.

## 1. Sonde de santé

```powershell
$env:SUPABASE_URL = "https://<projet>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
node scripts/ops/progression_outbox_health.mjs
```

Sortie JSON :

```json
{
  "pending": 0,
  "failed": 0,
  "dead": 0,
  "oldestPendingMinutes": 0,
  "leaderboard": { "pending": 0, "failed": 0, "oldestPendingMinutes": 0 },
  "ok": true
}
```

Codes de sortie : `0` = ok, `1` = dégradé ou lecture impossible, `2` = configuration absente.

`ok=false` si au moins un de ces cas :

| Condition | Seuil | Action |
|---|---|---|
| lignes `dead` dans `progression_outbox` | > 0 | inspecter `progression_outbox.last_error`, rejouer via `replay_dead_progression_outbox(100)` (service_role), vérifier `reward_transactions` associé |
| plus ancienne ligne outbox `pending`/`failed` | > 15 min | vérifier cron.job_run_details et le job SQL outbox ; le secours HTTP exige CRON_SECRET |
| plus ancienne ligne `leaderboard_refresh_queue` `pending`/`failed` | > 30 min | vérifier le job SQL leaderboard (toutes les 15 min) ; la RPC `refresh_leaderboard_batch(100)` est concurrente (`SKIP LOCKED`) |
| lignes `dead` dans `leaderboard_refresh_queue` | > 0 | corriger last_error puis réenfiler explicitement la ligne ; aucune émission de points |

Les compteurs utilisent HEAD count exact et seulement la première date ordonnée,
pour éviter le plafond REST de 1 000 lignes. Aucun arrondi des seuils 15/30 minutes.
Une lecture impossible est dégradée. Un JSON sain de file vide ne prouve pas
l'exécution du scheduler : contrôler aussi les journaux ci-dessous.

## 2. Jobs SQL de progression (T04) — observés en production

État 2026-10-11 : jobs planifiés par migrations additives, **exécutions observées en
production** (`cron.job_run_details`), reprise simulée sur base isolée. Les jobs ne
font que consommer/projeter des gains déjà décidés — aucune émission nouvelle.

| Job pg_cron | Cadence UTC | Commande bornée |
|---|---|---|
| `lkdv-progression-outbox-v1` | `*/5 * * * *` | `progression_ops.run_job('outbox')` — batch 50, statement_timeout 50s |
| `lkdv-progression-leaderboard-v1` | `*/15 * * * *` | `progression_ops.run_job('leaderboard')` — batch 100, statement_timeout 50s |
| `progression-outbox-purge` | `13 4 * * *` | `SELECT public.purge_progression_outbox(90)` — rétention |

pg_cron exécute avec la connexion `postgres` existante (contrainte plateforme :
`cron.schedule_in_database` refuse un `username` différent sans superuser). Le
wrapper `progression_ops.run_job` est possédé par `lkdv_progression_job`
(NOLOGIN/NOINHERIT/NOBYPASSRLS) et n'appelle que les deux consumers canoniques ;
ceux-ci restent SECURITY DEFINER et refusés à anon/authenticated. `pg_net` n'étant
pas installé, pg_cron exécute le SQL directement (pas d'appel HTTP).

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%progression%';
SELECT j.jobname, d.status, d.start_time, d.end_time, d.return_message
FROM cron.job_run_details d JOIN cron.job j USING(jobid)
WHERE j.jobname LIKE '%progression%' ORDER BY d.start_time DESC LIMIT 20;
SELECT job, started_at, finished_at, status, result, error
FROM progression_ops.job_runs ORDER BY id DESC LIMIT 20;
```

`job_runs` enregistre succeeded/degraded/failed pour les appels transactionnels.
Un timeout/cancel annule aussi ce log : `cron.job_run_details` est la preuve de ces
interruptions (`cron.log_run` doit rester on). Les lignes queue verrouillées
retournent à leur état précédent après rollback et restent reprenables.
Leaderboard : cinq erreurs, backoff exponentiel, puis `dead` ; une nouvelle
projection source remet explicitement la ligne pending. Après réparation sans
nouvelle réalisation, l'opérateur serveur peut remettre seulement les lignes
identifiées à `pending/attempts=0/available_at=now()/last_error=NULL`. Vérifier
ensuite batch, compteurs et absence de nouveaux reward_transactions/events.

Vérification locale de reprise (panne simulée, escalade `dead`, requeue sans
double) : `scripts/ops/t04_outbox_recovery_sim.sql` (LOCAL uniquement).

Retour arrière : le down de la migration des jobs désactive les jobs planifiés et
restaure les jobs simples antérieurs ; il conserve journaux, retry corrigé, gains
et protections. Aucun down historique de soldes/démo/réconciliation n'est autorisé
en production.

## 2a. Secours HTTP et rétention

Le secours outbox accepte GET/POST avec `Authorization: Bearer ${CRON_SECRET}`
(alias `GET = POST`, même lot, mêmes droits). Éviter toute double planification
d'une même tâche : le canal nominal est pg_cron. La purge outbox traitée (> 90 j)
est portée par le job SQL quotidien ; la route HTTP appelle aussi la purge à
chaque exécution (idempotente par construction).

| Route | Fréquence cible | Réponse |
|---|---|---|
| `GET|POST /api/cron/progression-outbox` | 5 min | `{ processed, failed, purged }` |
| `GET|POST /api/cron/leaderboard-refresh` | 15 min | `{ processed, failed }` |

## 2bis. Cycle de vie des saisons (service_role uniquement)

Aucune saison n'est créée ou clôturée implicitement par le moteur.

```sql
-- Ouvrir la saison suivante (statut upcoming, chevauchement refusé)
SELECT public.open_progression_season(
  'season_2027_s2', 2, 'Saison 2 · titre interne',
  '2026-11-14T00:00:00Z', '2027-01-09T00:00:00Z'
);

-- Clôturer reproductiblement (idempotent, ne supprime rien)
SELECT public.close_progression_season('season_2026_s1');
```

À planifier côté exploitation : ouvrir la saison N+1 quelques jours avant la fin
de la saison N ; clôturer après la fenêtre de grâce (14 jours par défaut).
Les classements ne lisent que la saison `active` ; une saison `upcoming` n'est
jamais exposée tant que le statut n'est pas basculé manuellement.

## 3. Rétention

| Table | Fenêtre par défaut | Mécanisme |
|---|---|---|
| `progression_outbox` (processed) | 90 j | RPC `purge_progression_outbox(90)` appelée par le cron outbox HTTP et par le job SQL quotidien |
| `leaderboard_access_log` | 30 j | RPC `purge_progression_logs(30, 180)` (service_role) |
| `territory_change_log` | 180 j | idem |

Purge manuelle :

```sql
SELECT public.purge_progression_logs(30, 180);
-- {"leaderboard_access_log": 0, "territory_change_log": 0}
```

Fenêtres bornées à `[1, 3650]` jours : toute valeur hors bornes est ramenée dans
l'intervalle. La fonction est `service_role` uniquement.

## 4. Vérifications ponctuelles

```sql
-- Retard outbox
SELECT status, count(*), min(created_at) FROM public.progression_outbox
WHERE status IN ('pending','failed','dead') GROUP BY status;

-- Retard file classement
SELECT status, count(*), min(created_at) FROM public.leaderboard_refresh_queue
WHERE status IN ('pending','failed','dead') GROUP BY status;

-- Index attendus (P4)
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
  'progression_events_user_effective_idx',
  'progression_decisions_user_action_effective_idx',
  'progression_outbox_user_idx',
  'leaderboard_access_log_created_idx',
  'territory_change_log_created_idx'
);
```

Plans et chiffres de référence : `docs/progression/PERFORMANCE.md`.
