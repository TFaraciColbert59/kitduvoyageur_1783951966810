# Matrice des producteurs de progression

Mise à jour : 11 octobre 2026 (T09 — preuves renforcées, économie 2.0 P1).
Règle : un producteur n'est actif que si sa preuve est vérifiable côté serveur. Les producteurs désactivés listent précisément ce qui manque. Les montants v2 sont gelés dans `docs/progression/2.0/rules-registry.json` (`draft_closed`) ; en production, le barème v1 reste actif et les formules T09 ci-dessous s'appliquent aux nouveaux événements.

## Actifs (preuve serveur vérifiée — T09)

| Action | Source réelle | Validation serveur (T09) | Gain | Répartition | Caps (jour/sem/saison) | Tests |
|---|---|---|---|---|---|---|
| Session de randonnée traitée | `hike_sessions.processing_status='processed'` | Propriété, session traitée ; **durée active** (`duration_seconds`, pauses exclues) ; `track_quality.plausibleMovement ≥ 0.5` (téléphone immobile exclu) ; **paliers 20/60/120/240 min → 40/70/100/130** ; **nouveauté** +20 une fois par parcours canonique (`route_id`) et par saison, claim `route_novelty`, gain total ≤ 150 | 40–150 | Explorer 1.0 | 2/8/48 (v2, `cap_group` terrain) | `producerHooks.spec` (b,b2,b3,b4) |
| Activité préparée depuis un sentier réel | `prepareActivityFromTrail` résultat `created` (index unique `uniq_trips_user_route`) | Sentier existant, géométrie réelle, propriétaire, résultat `created` (pas `reused`) ; intention durable écrite dans le même flux | 30 | Se préparer 1.0 | 1/3/18 (v2, partagé Compas) | `producerHooks.spec` (e) |
| Débrief terrain du kit | `kit_field_reports` (upsert item par item) sur session `processed` portant le kit | Propriété session ET kit ; **équipements DISTINCTS** (item_key) : 20 + 2×n, plafond 10 items = 40 ; **attribution différée** (capsule de stabilisation 20 min, finalisation du débrief, pas le premier item) ; date métier = dernier enregistrement | 20–40 | Se préparer 0.7 · Partager 0.3 | 1/3/18 (v2) | `producerHooks.spec` (c,d) + pgTAP intention différée |
| Avis de lieu publié | `place_reviews` unicité `(place_id, author_id)` | Propriétaire, upsert unique. **Palier 40 (visite contrôlée) fermé** : aucune preuve serveur de visite (lien lieu ↔ réalisation GPS) n'existe — aucun crédit inventé | 15 (40 fermé) | Partager 1.0 | 2/6/24 (v2) | `producerHooks.spec` (f) |
| Carnet publié | `carnets.visibility ∈ {public, friends}` + lien `carnets.trip_id` ou session | Auteur propriétaire, publication réelle, ≥ 3 moments ou ≥ 1 média ; points à la publication ; éditions sans recrédit | 60 | Partager 1.0 | 1/2/12 (v2) | `producerHooksCompletion.spec` (a–e) |
| Checklist complétée | `trip_checklist_items` avec **contrôles dus** (`due_offset_days` non nul) | Voyage `planned`/`active` ; **≥ 3 contrôles dus pertinents, tous terminés** ; les items libres ne comptent pas et ne bloquent pas ; date métier = dernier contrôle dû terminé | 25 | Se préparer 1.0 | 1/4/24 (v2) | `producerHooksCompletion.spec` (f,g,h,h2,i) |
| Itinérance accomplie | `trips.status='completed'` + **≥ 2 sessions `processed` liées sur ≥ 2 JOURS UTC distincts** | Une checklist ou un POI déclaré seuls ne prouvent plus le voyage ; une sortie journalière non plus ; propriété et couverture vérifiées | 45 | Explorer 0.7 · Se préparer 0.3 | 1/2/8 (v2) | `producerHooksCompletion.spec` (j,k,k2,k3,l,m) |

## Chaîne de fiabilité (déployée)

Source → **intention durable** (`progression_award_intents`, capteurs SQL atomiques T06) → **consommateur borné** (`intentConsumer` T07, refus métier terminal / panne infra → backoff → dead) → moteur canonique (`award_progression_gain` T08 : verrou par utilisateur, plafonds par date métier, cap_group, claims) → outbox → événement → projection → affichage. L'accélérateur client best-effort reste facultatif ; le débrief kit passe uniquement par la capsule de stabilisation.

## Désactivés (faute de preuve exploitable)

| Action | Ce qui manque précisément |
|---|---|
| Parrainage | Aucune table ni flux de parrainage ; seule une config `action_base_points.referral` existe |
| SOS / entraide géolocalisée | `sos_alerts` propriétaire uniquement, aucun répondant ni transition applicative |
| Découverte attestée (passeport) | Pas encore de table de découvertes canoniques (T18) |
| Import GPX comme réalisation | Aucun stockage serveur de trace importée (l'ingestion valable est la session traitée) |
| Participation aux sorties | Auto-inscription sans présence vérifiable (T30) |
| Défis de club | `club_challenge_entries.validated` jamais renseigné, aucun validateur (T31) |
| Signalements de lieu | `place_reports` en `pending` sans flux de traitement (T24) |
| Entretien / réparation | Résoudre une alerte ne prouve pas l'acte (T33) |
| Kit adapté (diff persisté) | Score de préparation côté client, non persisté (T23) |
| Tâches collectives | Complétion unilatérale, aucune validation croisée (T31) |
| Prêt restitué | `borrower_id` jamais renseigné ; restitution unilatérale (T32) |
| Q&A entraide | Modèle de données existant mais aucun flux applicatif (T25) |
| Activités hors randonnée | Adaptateurs métier absents (T21) |
| Fidélité / xp legacy | Écritures client directes (`loyalty_points`, `xp`) — non opposables ; émission commerciale T38 |

## Règles communes

- Clé d'idempotence générée serveur : `<source>:<source_id>` (jamais de `rules_version`).
- `effective_at` = date métier réelle ; réception tardive : grâce 14 jours ; politiques de retard explicites dans le barème.
- Plafonds par date métier (jour UTC, semaine ISO UTC, saison [début, fin)) dans `progression_rules.payload.actions.<action>.caps`, groupes `cap_groups` partagés (T08).
- Nouveauté : claim `route_novelty`, une fois par parcours canonique et par saison, réservé atomiquement avec le gain.
- Les plafonds d'XP par famille (terrain 600/4800, préparation 120/960, partage 180/1440, entraide 180/1440) s'activeront avec la publication du barème v2 ; ils sont gelés dans le registre JSON.
- Exclusion : achats, dépenses, valeur du matériel, clics, connexions, temps d'écran, messages privés, créations/suppressions répétées.
- Aucun gain pour un badge, une mission, un tampon ou une vue supplémentaire du même fait.
