# Analyseurs de parcours (R02)

Modules purs, sans réseau ni base, pour le drawer parcours et la fiche de sortie.

| Fiche | Module | Entrée | Absence explicite |
|---|---|---|---|
| K2.19 | `analyzeSurfaces` | tronçons `surface` / `highway` | `surface_source_unavailable`, `surface_tags_missing` |
| K2.20 | `analyzeClimbs` | profil `{distanceM, elevationM}` | `elevation_profile_unavailable`, couverture partielle |
| K2.21 / S3.26 | `analyzeDifficulty` | distance, D+, sport, surface, athlète | `elevation_missing`, `unsupported_sport` |
| K2.22 | `analyzeRouteAlerts` | géométrie + tronçons étiquetés | `alert_sections_unavailable`, `out_and_back_geometry_unavailable` |
| K2.23 | `analyzeFireAlerts` | incidents fournis, ou `null` | `fire_source_unavailable` |
| K2.24 | `analyzeRouteWeather` | série horaire + heure/durée de passage | `weather_source_unavailable`, `eta_unavailable` |
| S2.03 | `analyzeSessionWeather` | snapshot `hike_sessions.weather` ou prévision | `no_recorded_weather`, `forecast_unavailable` |

Règles communes :

- une valeur absente reste `null` / `missing` ; elle n'est jamais remplacée par zéro ;
- `status` vaut `available`, `partial` ou `unavailable` (les alertes ont aussi
  `clear` / `alerts`) ;
- les source, date de récupération, fuseau et couverture sont conservés ;
- une prévision n'est jamais présentée comme une observation ni comme une
  alerte officielle ;
- aucun appel à une API de feux, météo ou surface n'est fait ici.
