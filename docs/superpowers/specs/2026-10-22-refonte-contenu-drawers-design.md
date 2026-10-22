# Refonte de contenu — Réseau, Sortie, Compte

**Date :** 2026-10-22
**Statut :** proposition à valider — aucun code écrit
**Périmètre exact :**
1. **Drawer Réseau** — un drawer, deux sous-drawers : Abonnés et Abonnements.
2. **Drawer Sortie** — le drawer ouvert au clic sur une sortie, avec tous ses sous-drawers.
3. **Drawer Compte** — le drawer du bouton en haut à droite : commandes, notifications, paramètres, modification du profil, partage.

Le drawer Profil reste la référence visuelle et n’est pas modifié.

---

## 1. Objectif

Passer de listes héritées à trois espaces lisibles, réellement branchés sur
Supabase, qui répondent à trois questions :

- **Réseau :** « Qui me suit, qui je suis, et qui fait partie de ma cordée ? »
- **Sortie :** « Que s’est-il passé exactement sur cette sortie ? »
- **Compte :** « Où en sont mes achats, mes alertes et mes réglages ? »

Chaque sous-drawer doit avoir une raison d’exister, une action principale, et
un état vide qui donne envie d’agir. Aucune donnée simulée sur un compte
authentifié.

---

## 2. Recherche et partis pris

| Référence | Pattern retenu | Ce qu’on écarte |
|---|---|---|
| **Strava** | Activité riche : stats, trace, photos, matériel, compagnons, kudos | Classements, segments publics |
| **Komoot** | Trace, relief, météo, partage de sortie | Surcharge d’options |
| **Polarsteps** | Récit de sortie, photos, étapes | Timeline interminable |
| **Instagram** | Liste sociale, cercle proche, demandes | Feed infini |
| **Airbnb** | Suivi de commande, statut, facture | Pression commerciale |
| **Garmin** | Données de sortie précises | Tableaux de bord surchargés |

**Partis pris LKDV :**

1. La **preuve** avant le chiffre : chaque sortie vérifiée porte le sceau GPS.
2. La **confiance** avant la popularité : cordée, demandes, avis, prêts.
3. Le **contexte** avant la liste : une sortie se raconte, elle ne se résume
   pas à une ligne.
4. Le **calme** : pas de badge rouge permanent, pas de compteur anxiogène.
5. Le **privé par défaut** : les nouvelles fonctions sociales démarrent en
   cordée ou en privé.

---

## 3. Shell commun aux trois drawers

- Aucun en-tête : pas d’icône, titre, sous-titre ni bouton partager.
- Capsule principale en haut : `.segc.lg-tabs.lens-on`, 48 px, icônes 18 px,
  lentille `.sel-lens` avec `--i`.
- Capsule secondaire en bas à droite **uniquement** quand il y a un second
  niveau : `.ig-tabs-float`, 30 px, offset 10 px, icônes 15 px.
- Contenu : 14 px de marge latérale, 62 px de marge basse.
- Glissement à deux couches : 420 ms `cubic-bezier(.32,.72,0,1)`.
- États : squelette, vide avec CTA, erreur avec réessayer, hors-ligne.
- 44 px minimum, focus visible, `aria-selected`, roving tabindex.

---

## 4. Drawer Réseau

**Un seul drawer, deux sous-drawers.** La capsule du haut a deux cellules :
Abonnements (icône personne) et Abonnés (icône groupe). L’ordre reprend
« ceux que je suis » puis « ceux qui me suivent ».

### 4.1 En-tête de chaque sous-drawer

- Compteur principal (« 128 abonnés ») et variation sur 7 jours, discrète.
- Compteur secondaire (« 96 mutuels »).
- Barre de recherche : nom, handle, massif.
- Filtre en bas à droite : **Tous / Mutuels / Récents / Cordée**.

### 4.2 Sous-drawer Abonnés

**Section épinglée « Ta cordée »** (si non vide) :
- 3 à 5 avatars en ligne, badge Cordée, bouton « Gérer ».
- Une phrase : « Les personnes qui voient tes sorties en premier. »

**Section « Demandes »** (compte privé uniquement) :
- Ligne avec avatar, nom, « veut te suivre », date.
- Actions **Accepter** / **Refuser**.
- Badge de compteur discret, pas rouge.

**Section « Nouveaux »** :
- Abonnés des 7 derniers jours, avec « Nouveau ».
- Action rapide : ajouter à la cordée.

**Section « Tous les abonnés »** :
- Liste alphabétique ou triée par récence.
- Ligne : avatar + sceau, nom, handle, massif, relation (« te suit »,
  « mutuel »), dernière activité (« Sortie il y a 2 j »).
- Actions : Suivre / Abonné, Message, menu « … » (Retirer, Bloquer,
  Signaler, Ajouter à la cordée).

**État vide :** « Personne ne te suit encore. Partage ton profil pour
commencer ta cordée. » + bouton Partager.

### 4.3 Sous-drawer Abonnements

- Même structure, orientée « qui je suis ».
- Badge « Te suit aussi » sur les mutuels.
- Tri : récents, alphabétique, activité.
- Action Retirer avec confirmation (« Retirer @lea de tes abonnements ? »).
- **Suggestions** en bas :
  - 3 à 5 profils : mutuels en commun, même club, même massif, participants
    d’une sortie à venir.
  - Explication transparente (« 3 sorties en commun »).
  - Bouton Suivre, Masquer, Signaler.
- **État vide :** « Tu ne suis personne pour l’instant. Découvre des
  randonneurs de ton massif. » + CTA découverte.

### 4.4 La Cordée (nouveau)

- Cercle proche, 30 personnes maximum.
- Avantages : sorties en temps réel, prêts prioritaires, carnets en
  avant-première.
- Ajout en un geste depuis une ligne ou depuis la fiche d’une personne.
- Page de gestion : membres, permissions, notifications.
- Badge « Cordée » visible uniquement par le propriétaire et les membres.

### 4.5 Ligne utilisateur — règles

| Élément | Contenu |
|---|---|
| Avatar | photo ou initiale, anneau sceau si vérifié |
| Nom | nom affiché, handle en dessous |
| Contexte | massif, relation, dernière activité |
| Action principale | Suivre / Abonné / Accepter |
| Menu | Message, Cordée, Retirer, Bloquer, Signaler |

- Follow optimiste, rollback en cas d’erreur, toast discret.
- Aucun compteur public de followers sur les autres profils.

### 4.6 Données et API

- `follows` (follower_id, following_id, close_friend, created_at).
- `follow_requests` (requester_id, target_id, status, created_at).
- `profiles` (nom, handle, avatar, massif, sceau).
- `outings` (dernière activité, sorties en commun).
- API : `GET /api/compte/social/[followers|following]`,
  `POST/DELETE /api/compte/social/follow`,
  `POST /api/compte/social/requests`,
  `POST /api/compte/social/cordee`.
- RLS : un utilisateur ne voit que les profils autorisés ; les demandes ne
  sont visibles que par les deux parties.

---

## 5. Drawer Sortie

**Un drawer, plusieurs sous-drawers.** La capsule du haut organise toute la
sortie ; la capsule du bas à droite n’apparaît que si un sous-drawer a lui-même
des filtres (photos, matériel).

### 5.1 Sous-drawer Résumé

- **Hero** : couverture (photo ou trace), titre, date, massif, badge
  « Empreinte vérifiée ».
- **Ligne de contexte** : « avec Léa, Marc · 12,4 km · +860 m ».
- **4 tuiles** : distance, D+, altitude max, durée.
- **Statut** : terminée / à venir / brouillon.
- **Actions** : Partager, Modifier, Ajouter aux souvenirs, Exporter GPX.
- **Récit court** : 2–3 phrases générées depuis la trace ou saisies.
- **Note de preuve** : « Données issues de ta trace GPS. »

### 5.2 Sous-drawer Trace & relief

- **Aperçu de trace** : mini-carte avec départ, arrivée, points remarquables.
- **Profil altimétrique** : graphique interactif, survol des altitudes.
- **Repères** : altitude min/max, pente moyenne, passage le plus raide.
- **Temps** : durée totale, temps en mouvement, allure.
- **Bouton** : Télécharger le GPX, Voir sur la carte.
- **État vide** : « Aucune trace GPS rattachée. »

### 5.3 Sous-drawer Photos

- Grille 3 colonnes, plein écran au tap, légendes.
- Ajout de photos (appareil photo, galerie), réorganisation, suppression.
- Badge « Photo de couverture ».
- **État vide** : « Ajoute la première photo de cette sortie. »

### 5.4 Sous-drawer Matériel

- **Kit utilisé** : nom du kit, poids total, liste des objets.
- **Objets** : visuel, nom, poids, état, prêté ou non.
- **Manquants** : « 2 objets du kit n’étaient pas dans le sac. »
- **Actions** : ouvrir la fiche objet, ajouter au kit, marquer comme utilisé.
- **État vide** : « Aucun matériel rattaché à cette sortie. »

### 5.5 Sous-drawer Compagnons

- Liste des participants : avatar, nom, handle, rôle (organisateur, invité).
- **Kudos** : bouton sobre, pas de classement.
- **Inviter** : lien, QR, cordée.
- **État vide** : « Sortie solo. Invite ta cordée la prochaine fois. »

### 5.6 Sous-drawer Météo

- Conditions au départ : température, vent, pluie, neige, visibilité.
- Évolution sur la journée (matin / midi / soir).
- Alertes : vent fort, orage, brouillard, canicule.
- Source et horodatage.
- **État vide** : « Météo non disponible pour cette sortie. »

### 5.7 Sous-drawer Échanges

- **Kudos** : nombre et liste des personnes (sans classement).
- **Commentaires** : fil, réponses, likes, signalement.
- **Composer** : texte, mention, emoji sobre.
- **État vide** : « Sois le premier à réagir. »

### 5.8 Actions transverses

| Action | Où | Effet |
|---|---|---|
| Partager | Résumé | lien, carte, story |
| Modifier | Résumé | édition titre, date, massif, visibilité |
| Supprimer | menu « … » | double confirmation |
| Exporter GPX | Trace | téléchargement |
| Ajouter aux souvenirs | Résumé | story à la une |
| Voir sur la carte | Trace | carte du bas en contexte |

### 5.9 Données et API

- `outings` (titre, date, massif, km, dplus, maxAlt, durée, statut,
  visibilité, trace, cover).
- `outing_photos` (url, caption, order).
- `outing_gear` (gear_id, kit_id).
- `outing_participants` (user_id, role).
- `outing_kudos`, `outing_comments`.
- `weather_cache` (massif, date, payload).
- API : `GET /api/compte/outings/[id]`, `PATCH`, `DELETE`,
  `GET/POST /api/compte/outings/[id]/photos`,
  `GET/POST /api/compte/outings/[id]/gear`,
  `GET/POST /api/compte/outings/[id]/participants`,
  `POST /api/compte/outings/[id]/kudos`,
  `GET/POST /api/compte/outings/[id]/comments`.
- RLS : propriétaire, participants, abonnés selon visibilité ; jamais de
  trace brute publique.

---

## 6. Drawer Compte

**Un drawer, cinq sections.** La capsule du haut garde les cinq icônes
actuelles : Commandes, Notifications, Paramètres, Modifier le profil,
Partager.

### 6.1 Commandes

- **En-tête :** « 3 en cours · 12 passées », total annuel discret.
- **Filtre bas droite :** Toutes / En cours / Passées / Annulées.
- **Carte :**
  - référence, date, vignettes ;
  - stepper Confirmée → Préparée → Expédiée → Livrée ;
  - prochaine étape, date estimée, transporteur, suivi ;
  - total, moyen de paiement masqué ;
  - actions : Suivre, Facture, Recommander, Retour, Aide.
- **Détail :** timeline, adresse, articles, facture, remboursement, support.
- **Vide :** « Tes achats et réservations apparaîtront ici. » + CTA boutique.

### 6.2 Notifications

- **Filtre bas droite :** Tout / Social / Prêts / Commandes / Système.
- **Groupes :** Aujourd’hui, Hier, Cette semaine, Plus tôt.
- **Ligne :** avatar, texte contextualisé, entité, temps, point non-lu.
- **Actions inline :** Accepter un prêt, Répondre, Voir la sortie, Marquer
  comme lu.
- **Barre :** Tout marquer comme lu + préférences.
- **Vide :** « Tu es à jour. »

### 6.3 Paramètres (hub)

- Quatre cartes : Confidentialité, Notifications, Apparence & unités,
  Sécurité.
- Chaque carte montre l’état actuel et ouvre la section correspondante du
  drawer Réglages.
- Deux interrupteurs rapides : visibilité du profil, mode sombre.
- Lien « Tous les réglages ».

### 6.4 Modifier le profil

- Aperçu vivant de la carte profil.
- Anneau de complétude + 3 suggestions.
- Champs : photo, couverture, nom, handle, bio (160), massif, nationalité,
  liens (3), visibilité.
- Validation : handle unique, bio sans lien, image < 5 Mo, recadrage.
- Barre collante : Annuler / Enregistrer, état « Enregistré ».

### 6.5 Partager

- Carte de partage en verre : avatar, nom, sceau, massif, QR.
- Actions : partager natif, copier le lien, télécharger, QR, NameDrop.
- Lien révocable avec expiration.
- Vues du profil sur 7 jours (agrégées, privées).
- Note : « Ton profil privé reste sur invitation. »

### 6.6 Sécurité & confidentialité (sous-feuilles)

- Depuis Paramètres : visibilité, cordée, flou GPS, appareils connectés,
  2FA/passkeys, sessions, suppression.
- Chaque action destructive : double confirmation + conséquence explicite.

### 6.7 Données et API

- `orders`, `order_items`, `shipments`, `invoices`.
- `notifications` (type, actor, entity, read_at, group).
- `profiles`, `profile_links`, `profile_share_links`, `profile_views`.
- `notification_preferences`, `user_sessions`.
- API : `/api/compte/orders`, `/api/compte/notifications`,
  `/api/compte/settings`, `/api/compte/share`,
  `/api/compte/security/sessions`.
- RLS : chaque utilisateur ne voit que ses données.

---

## 7. Composants partagés

`DrawerShell`, `DrawerTopNav`, `DrawerLensPill`, `DrawerSection`,
`StatTile`, `ProgressRing`, `UserRow`, `OrderCard`, `NotificationRow`,
`ActivityCard`, `PhotoGrid`, `GearRow`, `Timeline`, `EmptyState`,
`ErrorState`, `ShareCard`, `ConfirmSheet`, `Toast`.

Chaque composant : un rôle, des props typées, un test isolé, un état vide.

---

## 8. Accessibilité, performance, offline

- 44 px, focus visible, `aria-selected`, roving tabindex, `inert` sur les
  panneaux inactifs.
- Contrastes AA sur verre ; tester en plein soleil.
- `prefers-reduced-motion` : transitions instantanées.
- Chargement paresseux par sous-drawer ; cache 60 s ; pagination 20.
- Images `next/image`, `loading=lazy`, tailles adaptées.
- Hors-ligne : cache des sorties, photos récentes, commandes ; bandeau.

---

## 9. Analytics

`drawer_open`, `subdrawer_view`, `action_click`, `follow`, `unfollow`,
`request_accept`, `cordee_add`, `share`, `gpx_export`, `order_track`,
`notification_read`, `profile_save`, `empty_cta`, `error_view`.

Aucune PII, aucun identifiant de profil dans les événements.

---

## 10. Phases

| Phase | Contenu | Durée |
|---|---|---|
| 0 | Shell partagé, API socle, schéma additif | 1 sem |
| 1 | Drawer Réseau (Abonnés/Abonnements, demandes, cordée) | 1,5 sem |
| 2 | Drawer Sortie (Résumé, Trace, Photos, Matériel, Compagnons, Météo, Échanges) | 2,5 sem |
| 3 | Drawer Compte (Commandes, Notifications, Paramètres, Profil, Partage) | 2 sem |
| 4 | Audit a11y/perf/offline + production | 1 sem |

Chaque phase est livrable seule.

---

## 11. Risques

| Risque | Mitigation |
|---|---|
| Données de sortie incomplètes | Afficher « non renseigné », jamais de faux |
| Photos lourdes | Compression, upload progressif, cache |
| Météo coûteuse | Cache 30 min, fournisseur unique |
| Social sensible | Cordée privée, pas de classement, blocage facile |
| Migration runtime → React | Shell partagé, migration drawer par drawer |
| Régression | Tests API + E2E par sous-drawer |
