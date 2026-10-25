# Communauté — drawers de création (design)

**Date :** 2026-10-23
**Statut :** proposition à valider — aucun code écrit
**Périmètre :** le drawer `+` de `/communaute` et ses formulaires de création.
**Base :** feed v3, drawer `CommunityDrawer` sans en-tête, création actuelle à 5 tuiles.

---

## 1. Décision

Chaque tuile du drawer `+` ouvre désormais un **formulaire dans un drawer**, au lieu de naviguer
vers une page. Le drawer de formulaire reprend la forme du drawer Profil du Compte :

- hauteur **76dvh** (les formulaires ont besoin de place ; le hub de création reste à 50dvh) ;
- **aucun titre, aucune croix** : poignée, contenu direct, fermeture par backdrop / Échap /
  glissement vers le bas ;
- **footer collant** avec l’action principale (`Publier`, `Créer`, `Envoyer`) et l’état de chargement ;
- verre du Compte, rayon 28, mêmes jetons.

Le hub `+` passe à **6 entrées** :

1. **Publication** — photo/vidéo, billet, question, événement.
2. **Carnet**.
3. **Sortie GPS**.
4. **Kit**.
5. **Club**.
6. **Story**.

Chaque formulaire crée la ressource et, quand le modèle le permet, **le post correspondant dans le
fil** ; sinon il crée la ressource et rafraîchit les sections.

---

## 2. Les formulaires

### 2.1 Publication
- Onglets de type : **Photo / Vidéo**, **Billet**, **Question**, **Événement**.
- Champs communs : titre (billet/question/événement), contenu, audience (`public`, `club`,
  `abonnies`), club si audience club, lieu, tags, carnet lié / kit lié (optionnels).
- Photo/vidéo : 1 à 10 médias, upload après validation ; les audiences privées n’acceptent que
  du texte (règle existante).
- Événement : date, durée, lieu, participants max, description, cover, cagnotte ; crée `events`
  **puis** un post `post_type='share'` avec le titre, la date, le lieu et le lien `/evenements`.
- Insertion : `community_posts` (`post_type` = `post` pour photo/billet, `question` pour question,
  `share` pour événement), `linked_carnet_id`, `linked_kit_id`, `audience`, `club_id`.
- Validation : contenu ou média obligatoire ; titre requis pour billet/question/événement ;
  club requis si audience club.

### 2.2 Story
- Média photo/vidéo, légende 280 max, audience (`public`, `abonnies`, `only_me`).
- Réutilise l’upload `stories-private` et `post_stories` ; pas de nouveau schéma.
- Le formulaire peut ouvrir le sélecteur natif et afficher l’aperçu.

### 2.3 Carnet
- Titre, destination, dates début/fin, description, cover, visibilité (`public`/`private`).
- Insertion `carnets` ; puis post `post_type='share'` avec `linked_carnet_id`, titre, cover,
  audience publique (ou privée selon visibilité).
- Après succès : toast, fermeture, rafraîchissement du fil ; lien « Ouvrir le carnet ».

### 2.4 Sortie GPS
- Titre, date, durée, lieu, participants max, description, cover.
- Insertion `events` (`organizer_id`, `current_participants=0`, `status='upcoming'`).
- Post `post_type='share'` avec le titre, la date, le lieu, le lien `/evenements`.
- Pas de colonne `linked_event_id` : le lien est dans le contenu ; aucune migration.

### 2.5 Kit
- Nom, catégorie, poids (g), description, visibilité publique.
- Insertion `materiel_kits` (`user_id`, `is_public`) ; post `post_type='share'` avec
  `linked_kit_id`, nom, cover, description.
- Lien « Ouvrir le kit ».

### 2.6 Club
- Nom, catégorie, description, cover, lieu, visibilité (`open`/`closed`), règles simples.
- Insertion `clubs` (`created_by`, slug généré) + `club_members` admin actif.
- Post d’accueil `post_type='share'`, `audience='club'`, `club_id`, contenu « Bienvenue dans … ».
- Après succès : lien « Ouvrir le club ».

---

## 3. Shell et composants

```
src/features/community/create/
  CommunityFormDrawer.tsx       (76dvh, poignée, footer, drag/backdrop)
  CreateFormProvider.tsx        (kind + open/close + succès)
  useCreateForm.ts              (état, validation, submit, erreurs)
  form-fields.tsx               (Input, Textarea, Select, CoverPicker, Audience, MediaPicker)
  PostCreateForm.tsx
  StoryCreateForm.tsx
  CarnetCreateForm.tsx
  SortieCreateForm.tsx
  KitCreateForm.tsx
  ClubCreateForm.tsx
  upload.ts                     (upload média public/privé, strip metadata)
  post-bridge.ts                (insertion du post lié)
```

- `CommunityFormDrawer` : 76dvh, aucun header, `onClose`, `footer`, `busy`, `error`.
- Le hub `CommunityCreateDrawer` garde 50dvh et devient un simple routeur d’ouverture.
- Les formulaires sont **contrôlés** ; un seul `useCreateForm` par formulaire.
- Les erreurs sont affichées dans le footer (pas de disparition silencieuse).
- Après succès : `onCreated(kind, id)` → toast, fermeture, `refresh` du fil/sections.

---

## 4. Données et règles

| Formulaire | Table | Post lié |
|---|---|---|
| Publication | `community_posts` | lui-même |
| Événement | `events` + `community_posts` | `share` |
| Story | `post_stories` + storage | — |
| Carnet | `carnets` | `share` + `linked_carnet_id` |
| Sortie | `events` | `share` (lien dans le contenu) |
| Kit | `materiel_kits` | `share` + `linked_kit_id` |
| Club | `clubs` + `club_members` | `share` + `club_id` + audience club |

Aucune migration : les colonnes existantes suffisent (`post_type` reste `post|tip|question|share`).
Les inserts liés sont séquentiels ; si le post échoue, la ressource reste créée et un toast
« Ressource créée, publication non ajoutée » s’affiche.

---

## 5. UX / états

- Ouverture : le hub se ferme, le formulaire s’ouvre ; focus sur le premier champ.
- Fermeture : swipe bas / backdrop / Échap ; si des champs sont modifiés, confirmation douce.
- Footer : action désactivée pendant l’envoi, spinner, libellé `Publication…`.
- Succès : toast, fermeture, rafraîchissement du fil ; le nouveau post apparaît en tête.
- Invité : le hub s’ouvre, le formulaire redirige vers la connexion.
- Erreur : message lisible dans le footer, aucune perte de saisie.
- `prefers-reduced-motion` : pas d’animation de drawer.
- Mobile 430 : le footer reste au-dessus du clavier (`env(safe-area-inset-bottom)`).
- Pas de nouvelle couleur ; verre du Compte.

---

## 6. Décisions à confirmer

| # | Décision | Défaut |
|---|---|---|
| D1 | 6 entrées : Publication + 5 créations | oui |
| D2 | Formulaire en drawer 76dvh, hub 50dvh | oui |
| D3 | Carnet/Club/Sortie/Kit : formulaire rapide + « Ouvrir l’éditeur complet » | oui |
| D4 | Événement : `events` + post `share` (pas de `linked_event_id`) | oui |
| D5 | Story : réutiliser l’upload et le composer existants | oui |
| D6 | Après création : rester sur le fil et rafraîchir (pas de navigation) | oui |
