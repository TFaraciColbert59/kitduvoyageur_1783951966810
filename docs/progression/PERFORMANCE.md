# Performance, exploitation et robustesse — moteur de progression

Mise à jour : 20 septembre 2026 · Branche `feat/mobile-direction-progression` ·
Base locale `lkdv-test-db` (Postgres 17.6, conteneur `public.ecr.aws/supabase/postgres:17.6.1.141`, port 55432).
Périmètre : index, requêtes chaudes, rétention, cache/rate-limit des routes.

> **Limites assumées dès maintenant** : toutes les mesures sont locales
> (Docker sur poste Windows), sur données synthétiques, sans production ni
> environnement de charge. Les valeurs absolues ne sont pas des SLA ; elles
> prouvent la **forme des plans** et les ordres de grandeur. Aucun déploiement,
> aucun push, aucune migration distante n'ont été effectués.

---

## 1. Index — décisions (vérifiées sur `pg_indexes` avant création)

| Table | Index | Décision | Justification |
|---|---|---|---|
| `progression_events` | `progression_events_user_effective_idx (user_id, effective_at DESC)` | **créé** | L'existant `idx_progression_events_user (user_id, created_at DESC)` ne peut pas servir un tri par date d'effet métier (`effective_at`), qui est la date autoritaire du ledger (gains antidatés possibles). |
| `progression_decisions` | `progression_decisions_user_action_effective_idx (user_id, action_type, effective_at DESC)` | **créé** | Aucun index hors PK (`idempotency_key`) : les trois comptages de plafonds glissants d'`award_progression_gain` balayaient toute la table. |
| `progression_outbox` | `progression_outbox_user_idx (user_id)` | **créé** | Diagnostic/réparation ciblée par utilisateur (runbook) ; table bornée par la purge à 90 jours. Le lot du cron garde son index partiel existant `(status, available_at)`. |
| `leaderboard_refresh_queue` | `(status, created_at) WHERE status='pending'` | **non créé (redondant)** | `leaderboard_refresh_queue_status_idx (status, created_at)` existe et sert déjà le lot du cron (`pending`+`failed`, tri `created_at`) comme la sonde `pending` seule : cf. plans D/E ci-dessous. Le doublon n'aurait aucun chemin d'accès propre et coûterait des écritures. |
| `leaderboard_access_log` | `leaderboard_access_log_created_idx (created_at)` | **créé** | L'existant `(user_id, created_at DESC)` ne peut pas servir la purge globale par fenêtre (`DELETE … WHERE created_at < cutoff`). |
| `territory_change_log` | `territory_change_log_created_idx (created_at)` | **créé** (en plus de la liste) | Même besoin de purge globale ; l'existant `territory_change_log_user_idx (user_id, created_at DESC)` (identique à l'index demandé) est conservé et couvre déjà les lectures par utilisateur du service territoire. |

Migration : `supabase/migrations/20260921200000_perf_ops.sql`
(ces index ne changent aucun comportement fonctionnel).

### Encore vérifié plus tard (état base locale au 20/09)

`territory_change_log` a reçu entre-temps une FK `user_id → auth.users` par une
autre branche ; l'index `(user_id, created_at DESC)` reste celui des lectures de
`territoryService` (déclaré/lock 24 h et comptage de correction 30 j).

---

## 2. Méthode de mesure

1. **Données synthétiques** insérées dans une transaction annulée
   (`BEGIN … ROLLBACK`) : rien n'est persisté.
2. `ANALYZE` de toutes les tables concernées dans la transaction, puis
   `EXPLAIN (ANALYZE, BUFFERS)` sur des requêtes représentatives.
3. Volumes seedés (identiques avant/après) :
   - 200 utilisateurs (`auth.users` + `user_profiles`), 200 projections profil ;
   - **200 000** `progression_decisions` (200 utilisateurs × 1 000, 1 jour de rétro) ;
   - **100 000** `progression_events` (200 × 500) ;
   - **50 000** `reward_transactions` + **50 000** lignes `progression_outbox`
     (45 000 `processed` à 100 jours, 5 000 `pending` disponibles) ;
   - **100 000** lignes `leaderboard_refresh_queue` (500 `pending` récentes) ;
   - 800 agrégats de classement (200 × 4 scopes) ;
   - **100 000** `leaderboard_access_log` + **100 000** `territory_change_log`.
4. Commandes :

```powershell
# Application de la migration (base locale uniquement)
docker cp supabase/migrations/20260921200000_perf_ops.sql lkdv-test-db:/tmp/perf_ops.sql
docker exec lkdv-test-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/perf_ops.sql

# Mesure (script local non versionné, seed complet en BEGIN/ROLLBACK)
docker cp .\perf_measure.sql lkdv-test-db:/tmp/perf_measure.sql
docker exec lkdv-test-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/perf_measure.sql
```

Requête type pour chaque plan (exemple plafonds) :

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM public.progression_decisions d
WHERE d.user_id = '…' AND d.action_type = 'carnet_step'
  AND d.outcome IN ('awarded','awarded_lifetime_only')
  AND d.effective_at > now() - interval '1 day';
```

---

## 3. Résultats avant / après (20/09/2026, base locale)

| # | Requête | Plan avant | Temps avant | Plan après | Temps après |
|---|---|---|---|---|---|
| A | Consommateur outbox — lot `LIMIT 50 … SKIP LOCKED` | Bitmap Index `progression_outbox_pending_idx` + Hash Join + Sort | 21,4 ms | idem (aucun index nouveau sollicité) | 11,3 ms* |
| B1 | Profil — `user_progression` par PK | Index Scan `user_progression_pkey` | 0,032 ms | idem | 0,026 ms |
| B2 | Profil — `user_season_progress` par PK | Index Scan `user_season_progress_pkey` | 0,019 ms | idem | 0,027 ms |
| B3 | Plafonds glissants — `progression_decisions` | **Parallel Seq Scan** (200 000 lignes, 66 333 filtrées/worker) | **15,96 ms** | **Index Scan `progression_decisions_user_action_effective_idx`** (1 000 lignes lues) | **0,67 ms** |
| B4 | Journal utilisateur — `progression_events` tri `effective_at DESC` | Bitmap `idx_progression_events_user` + **Sort** top-N | 1,97 ms | **Index Scan `progression_events_user_effective_idx`** sans tri | **0,040 ms** |
| C | Classement scope city (rang fenêtré) | Index Only Scan `progression_leaderboard_agg_rank_idx` | 0,064 ms | idem | 0,069 ms |
| D | File leaderboard — lot cron `pending+failed ORDER BY created_at` | Index Scan `leaderboard_refresh_queue_status_idx` + tri 700 lignes | 0,222 ms | idem | 0,313 ms* |
| E | File leaderboard — sonde `pending` (`count`, `min`) | Index Only Scan `leaderboard_refresh_queue_status_idx` | 0,179 ms | idem | 0,169 ms |
| F | Rétention — `DELETE … leaderboard_access_log > 30 j` (56 800 lignes / 100 000) | **Seq Scan** | 34,0 ms | Index Scan `leaderboard_access_log_created_idx` | 28,1 ms |
| G | Rétention — `DELETE … territory_change_log > 180 j` (95 680 / 100 000) | **Seq Scan** | 153,1 ms | Seq Scan conservé (95 % des lignes concernées : le scan séquentiel reste moins cher que l'index) | 57,3 ms* |
| H | Purge outbox existante `processed > 90 j` | Index Scan `progression_outbox_processed_idx` | 36,9 ms | idem | 44,9 ms* |
| I | `purge_progression_logs(30, 180)` (après F et G dans la même transaction) | — | — | Function Scan (rien à purger) | 7,1 ms |

\* Écarts A, D, G, H non significatifs : même plan, bruit de la base locale
partagée et écritures du rollback. Les gains réels et reproductibles sont B3,
B4 et, à séniorité réaliste, F/G (ci-dessous).

### Rétention à séniorité réaliste (2,8 % de la table au-delà de la fenêtre, comme un cron quotidien)

| Requête (~2 800 lignes supprimées / 100 000) | Avant (sans index `created_at`) | Après |
|---|---|---|
| `leaderboard_access_log` | Seq Scan — 12,97 ms | **Index Scan `leaderboard_access_log_created_idx`** — 10,5 ms |
| `territory_change_log` | Seq Scan — 10,16 ms | **Index Scan `territory_change_log_created_idx`** — 10,6 ms |

À volume faible l'écart est modeste ; il devient structurel quand les journaux
grossissent : le coût du scan séquentiel croît linéairement, celui de l'index
en `O(log n + k)`.

### Choix de non-création (preuves D/E)

Le lot du cron utilise `Index Scan using leaderboard_refresh_queue_status_idx`
avec `Index Cond: status = ANY ('{pending,failed}')` ; la sonde `pending`
utilise `Index Only Scan using leaderboard_refresh_queue_status_idx`.
L'index partiel demandé n'apporterait pas de chemin d'accès distinct.

---

## 4. Rétention

`public.purge_progression_logs(p_access_days integer DEFAULT 30, p_territory_days integer DEFAULT 180)`
(migration `20260921200000_perf_ops.sql`) :

- supprime `leaderboard_access_log` et `territory_change_log` au-delà des fenêtres ;
- paramètres bornés `[1, 3650]` jours (`COALESCE` + `GREATEST`/`LEAST`) ;
- retourne `jsonb { "leaderboard_access_log": n, "territory_change_log": m }` ;
- `SECURITY DEFINER`, `search_path = public`, `REVOKE` de `PUBLIC`/`anon`/`authenticated`,
  `GRANT EXECUTE` à `service_role` uniquement (vérifié par
  `has_function_privilege`).

L'outbox (`progression_outbox`) garde sa purge dédiée à 90 jours, appelée par le
cron outbox à chaque exécution (champ `purged` de la réponse).

---

## 5. Cache et charge des routes

- **En-têtes** — réponses GET succès de `/api/progression`,
  `/api/progression/leaderboard`, `/api/progression/territory` :
  `Cache-Control: private, max-age=30, stale-while-revalidate=60` + `Vary: Cookie`.
  Jamais posés sur les mutations (POST territoire) ni sur les erreurs ;
  `private` empêche tout cache partagé, `Vary: Cookie` évite le mélange de sessions.
- **Rate limiting** (module existant `enforceRateLimit`, `failMode: 'closed'`
  comme `rewards/claim` — 503 explicite si le limiteur distribué configuré est
  injoignable, repli mémoire sinon) :
  - profil `progression-profile` : 120/min ;
  - classement `progression-leaderboard` : 60/min (le filtre 1 km conserve son
    quota interne de 30/h dans `get_leaderboard`, inchangé) ;
  - territoire `progression-territory` : 30/min (GET et POST).
- **Carte compacte** (`ProgressionCompactCard`) : plus de second appel réseau
  système — le rang n'est demandé que si le profil est chargé **et** `hasData` ;
  cache mémoire module-level à 60 s avec déduplication des requêtes en vol
  (les trois menus `CollectifMenu`/`PossessionMenu`/`SortieMenu` montent la carte
  deux fois). Limite assumée : cache par instance JS/onglet, non partagé, perdu
  au rechargement ; aucune lib de cache ajoutée.

---

## 6. Planification des crons (à configurer — `vercel.json` absent)

Aucun `vercel.json`, `netlify.toml` ni workflow programmé n'existe dans le dépôt
à cette date : le format n'étant pas présent, la planification ne peut pas être
« actualisée » sans introduire un nouveau fichier de déploiement. À configurer sur
la plateforme :

| Route | Méthode | Fréquence | Authentification |
|---|---|---|---|
| `/api/cron/progression-outbox` | POST | toutes les 5 min | `Authorization: Bearer $CRON_SECRET` |
| `/api/cron/leaderboard-refresh` | POST | toutes les 15 min | `Authorization: Bearer $CRON_SECRET` |

Snippet pour un futur `vercel.json` (format standard, non créé ici) :

```json
{
  "crons": [
    { "path": "/api/cron/progression-outbox", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/leaderboard-refresh", "schedule": "*/15 * * * *" }
  ]
}
```

Alternative GitHub Actions (workflow non créé ici) :

```yaml
name: progression-crons
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "${{ vars.LKDV_APP_URL }}/api/cron/progression-outbox" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Alternative `pg_cron` + `pg_net` (activée seulement si l'extension est disponible
et si le secret est stocké dans Vault — non appliquée ici) : planifier un
`net.http_post` vers les deux routes avec l'en-tête `Authorization`.

---

## 7. Exploitation

Voir `docs/progression/OPERATIONS.md` (sonde de santé outbox + file classement,
seuils, commandes de purge manuelle).
