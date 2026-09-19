# Matrice des producteurs de progression

Mise à jour : 19 septembre 2026 · Référence : spec §3 (`docs/superpowers/specs/2026-09-19-lkdv-progression-canonique-direction-mobile-design.md`).
Règle : un producteur n'est actif que si sa preuve est vérifiable côté serveur. Les producteurs désactivés listent précisément ce qui manque.

## Prêts à brancher (preuve serveur existante)

| Action | Source réelle | Validation serveur | Gain v1 | Répartition | Plafond | Test | Clé d'idempotence |
|---|---|---|---|---|---|---|---|
| Session de randonnée traitée | `hike_sessions.processing_status='processed'` + `session_segment_passages` écrits par le processeur | Propriété `user_id`, session traitée par le cron, métriques serveur | 40 + paliers (passages, qualité), plafond 150 | Explorer 1.0 | 150/session | P2 | `hike_session:<session_id>` |
| Activité préparée depuis un sentier réel | `prepareActivityFromTrail` résultat `created` (index unique `uniq_trips_user_route`) | Sentier existant, géométrie réelle, propriétaire, résultat `created` (pas `reused`) | 30 | Se préparer 1.0 | 1 par sentier | P2 | `trail_prep:<user_id>:<route_id>` |
| Débrief terrain du kit | `kit_field_reports` sur session `processed` portant le kit | Propriété session ET kit, session traitée exigée | 20 + 2/élément, plafond 40 | Se préparer 0.7 · Partager 0.3 | 40/session | P2 | `kit_report:<session_id>` |
| Avis de lieu publié | `place_reviews` unicité `(place_id, author_id)` | Propriétaire, upsert unique ; +25 seulement si preuve terrain recalculée serveur | 15 (+25 certifié) | Partager 1.0 | 1 par lieu, édition sans recrédit | P2 | `place_review:<place_id>` |
| Carnet publié | `carnets.visibility ∈ {public, friends}` + lien `carnets.trip_id` ou session (`hike_sessions.carnet_id`, `carnet_moments.hike_session_id`) | Auteur propriétaire, publication réelle, ≥ 3 moments ou ≥ 1 média (`carnet_media.url` ou `carnet_moments.image_url`) ; points à la publication | 60 | Partager 1.0 | 1 par carnet | P2 | `carnet:<carnet_id>` |
| Checklist complétée | `trip_checklist_items` 100 % cochés (aucune colonne ne distingue un item dû : tous les items), voyage `planned`/`active` | État relu en service role après toggle (route `POST /api/trips/[id]/checklist/complete`) | 25 | Se préparer 1.0 | 1 par voyage | P2 | `checklist:<trip_id>` |
| Voyage terminé | `trips.status='completed'` + ≥ 1 preuve : session `processed` liée, checklist 100 %, ou POI `visited` | Transition contrôlée via `updateTripStatus` ; une fois par voyage | 45 | Explorer 0.7 · Se préparer 0.3 | 1 par voyage | P2 | `trip:<trip_id>` |

## Livrés dans ce programme (P2)

Les trois derniers producteurs du tableau ci-dessus sont désormais branchés par des accroches qui recalculent la preuve en service role : `awardCarnetPublished` (routes serveur et client via `POST /api/carnets/[id]/publish`), `awardChecklistCompleted` (route `POST /api/trips/[id]/checklist/complete` appelée après chaque toggle) et `awardTripCompleted` (dans `updateTripStatus`). Preuves couvertes par `tests/features/progression/producerHooksCompletion.spec.ts`.

Règle appliquée : une preuve incomplète refuse sans appeler le moteur (`success:false`, `reason` explicite) ; l'idempotence `<source>:<source_id>` garantit une seule attribution. Les routes client répondent 200 même en refus/erreur : la progression ne bloque jamais le parcours.

## Désactivés (faute de preuve exploitable)

| Action | Ce qui manque précisément |
|---|---|
| Parrainage | Aucune table ni flux de parrainage ; seule une config `action_base_points.referral` existe |
| SOS / entraide géolocalisée | `sos_alerts` propriétaire uniquement, aucun répondant ni transition applicative |
| Découverte attestée | Aucun modèle de nouveauté ni de preuve de découverte |
| Import GPX comme réalisation | Aucun stockage serveur de trace importée (l'ingestion valable est la session traitée) |
| Participation aux sorties | Auto-inscription sans présence vérifiable (pas de check-in serveur) |
| Défis de club | `club_challenge_entries.validated` jamais renseigné, aucun validateur |
| Signalements de lieu | `place_reports` en `pending` sans flux de traitement |
| Entretien / réparation | Résoudre une alerte ne prouve pas l'acte ; pas de table d'intervention ni confirmation |
| Kit adapté (score) | Score de préparation calculé côté client, non persisté |
| Tâches collectives | Complétion unilatérale, aucune validation croisée par un tiers |
| Prêt restitué | `borrower_id` jamais renseigné ; restitution unilatérale (prêteur) |
| Contributions club | Aucun critère objectivable (pas de réponse acceptée, modération absente) |
| Q&A entraide | Modèle de données existant mais aucun flux applicatif |
| Terrain Live | Preuve techniquement forte mais flag produit `terrain_live` OFF par défaut |
| Fidélité / xp legacy | Écritures client directes (`loyalty_points`, `xp`) — non opposables |

## Règles communes

- Clé d'idempotence générée serveur : `<source>:<source_id>` (jamais de `rules_version`).
- `effective_at` = date métier réelle ; activité tardive : grâce 14 jours par défaut, politique `refuse` au-delà ; la saison courante n'est jamais écrasée.
- Plafonds quotidien/hebdomadaire/saison par action dans `progression_rules.payload.actions.<action>.caps`.
- Rendements décroissants (même sentier dans la saison : ×0.5 puis ×0.25) : à implémenter en P2 dans la fonction d'attribution.
- Exclusion : achats, dépenses, valeur du matériel, clics, connexions, temps d'écran, messages privés, créations/suppressions répétées.
- Aucun gain pour un badge ou un défi (conséquences, jamais boucles).
- Explication du gain et de la répartition montrée à l'utilisateur (`metadata.explanation`).
