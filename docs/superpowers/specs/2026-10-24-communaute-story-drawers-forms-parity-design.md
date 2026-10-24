# Story + drawers Communauté — parité Profil et formulaires (design)

**Date :** 2026-10-24
**Statut :** proposition à valider — aucun code écrit
**Périmètre :** visionneuse Story, drawer sections/recherche, drawer création et ses formulaires.

---

## 1. Décisions

1. **Story** garde uniquement :
   - la pillule auteur en haut à gauche, **copiée du post** et cliquable vers `/profil/${id}` ;
   - le bouton `···` en haut à droite, **copié du post** ;
   - le cœur de like en bas à droite ;
   - le composer de message en bas, **même composant que les commentaires d'un post**.
2. **Drawer sections / recherche** et **drawer création** reprennent la grammaire du drawer Profil :
   - même surface, même poignée, même verre, mêmes boutons, mêmes sélecteurs ;
   - **hauteur maximale 50dvh à l'ouverture** (nouvelle contrainte utilisateur) ;
   - **sélecteur CapsuleTabs en haut** du drawer ;
   - la recherche est une **entrée du sélecteur avec son propre sous-drawer**, pas une section sous les onglets ;
   - chaque entrée du sélecteur ouvre son sous-drawer utile : Recherche, Pour toi, Carnets, Clubs, Sorties.
3. **Création** :
   - un seul drawer, sans titre/croix ;
   - sélecteur de type en haut : Publication, Carnet, Sortie, Kit, Club, Story ;
   - le formulaire du type sélectionné s'affiche **dans le même drawer** ;
   - formulaires multi-étapes avec `LensPager` (swipe) + mini sélecteur d'étapes en bas à droite, comme le drawer Profil ;
   - footer d'action collant.
4. Les champs et les écritures existants sont conservés ; l'amélioration du contenu des formulaires est un lot suivant.

---

## 2. Story

### 2.1 Composition finale

```
[ pillule auteur cliquable ]                    [ ··· ]
[                       média story                  ]
[                                              ♥ ]
[ composer message exactement comme commentaires   ]
```

- **Pillule** : composant partagé `PostIdentityPill`, mêmes classes/CSS que la pillule d'un post, avatar + nom + méta, lien `/profil/${user.id}`.
- **`···`** : même bouton SVG et même menu que le post ; actions adaptées à la story :
  - propriétaire : Vues, Supprimer ;
  - visiteur : Signaler, Bloquer.
- **Cœur** : bouton glass en bas à droite, au-dessus du composer ; `aria-label` « Aimer cette story » / « Retirer mon j'aime », état `likedStoryIds`, callback `onToggleLike`.
- **Composer** : `PostReplyComposer` partagé, markup et classes strictement identiques au composer des commentaires :
  - input `.lkdv-comments-composer input`
  - bouton `.lkdv-comments-send` avec `Icon name="send"`.
  - Le composer story utilise le même CSS ; il est posé sur le média avec un fond glass pour rester lisible.
- Plus de croix, like top, vues top, son, lecture, « Ignorer », caption : sortie par swipe bas / Échap.

### 2.2 Like persisté

- Le cœur est le **seul** bouton de like.
- Le double-tap like est supprimé (le geste reste navigation).
- Persistance réelle dans `public.story_likes` via `handleToggleLike` :
  - insert `{ story_id, user_id }` ;
  - delete sur le même couple ;
  - `23505` (déjà aimé) = état final aimé ;
  - état optimiste + rollback si l'écriture échoue.
- RLS existantes : `story_likes_insert_own`, `story_likes_delete_own`, lecture auteur/soi.
- **Aucune nouvelle migration** : la table existe déjà.

---

## 3. Drawers : coquille Profil à 50dvh

### 3.1 Coquille

Nouveau `CommunityDrawer` (et `CommunityFormDrawer` supprimé/absorbé) :

- surface : `linear-gradient(180deg, rgba(255,255,255,.59), rgba(255,255,255,.49) 40%, rgba(255,255,255,.53))` ;
- flou : `blur(29px) saturate(1.9) brightness(1.06)` ;
- rayon : **32px** (50dvh) ou 44px si la hauteur le permet ; mêmes inset shadows ;
- **height: 50dvh; max-height: 50dvh; bottom: 0** ; `left/right 8px` si la largeur le permet ;
- poignée 36×5, drag-to-dismiss ; backdrop ; Échap ; focus trap ;
- **aucun titre ni croix**.

### 3.2 Sélecteur supérieur

- `CapsuleTabs` (le composant du sélecteur Profil) en haut du drawer.
- Sections : Pour toi, Carnets, Clubs, Sorties.
- Création : Publication, Carnet, Sortie, Kit, Club, Story.
- Le sélecteur est la **navigation supérieure**, pas une section de contenu ; la recherche reste la première section de contenu des sections.

### 3.3 Sous-drawers du sélecteur

Chaque entrée du sélecteur est un sous-drawer :

1. **Recherche** — champ hero, scopes Tout/Publications/Carnets/Clubs/Sorties/Membres, résultats groupés et distinctifs. C'est un sous-drawer entier, sans onglets de sections en dessous.
2. **Pour toi** — accueil du fil et raccourcis.
3. **Carnets** — liste, filtres, détail.
4. **Clubs** — liste, filtres, adhésion.
5. **Sorties** — liste, filtres, inscription.

Le sélecteur reste visible en haut ; le sous-drawer occupe la zone de contenu. La hauteur reste ≤50dvh, donc chaque sous-drawer est scrollable et compact.

---

## 4. Création : un drawer, un sélecteur, des étapes

### 4.1 Architecture

```
CommunityCreateDrawer
  CapsuleTabs (type de création)
  CreateFormHost
    type = post | carnet | sortie | kit | club | story
    StepPager (LensPager + mini-sélecteur bas droite)
    champs de l'étape
  Footer (Continuer / Publier)
```

- Le hub de 6 tuiles est remplacé par le sélecteur supérieur.
- Un seul état de formulaire dans le drawer ; changer de type réinitialise.
- Chaque formulaire expose ses étapes et sa validation dans un hook ; le drawer gère le shell et le footer.

### 4.2 Étapes

| Type | Étapes |
|---|---|
| Publication | Format → Contenu → Audience |
| Story | Média → Légende & audience |
| Carnet | Infos → Dates & visuel → Visibilité |
| Sortie | Infos → Détails → Participants |
| Kit | Identité → Poids & visibilité |
| Club | Identité → Présentation → Adhésion |

- `LensPager` pour le swipe entre étapes.
- Mini-sélecteur d'étapes en bas à droite : capsules/pastilles, même langage que les lentilles du drawer Profil.
- Footer : « Continuer » jusqu'à l'avant-dernière étape, action finale sur la dernière.
- Validation par étape ; erreurs dans le footer ; pas de perte de saisie.

### 4.3 Champs existants

Les champs des formulaires actuels sont conservés :
`PostCreateForm`, `StoryCreateForm`, `CarnetCreateForm`, `SortieCreateForm`, `KitCreateForm`, `ClubCreateForm`.
Le refactor sépare l'état/les champs de la coquille ; aucune migration DB.

---

## 5. Composants partagés

```
src/features/posts/ui/PostIdentityPill.tsx
src/features/posts/ui/PostOptionsButton.tsx
src/features/posts/ui/PostOptionsMenu.tsx
src/features/posts/ui/PostReplyComposer.tsx
src/features/posts/ui/PostHeartButton.tsx
src/features/community/drawers/CommunityDrawerShell.tsx
src/features/community/drawers/DrawerCapsuleSelector.tsx
src/features/community/drawers/StepPager.tsx
src/features/community/create/CreateDrawer.tsx
src/features/community/create/CreateFormHost.tsx
src/features/community/create/steps.ts
```

- `CommunityDrawerShell` remplace `CommunityDrawer` + `CommunityFormDrawer`.
- `DrawerCapsuleSelector` encapsule `CapsuleTabs` avec icônes/labels.
- `StepPager` encapsule `LensPager` + mini-sélecteur.
- `PostReplyComposer` est la source unique pour commentaires et story.

---

## 6. Tests

- Story : exactement les boutons attendus (cœur, `···`, envoyer), pillule lien, composer classes identiques aux commentaires, like optimiste.
- Drawer : hauteur ≤50dvh, sélecteur top, Recherche comme sous-drawer, résultats 5 types.
- Story like : insert/delete `story_likes`, test de persistance et rollback.
- Création : sélecteur 6 types, formulaire en place, étapes, swipe, footer, validation.
- Visuel 430/768/1440 ; E2E Story/Search/Création ; build.

---

## 7. Hors périmètre

- Amélioration du contenu/UX de chaque formulaire (lot suivant).
- Nouvelles tables/API.
- Refonte complète du runtime Compte.
