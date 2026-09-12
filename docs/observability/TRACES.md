# Traces corrélées — contrat et propagation (Phase 10)

## 1. Contrat d'entrée

| Canal | Nom | Format | Priorité |
|---|---|---|---|
| En-tête HTTP | `x-correlation-id` | UUID (toutes versions) | 2 |
| Corps JSON | `correlationId` | UUID | 1 (prime) |
| Aucun / invalide | — | un UUID est **généré** | 3 |

Implémentation : `src/lib/observability/correlation.ts`
(`resolveCorrelationId`, `readCorrelationId`, `correlationResponseHeaders`).

Règles :

- une valeur non-UUID est **refusée sans être recopiée** (elle peut contenir du
  PII) et un identifiant neuf est généré — la requête n'échoue jamais à cause de
  l'en-tête ;
- la réponse renvoie `x-correlation-id` (et, pour la génération de plan,
  `correlationId` dans le corps) pour que le client poursuive la chaîne ;
- un `correlation_id` est un **identifiant technique** : jamais d'e-mail, de
  nom ou de coordonnée dans les logs qui le portent (rédaction du logger).

## 2. Propagation réelle (code d'aujourd'hui)

| Étape | Fichier / objet | Ce qui est écrit |
|---|---|---|
| Entrée génération | `src/app/api/adventure/generate/route.ts` | en-tête/corps résolus → `generateAdventure({ correlationId })` ; réponse 201 (`x-correlation-id` + `correlationId`) |
| Orchestrateur moteurs | `src/features/adventure-intelligence/server/generateAdventure.ts:703` | `correlationId = input.correlationId ?? randomUUID()` |
| Runs moteurs | RPC `create_adventure_plan_bundle` → `adventure_engine_runs.correlation_id` (text) | tous les runs d'une génération partagent l'identifiant (`20260911340000_a11_engine_runs_observability.sql`) |
| Sélection de route | RPC `select_adventure_plan_route` (`20260911500000_phase2_chain_integrity.sql`) | `adventure_plans.correlation_id`, décision corrélée, `trip.metadata.correlation_id` |
| Réaffectation plan→voyage | RPC `attach_adventure_plan_to_trip` (`20260911510000_phase2_attach_plan_trip.sql`) | propage `correlation_id` (paramètre prime, sinon existant, sinon généré) |
| Re-routage | `src/features/adventure-intelligence/actions/rerouteAdventurePlanRoute.ts` | `p_correlation_id` → plan + décision |
| Session de terrain | `src/app/api/hike-sessions/route.ts` | `hike_sessions.correlation_id` + `carnets.correlation_id` (généré si absent) |
| Chaîne auto-générée | `src/features/trips/server/createTripFromAutogenIntent.ts` | `correlation_id` sur plan, décisions, sessions, carnets, publication |
| Lecture unifiée | `src/features/trips/server/getTripExperience.ts` | lit la corrélation unifiée des pivots |
| Events bus produit | `lkv_events.metadata` (jsonb) | convention : `metadata.correlation_id` quand l'émetteur connaît la chaîne (aucun écrivain automatique aujourd'hui) |

## 3. Trou assumé : file `adventure_domain_events`

La file idempotente `adventure_domain_events` (consentement révoqué, A10) **ne
porte pas de `correlation_id`** : les événements sont émis par une action
utilisateur sans chaîne de génération. Le worker
`src/app/api/cron/process-adventure-events/route.ts` les traite par `id` et
journalise l'identifiant d'événement.

Si un futur émetteur doit corréler un événement de domaine, l'ajout est
**additif** : colonne `correlation_id uuid` + index partiel + écriture par
l'émetteur ; elle n'est pas créée tant qu'aucun émetteur ne l'alimente (pas de
colonne morte).

## 4. Reprise d'incident par corrélation

```sql
-- Tous les runs moteurs d'une génération
SELECT engine_id, status, duration_ms, warnings, error, started_at
FROM public.adventure_engine_runs
WHERE correlation_id = :correlation
ORDER BY started_at;

-- Le plan et son voyage
SELECT id, owner_id, trip_id, selected_route_id, correlation_id
FROM public.adventure_plans
WHERE correlation_id = :correlation;

-- Session et carnet issus de la même chaîne
SELECT id, user_id, carnet_id, correlation_id FROM public.hike_sessions
WHERE correlation_id = :correlation;
SELECT id, author_id, correlation_id FROM public.carnets
WHERE correlation_id = :correlation;
```

Logs : les lignes JSON des routes (`api.adventure.generate`,
`api.hike-sessions`) portent `correlation_id`, `latency_ms`, `status` et
permettent de filtrer une requête précise. La journalisation de ces requêtes en
production dépend de la plateforme (item ops, cf. `DASHBOARDS.md`).

## 5. Non couvert (honnête)

- Pas de propagation W3C `traceparent` / OpenTelemetry : non implémenté ;
- pas de collecteur de traces centralisé : logs JSON à brancher sur la
  plateforme d'hébergement ;
- `adventure_domain_events` sans corrélation (cf. §3) ;
- les crons n'ont pas de corrélation d'entrée (déclencheur plateforme) : leur
  observabilité passe par le healthcheck A14 (files, âge, échecs).
