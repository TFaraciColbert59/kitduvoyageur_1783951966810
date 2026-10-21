# Refonte du drawer Profil — 6 slots « Le vestiaire du voyageur »

Date : 21 octobre 2026.
Statut : design révisé après retour utilisateur (slots 5 et 6 privés, communauté déplacée, couronne retirée, Atelier de publication).
Portée : drawer Profil (`S.step === 0`) du compte LKDV, en vue propriétaire et en vue visiteur.

## 1. Décisions issues du retour utilisateur

- Les slots **5** et **6** sont **privés** : ils ne sont pas montrés à un visiteur.
- Les **défis**, **clubs + événements + sujets** et **cordée + compagnons de sortie**
  passent du slot 1 au **slot 5**, qui devient l'écran **Communauté** personnel.
- La **couronne de régularité** est retirée du design.
- Le **slot 6** est un nouvel écran privé : l'**Atelier de publication**, construit
  autour de la **republication** et de tout ce qui touche à ce que l'utilisateur publie.
- Le slot 1 **Vitrine** garde l'identité, les **stats** et les **trophées/badges**.
- Le drawer doit rester lisible par un visiteur pour les slots publics (1 à 4).

## 2. Les 6 slots

| # | Slot | Visibilité | Contenu principal |
|---|------|------------|-------------------|
| 1 | **Vitrine** | Public | Identité, stats, trophées/badges |
| 2 | **Kit & Sac** | Public si kit public | Kits, inventaire, usure, lignée |
| 3 | **Prêts & Locations** | Privé + carte de confiance publique | Prêts, emprunts, réputation |
| 4 | **Sorties & Souvenirs** | Public selon publication | Timeline, passeport de lieux, souvenirs 3D |
| 5 | **Communauté** | **Privé** | Défis, clubs + événements + sujets, cordée + compagnons |
| 6 | **Atelier** | **Privé** | Brouillons, republication, partages, modération, performance |

Vue visiteur : rail limité aux slots **1 à 4**. Les slots 5 et 6 n'apparaissent pas.

## 3. Contenu détaillé

### Slot 1 — Vitrine (public)

**Lentille Stats**
- Bandeau : km, D+, sorties, nuits dehors, massifs, pays.
- Bloc « Cette année » : 12 mois, meilleur mois, plus longue sortie.
- Chaque stat a un cadenas public/privé.
- Pas de couronne, pas de classement, pas de rang.

**Lentille Trophées**
- Armoire : 4 badges récents, puis grille complète.
- `badges` (32) + `user_badges` (10), dédupliqués par nom.
- Progression des défis déplacée au slot 5 ; ici uniquement les badges obtenus
  et les badges verrouillés avec leur condition.
- Carte partageable « Mon année LKDV ».

### Slot 2 — Kit & Sac

Inchangé par rapport au design précédent : kits `materiel_kits` (34), inventaire
`product_ownership` (83), poids, coût par sortie, lignée (`ancestors`,
`lineage_root_id`, `generation`), usure dérivée des sorties réelles, fenêtre de
remplacement liée au prochain voyage. En vue visiteur : uniquement `is_public`.

### Slot 3 — Prêts & Locations

Inchangé : deux lentilles « Je prête » / « J'emprunte », `materiel_loans` (5),
statuts, échéances, contrat, notes mutuelles, carte de confiance publique.

### Slot 4 — Sorties & Souvenirs

Inchangé, sans les compagnons (déplacés au slot 5) : timeline `hike_sessions`,
carnets, photos, passeport de lieux (`geo_massifs`, 774), souvenir 3D, collections.

### Slot 5 — Communauté (privé)

**Lentille Défis**
- `challenges` (26) : titre, catégorie, difficulté, XP, échéance.
- `user_challenges` : progression personnelle (0 aujourd'hui → état vide).
- `progression_challenges` (8) : paliers de progression.
- Aucun classement public, aucune comparaison nominative.

**Lentille Clubs**
- Cartes `clubs` (31) + `club_members` (35) : rôle, statut, membres actifs.
- Prochain événement depuis `club_events` (26) : date, lieu, places, RSVP.
- Sujets `club_topics` (40) : épinglés et annonces d'abord.
- Kits recommandés `club_recommended_kits`.
- Actions : rejoindre, quitter, s'inscrire, ouvrir le club.

**Lentille Cordée**
- Abonnés / abonnements réels (`user_follows` + `public_profiles`).
- **Compagnons de sortie** : personnes présentes sur les mêmes `hike_sessions`,
  avec nombre de sorties communes et dernier massif partagé.
- Confiance : prêts rendus, notes, ancienneté.

### Slot 6 — Atelier (privé)

**Lentille Brouillons**
- `community_post_drafts` (0 aujourd'hui) : titre, contenu, type, tags, lieu,
  audience, club, date de modification.
- Reprendre, publier, supprimer.
- `scheduled_at` à ajouter pour programmer une publication.

**Lentille Republication**
- Republier une publication existante vers une autre audience : public, club,
  abonnés. Source : `community_posts` (20) avec `audience`, `club_id`,
  `linked_carnet_id`, `linked_kit_id`, `snapshot_payload`, `mentions`.
- Attribution obligatoire : `reposted_from_id` à ajouter, plus mention de l'auteur
  d'origine.
- Republier un carnet ou un kit en publication, avec snapshot figé.
- Idempotence via `client_request_id`.

**Lentille Partages**
- `post_shares` (0) : partages en message privé, avec conversation et date.
- `share_tokens` (0) : liens de partage de kit, permission, expiration, dernier accès.
- `community_posts.shares_count` : nombre de partages par publication.
- `messages` avec `message_type = 'post'` : trace réelle du partage.

**Lentille Modération & Performance**
- `community_moderation_queue` (7) : signalements déposés ou reçus, statut, raison.
- Performance par publication : vues, likes, commentaires, partages
  (`community_posts.likes_count`, `comments_count`, `shares_count`).
- Meilleure publication, audience qui performe, heure de publication.
- Actions : modifier, dépublier, supprimer, republier.

## 4. Disposition UI/UX

### 4.1 Rail de slots (6 emplacements)

Une barre d'onglets iOS classique est limitée à 5 éléments. Le drawer utilise donc
un **rail horizontal scrollable** en haut de la feuille :

- 6 pilules (icône + libellé court) pour le propriétaire, 4 pour un visiteur.
- Pilule active avec la lentille existante (`.sel-lens`) animée en 300 ms.
- Le titre large de la feuille affiche le slot actif.
- Le rail reste accessible au pouce, sans masquer le contenu.
- Rôles ARIA : `tablist` / `tab` / `tabpanel`, cible 44 px, libellés explicites.

### 4.2 Lentilles internes

Chaque slot a 2 à 4 lentilles segmentées :

- Vitrine : `Stats` · `Trophées`
- Kit & Sac : `Kits` · `Inventaire` · `Usure`
- Prêts & Locations : `Je prête` · `J'emprunte` · `Confiance`
- Sorties & Souvenirs : `Timeline` · `Passeport` · `Souvenirs`
- Communauté : `Défis` · `Clubs` · `Cordée`
- Atelier : `Brouillons` · `Republication` · `Partages` · `Modération`

### 4.3 Grammaire visuelle (Apple HIG + Liquid Glass)

- Feuille iOS : grand titre, rail de slots, contenu scrollable, pas de bordure dure.
- Cartes en verre dépoli réutilisant `--glass-*`, `--lkv-*`, `.lg`, `.li`, `.mbtn`.
- Hiérarchie par taille et graisse, accent `#17402C` parcimonieux, zéro orange.
- Rythme de liste iOS : séparateurs ou espacement, jamais les deux.
- États : squelette au chargement, état vide avec CTA, erreur avec nouvel essai.
- Mouvement : 200–300 ms pour les lentilles, `transform`/`opacity` uniquement,
  `prefers-reduced-motion` respecté, une seule animation dominante par vue.

### 4.4 Composants

`SlotRail`, `SlotShell`, `SegmentedLens`, `StatTile`, `BadgeTile`, `KitCard`,
`WearGauge`, `LoanCard`, `StampTile`, `ClubCard`, `ChallengeRow`, `CompanionRow`,
`DraftCard`, `RepostCard`, `ShareRow`, `ModerationRow`, `PerformanceTile`.

## 5. Vérification des liens base de données

| Slot / lentille | Table(s) | État réel |
|---|---|---|
| Vitrine stats | `hike_sessions`, `community_posts`, `user_follows` | 20 sessions, 20 posts |
| Vitrine trophées | `badges`, `user_badges` | 32 badges, 10 obtenus |
| Kit & Sac | `materiel_kits`, `materiel_kit_items`, `product_ownership`, `kit_royalty_shares` | 34 kits, 83 objets |
| Prêts | `materiel_loans`, `loans`, `marketplace_reviews` | 5 prêts, notes nulles |
| Souvenirs | `hike_sessions`, `community_posts`, `carnets`, `post_stories`, `geo_massifs` | 20 sessions, 774 massifs |
| Communauté défis | `challenges`, `user_challenges`, `progression_challenges` | 26 défis, 0 progression |
| Communauté clubs | `clubs`, `club_members`, `club_events`, `club_topics`, `club_recommended_kits` | 31 clubs, 26 événements, 40 sujets |
| Communauté cordée | `user_follows`, `public_profiles`, `hike_sessions` | follows réels, 20 sessions |
| Atelier brouillons | `community_post_drafts` | 0 aujourd'hui |
| Atelier republication | `community_posts` (+ `reposted_from_id` à ajouter) | 20 publications |
| Atelier partages | `post_shares`, `share_tokens`, `messages` | 0 partage, 0 token |
| Atelier modération | `community_moderation_queue` | 7 signalements |

RLS vérifiée : `community_post_drafts` (select/insert/update/delete own),
`post_shares` (read/insert own), `share_tokens` (owner), `community_posts`
(select audience, insert/update/delete own), `materiel_loans` (select/update
involved), `user_badges` et `user_challenges` (lecture publique, gestion own).

## 6. Migration nécessaire

- `user_profiles.profile_section_visibility jsonb default '{}'`.
- `community_posts.reposted_from_id uuid references community_posts(id)`.
- `community_posts.scheduled_at timestamptz`.
- `community_post_drafts.scheduled_at timestamptz`.
- Index : `materiel_loans(lender_id,status)`, `club_events(club_id,event_date)`,
  `community_posts(author_id,created_at)`.
- Correction de `mapClubs` : prochain événement depuis `club_events`, pas
  `clubs.next_event` (colonne inexistante).

## 7. Limites connues

- `community_post_drafts`, `post_shares`, `share_tokens`, `user_challenges`,
  `user_documents` et `hike_session_photos` sont vides aujourd'hui : états vides
  explicites, pas de contenu inventé.
- Les notes de prêt sont nulles : carte de confiance « pas encore noté ».
- Les sessions n'ont pas de coordonnées GPS exploitables : le passeport de lieux
  s'appuie sur les régions et itinéraires, pas sur une trace inventée.

## 8. Décisions à confirmer

1. Les 6 slots ci-dessus, avec Communauté et Atelier privés (non visibles visiteur).
2. Le rail horizontal de 6 pilules plutôt qu'une barre d'onglets classique.
3. L'Atelier de publication comme slot 6, avec republication attribuée.
