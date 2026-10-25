# Dashboards — spécification et sources réelles (Phase 10)

Ce document décrit les panneaux **minimaux** exigés par le chantier (§Phase 10)
et, pour chacun, **où la métrique est réellement mesurable dans le code
d'aujourd'hui**. Aucun dashboard fictif n'est décrit : la colonne « État »
distingue ce qui est mesurable localement (preuve existante) de ce qui exige la
plateforme/ops (`INSUFFICIENT_DATA`).

Rappels transverses :

- les routes principales émettent des logs JSON avec `correlation_id`,
  `latency_ms`, `status` (`src/lib/observability/logger.ts`, câblé sur
  `api.adventure.generate` et `api.hike-sessions`) ;
- A14 (`scripts/ops/a14_healthcheck.mjs`) interroge la base locale en lecture
  seule : files, âge, échecs, latence RPC ;
- A15 (`scripts/ops/a15_load_test.mjs`) mesure le chemin de données local ;
- `npm run ops:slo-check` agrège A14 + A15 + `ai_usage_daily` en évaluation SLO.

## 1. API

| Panneau | Métrique | Source exacte | Seuil | État actuel |
|---|---|---|---|---|
| Disponibilité principale | taux de succès (hors 5xx) | logs plateforme / uptime provider | 99,9 % | `INSUFFICIENT_DATA` (provider non branché) |
| Latence lecture p95 | `latency_ms` routes GET | logs structurés (`api.*`) + proxy A15 `conditions` | < 300 ms | proxy local mesuré (70,96 ms le 2026-09-11) ; prod = plateforme |
| Latence écriture p95 | `latency_ms` routes POST | logs structurés (`api.adventure.generate`, `api.hike-sessions`) | < 500 ms | aucun scénario d'écriture en charge — `INSUFFICIENT_DATA` |
| Erreurs 5xx | ratio 5xx/requêtes | logs plateforme ; statuts agrégés A15 | < 1 % | proxy local 0 % ; prod = plateforme |
| Rate limiting | 429 par scope | `src/lib/rate-limit/routes.ts` (429 des routes) | informatif | mesurable en local par tests/charge |
| Routes lentes (> 1 s) | top routes par latence | logs structurés (filtre `latency_ms`) | informatif | à brancher plateforme |

## 2. Base de données

| Panneau | Métrique | Source exacte | Seuil | État actuel |
|---|---|---|---|---|
| File événements domaine | `count(status='pending')` | `public.adventure_domain_events` (requête A14) | ≤ 50 | **mesuré localement** (0) |
| Retard max événement | âge du plus vieux `pending` | idem | ≤ 60 min | **mesuré localement** (0) |
| File générations | `count(status='pending')` | `public.adventure_generation_requests` (A14) | ≤ 20 | **mesuré localement** (0) |
| Runs moteurs | total / succès / échecs / p95 | `public.adventure_engine_runs` (A14) | échecs ≤ 20 % (si ≥ 10 runs) | **mesuré localement** |
| Latence RPC noyau | chrono `current_feature_flags()` | A14 (`measureRpcLatency`) | ≤ 250 ms | **mesuré localement** |
| Erreurs Postgres | `pg_stat_database.xact_rollback`, logs | plateforme Supabase | informatif | `INSUFFICIENT_DATA` (pas de collecteur) |

Exemple de requête de contrôle (reprise d'incident) :

```sql
SELECT status, count(*), max(now() - created_at) AS oldest
FROM public.adventure_domain_events
GROUP BY status;
```

## 3. IA

| Panneau | Métrique | Source exacte | Seuil | État actuel |
|---|---|---|---|---|
| Quotas par utilisateur | `requests_heavy`, `requests_fast` / jour | `public.ai_usage_daily` (`20260903000000_ai_foundations.sql`) | 20 heavy / 100 fast par utilisateur et par jour | **table réelle** (0 ligne en local) |
| Repli (fallback) | `fallback_count`, `external_calls` | `public.adventure_engine_runs` (A11) | dérive = investigation | **mesuré** |
| Jobs IA | `status`, `attempts` | `public.ai_jobs` | pending > 20 ou failed | requêtable, non intégré à A14 |
| Coût monétaire | USD/jour | aucun barème contractuel ; modèles `:free` | budget non configuré | `INSUFFICIENT_DATA` (cf. `A15_COSTS.md`) |
| Budget | évaluation pure | `src/lib/observability/aiBudget.ts` + `ops:slo-check --ai-usage` | global/monétaire à définir | quotas par utilisateur OK ; global/monétaire manquants |

Export des lignes réelles :

```sql
SELECT user_id, day, requests_heavy, requests_fast, requests_by_feature
FROM public.ai_usage_daily;
```

## 4. Cartographie / terrain

| Panneau | Métrique | Source exacte | Seuil | État actuel |
|---|---|---|---|---|
| Lecture conditions | p95 route | `GET /api/terrain/conditions` (cache `max-age=60`) via A15 | < 300 ms | **mesuré localement** (p95 70,96 ms le 2026-09-11) |
| Proximité PostGIS | p95 RPC | `a5_terrain_reports_near` via A15/autocannon | < 300 ms | **mesuré localement** (p95 142 ms le 2026-09-11) |
| Signalements | volumes par statut/catégorie | `public.terrain_reports` | informatif | requêtable |
| Tuiles hors-ligne | octets servis / échecs | `src/lib/offline/tiles.ts` (client) ; egress plateforme | quota fournisseur | `INSUFFICIENT_DATA` (egress non mesuré localement) |

## 5. Stripe

| Panneau | Métrique | Source exacte | Seuil | État actuel |
|---|---|---|---|---|
| Webhooks reçus | `count(*)` par `kind` | `public.stripe_events` (Phase 8) | informatif | **table réelle** (0 en local) |
| Webhooks en échec | `status='failed'` | idem | > 0 = investigation ; retry Stripe | requêtable |
| Webhooks bloqués | `status='processing'` trop ancien | idem | > 15 min = investigation | requêtable |
| Entitlements | lignes `user_entitlements` | `public.user_entitlements` | informatif | **table réelle** |
| Paiements réels | volume, remboursements | dashboard Stripe (externe) | budget frais | `INSUFFICIENT_DATA` (aucune clé) |

```sql
SELECT kind, status, count(*), max(now() - created_at) AS oldest
FROM public.stripe_events
GROUP BY kind, status;
```

## 6. Synchronisation / offline

| Panneau | Métrique | Source exacte | Seuil | État actuel |
|---|---|---|---|---|
| Opérations de sync | `status` (`applied`/`rejected`) | `public.offline_sync_operations` (A13) | rejets en hausse = investigation | **table réelle** |
| Sync destructives | compteur | aucun marqueur « destructive » en base aujourd'hui | 0 | `INSUFFICIENT_DATA` (instrumentation à ajouter) |
| Perte d'entrée carnet | écart entrées client/DB | `hike_sessions`, `carnet_moments`, `carnets` | 0 | `INSUFFICIENT_DATA` (pas de réconciliation automatique) |
| Conflits de sync | rejets champ par champ | codes de rejet d'`offline_sync_operations.result` | informatif | requêtable après définition des codes |
| Sessions de terrain | volume, corrélation | `public.hike_sessions.correlation_id` | informatif | **table réelle** + log route |

## 7. RUM

| Panneau | Métrique | Source exacte | État actuel |
|---|---|---|---|
| Web Vitals | LCP/INP/CLS terrain | `@vercel/speed-insights` monté dans `src/app/layout.tsx:286` | `INSUFFICIENT_DATA` localement : données côté projet Vercel |
| Ressenti mobile | batterie/ réseau | capteurs natifs (Phase 11) | hors périmètre Phase 10 |

## 8. Branchement (item humain/ops)

1. Créer les dashboards sur la plateforme d'hébergement (ou Grafana) en
   consommant les logs JSON et les requêtes ci-dessus.
2. Brancher `ops:healthcheck` (A14) et `ops:slo-check` sur un cron distant et
   router les alertes vers un destinataire réel (e-mail/Slack/pager).
3. Provisionner l'accès lecture Supabase (rôle dédié) pour les requêtes de
   dashboard — aucune clé de service dans un dashboard public.

Tant que 1–3 ne sont pas faits, les panneaux concernés restent
`INSUFFICIENT_DATA` : aucune case n'est cochée par anticipation.
