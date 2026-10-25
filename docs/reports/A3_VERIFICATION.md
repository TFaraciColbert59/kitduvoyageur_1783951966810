# A3 — Rapport de vérification (Phase 3 : Profil Terrain, difficulté, prédictions)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `4bb477be`
Statut : **RÉALISÉ**

## Livrables

| Livrable | Chemin |
|---|---|
| Spec / Plan | `docs/superpowers/specs/2026-09-11-a3-personal-profile-prediction-design.md` · `docs/superpowers/plans/a3-personal-profile-prediction.md` |
| Moteurs purs | `domain/performanceProfile.ts`, `domain/fatigue.ts`, `domain/paceResolver.ts`, `domain/prediction.ts` |
| Serveur | `server/featureFlags.ts` (fail-safe), `server/buildUserProfile.ts` (client injecté, idempotent) |
| Migration | `supabase/migrations/20260911150000_a3_feature_flags.sql` (2 flags OFF) |
| Intégration copilote | `src/features/hiking/copilot/CopilotEngine.ts` (résolveur d'allure optionnel, défaut 15 min/km inchangé) |
| Tests | `tests/adventure-intelligence/{performance-profile,pace-resolver,prediction-a3,build-profile.server,copilot-pace}.spec.ts` (+37 tests A3) |

## Preuves

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ **213 fichiers, 1636 tests, 0 échec** (115 tests domaine A1-A3) |
| `npm run type-check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm run verify:invariants` | ✅ |

Note : un run intermédiaire a montré 1 échec hors domaine A3 (test réseau Overpass) — non
reproduit sur relance complète immédiate (1636/1636). Test réputé flaky (dépendance réseau),
sans lien avec le chantier.

## Invariants de la roadmap (tous testés)

1. Plus de distance ⇒ jamais moins de temps (`TEST-A3-PRED-01`).
2. Plus de D+ ⇒ effort jamais inférieur (`TEST-A3-PRED-02`).
3. Confiance faible ⇒ P50–P90 plus large (`TEST-A3-PRED-03`).
4. Stratégie rapide jamais plus lente que confort (`TEST-A3-PRED-04`).
5. Profil froid explicitement non personnalisé (`TEST-A3-PRED-05`, `TEST-A3-PACE-02`).

## Revue indépendante

- Spec ✅ Tasks 1-4 ; copilote rétrocompatible (défaut strict 15 min/km) ; flags fail-safe.
- **1 Important** : `buildUserProfile` réinsérait un snapshot `a3-v1` malgré
  `UNIQUE (profile_id, model_version)` → contrat renommé `upsertProfileVersion`
  (idempotence documentée) + test durci (double build ⇒ 1 seule version). Corrigé `4bb477be`.
- **1 Minor corrigé** : `predictSegment` passe désormais `flagEnabled` (défaut `true`) à
  `resolvePace`.
- Mineurs différés : courbes `gradeResponse`/`surfaceResponse`/`fatigueCurve` persistées mais
  non encore consommées par les moteurs (prévu pour le raffinage/backtesting ultérieur) ;
  adaptateur Supabase concret de `ProfileBuildClient` à câbler avec les routes (Phase 6/7).

## Gate de sortie Phase 3

- ✅ Profil persistant et versionné (upsert idempotent, historique).
- ✅ ETA personnelle (segment + route, P50/P90).
- ✅ Difficulté personnelle et facteurs explicables.
- ✅ Trois stratégies d'allure (confort/recommandée/rapide).
- ✅ Backtesting possible (moteurs purs déterministes).
- ✅ Fallback sûr : cascade profil → générique → standard, flags OFF par défaut.
