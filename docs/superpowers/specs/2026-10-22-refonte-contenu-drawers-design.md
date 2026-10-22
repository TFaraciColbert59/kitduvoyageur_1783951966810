# Refonte de contenu des drawers — design

**Date :** 2026-10-22
**Statut :** proposition à valider — aucun code écrit
**Périmètre :** tous les drawers de la page Compte **sauf** le drawer Profil (référence visuelle et fonctionnelle)

---

## 1. Contexte et objectifs

Le drawer Profil est devenu la référence : navigation principale en haut
(`.segc.lg-tabs.lens-on`), navigation secondaire en bas à droite
(`.ig-tabs-float`), contenu aéré, glissement fluide entre écrans. Les autres
drawers ont gardé une structure héritée : listes plates, peu de hiérarchie,
actions dispersées, données parfois simulées.

Objectif : transformer chaque drawer en un **espace de travail personnel**
aussi lisible que le Profil, avec des contenus réellement utiles, branchés sur
les données Supabase, et une identité propre à LKDV : la **preuve vérifiée**
(empreinte GPS), la **confiance** (prêts, avis), la **transmission** (lignées,
crédits créateurs) et la **cordée** (relations choisies).

### Ce que l’on veut obtenir

- Moins de listes, plus de **réponses** : « où en est ma commande ? », « qui me
  suit ? », « quelle sortie choisir ce week-end ? », « qu’est-ce que je prête
  en ce moment ? », « mon matériel vaut-il encore le coup ? ».
- Des écrans qui **racontent une progression** : récap annuel, records,
  passeport, fidélité, lignée.
- Des actions **contextuelles** : agir depuis la ligne, sans changer d’écran.
- Une **cohérence totale** avec le Profil : même capsule, même lentille, même
  animation, mêmes états vides.

### Non-objectifs

- Pas de classement public entre membres, pas de leaderboard.
- Pas de feed infini algorithmique.
- Pas de gamification anxiogène (streaks punitifs, notifications culpabilisantes).
- Pas de nouvelle carte dans les drawers : la carte du bas reste le contexte.

---

## 2. Recherche concurrentielle

Synthèse des produits étudiés (Strava, Komoot, Polarsteps, AllTrails, Garmin
Connect, Instagram, Airbnb, Duolingo, Spotify Wrapped) et des patterns à
reprendre ou rejeter.

| Produit | Pattern fort | Ce qu’on reprend | Ce qu’on rejette |
|---|---|---|---|
| **Strava** | Profil = statistiques année/all-time, trophées de segments, challenges, clubs, kudos | Récap annuel, records personnels, cartes d’activité riches, kudos sobres | Classements, segments publics anxiogènes, paywall de ses propres données |
| **Komoot** | Collections, highlights, planification, cartes hors-ligne, découverte | Carnets/collections, planifier une sortie, météo, itinéraires | Complexité de l’éditeur, surcharge d’options |
| **Polarsteps** | Voyage = étapes sur une carte, stats pays/km, livre photo, collaboration | Carnet vivant auto-généré, étapes, export livre, collaborateurs | Timeline linéaire interminable |
| **AllTrails** | Fiches de sentier, listes, avis, photos, badges, hors-ligne | Listes de sorties, photos, badges utiles, téléchargement hors-ligne | Avis non vérifiés, publicité intrusive |
| **Garmin** | Badges, challenges, santé, appareils | Badges de progression, défis doux | Tableaux de bord surchargés |
| **Instagram** | Grille, stories à la une, tagged, close friends, insights | Grille, À la une, cercle proche, stats de publication | Feed infini, métriques de vanité |
| **Airbnb** | Voyages, messages, vérification, wishlists | Suivi de réservation, vérification, listes | Pression de réservation |
| **Duolingo** | Streak, ligues, achievements | Série douce, achievements | Culpabilisation, ligues compétitives |
| **Spotify Wrapped** | Récap annuel partageable | Carte récap annuelle partageable | Sur-exposition des données |

### Enseignements

1. **Le profil est un portfolio, pas un flux.** Les gens y viennent pour
   comprendre leur progression et agir (prêt, commande, réglage).
2. **Les meilleures fonctionnalités sont des réponses** : statut, prochaine
   étape, personne à recontacter.
3. **La preuve est le différenciateur de LKDV.** Strava prouve l’effort,
   Komoot prouve l’itinéraire ; LKDV prouve la sortie **et** le matériel
   **et** la relation.
4. **Le social doit être choisi.** « Cordée » (cercle proche) plutôt que
   followers publics par défaut.
5. **Un récap annuel est l’écran le plus partagé.** C’est un aimant
   d’acquisition, à condition qu’il soit beau et privé par défaut.

---

## 3. Principes de design

1. **Une question, un écran.** Chaque section répond à une question concrète.
2. **La preuve avant le chiffre.** Tout chiffre vérifié porte la marque
   « Empreinte » ; les chiffres déclaratifs sont distingués.
3. **Agir sans quitter.** Les actions principales sont dans la ligne ou la
   carte ; les actions secondaires dans un menu « … ».
4. **Le calme.** Pas de badge rouge permanent, pas de compteur anxiogène.
5. **Le privé par défaut.** Toute nouvelle fonctionnalité sociale démarre en
   « cordée » ou « privé », jamais en public.
6. **Le mouvement explique.** Le glissement indique la direction ; il ne
   décore pas.
7. **Le vide est un début.** Chaque état vide propose une action utile et une
   phrase qui explique la valeur.
8. **44 px, contraste, reduced motion.** Les mêmes règles que le Profil.

---

## 4. Architecture d’information

### 4.1 Carte des drawers

| Drawer | Entrée | Navigation principale | Navigation secondaire |
|---|---|---|---|
| **Profil** (référence) | Avatar | 5 slots (haut) | Lentilles (bas droite) |
| **Compte** | Bouton curseurs | 5 sections (haut) | Filtres contextuels (bas droite) |
| **Abonnés / Abonnements** | Compteurs du profil | 2 onglets (haut) | Filtre de liste (bas droite) |
| **Sorties & Voyages** | Tuiles KPI, « Voir tout » | 3 onglets : Parcours, Records, Météo (haut) | Filtres année/type/massif (bas droite) |
| **Publications & Carnets** | Avatar, massifs, « Créer un carnet » | 3 onglets : Publications, Carnets, À la une (haut) | Filtre contenu (bas droite) |
| **Lignées & Inventaire** | Pastille crédit, bio, fiche kit | 5 onglets : Kits, Inventaire, Prêts, Fidélité, Parrainage (haut) | Filtre catégorie/état (bas droite) |
| **Réglages & Sécurité** | Action Réglages, hub Compte | 6 onglets : Compte, Confidentialité, Notifications, Préférences, Abonnement, Données (haut) | Sous-filtre si besoin (bas droite) |

> Les drawers à plus de 5 onglets utilisent un défilement horizontal de la
> capsule, jamais une deuxième rangée. La capsule garde 44 px de hauteur.

### 4.2 Shell commun

Chaque drawer non-Profil reçoit le même shell React que le Profil :

- poignée 36×5 ;
- **aucun en-tête** (pas d’icône, titre, sous-titre, partage) ;
- capsule `.segc.lg-tabs.lens-on` en haut, 48 px, icônes 18 px, lentille
  `.sel-lens` avec `--i` ;
- capsule `.ig-tabs-float` en bas à droite **uniquement** s’il existe une
  navigation secondaire, offset 10 px, 30 px de haut ;
- contenu scrollable avec 14 px de marge latérale et 62 px de marge basse ;
- glissement à deux couches : l’ancien panneau sort, le nouveau entre,
  420 ms `cubic-bezier(.32,.72,0,1)` ;
- états `loading` (squelette), `empty` (illustration + CTA), `error`
  (message + réessayer), `offline` (bandeau + cache).

### 4.3 Composants partagés

`DrawerShell`, `DrawerTopNav`, `DrawerLensPill`, `DrawerSection`,
`StatTile`, `ProgressRing`, `ActivityCard`, `UserRow`, `GearRow`,
`OrderCard`, `NotificationRow`, `FilterPill`, `EmptyState`, `ErrorState`,
`ShareCard`, `Timeline`, `SheetAction`, `ConfirmSheet`, `Toast`.

Chaque composant a un seul rôle, des props typées, et un test isolé.

---

## 5. Drawer Compte

Question : **« Où en sont mes achats, mes alertes et mes réglages ? »**

### 5.1 Commandes

**Objectif :** suivre chaque commande ou réservation jusqu’à son terme, sans
chercher un e-mail.

- **En-tête de section :** compteur « 3 en cours · 12 passées », total dépensé
  sur l’année (discret).
- **Filtre bas droite :** Toutes / En cours / Passées / Annulées.
- **Carte commande :**
  - numéro court (`#LKDV-2048`), date, vignettes des articles ;
  - statut avec étape : Confirmée → Préparée → Expédiée → Livrée ;
  - prochaine étape et date estimée ;
  - transporteur + numéro de suivi (lien) ;
  - total, moyen de paiement masqué ;
  - actions : **Suivre**, **Facture**, **Recommander**, **Retour**, **Aide**.
- **Détail (sous-feuille) :** timeline verticale, adresse, articles, facture,
  remboursement, contact support.
- **États :** vide (« Tes achats et réservations apparaîtront ici. » + CTA
  boutique), erreur, chargement.
- **Données :** `orders`, `order_items`, `shipments`, `invoices`,
  `bookings`. Aucune donnée simulée.

### 5.2 Notifications

**Objectif :** une boîte de réception lisible, pas un mur de points rouges.

- **Filtre bas droite :** Tout / Social / Prêts / Commandes / Système.
- **Groupes :** Aujourd’hui, Hier, Cette semaine, Plus tôt.
- **Ligne :** avatar de l’acteur, texte contextualisé, entité, temps relatif,
  point non-lu discret.
- **Actions inline :** Accepter un prêt, Répondre, Voir la sortie, Marquer
  comme lu. Un appui long propose Archiver / Supprimer.
- **Barre d’actions :** « Tout marquer comme lu » + lien vers les préférences.
- **États :** vide (« Tu es à jour. »), erreur, chargement.
- **Données :** `notifications` avec `type`, `actor_id`, `entity_type`,
  `entity_id`, `read_at`, `created_at`, `group`.

### 5.3 Paramètres (hub)

**Objectif :** ne pas dupliquer le drawer Réglages ; servir de raccourci.

- Quatre cartes : **Confidentialité**, **Notifications**, **Apparence &
  unités**, **Sécurité**.
- Chaque carte affiche l’état actuel (« Profil privé », « Push activées »,
  « Unités métriques », « 2 appareils connectés ») et ouvre la section
  correspondante du drawer Réglages.
- Deux interrupteurs rapides : visibilité du profil, mode sombre.
- Lien « Tous les réglages ».

### 5.4 Modifier le profil

**Objectif :** un éditeur qui donne envie de compléter son profil.

- **Aperçu vivant** de la carte profil en haut (avatar, nom, handle, bio,
  massif, sceau).
- **Anneau de complétude** (0–100 %) avec 3 suggestions contextuelles
  (« Ajoute une photo de couverture », « Relie ton premier carnet »,
  « Choisis ta cordée »).
- **Champs :** photo, couverture, nom, handle, bio (160), massif principal,
  nationalité, liens (3 max), visibilité.
- **Validation :** handle unique, bio sans lien, image < 5 Mo, recadrage.
- **Barre d’enregistrement** collante en bas : Annuler / Enregistrer, avec
  état « Enregistré ».
- **Données :** `profiles`, `profile_links`, storage.

### 5.5 Partager

**Objectif :** partager un profil vérifié, pas un lien nu.

- **Carte de partage** : fond verre, avatar, nom, sceau, massif, QR.
- **Actions :** partager natif, copier le lien, télécharger la carte, QR,
  NameDrop.
- **Lien de partage** avec expiration et révocation.
- **Statistiques** : vues du profil sur 7 jours (privées, agrégées).
- **Note de confidentialité** : « Ton profil privé reste sur invitation. »
- **Données :** `profile_share_links`, `profile_views`.

---

## 6. Drawer Abonnés / Abonnements

Question : **« Qui fait partie de ma cordée, et qui veut en faire partie ? »**

### 6.1 En-tête

- Deux compteurs : abonnés, abonnements, et « mutuels ».
- Croissance sur 7 jours (discret, pas de flèche agressive).
- Barre de recherche par nom, handle, massif.

### 6.2 Abonnés

- **Filtre bas droite :** Tous / Mutuels / Récents / Cordée.
- **Section épinglée « Ta cordée »** : les personnes du cercle proche, avec
  bouton « Gérer ».
- **Section « Nouveaux »** : abonnés des 7 derniers jours.
- **Lignes :** avatar + sceau, nom, handle, massif, relation (« te suit »,
  « mutuel »), dernière activité (« Sortie il y a 2 j »), bouton Suivre /
  Abonné, menu « … » (Message, Retirer, Bloquer, Signaler).
- **Privé :** section « Demandes » avec Accepter / Refuser.
- **États :** vide (« Personne ne te suit encore. Partage ton profil. »),
  erreur, chargement.

### 6.3 Abonnements

- Même structure, orientée « qui je suis ».
- Badge « Te suit aussi » pour les mutuels.
- Suggestions en bas : « Dans ta cordée », « Même club », « Même massif ».
- Action Retirer avec confirmation.

### 6.4 Suggestions (nouveau)

- 3 à 5 profils : mutuels en commun, membres de club, participants d’une
  sortie à venir, même massif.
- Explication transparente (« 3 sorties en commun »), pas de score opaque.
- Bouton Suivre, masquer, signaler.

### 6.5 Innovation : la Cordée

- Cercle proche (max 30) qui reçoit les sorties en temps réel, les prêts et
  les carnets en avant-première.
- Ajout en un geste depuis une ligne, badge « Cordée ».
- Page de gestion : membres, permissions, notifications.

---

## 7. Drawer Sorties & Voyages

Question : **« Qu’est-ce que j’ai vécu, et quelle est ma prochaine sortie ? »**

### 7.1 Parcours

- **Bandeau stats :** km, D+, sorties, massifs, pays, avec sélecteur d’année.
- **Carte « Récap 2026 »** : fond verre, chiffres clés, plus longue sortie,
  plus gros D+, massif préféré, série de mois actifs, bouton Partager.
- **Records personnels :** 3 tuiles (plus longue, plus gros D+, plus haut
  sommet) avec date et lien vers la sortie.
- **Filtre bas droite :** Année / Type (rando, trail, vélo, autre) / Massif /
  Photos.
- **Liste groupée par mois :**
  - carte avec vignette de trace, titre, massif, date, km, D+, photos,
    matériel utilisé, compagnons, badge « Empreinte vérifiée » ;
  - actions : voir sur la carte, partager, modifier, supprimer.
- **Barre d’actions :** Importer un GPX, Planifier une sortie.
- **États :** vide (« Ta première sortie vérifiée t’attend. » + CTA),
  erreur, chargement.

### 7.2 Records (nouvel onglet)

- Records personnels par type et par année.
- « Première fois » : premier 10 km, premier 1000 m de D+, premier massif.
- Graphique annuel simple (12 barres) : km et D+.
- Aucun classement, aucun comparaison publique.

### 7.3 Météo

- **Massifs suivis** : cartes avec température, vent, pluie, neige, qualité
  de la fenêtre.
- **7 jours** : bande horizontale, meilleure fenêtre mise en avant.
- **Alertes** : vent > 60 km/h, orage, neige, canicule.
- **Lien** : « Planifier autour de la météo ».
- **Données :** cache météo par massif, horodatage, source.

### 7.4 Planifier (nouveau)

- Choisir un massif, une date, un type.
- Suggestions de boucles (distance, D+, durée, difficulté) issues des traces
  vérifiées, anonymisées.
- Météo intégrée, départ, retour, matériel recommandé.
- Enregistrer comme sortie planifiée, inviter la cordée.
- **Données :** `outings` (status planned), `routes` (nouveau), météo.

---

## 8. Drawer Publications & Carnets

Question : **« Qu’est-ce que je transmets, et comment je le raconte ? »**

### 8.1 Publications

- **Bandeau :** publications, vues, enregistrements, commentaires (7 j).
- **Filtre bas droite :** Tous / Public / Abonnés / Club / Brouillons.
- **Grille 3 colonnes** avec badge de visibilité, épingle, progression de
  brouillon.
- **Liste détaillée** au tap : aperçu, stats, actions (Modifier, Épingler,
  Republier, Archiver, Supprimer).
- **États :** vide (« Publie ta première trace. »), erreur.

### 8.2 Brouillons

- Cartes avec progression (« 3/5 étapes »), dernière modification, reprise.
- Suppression avec confirmation.

### 8.3 Carnets

- **Cartes carnet :** couverture, titre, dates, nombre de jours, km, photos,
  collaborateurs, statut (brouillon, publié, privé).
- **Créer :** depuis une sortie, depuis un modèle (Traversée, Week-end,
  Expédition), ou vierge.
- **Carnet vivant :** génération automatique des étapes à partir des sorties
  GPS, avec photos et carte.
- **Actions :** ouvrir, partager, exporter PDF, dupliquer, archiver.

### 8.4 Éditeur de carnet

- Couverture, titre, sous-titre, dates, massif, visibilité.
- Chapitres / jours : titre, date, lieu, texte, photos, trace, météo.
- Carte du carnet (étapes reliées).
- Collaborateurs : inviter, rôle (lecteur, éditeur).
- Aperçu lecture, publication, export.
- **Données :** `carnets`, `carnet_days`, `carnet_media`,
  `carnet_collaborators`.

### 8.5 À la une

- Gestion des stories à la une : couvertures, ordre, ajout depuis une sortie,
  visibilité.
- Aperçu du rendu profil.
- **Données :** `story_highlights`, `story_highlight_items`.

---

## 9. Drawer Lignées & Inventaire

Question : **« Quel matériel j’ai, d’où il vient, et qu’est-ce que j’en fais ? »**

### 9.1 Mes Kits

- **Carte kit :** nom, poids, nombre d’objets, complétude, usage, dernière
  sortie.
- **Lignée :** arbre G1 → G2 → G3, crédits créateurs, propriétaires
  successifs.
- **Actions :** ouvrir, dupliquer, partager, archiver, voir les prêts liés.
- **Créer un kit :** depuis l’inventaire, un modèle, ou un sac existant.

### 9.2 Inventaire

- **Bandeau :** poids total, valeur estimée, CO₂ évité, objets prêtés.
- **Filtre bas droite :** Catégorie / État / Prêté / À entretenir.
- **Lignes :** visuel, nom, marque, poids, état d’usure, dernière
  utilisation, statut (disponible, prêté, en maintenance), QR.
- **Fiche objet :** achat, facture, garantie, réparations, historique de
  prêts, valeur, seconde vie.
- **Actions :** ajouter, scanner, modifier, prêter, mettre en maintenance,
  vendre.
- **Données :** `gear_items`, `gear_maintenance`, `gear_warranties`,
  `loans`.

### 9.3 Prêts

- Vue synthétique : prêts sortants, entrants, retards, confiance.
- Lien direct vers le drawer Prêts du Profil (même API, mêmes règles).
- Rappels et actions Accepter / Rendre / Relancer.

### 9.4 Fidélité

- **Palier** (ex. Découverte, Marcheur, Alpiniste) avec progression douce.
- **Badges** : débloqués, prochains, critères transparents.
- **Défis** : en cours, terminés, rejoindre.
- **Série** : mois actifs, pas de punition.
- **Récompenses** : crédits boutique, accès anticipé, badges.
- **Aucun classement.**

### 9.5 Parrainage

- Code personnel, lien, QR.
- Invitations envoyées, acceptées, récompenses.
- Statut et conditions claires.
- **Données :** `referrals`, `loyalty_events`.

---

## 10. Drawer Réglages & Sécurité

Question : **« Je garde le contrôle de mon compte, de mes données et de ma
visibilité. »**

### 10.1 Compte & sécurité

- E-mail, téléphone, mot de passe, passkeys, 2FA.
- Appareils connectés : nom, dernière activité, révoquer.
- Historique de connexion.
- Suppression du compte (double confirmation, délai, export proposé).

### 10.2 Confidentialité

- Visibilité du profil (public / privé).
- Cordée : qui voit les sorties en temps réel.
- Flou GPS (1 km), masquage des départs, zones privées.
- Découvrabilité (recherche, suggestions).
- Liste des bloqués.
- Matrice « Qui voit quoi ? » (déjà existante, à intégrer).

### 10.3 Notifications

- Catégories : social, prêts, commandes, clubs, système.
- Canaux : push, e-mail, in-app.
- Heures calmes, résumé quotidien/hebdomadaire.
- Test de notification.

### 10.4 Préférences

- Unités (métrique/impérial), langue, thème (clair/sombre/auto).
- Style de carte, relief, animations (réduites).
- Stockage hors-ligne, qualité des images, économiseur de données.

### 10.5 Abonnement

- Plan actuel, renouvellement, factures, moyen de paiement.
- Changer / annuler avec transparence.
- Historique.

### 10.6 Données & RGPD

- Export complet (JSON + GPX), délai, lien de téléchargement.
- Suppression, consentements, historique.
- Politique de confidentialité, conditions.

### 10.7 Aide & support

- FAQ contextuelle, contact, signaler un bug, version, statut.

---

## 11. Sous-drawers

| Sous-drawer | Contenu | Priorité |
|---|---|---|
| **Sortie** | Carte, stats, profil altimétrique, photos, matériel, compagnons, kudos, commentaires, partage, modifier/supprimer | P1 |
| **Club** | Couverture, membres, événements, chat, rôles, rejoindre/quitter | P1 |
| **Commentaires** | Fil, réponses, likes, signalement, composer | P2 |
| **Invitations** | Créer, révoquer, accepter, QR, statut | P2 |
| **Story** | Visionneuse, À la une, création | P2 |
| **Créer** | Menu de création (sortie, carnet, publication, story, club) | P2 |

---

## 12. Données, API et sécurité

### 12.1 Nouvelles tables

| Table | Colonnes clés | RLS |
|---|---|---|
| `carnets` | id, owner_id, title, slug, cover_url, start_date, end_date, visibility, status, created_at | owner + collaborateurs + visibilité |
| `carnet_days` | id, carnet_id, day_index, title, date, body, lat, lng, outing_id | via carnet |
| `carnet_media` | id, carnet_id, day_id, url, caption, sort_order | via carnet |
| `carnet_collaborators` | carnet_id, user_id, role | via carnet |
| `gear_maintenance` | id, gear_id, type, due_at, done_at, notes | owner |
| `gear_warranties` | id, gear_id, purchased_at, warranty_until, receipt_url | owner |
| `profile_share_links` | id, user_id, token, expires_at, revoked_at | owner |
| `profile_views` | id, profile_id, viewer_id, viewed_at | agrégé propriétaire |
| `referrals` | id, referrer_id, invitee_id, status, reward_cents | concernés |
| `loyalty_events` | id, user_id, kind, points, created_at | owner |
| `notification_preferences` | user_id, category, channel, enabled, quiet_hours | owner |
| `user_sessions` | id, user_id, device, last_seen_at, revoked_at | owner |
| `weather_cache` | massif_id, payload, fetched_at | lecture publique |

### 12.2 Colonnes à ajouter

- `profiles` : `cover_url`, `bio`, `links jsonb`, `completeness`,
  `close_friends_count`.
- `follows` : `close_friend boolean default false`.
- `orders` : `tracking_url`, `carrier`, `estimated_delivery`.
- `notifications` : `group text`, `entity_type`, `entity_id`.
- `gear_items` : `purchase_date`, `purchase_price_cents`, `wear_pct`,
  `qr_token`.
- `outings` : `weather jsonb`, `route_id`, `planned boolean`.
- `posts` : `archived_at`, `pinned boolean`.

### 12.3 API

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/compte/orders` | GET | Commandes + suivi |
| `/api/compte/notifications` | GET, PATCH | Liste, lecture, archive |
| `/api/compte/social/[kind]` | GET | Abonnés / abonnements / demandes |
| `/api/compte/social/follow` | POST, DELETE | Suivre / retirer |
| `/api/compte/social/requests` | POST | Accepter / refuser |
| `/api/compte/outings` | GET, POST | Liste, import, planification |
| `/api/compte/carnets` | GET, POST, PATCH, DELETE | CRUD carnets |
| `/api/compte/gear` | GET, POST, PATCH, DELETE | Inventaire |
| `/api/compte/settings` | GET, PATCH | Préférences |
| `/api/compte/share` | POST, DELETE | Liens de partage |
| `/api/weather` | GET | Météo massif |

Toutes les routes : authentification, validation Zod, erreurs honnêtes
(401/403/404/409/500), rate limiting, pas de fuite de données privées.

### 12.4 RPC

- `accept_follow_request(request_id)`
- `mark_notifications_read(ids[])`
- `create_carnet_from_outing(outing_id)`
- `gear_due_maintenance(user_id)`
- `profile_completeness(user_id)`
- `export_user_data(user_id)`
- `delete_user_account(user_id)`

---

## 13. Design system et composants

- Réutiliser les tokens `--glass-*`, `--lkv-*`, `.lg`, `.li`, `.mbtn`.
- Aucun orange `#E4501C`.
- Capsule haut : `.segc.lg-tabs.lens-on`, 48 px, 5 cellules max visibles.
- Capsule bas droite : `.ig-tabs-float`, 30 px, offset 10 px.
- Cartes : rayon 18–22 px, liseré, ombre douce.
- Typographie : SF Pro, titres 17–22 px, corps 13–15 px, légendes 11–12 px.
- Icônes : Lucide, 18 px, stroke 1.8.
- Mouvement : 420 ms, `cubic-bezier(.32,.72,0,1)`, reduced motion.
- États : squelette, vide, erreur, offline, succès (toast).

---

## 14. Accessibilité, performance, offline

- Cibles 44 px, focus visible, `aria-selected`, roving tabindex.
- Contrastes AA, texte sur verre testé.
- `prefers-reduced-motion` : transitions instantanées.
- Chargement paresseux par drawer, cache React Query, pagination 20.
- Images : `next/image`, tailles adaptées, `loading=lazy`.
- Offline : cache des sorties, carnets et inventaire ; bandeau « hors-ligne ».
- Temps de réponse cible : < 300 ms pour un changement d’onglet déjà chargé.

---

## 15. Analytics et succès

| Métrique | Cible |
|---|---|
| Ouverture drawer → section | > 60 % |
| Action par session | > 1,5 |
| Taux de complétion profil | +20 pts |
| Demandes d’abonnement acceptées | > 80 % |
| Carnets créés / mois | +30 % |
| Objets d’inventaire renseignés | +40 % |
| Erreurs API | < 0,5 % |
| LCP mobile | < 2,5 s |

Événements : `drawer_open`, `section_view`, `action_click`, `empty_cta`,
`error_view`, `share`, `export`.

---

## 16. Risques et arbitrages

| Risque | Mitigation |
|---|---|
| Scope trop large | Phases, chaque drawer livrable seul |
| Données simulées | Bootstrap réel + tests d’intégrité |
| Vie privée | RLS, tests, pas de données privées dans les agrégats |
| Performance | Lazy loading, cache, pagination |
| Complexité éditeur carnet | MVP texte + photos + jours, export ensuite |
| Météo coûteuse | Cache 30 min, fournisseur unique |
| Migration runtime → React | Phase 0, shell partagé, pas de big bang |

---

## 17. Hors périmètre

- Refonte du drawer Profil (déjà fait).
- Nouvelle carte ou moteur 3D.
- Messagerie temps réel complète.
- Paiement en ligne dans les drawers.
- Application native iOS/Android.
