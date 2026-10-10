# Exploitation du moteur de progression — runbook

Mise à jour : 10 octobre 2026 · Chantier Progression 2.0.
Périmètre : outbox P1, file de classement P3, rétention P4, crons.

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
  "leaderboard": { "pending": 0, "failed": 0, "dead": 0, "oldestPendingMinutes": 0 },
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

## 2. Jobs SQL v1 — migration additive du chantier

État : migration testée et revue en environnement isolé ; application distante
et observation renseignées dans docs/progression/2.0/status.json et evidence.
Ne pas confondre ces résultats locaux avec une activation production.

| Job pg_cron | Cadence UTC | Commande bornée |
|---|---|---|
| lkdv-progression-outbox-v1 | */5 * * * * | progression_ops.run_job('outbox'), batch 50 |
| lkdv-progression-leaderboard-v1 | */15 * * * * | progression_ops.run_job('leaderboard'), batch 100 |

pg_cron utilise sa connexion postgres existante ; le wrapper est possédé par
lkdv_progression_job, NOLOGIN/NOINHERIT/NOBYPASSRLS. Ce rôle peut appeler
uniquement les deux consumers canoniques et gérer ses logs privés ; ces
consumers restent SECURITY DEFINER. Ce montage n'est pas une connexion
cron sous le rôle NOLOGIN. Les clients anon/authenticated n'ont accès ni au
wrapper ni au schéma progression_ops. Chaque commande a statement_timeout=50s.

```sql
SELECT jobname, schedule, active, database, username FROM cron.job
WHERE jobname IN ('lkdv-progression-outbox-v1','lkdv-progression-leaderboard-v1');
SELECT j.jobname, d.status, d.start_time, d.end_time, d.return_message
FROM cron.job_run_details d JOIN cron.job j USING(jobid)
WHERE j.jobname IN ('lkdv-progression-outbox-v1','lkdv-progression-leaderboard-v1')
ORDER BY d.start_time DESC LIMIT 20;
SELECT job, started_at, finished_at, status, result, error
FROM progression_ops.job_runs ORDER BY id DESC LIMIT 20;
```

job_runs enregistre succeeded/degraded/failed pour les appels transactionnels.
Un timeout/cancel annule aussi ce log : cron.job_run_details est la preuve de
ces interruptions (cron.log_run doit rester on). Les lignes queue verrouillées
retournent à leur état précédent après rollback et restent reprenables.
Leaderboard : cinq erreurs, backoff exponentiel, puis dead ; une nouvelle
projection source remet explicitement la ligne pending. Après réparation sans
nouvelle réalisation, opérateur serveur peut remettre seulement les lignes
identifiées à pending/attempts=0/available_at=now()/last_error=NULL. Vérifier
ensuite batch, compteurs et absence de nouveaux reward_transactions/events.

Retour arrière de cette tranche : down désactive seulement ces deux jobs.
Il conserve journaux, retry corrigé, gains et protections. Pour reprendre,
réappliquer les deux cron.schedule identiques ; vérifier cadence et journaux.
Aucun down historique de soldes/démo/réconciliation n'est autorisé en production.

## 2a. Secours HTTP et rétention historique

| Route | Fréquence | Réponse |
|---|---|---|
| `POST /api/cron/progression-outbox` | 5 min | `{ processed, failed, purged }` — `purged` = lignes outbox `processed` > 90 j supprimées |
| `POST /api/cron/leaderboard-refresh` | 15 min | `{ processed, failed }` |

Le secours outbox accepte GET/POST avec Authorization Bearer CRON_SECRET.
Le chemin HTTP leaderboard historique cité n'est pas une preuve de route ou
de planification disponible : privilégier le job SQL vérifié. Ne pas planifier
en double une nouvelle route HTTP. La purge processed >90j reste liée au
secours HTTP existant ; le job SQL ne supprime aucun journal.

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
| `progression_outbox` (processed) | 90 j | RPC `purge_progression_outbox(90)` appelée par le cron outbox à chaque exécution |
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
