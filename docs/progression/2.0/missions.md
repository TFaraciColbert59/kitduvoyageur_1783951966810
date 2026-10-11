# Missions 2.0 — catalogue versionné (T12)

Mise à jour : 11 octobre 2026. Source : `src/features/progression/domain/missionCatalog.ts` (testé par `tests/features/progression/missionCatalog.spec.ts`, 5/5).

## Règles

- **Fin de mission = distinction, 0 XP supplémentaire.** Le gain annoncé d'une mission est la somme des actions sources **encore éligibles** (calcul vivant, T14) ; aucun montant n'est stocké dans un modèle.
- Un modèle ne cite que des **producteurs disponibles** (les sept preuves T09, cf. `PRODUCER_MATRIX.md`). Une catégorie sans producteur prêt est **fermée avec sa dépendance exacte** — jamais promise.
- Chaque modèle porte : critères (actions sources + seuil), période (`ever`/`week`/`season`), provenance (`canonical_v2`), version.
- Les huit catégories du brief : découverte, préparation, progression, communauté, coopération, collection, formation, personnelle.

## Modèles (version 1)

| ID | Catégorie | Seuil | Actions sources | État |
|---|---|---|---|---|
| `mission_discovery_first_activity` | découverte | 1 | `hike_session_processed` | ouvert |
| `mission_prep_departure_checks` | préparation | 1 | `checklist_completed` | ouvert |
| `mission_prep_kit_debrief` | préparation | 1 | `kit_field_report` | ouvert |
| `mission_prep_trail_week` | préparation (hebdo) | 1 | `trail_prepared` | ouvert |
| `mission_progress_itinerancy` | progression | 1 | `trip_completed` | ouvert |
| `mission_community_review` | communauté | 1 | `place_review` | ouvert |
| `mission_community_carnet` | communauté | 1 | `carnet_published` | ouvert |
| `mission_cooperation_outing` | coopération | — | — | **fermé** (T30) |
| `mission_collection_passport` | collection | — | — | **fermé** (T18) |
| `mission_formation_module` | formation | — | — | **fermé** (T22) |
| `mission_personal_rhythm` | personnelle | — | — | **fermé** (T16) |

## Écart historique à résorber (étape suivante de T12)

La base de production contient 8 défis « canoniques » (`chal_exp_01`…`chal_entr_02`) portant des `points_reward` de 40 à 120, et 26 défis historiques. Ces montants **contredisent la doctrine 2.0** (« fin de mission = 0 XP supplémentaire ») et l'interface actuelle les affiche via `challengeService`/DTO.

Plan de résorption (données, prochaine tranche) :
1. Conserver les lignes et toutes les associations (`user_progression.current_challenge_id`) — aucune suppression.
2. Migration additive : table de liaison id de défi → modèle de catalogue (`provenance`, `version`), dédup des 26 historiques.
3. Interface : ne plus afficher de promesse de points sur la carte de défi ; afficher l'avancement en réalisations distinctes et le gain restant estimé (T14).
4. T13 prend le relais : assignations ≤ 3 missions, remplacement/abandon sans perte ni dette.

## Vérifications

- `npx vitest run tests/features/progression/missionCatalog.spec.ts` — 5/5 : huit catégories couvertes, aucun producteur indisponible cité, aucune promesse de points, identifiants/versions/provenances complets.
