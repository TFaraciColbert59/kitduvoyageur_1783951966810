# A3 — Profil Terrain, difficulté et prédictions personnelles — Design

Date : 2026-09-11 · Plan : `docs/superpowers/plans/a3-personal-profile-prediction.md`
Contraintes : ADR-AI-004 (IA non calculante), ADR-AI-005 (moteurs purs), ADR-AI-008 (flags)

## Vision

Construire le cœur de la personnalisation **sans données santé** : un Profil Terrain
appris sur les observations privées (Phase 2), la difficulté personnelle, l'allure, la
fatigue, les pauses et l'ETA, avec fallback sûr quand les données manquent.

## Moteurs purs

- `performanceProfile.ts` — `buildPerformanceProfile(observations, options) → PerformanceProfile`
  - médiane pondérée (récence + qualité), rejet d'anomalies (MAD),
  - calibrations séparées plat/montée/descente (m/h et km/h),
  - courbe de fatigue, modèle de pauses, réponse au portage, réponse pente/surface,
  - niveaux : `cold` (0), `calibration` (3–5), `personalization` (10–20), `contextualization` (> 20 diversifiées),
  - `modelVersion: 'a3-v1'`, `confidence` A1, `sampleCount`.
- `fatigue.ts` — fatigue intra-journée **sans santé** : durée active, D+/D-, technicité,
  pauses, charge récente LKDV, poids de sac déclaré, fatigue/difficulté déclarées.
- `prediction.ts` —
  - `predictSegment(input, profile) → SegmentPrediction` (P50/P90, effort, difficulté
    personnelle, pause recommandée, facteurs explicables),
  - `predictRoute(input, profile) → RoutePrediction` (3 stratégies confort/recommandée/rapide,
    P50/P90, pauses, fatigue max, heure de demi-tour, segments critiques).
- `paceResolver.ts` — cascade **profil → profil générique → standard 15 min/km**, chaque
  niveau explicite (`source: 'profile'|'generic'|'standard'`), profil froid
  explicitement `personalized: false`.

## Invariants (tests obligatoires)

1. Plus de distance ⇒ jamais moins de temps.
2. Plus de D+ ⇒ effort jamais inférieur.
3. Confiance faible ⇒ intervalle P50–P90 plus large.
4. Stratégie rapide jamais plus lente que confort.
5. Profil froid explicitement marqué non personnalisé (`calibrationLevel: 'cold'`, `personalized: false`).

## Monde réel

- `server/featureFlags.ts` — lecture `current_feature_flags()` (server-only, fail-safe
  `{ performance_profile_v2: false, route_prediction_v2: false }`).
- `server/buildUserProfile.ts` — orchestrateur à client injecté : lit les
  `performance_observations`, construit le profil, upsert `user_performance_profiles`
  + snapshot `user_performance_profile_versions` (idempotent par `modelVersion`).
- Intégration copilote : `CopilotEngine` (hiking) accepte un résolveur d'allure optionnel ;
  comportement historique (15 min/km) inchangé sans résolveur.
- Migration `20260911150000_a3_feature_flags.sql` : 2 flags désactivés.

## Gate de sortie Phase 3

Profil persistant + versionné, ETA personnelle, difficulté personnelle, stratégies d'allure,
backtesting possible (moteurs purs), fallback sûr, flags déclarés.
