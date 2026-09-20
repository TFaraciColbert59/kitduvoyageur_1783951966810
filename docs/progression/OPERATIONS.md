# Exploitation du moteur de progression — runbook

Mise à jour : 20 septembre 2026 · Branche `feat/mobile-direction-progression`.
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
  "leaderboard": { "pending": 0, "failed": 0, "oldestPendingMinutes": 0 },
  "ok": true
}
```

Codes de sortie : `0` = ok, `1` = dégradé ou lecture impossible, `2` = configuration absente.

`ok=false` si au moins un de ces cas :

| Condition | Seuil | Action |
|---|---|---|
| lignes `dead` dans `progression_outbox` | > 0 | inspecter `progression_outbox.last_error`, rejouer via `replay_dead_progression_outbox(100)` (service_role), vérifier `reward_transactions` associé |
| plus ancienne ligne outbox `pending`/`failed` | > 15 min | vérifier que le cron `/api/cron/progression-outbox` passe bien (`Authorization: Bearer $CRON_SECRET`) |
| plus ancienne ligne `leaderboard_refresh_queue` `pending`/`failed` | > 30 min | vérifier le cron `/api/cron/leaderboard-refresh` (toutes les 15 min) ; la RPC `refresh_leaderboard_batch(100)` est concurrente (`SKIP LOCKED`) |

## 2. Crons à planifier

| Route | Fréquence | Réponse |
|---|---|---|
| `POST /api/cron/progression-outbox` | 5 min | `{ processed, failed, purged }` — `purged` = lignes outbox `processed` > 90 j supprimées |
| `POST /api/cron/leaderboard-refresh` | 15 min | `{ processed, failed }` |

Les deux exigent `Authorization: Bearer ${CRON_SECRET}`. La planification
plateforme n'est pas encore configurée dans le dépôt : voir
`docs/progression/PERFORMANCE.md` §6.

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
WHERE status IN ('pending','failed') GROUP BY status;

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
