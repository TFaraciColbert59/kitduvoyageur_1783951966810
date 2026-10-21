# Drawer Profil — 5 slots « Le vestiaire du voyageur »

Date : 21 octobre 2026.
Statut : design révisé (5 slots, sélecteur identique à la bottom bar, compte public/privé, Republication dans Vitrine).
Portée : drawer Profil (`S.step === 0`), visible par le propriétaire et par les visiteurs autorisés.

## 1. Décisions verrouillées

- **5 slots**, pas 6 : on respecte la limite iOS de 5 éléments.
- Le **sélecteur ne change pas de forme** : capsule identique à la bottom bar (`.tb`), icône + libellé, lentille coulissante. Aucun rail horizontal, aucun nouveau style.
- **Les 5 slots sont publics** quand le compte est public.
- **Compte public** : tout le monde voit les 5 slots.
- **Compte privé** : visible **uniquement sur invitation** du propriétaire. Aucune autre règle.
- Pas de visibilité par bloc, pas de matrice « qui voit quoi ».
- **Republication** est une lentille du slot **Vitrine**, pas un slot séparé.
- Les brouillons et la modération restent dans `/communaute/publier` et les surfaces de modération communautaire ; la lentille Republication du drawer est le **flux public des publications relayées**.

## 2. Les 5 slots et leurs lentilles

| # | Slot | Lentilles |
|---|------|-----------|
| 1 | **Vitrine** | Stats · Republication · Trophées |
| 2 | **Kit** | Kits · Inventaire |
| 3 | **Prêts** | Je prête · J'emprunte · Confiance |
| 4 | **Souvenirs** | Timeline · Passeport · Souvenirs |
| 5 | **Communauté** | Défis · Clubs · Cordée |

## 3. Modèle de confidentialité (compte)

`user_profiles.profile_visibility` existe déjà avec les valeurs `public` (157 profils)
et `communaute` (6 profils). Le design retient **deux niveaux** :

- `public` : tout le monde.
- `prive` : uniquement les personnes invitées par le propriétaire.

Migration :
- migrer `communaute` vers `public` ;
- contrainte `profile_visibility in ('public','prive')` ;
- table `profile_invitations` (`id`, `owner_id`, `invitee_id`, `token`, `status`,
  `expires_at`, `created_at`) avec RLS : le propriétaire crée/révoque, l'invité lit
  la sienne, le propriétaire voit les invitations qu'il a émises ;
- étendre la vue `public_profiles` : `public` → tout le monde ; `prive` → seulement
  si `id = auth.uid()` ou s'il existe une invitation acceptée non expirée.

Vue visiteur d'un compte privé sans invitation : écran verrouillé unique,
avatar flouté, nom, mention « Compte privé · accès sur invitation », aucun slot.

## 4. Shell commun du drawer

- **Poignée** : capsule 36×5, centrée, 8 px du haut.
- **En-tête** : icône du slot 22 px, titre 22 px SF Pro Bold, sous-titre 13 px
  secondaire, à droite un bouton Partager 32 px en verre.
- **Sélecteur de slot** : copie conforme de la bottom bar — capsule `.tb`,
  5 éléments, icône 19 px + libellé 10 px, lentille `.sel-lens`, actif `#2F6B45`.
- **Sous-lentilles** : capsule `.flow` existante, 2 à 3 éléments, hauteur 30 px,
  lentille animée 300 ms.
- **Contenu** : pile verticale, 12 px de marge latérale, 10 px entre cartes,
  rayons 18–22 px, verre dépoli `--glass-*`, liseré lumineux, ombre douce.
- **États** : squelette au chargement, état vide avec CTA, erreur avec nouvel essai.
- **Mouvement** : `transform`/`opacity` uniquement, 200–300 ms, réduction de
  mouvement respectée, une seule animation dominante par vue.
- **Accessibilité** : `role="tablist"/"tab"/"tabpanel"`, cibles 44 px, libellés.

## 5. Description écran par écran

### Slot 1 — Vitrine

**En-tête de slot** : avatar 84 px avec anneau Sceau, nom 20 px, @handle 13 px,
« Membre depuis … », base de départ floutée à 1 km, badge compte `Public` ou `Privé`.

**Lentille Stats**
1. Carte héro 3 colonnes : kilomètres, D+, sorties — chiffres 28 px tabulaires,
   libellés 11 px, séparateurs verticaux fins.
2. Rangée de 3 tuiles : nuits dehors, massifs, pays — icône 16 px, valeur 18 px.
3. Carte « Cette année » : 12 barres verticales 28 px, mois en abscisse, meilleur
   mois en pastille, plus longue sortie en ligne secondaire.
4. État vide : illustration montagne, « Aucune sortie enregistrée », CTA
   « Planifier un voyage ».

**Lentille Republication**
1. Ligne d’introduction : « Publications relayées avec attribution ».
2. Cartes de republication (pleine largeur, 76 px) : vignette source 56 px à
   gauche, nom de l’auteur d’origine + @handle, date de la source, date du relais,
   pastille d’audience (`Public`, `Club`, `Abonnés`), chevron « Voir l’original ».
3. Pied de liste : « X publications relayées ».
4. Propriétaire : bouton « Republier une publication » en bas.
5. État vide : « Aucune republication pour le moment » + CTA propriétaire.

**Lentille Trophées**
1. Étagère : 4 badges récents en tuiles 72 px, anneau de rareté coloré, nom 11 px.
2. Carte « Prochain badge » : icône, nom, condition, barre de progression.
3. Grille « Tout voir » 3 colonnes : tuiles 96 px, icône 28 px, nom, rareté,
   date ou condition.
4. État vide : « Aucun badge pour le moment ».

### Slot 2 — Kit

**Lentille Kits**
1. Cartes kit (pleine largeur, 96 px) : couverture 72 px à gauche, nom 15 px,
   poids 13 px, nombre d’objets, génération (`Kit souche`, `Lignée G2`), preuves
   terrain, chevron.
2. Carte filiation : 3 nœuds G1 → G2 → G3, flèches fines, compteur de reprises.
3. Propriétaire : boutons « Créer un kit » et « Kit du prochain voyage ».
4. État vide : « Aucun kit enregistré ».

**Lentille Inventaire**
1. Sections par catégorie : en-tête icône + nom + poids total.
2. Lignes d’objet : nom 14 px, marque 12 px, poids à droite, pastille d’état
   (`neuf`, `bon`, `usé`, `à remplacer`), badge `Prêté` si applicable.
3. Propriétaire : prix payé, coût par sortie, actions entretien/prêt.
4. Visiteur : ni prix, ni prêt, ni nom d’emprunteur.
5. État vide : « Aucun matériel enregistré ».

### Slot 3 — Prêts

**Lentille Je prête**
1. Carte résumé 3 colonnes : prêts actifs, en retard, rendus cette année.
2. Cartes prêt (84 px) : nom de l’objet, prénom de l’emprunteur (visiteur :
   « Membre »), dates, pastille de statut (`En cours`, `En retard`, `Rendu`),
   échéance, actions `Rappeler`, `Marquer rendu`, `Noter`.
3. État vide : « Aucun prêt en cours ».

**Lentille J'emprunte**
1. Même structure, côté emprunteur : objet, prêteur, dates, statut.
2. Actions : `Rendre`, `Noter`, `Signaler un souci`.

**Lentille Confiance**
1. Carte de confiance : badge vérifié, nombre de prêts, note moyenne, taux de
   retour à temps, litiges.
2. Historique compact : 5 derniers prêts avec issue.
3. Visiteur : uniquement la carte agrégée, jamais les personnes.

### Slot 4 — Souvenirs

**Lentille Timeline**
1. Filtres d’année : pastilles 32 px.
2. Sections par mois : cartes sortie (88 px) avec couverture 64 px, titre,
   km · D+, massif, pastille `GPS vérifié`, nombre de photos.
3. État vide : « Aucune sortie enregistrée ».

**Lentille Passeport**
1. Carte carte miniature (hauteur 140 px) avec points visités.
2. Grille de tampons 3 colonnes : tuile 96 px, nom du lieu, type
   (`massif`, `parc`, `refuge`, `sommet`), nombre de sorties, sceau vérifié.
3. Ligne de progression : « X lieux visités ».
4. État vide : « Aucun lieu validé pour le moment ».

**Lentille Souvenirs**
1. Cartes collection : carnets, albums, stories, itinéraires enregistrés.
2. Carte « Revoir en 3D » : aperçu, bouton lecture, durée.
3. État vide : « Aucun souvenir publié ».

### Slot 5 — Communauté

**Lentille Défis**
1. Cartes défi (84 px) : titre, pastille catégorie, difficulté, XP, barre de
   progression, échéance.
2. Section « Terminés » repliable.
3. État vide : « Aucun défi en cours ».

**Lentille Clubs**
1. Cartes club (96 px) : emoji, nom, catégorie, pastille rôle, membres actifs.
2. Carte prochain événement : titre, date, lieu, places, bouton `Je participe`.
3. Aperçu des 2 derniers sujets.
4. Boutons `Rejoindre` / `Quitter`.
5. État vide : « Aucun club » + CTA « Découvrir des clubs ».

**Lentille Cordée**
1. Rangée abonnés / abonnements.
2. Liste compagnons : avatar 36 px, nom, @handle, « X sorties communes »,
   dernier massif partagé, chevron profil.
3. Bandeau confiance : prêts rendus, note, ancienneté.
4. État vide : « Aucune sortie partagée pour le moment ».

## 6. Liens base de données

| Slot / lentille | Table(s) | État réel |
|---|---|---|
| Vitrine Stats | `hike_sessions`, `community_posts` | 20 sessions, 20 posts |
| Vitrine Republication | `community_posts` (`reposted_from_id` à ajouter) | 20 posts |
| Vitrine Trophées | `badges`, `user_badges` | 32 badges, 10 obtenus |
| Kit Kits | `materiel_kits`, `materiel_kit_items`, `kit_royalty_shares` | 34 kits |
| Kit Inventaire | `product_ownership`, `materiel_loans` | 83 objets, 5 prêts |
| Prêts | `materiel_loans`, `loans`, `marketplace_reviews` | 5 prêts |
| Souvenirs | `hike_sessions`, `community_posts`, `carnets`, `post_stories`, `geo_massifs` | 20 sessions, 774 massifs |
| Communauté Défis | `challenges`, `user_challenges`, `progression_challenges` | 26 défis, 0 progression |
| Communauté Clubs | `clubs`, `club_members`, `club_events`, `club_topics` | 31 / 35 / 26 / 40 |
| Communauté Cordée | `user_follows`, `public_profiles`, `hike_sessions` | follows + sessions réels |
| Confidentialité | `user_profiles.profile_visibility`, `profile_invitations` (à créer) | 157 public, 6 communaute |

RLS : `community_posts` par audience + écriture own, `materiel_loans` involved,
`user_badges`/`user_challenges` lecture publique + gestion own, `community_post_drafts`
own (hors drawer), `profile_invitations` propriétaire/invité.

## 7. Migration nécessaire

- `profile_visibility` : migrer `communaute` → `public`, contrainte deux valeurs.
- `community_posts.reposted_from_id uuid references community_posts(id)`.
- Table `profile_invitations` + RLS + index.
- Mise à jour de la vue `public_profiles` pour les invitations.
- Index : `materiel_loans(lender_id,status)`, `club_events(club_id,event_date)`,
  `community_posts(author_id,created_at)`.
- Correction `mapClubs` : prochain événement depuis `club_events`.

## 8. Limites connues

- `user_challenges`, `post_shares`, `share_tokens`, `community_post_drafts`,
  `hike_session_photos` sont vides : états vides explicites.
- `reposted_from_id` n’existe pas encore : la lentille Republication affiche un
  état vide tant que la migration et la fonction ne sont pas livrées.
- Les notes de prêt sont nulles : carte de confiance « pas encore noté ».
- Pas de coordonnées GPS dans les sessions : le passeport s’appuie sur les
  régions et itinéraires réels.

## 9. Décisions à confirmer

1. 5 slots, sélecteur identique à la bottom bar.
2. Compte public = tout le monde ; compte privé = invitation uniquement.
3. Republication comme lentille de Vitrine, flux public des relais.
