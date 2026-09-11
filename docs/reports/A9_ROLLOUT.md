# A9 — Rollout progressif et critères d'arrêt (Phase 9)

Date : 2026-09-11 · Réf. : ADR-AI-008, `docs/reports/A9_SECURITY_AUDIT.md`

## Paliers

| Palier | Population | Flags actifs | Contrôles avant passage |
|---|---|---|---|
| 0 — Interne | équipe | shadow uniquement | pgTAP sur copie, backtesting, revue sécurité |
| 1 — 1 % | cohorte aléatoire | `performance_profile_v2`, `route_prediction_v2` | erreurs < baseline, pas d'ETA dangereuse |
| 2 — 5 % | + cohorte | + `collective_intelligence` (lecture agrégats) | qualité map-matching, agrégats ≥ seuil |
| 3 — 20 % | + cohorte | + `terrain_live` (création/consultation) | taux de faux signalements, modération |
| 4 — 50 % | moitié | tous (hors shadow) | batterie, coûts, sync offline |
| 5 — 100 % | tous | tous | validation humaine explicite |

Règle : un palier ne passe au suivant qu'après **7 jours** sans déclencheur d'arrêt et
revue du tableau de bord (erreurs, ETA, terrain, coûts, batterie).

## Flags consommés (état à la livraison A9)

| Flag | Consommé par | Effet quand désactivé (fail-safe) |
|---|---|---|
| `terrain_live` | `GET /api/terrain/conditions`, `POST /api/terrain/reports`, `POST /api/terrain/reports/[id]/confirm` | `503 { error: 'Fonctionnalité non activée' }`, aucun traitement |
| `collective_intelligence` | `POST /api/cron/aggregate-segments` | `200 { skipped: 'flag_disabled' }`, aucune agrégation |
| `route_prediction_v2` | `POST /api/adventure/generate` → contexte moteur injecté → `predictionAdapter`/`difficultyAdapter` | profil ignoré : repli générique (profil existant) ou standard (aucun profil) |
| `performance_profile_v2` | Déclaré et transmis dans le contexte de génération | Aucun consommateur moteur câblé à ce stade : sans effet runtime |
| `*_shadow` (4 flags) | Déclarés pour de futurs jobs shadow | Aucun runner shadow n'est livré : sans effet runtime |

`process-hike-sessions` et `expire-terrain-reports` sont des maintenances privées :
volontairement non gatées par ces flags.

## Shadow mode (avant palier 1)

Flags : `performance_profile_v2_shadow`, `route_prediction_v2_shadow`,
`collective_intelligence_shadow`, `terrain_auto_detection_shadow`.
Les moteurs d'exécution silencieuse (`compareShadow`/`summarizeShadow`) existent côté domaine,
mais **aucun runner shadow n'est câblé à ce stade** : ces flags n'ont aucun effet runtime.
Aucun affichage tant que `agreementRate` n'est pas jugé suffisant par la revue humaine.

## Critères d'arrêt (rollback immédiat)

1. Fuite de données ou erreur RLS critique.
2. Hausse anormale du taux d'erreurs (> 2× baseline 24 h).
3. ETA dangereusement sous-estimée (couverture P90 < 0,75 sur échantillon suffisant).
4. Faux signalements critiques répétés (Terrain Live) ou défaut de modération.
5. Consommation batterie excessive liée au recalcul (anti-rebond 60 s défaillant).
6. Coût IA ou tuiles non maîtrisé (dépassement budget).
7. Corruption de session / passage ou synchronisation offline destructive.

## Procédure de rollback

```text
1. feature_flags : enabled = false (UPDATE ciblé, immédiat, sans déploiement)
2. Vérifier la reprise du comportement V1 sur les chemins réellement câblés
   (terrain 503, cron sauté, repli générique/standard des prédictions)
3. Aucun DROP : les migrations sont additives, la base reste compatible
4. Consigner l'incident + mesures dans docs/reports/
```

Le rollback par flag n'a d'effet que sur les flags **consommés** listés ci-dessus :
`performance_profile_v2` (sans consommateur moteur) et les `*_shadow` (sans runner shadow)
restent inertes tant que leur câblage n'est pas livré.

## Observabilité minimale

- `adventure_engine_runs` : moteur, version, statut, durée, warnings.
- Erreurs API : journaux serveur (aucune donnée personnelle).
- Backtesting hors ligne : `runBacktest` sur les échantillons historiques (P50/P90/difficulté).
- Coûts : cache IA existant + fallback sans IA (jamais bloquant).

## Validation manuelle requise avant tout `db push`

```bash
supabase db push --db-url "<COPIE>"
supabase test db --db-url "<COPIE>"
# + contrôle F1 : SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_profiles';
```
