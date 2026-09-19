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

## À compléter dans ce programme

| Action | Ce qui manque | Critère proposé | Répartition | Statut |
|---|---|---|---|---|
| Carnet publié | Publication réelle (visibilité ≠ privée), lien voyage/session, critère moments/médias, points à la publication | ≥ 3 moments ou ≥ 1 média | Partager 1.0 | Désactivé tant que non livré |
| Checklist complétée | RPC de clôture « 100 % des items dus faits », une fois par voyage | Voyage planifié/actif, date de départ encadrée | Se préparer 1.0 | Désactivé tant que non livré |
| Voyage terminé | Automate d'état, au moins une preuve serveur (session traitée, checklist, POI visités) | Transition contrôlée vers `completed` | Explorer 0.7 · Se préparer 0.3 | Désactivé tant que non livré |

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
