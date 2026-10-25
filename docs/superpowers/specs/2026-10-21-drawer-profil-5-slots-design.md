# Drawer Profil — 5 slots, version propre

Date : 21 octobre 2026.
Statut : refonte propre après retours utilisateur. Aucun code produit.
Portée : drawer Profil (`S.step === 0`), propriétaire et visiteurs autorisés.

## 1. Décisions verrouillées

- **5 slots** : Vitrine · Kit · Prêts · Souvenirs · Communauté.
- **Sélecteur inchangé dans sa famille** : on réutilise `.ig-tabs` (la petite
  capsule à lentille de la carte principale, en bas à gauche), 5 icônes, l'actif
  s'élargit avec son libellé. Même langage visuel que la bottom bar, taille réduite.
- **Changement de lentille par swipe horizontal** à l'intérieur d'un slot :
  droite → gauche = lentille suivante, gauche → droite = précédente. Le segmented
  `.flow` reste affiché et se synchronise avec le swipe.
- **Pas de nouvelle carte dans le drawer** : la carte du bas existe déjà. Quand le
  drawer est ouvert, elle passe en **mode contexte** et change de style selon le
  slot/lentille actif.
- **Compte public** : les 5 slots visibles par tout le monde. **Compte privé** :
  visible uniquement sur invitation. Aucune autre règle, aucune visibilité par bloc.
- **Souvenirs** : uniquement les stories **À la une** (`story_highlights`), jamais
  toutes les stories.
- **Kit** : une **image produit à chaque fois**, et réutilisation des fonctions
  existantes de kit (récupération/fork, partage, fiche, référencement, royalties,
  historique, découverte).
- **Clubs** : plusieurs clubs, cartes **scrollables horizontalement**, clic →
  **nouveau drawer club** avec infos et actions.
- **Prêts** : on **retire « prêts rendus »** de la lentille Confiance.

## 2. Les 5 slots et leurs lentilles

| # | Slot | Lentilles |
|---|------|-----------|
| 1 | **Vitrine** | Stats · Republication · Trophées |
| 2 | **Kit** | Kits · Inventaire |
| 3 | **Prêts** | Je prête · J'emprunte · Confiance |
| 4 | **Souvenirs** | Timeline · Passeport · Souvenirs |
| 5 | **Communauté** | Défis · Clubs · Cordée |

## 3. Sélecteur, swipe et carte contexte

### 3.1 Sélecteur de slot
- Réutilise `.ig-tabs` : capsule, lentille `.ig-th`, icônes 18 px, hauteur 44 px.
- Position : **en haut du drawer, sur toute la largeur**, comme la navigation des
  autres drawers du compte.
- 5 icônes ; l'icône active s'élargit pour afficher son libellé court.
- Glissement de lentille 300 ms, `translateX`, pas de nouvelle animation.
- Le sélecteur des **lentilles** passe en bas à droite : petite pilule flottante
  façon sélecteur grille/sorties de la carte principale, **icônes seules**
  (libellé en `aria-label`/`title`), cible 44 px.

### 3.2 Swipe des lentilles
- Le contenu du slot est une piste horizontale de N lentilles.
- Swipe droite → gauche : lentille suivante ; gauche → droite : précédente.
- Seuil 24 px, verrouillage d'axe pour ne pas gêner le scroll vertical.
- Le segmented `.flow` se met à jour pendant le swipe, la lentille coulisse.
- Fin de swipe : snap 250 ms, easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- Accessibilité : boutons du segmented toujours cliquables, clavier ←/→.

### 3.3 Carte contexte (carte du bas)
- Aucune carte n'est ajoutée dans le drawer.
- Quand le drawer s'ouvre, la carte du bas passe en mode contexte : fond atténué,
  en-tête compact avec le nom du slot, calque adapté.
- Calques par slot : Vitrine → heatmap personnelle ; Kit → usage des kits ;
  Prêts → circulation du matériel (anonymisée) ; Souvenirs → lieux des À la une ;
  Communauté → clubs et événements.
- Retour au mode normal à la fermeture du drawer.

## 4. Description écran par écran

### Shell commun
- Poignée 36×5, **navigation des 5 slots en haut** (`.ig-tabs`, toute la
  largeur), contenu scrollable, **pilule des lentilles en bas à droite**
  (icônes seules, 44 px). Aucun en-tête : pas d'icône, pas de titre, pas de
  sous-titre, pas de bouton Partager.
- Cartes en verre `--glass-*`, rayons 18–22 px, liseré lumineux, ombre douce.
- États : squelette, vide avec CTA, erreur avec nouvel essai.
- Mouvement `transform`/`opacity`, réduction de mouvement respectée.

### Slot 1 — Vitrine

**Stats**
1. Carte héro 3 colonnes : km, D+, sorties (chiffres 28 px tabulaires).
2. 3 tuiles : nuits, massifs, pays.
3. Carte « Cette année » : 12 barres, meilleur mois, plus longue sortie.
4. Pas de carte dans le drawer : la carte du bas affiche la heatmap.

**Republication**
1. Liste de cartes 76 px : vignette source, auteur d'origine, date source,
   date du relais, pastille audience, « Voir l'original ».
2. Pied : nombre de republications.
3. Propriétaire : « Republier une publication ».
4. Vide : « Aucune republication pour le moment ».

**Trophées**
1. Étagère de 4 badges récents (tuiles 72 px, anneau de rareté).
2. Carte « Prochain badge » avec progression.
3. Grille « Tout voir » 3 colonnes (tuiles 96 px).
4. Vide : « Aucun badge pour le moment ».

### Slot 2 — Kit

**Kits**
1. Carte kit 96 px avec **image produit** : `cover_image_url` sinon première
   image d'objet, sinon visuel généré. Nom, poids, objets, génération, preuves.
2. Actions existantes réutilisées : **Récupérer/fork** (`/api/materiel/fork`),
   **Partager** (`/api/materiel/share` → `/k/token`), **Fiche** (`/api/kits/:id/sheet`),
   **Référencer** (`/api/kits/:id/refer`), **Royalties** (`/api/kits/my-royalties`),
   **Historique** (`/api/materiel/kits/:id/history`), **Découvrir** (`/api/kits/discovery`).
3. Carte filiation G1 → G2 → G3.
4. Vide : « Aucun kit enregistré ».

**Inventaire**
1. Sections par catégorie, ligne d'objet avec **image produit** (`photo_url`).
2. Nom, marque, poids, état, badge prêt.
3. Propriétaire : prix, coût par sortie, entretien, prêt. Visiteur : sans prix ni prêt.
4. Vide : « Aucun matériel enregistré ».

### Slot 3 — Prêts

**Je prête**
1. Résumé 3 colonnes : actifs, en retard, cette année.
2. Cartes prêt 84 px : objet, prénom (visiteur « Membre »), dates, statut,
   échéance, actions Rappeler / Marquer rendu / Noter.
3. Vide : « Aucun prêt en cours ».

**J'emprunte**
1. Même structure côté emprunteur.
2. Actions : Rendre, Noter, Signaler.

**Confiance**
1. Carte agrégée : vérifié, prêts actifs, note moyenne, taux de retour à temps.
2. **Aucun historique « prêts rendus »** (retiré).
3. Visiteur : carte agrégée uniquement.

### Slot 4 — Souvenirs

**Timeline**
1. Filtres d'année, sections par mois, cartes sortie 88 px.
2. Couverture, titre, km · D+, massif, pastille GPS, photos.
3. Vide : « Aucune sortie enregistrée ».

**Passeport**
1. Grille de tampons 3 colonnes : lieu, type, sorties, sceau.
2. Ligne « X lieux visités ».
3. Vide : « Aucun lieu validé ».

**Souvenirs**
1. **Uniquement les stories À la une** : `story_highlights` + `story_highlight_items`.
2. Carte album 96 px : couverture (cover_story_id), titre, nombre d'éléments.
3. Clic → visionneuse À la une existante.
4. Vide : « Aucune story à la une ».
5. Les autres stories ne sont jamais listées ici.

### Slot 5 — Communauté

**Défis**
1. Cartes défi 84 px : titre, catégorie, difficulté, XP, progression, échéance.
2. Section Terminés repliable.
3. Vide : « Aucun défi en cours ».

**Clubs**
1. **Rail horizontal scrollable** de cartes club (largeur 78 %, snap).
2. Carte : emoji, nom, catégorie, rôle, membres, prochain événement.
3. **Clic → drawer club** (nouveau) : en-tête club, rôle, membres actifs,
   prochains événements avec RSVP, sujets récents, kits recommandés, actions
   Rejoindre/Quitter/Partager/Inviter, règles de sécurité.
4. Vide : « Aucun club » + « Découvrir des clubs ».

**Cordée**
1. Rangée abonnés / abonnements.
2. Lignes compagnons : avatar, nom, @handle, sorties communes, dernier massif.
3. Bandeau confiance.
4. Vide : « Aucune sortie partagée ».

## 5. Compte public / privé

- `user_profiles.profile_visibility` : deux valeurs, `public` et `prive`.
- Migration : `communaute` → `public`, contrainte deux valeurs.
- `profile_invitations` : propriétaire crée/révoque, invité lit la sienne.
- `public_profiles` étendue : public → tout le monde ; privé → soi ou invitation
  acceptée non expirée.
- Visiteur sans invitation : écran verrouillé, aucun slot.

**Périmètre de livraison.** Le drawer 5 slots est la surface **propriétaire**
montée sur `/compte` : un invité n'y accède pas et un compte connecté y voit
toujours ses propres slots. La branche visiteur/verrou (`viewer=visitor`,
`visibility=prive`, `invited=false`) est implémentée et couverte par les tests
unitaires, mais son montage sur la page publique `/profil/[id]` reste un
follow-up explicite ; d'ici là, la confidentialité y est portée par
`public_profiles` et par le gating des requêtes de la page (aucune requête
carnets/badges/clubs/sessions n'est émise sans accès). La republication est
exposée par la route et la lentille Vitrine ; le branchement du compositeur
`/communaute/publier` sur cette route reste également un follow-up.

## 6. Liens base de données

| Slot / lentille | Table(s) | État réel |
|---|---|---|
| Vitrine Stats | `hike_sessions`, `community_posts` | 20 sessions, 20 posts |
| Vitrine Republication | `community_posts` + `reposted_from_id` | 20 posts |
| Vitrine Trophées | `badges`, `user_badges` | 32 badges, 10 obtenus |
| Kit Kits | `materiel_kits`, `materiel_kit_items`, `kit_items`, `explore_kits_public` | 34 kits, 1 kit public |
| Kit Inventaire | `product_ownership`, `photo_url` | 83 objets, 15 photos |
| Kit fonctions | `share_tokens`, `kit_attributions`, `kit_export_logs`, `kit_field_reports` | 0, 0, 0, 0 |
| Prêts | `materiel_loans`, `loans`, `marketplace_reviews` | 5 prêts |
| Souvenirs Timeline | `hike_sessions`, `hiking_routes` | 20 sessions |
| Souvenirs Passeport | `geo_massifs`, `hike_sessions` | 774 massifs |
| Souvenirs À la une | `story_highlights`, `story_highlight_items` | 0, 0 |
| Communauté Défis | `challenges`, `user_challenges`, `progression_challenges` | 26, 0, 8 |
| Communauté Clubs | `clubs`, `club_members`, `club_events`, `club_topics`, `club_recommended_kits` | 31, 35, 26, 40, 0 |
| Communauté Cordée | `user_follows`, `public_profiles`, `hike_sessions` | follows réels |
| Confidentialité | `user_profiles.profile_visibility`, `profile_invitations` | 157 public, 6 communaute |

RLS vérifiée : `community_posts` par audience, `materiel_loans` involved,
`story_highlights` / `story_highlight_items` propriétaire, `profile_invitations`
propriétaire/invité, `user_badges`/`user_challenges` lecture publique + gestion own.

## 7. Migration nécessaire

- `profile_visibility` : migrer `communaute` → `public`, contrainte deux valeurs.
- Table `profile_invitations` + RLS + index.
- `community_posts.reposted_from_id`.
- Vue `public_profiles` étendue aux invitations.
- Index : `materiel_loans(lender_id,status)`, `club_events(club_id,event_date)`,
  `community_posts(author_id,created_at)`, `story_highlights(owner_id,position)`.
- Correction `mapClubs` : prochain événement depuis `club_events`.

## 8. Limites connues

- `story_highlights`, `share_tokens`, `kit_attributions`, `user_challenges` sont
  vides : états vides explicites.
- `materiel_kits.cover_image_url` est vide ; l'image vient de `product_ownership.photo_url`
  ou de `kit_items.image` (3 images catalogue).
- Pas de coordonnées GPS dans les sessions : le passeport s'appuie sur les
  régions et itinéraires réels.
- Les notes de prêt sont nulles : carte de confiance « pas encore noté ».

## 9. Décisions à confirmer

1. 5 slots, sélecteur `.ig-tabs` en bas à gauche, swipe des lentilles.
2. Carte du bas en mode contexte, aucune carte ajoutée dans le drawer.
3. Souvenirs = À la une uniquement ; clubs scrollables + drawer club ;
   « prêts rendus » retiré.
