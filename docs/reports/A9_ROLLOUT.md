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

## Shadow mode (avant palier 1)

Flags : `performance_profile_v2_shadow`, `route_prediction_v2_shadow`,
`collective_intelligence_shadow`, `terrain_auto_detection_shadow`.
Les moteurs s'exécutent silencieusement et `compareShadow`/`summarizeShadow` mesurent
l'écart V1/V2 sans aucun effet utilisateur. Aucun affichage tant que `agreementRate`
n'est pas jugé suffisant par la revue humaine.

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
2. Vérifier la reprise du comportement V1 (fallbacks 15 min/km + plan sans personnalisation)
3. Aucun DROP : les migrations sont additives, la base reste compatible
4. Consigner l'incident + mesures dans docs/reports/
```

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
