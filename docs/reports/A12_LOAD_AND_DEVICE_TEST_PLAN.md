# A12 — Plan de tests charge, batterie et appareils réels (P2)

Date : 2026-09-11 · Statut : plan à exécuter (appareils/parc humain requis)

## 1. Charge (backend)

| Test | Cible | Seuil |
|---|---|---|
| Agrégation quotidienne | 200 segments × 500 passages | < 5 min wall, aucune erreur |
| `a4_recent_eligible_segments` | 50 appels concurrents | p95 < 300 ms |
| `a5_terrain_reports_near` | 100 req/s sur 5 min | p95 < 300 ms, 0 5xx |
| `POST /api/terrain/reports` | 20 req/s | 0 5xx ; rate limit actif > 10/h/user |
| `POST /api/adventure/generate` | 10 générations concurrentes | 0 5xx ; 409/429 conformes |

Outils : `k6` ou `autocannon` sur environnement de test avec base de test.

## 2. Batterie et réseau (mobile)

| Scénario | Protocole | Critère |
|---|---|---|
| Recalcul live | 4 h de sortie simulée, GPS 1 Hz | 1 recalcul/≥ 60 s max, < 5 % batterie/h |
| Hors-ligne 3 h | mode avion, puis reconnexion | file vidée, zéro doublon, zéro perte |
| Batterie faible | 15 % → fin | pas de recalcul non essentiel, alertes seulement |
| Réseau instable | perte/retour répétés ×20 | aucune corruption Dexie, reprise après crash |
| Luminosité forte | plein soleil | contraste lisible (design tokens) |

## 3. Appareils réels (minimum)

| Plateforme | Appareils | Contrôles |
|---|---|---|
| iOS | 1 SE/compact + 1 récent (Dynamic Island) | safe-areas, sheets, haptique, 150–200 % texte, reduced motion |
| Android | 1 milieu de gamme + 1 récent | permissions GPS/notifications, back gesture, batterie |
| Tablette | 1 iPad 768+ | grille, pas de débordement |

## 4. Terrain & calibration

- 20 sorties réelles minimum, variées : plat, montée, descente technique, sac léger/lourd, pluie.
- Mesures : MAE ETA, couverture P90, biais montée/descente, précision map-matching, faux positifs Terrain Live.
- Comparaison V1/V2 via `adventure_shadow_runs` (déjà instrumenté) avant toute activation de flag.

## 5. Critères d'arrêt rappelés

Toute fuite de données, ETA sous-estimée (couverture P90 < 0,75), faux signalements critiques,
batterie anormale, coût non maîtrisé → flags OFF + post-mortem (voir `A12_RUNBOOKS.md`).
