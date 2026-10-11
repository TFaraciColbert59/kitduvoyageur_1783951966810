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

## Constat d'application (2026-10-11) et liaison défi → modèle

La base contient **exactement 8 défis** (`chal_exp_01`…`chal_entr_02`) : les « 26 anciens défis » du dossier de conception n'existent plus dans `progression_challenges` — aucune suppression n'a été faite par ce chantier. La migration `20261011160108` crée `progression_challenge_models` :

| Défi | Modèle publié | État |
|---|---|---|
| `chal_exp_01` Arpenteur local | `mission_discovery_first_activity` | publié |
| `chal_prep_02` Vérification météo & sécurité | `mission_prep_departure_checks` | publié |
| `chal_prep_01` Pacte du sac léger | `mission_prep_kit_debrief` | publié |
| `chal_part_01` Plume des sentiers | `mission_community_carnet` | publié |
| `chal_part_02` Conseil de cordée | `mission_community_review` | publié |
| `chal_exp_02` Sommets secrets | — | conservé non publié (produit ambigu) |
| `chal_entr_01` Main tendue | — | conservé non publié (T25) |
| `chal_entr_02` Partage d'équipement | — | conservé non publié (T32) |

Les `points_reward` historiques (40–120) **ne sont plus affichés** par l'interface (la carte de défi montre titre/avancement/unité seulement) ; le champ reste dans le DTO legacy et sera repurgé quand T14 affichera le gain restant estimé. Les associations `user_progression.current_challenge_id` sont intactes (pgTAP 15/15).

## Écart historique à résorber (rappel)

Plan de résorption (données, prochaine tranche) :
1. Conserver les lignes et toutes les associations (`user_progression.current_challenge_id`) — aucune suppression.
2. Migration additive : table de liaison id de défi → modèle de catalogue (`provenance`, `version`), dédup des 26 historiques.
3. Interface : ne plus afficher de promesse de points sur la carte de défi ; afficher l'avancement en réalisations distinctes et le gain restant estimé (T14).
4. T13 prend le relais : assignations ≤ 3 missions, remplacement/abandon sans perte ni dette.

## Vérifications

- `npx vitest run tests/features/progression/missionCatalog.spec.ts` — 5/5 : huit catégories couvertes, aucun producteur indisponible cité, aucune promesse de points, identifiants/versions/provenances complets.
