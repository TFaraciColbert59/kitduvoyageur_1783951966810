# a13 — L3 · Produit fonctionnel bout-en-bout — Plan d'exécution

Date : 2026-09-11 · Prérequis : Étape 0 certifiée (tags `a10-code-done`, `a11-code-done`,
CI verte `be90510a`, install+upgrade stricts verts, pgTAP TAP PASS sans quarantaine).

**Parcours cible** : phrase → trois plans complets → sélection → route map-matchée →
ETA personnelle → cockpit → tracking → recalcul → offline → reconnexion → retour
d'expérience → profil recalibré. **Aucune fixture dans le parcours de certification.**

## Flux de travail (dépendances)

```text
S1 ETA réelle (map-matching route + profil → prédictions)   ← bloquant pour S5/S9
   │
S2 Trois plans comparables + sélection/matérialisation       (dépend S1 pour l'ETA)
S3 Groupe/trek/entitlements persistés + Stripe serveur       (indépendant)
S4 Sources : météo, Terrain Live→plan, eau/refuges, réglementation, documents
S5 Cockpit live branché au tracking réel                     (dépend S1)
S6 Pack offline complet + sync réelle                        (dépend S1/S4/S7)
S7 Terrain Live monté sur la carte                           (dépend S4)
S8 Backtesting réel anonymisé                                (dépend S1)
S9 E2E phrase → plan → sortie → offline → retour             (dépend tout)
```

## S1 — ETA réelle bout-en-bout (stream en cours)

- Nouvelle RPC additive `20260911420000_a13_segment_geometry.sql` :
  `a13_segment_geometries(p_ids bigint[])` → `(id, geojson, surface, sac_scale, highway)`
  (SECURITY INVOKER, lecture OSM publique, bornée 500 ids).
- `server/routePrediction.ts` (client injecté) :
  - géométrie de route (polyline du plan) → points → `a2_match_track_candidates` (batch)
    → segments retenus → géométries `a13_segment_geometries` → `computeSegmentFeatures`
    (A2) → `predictSegment`/`predictRoute` (A3) avec profil réel (consentement
    `personal_performance`) → persistance `persist_adventure_predictions` (A10) ;
  - fallback explicite `uniform_from_blueprint` si pas de route/profil (jamais silencieux).
- `generateAdventure` : si le brief fournit des coordonnées de route, utilise le moteur réel ;
  sinon fallback. Le plan expose `sections.paceStrategies` + ETA P50/P90 réelles.
- Tests : `TEST-A13-ROUTE-01..06` (matching→features, profil consent-gated, persistance,
  fallback explicite, bornes RPC, idempotence modèle).

## S2 — Trois plans comparables

- `buildCandidatePlans` (A11) enrichi : les trois candidats partagent la MÊME route et les
  mêmes hébergements, diffèrent par stratégie d'allure, marge, budget, risque, pauses.
- Résultat de génération : `candidatePlans` avec tableau comparatif (durée P50/P90, budget,
  difficulté, confort, risques, incertitude, raisons) ; `POST /api/adventure/[id]/select`
  matérialise un candidat comme version du plan (transactionnel, verrous respectés).
- Tests `TEST-A13-CAND-*`, `TEST-A13-SELECT-*`.

## S3 — Groupe, trek, entitlements (produit + serveur)

- Persistance : plan de groupe (crew existant) + résultats trek (`multiDayTrek`) stockés
  dans `adventure_plan_versions.snapshot` ; endpoints `GET/POST /api/adventure/{id}/group`,
  `/trek` ; UI mobile (skills apple/ux/interaction) : bloc groupe (allure, membre limitant,
  redistribution) et vue trek (fatigue quotidienne, ajustements).
- Stripe/paywall **serveur** : entitlements (`domain/entitlements`) appliqués sur les routes
  (403/402 si entitlement requis), pass/plan via métadonnées Stripe existantes ; aucun prix
  inventé (catalogue existant).
- Tests `TEST-A13-GROUP-*`, `TEST-A13-ENT-*` (gating serveur), E2E UI a11y.

## S4 — Sources vivantes dans le plan

- `liveConditions` : Terrain Live autour de la route (RPC proximité) + météo (déjà partielle).
- Points d'eau/refuges : POI existants (`trail_pois`, migration distante) via RPC bbox.
- Réglementation/documents : source déterministe si disponible ; sinon section `null` +
  `warnings` explicites (jamais inventée), documenté.
- Tests `TEST-A13-SRC-*` (présence/provenance, absence = warning).

## S5 — Cockpit live réel

- `buildCockpitView` alimenté par : tracking GPS réel (positions), `recalcTriggers` (anti-rebond
  60 s), ETA P50/P90 personnalisée, prochain segment difficile, demi-tour, confiance, Terrain Live.
- Branchement dans la page randonnée active (mobile-first, skills UI). Tests `TEST-A13-COCK-*`.

## S6 — Offline réel

- Pack aventure (routes, segments, prédictions, POI, conditions) écrit dans Dexie par utilisateur ;
  `syncWorker` branché sur les endpoints réels ; cycle hors-ligne → reconnexion sans perte ni doublon.
- Tests `TEST-A13-OFF-*` + test d'intégration worker (transport injecté).

## S7 — Terrain Live sur la carte

- Couche `TerrainLiveLayer` montée sur la carte existante (route active), création 3 gestes
  ouverte depuis le cockpit, liste verticale, confirmations. Tests E2E/a11y.

## S8 — Backtesting réel

- Export anonymisé (schéma-only + agrégats) → `scripts/ai/a11_backtest.ts` → rapport chiffré
  (MAE ETA, couverture P90, calibration, biais montée/descente, dérive par surface) ;
  seuils publiés ; **aucune donnée personnelle** exportée.

## S9 — E2E certification

- Scénario `scripts/e2e/a13-journey.spec.ts` : phrase → génération → sélection → ETA →
  cockpit → tracking simulé → recalcul → offline → reconnexion → retour → profil recalibré,
  sur le projet Supabase de **test** (`.env.local`), sans fixtures.

## Gate a13

Parcours ci-dessus vert sur données réelles de test ; zéro fixture ; CI verte sur le HEAD ;
tag `a13-done`.
