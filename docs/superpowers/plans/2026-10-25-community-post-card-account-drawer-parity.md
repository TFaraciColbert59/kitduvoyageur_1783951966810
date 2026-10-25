# Carte post Communauté = drawer post Compte — plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** rendre la carte du fil identique au drawer post du Compte dernière version, au repos comme dans les panes partage/commentaires.

**Architecture:** extraire `PostCardSurface`, `PostOptionsRail`, `PostLensPager`, `PostSharePane`, `PostCommentsPane` du `PostDrawer`, puis les utiliser dans le drawer Compte et dans une carte fil qui s’étend de 541 à 794 px. Supprimer la carte et les panneaux spécifiques au fil.

**Tech Stack:** Next.js 15, React 19, vinext/Cloudflare, LensPager, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-community-post-card-account-drawer-parity-design.md`

## Global Constraints

- Compte de recette : `lea.fontaine` (`demo@lkdv.app`).
- Carte fil : **406×541** au repos, **406×794** en partage/commentaires, `x=12`, rayon 28.
- Média **4:5**, header verre 60/40, X, rail d’options, compteurs.
- **3 panes** ; onglets partage Envoyer/Partage externe.
- Aucun `PostGlassPanel`, `lkdv-share-mini`, `AccountMoreMenu` dropdown dans le fil.
- Pas de lightbox (désactivée côté Compte).
- Tests + build Cloudflare avant commit final.

## Captures de référence

Compte :
`latest-account-home.png`, `latest-account-post.png`, `latest-account-options.png`, `latest-account-share.png`, `latest-account-comments.png`.

Communauté :
`latest-community-card.png`, `latest-community-options.png`, `latest-community-comments.png`, `latest-community-share.png`.

## Différences exhaustives

| # | Point | Compte | Fil | Correction |
|---|---|---|---|---|
| 1 | Conteneur | sheet 406×541 x12 y48 | carte 410×410 x10 y163 | `PostCardSurface` 406 |
| 2 | Extension panes | 406×794 | 410×354 | expansion 794 |
| 3 | Fond | sheet transparente | `#17402C` | supprimer fond |
| 4 | Média | 4:5 | 1:1 | 4:5 |
| 5 | Header | 60, avatar 40, nom 15, handle+temps | 36, avatar 28, sans temps | header partagé |
| 6 | X | oui | non | ajouter |
| 7 | Grab | oui | non | ajouter |
| 8 | Options | rail vertical 5 | dropdown 4 | rail partagé |
| 9 | Trigger | `lkdv-post-options-trigger` 38 | `pmi-more-pill` 34 | même trigger |
| 10 | Actions | 2/5/2, 46×31 | 12/3/1, 34 | mêmes tailles |
| 11 | Icônes | Heart/MessageCircle/Send | Heart/MessageCircle/Share2 | mêmes icônes |
| 12 | Like | pop + burst | compteur local | mêmes animations |
| 13 | Panes | 3 | 2 | LensPager 3 |
| 14 | Navigation | swipe/lens | PostGlassPanel | même pager |
| 15 | Partage | recherche + 3 actions + liste + mini 2 | actions + mini 3 | pane partagée Compte |
| 16 | Mini partage | 2 boutons | 3 boutons | 2 boutons |
| 17 | Commentaires | pane 794 | panneau 354 | pane partagée |
| 18 | Composer | textarea | input | composer Compte |
| 19 | Liste comments | actions complètes | liste fil | composant Compte |
| 20 | Animation sheet | expansion | height .4 | même transition |
| 21 | Carrousel | flèches + compteur | non | ajouter |
| 22 | Lightbox | désactivée | non | ne pas ajouter |
| 23 | Texte | fallback | fallback | même cadre |
| 24 | Vidéo | média | vidéo | surface média partagée |
| 25 | Fermeture | X/grab/swipe | aucune | mêmes gestes |
| 26 | Scrim | transparent | absent | overlay |
| 27 | Bottom bar | visible | visible | inchangé |
| 28 | Largeur | 406 | 410 | colonne 12 |
| 29 | Focus | trap/lock | local | mêmes |
| 30 | Partage externe | 4 boutons | 3 actions | mêmes |
| 31 | Recherche partage | 35 | 40 | même style |
| 32 | Liste conversations | rows Compte | rows fil | même markup |
| 33 | Menu largeur | rail | 226 | rail |
| 34 | Police | SF Pro 12–15 | feed 10–13 | tokens Compte |
| 35 | Entrée | grille Compte | inline | inline + expansion |
| 36 | Tap média | double like | double like | même |
| 37 | Compteurs | oui | oui | mêmes valeurs/style |
| 38 | Header time | oui | non | ajouter |
| 39 | A11y | dialog/focus | dialog local | mêmes attributs |
| 40 | Multi-média | oui | non | ajouter |

## Fichiers

```
src/components/compte/overlay/
  PostDrawer.tsx
  PostCardSurface.tsx
  PostOptionsRail.tsx
  PostLensPager.tsx
  PostSharePane.tsx
  PostCommentsPane.tsx
  compte-overlay.css
src/features/community/feed/CommunityFeedPost.tsx
src/styles/community-feed.css
tests/visual/post-card-parity.spec.ts
tests/e2e/post-card-parity.spec.ts
```

---

### Task 1: Fixture et captures

- [ ] **Step 1:** test rouge vérifiant 406×541 et 406×794.
- [ ] **Step 2:** fixture Playwright : login `demo@lkdv.app`, ouvrir `/compte`, première tuile.
- [ ] **Step 3:** captures Compte (home/post/options/share/comments) et Fil (card/options/share/comments).
- [ ] **Step 4:** commit `test(post): captures parité compte rempli`.

### Task 2: `PostCardSurface`

- [ ] **Step 1:** test rouge : `.lkdv-post-media` 4:5, header 60/40, X, rail, compteurs 46×31.
- [ ] **Step 2:** extraire le markup exact du `PostDrawer` (header, média, glass, rail).
- [ ] **Step 3:** remplacer dans `PostDrawer` par `<PostCardSurface … />`.
- [ ] **Step 4:** `tsc` + test + commit.

### Task 3: `PostOptionsRail`

- [ ] **Step 1:** test rouge : 5 boutons, trigger 38, X, rotation 90°.
- [ ] **Step 2:** extraire le rail et les handlers.
- [ ] **Step 3:** commit.

### Task 4: `PostLensPager` + panes

- [ ] **Step 1:** test rouge : 3 panes, sheet 541→794, swipe, partage recherche/actions/liste.
- [ ] **Step 2:** extraire `LensPager`, `PostSharePane`, `PostCommentsPane`.
- [ ] **Step 3:** brancher `PostDrawer` sur ces composants.
- [ ] **Step 4:** commit.

### Task 5: Carte fil

- [ ] **Step 1:** test rouge : carte 406×541, 4:5, header/X/rail/compteurs, pas de dropdown.
- [ ] **Step 2:** remplacer `CommunityFeedPost` par `PostCardSurface` + `PostLensPager`.
- [ ] **Step 3:** expansion 406×794 pour partage/commentaires.
- [ ] **Step 4:** supprimer `PostGlassPanel`, `lkdv-share-mini`, `AccountMoreMenu` du fil.
- [ ] **Step 5:** commit.

### Task 6: Interactions

- [ ] **Step 1:** test rouge : like, double tap, options rail, partage tabs, commentaires, fermeture X/swipe.
- [ ] **Step 2:** brancher les handlers sur les mêmes mutations.
- [ ] **Step 3:** commit.

### Task 7: Média

- [ ] **Step 1:** test rouge : 4:5, flèches, compteur, pas de lightbox.
- [ ] **Step 2:** implémenter le carrousel partagé.
- [ ] **Step 3:** commit.

### Task 8: Recette/déploiement

- [ ] **Step 1:** `npx tsc --noEmit`.
- [ ] **Step 2:** `npx vitest run tests/design/post-card-*.spec.tsx`.
- [ ] **Step 3:** Playwright visuel + E2E.
- [ ] **Step 4:** `cd /Users/fr168256/Desktop/lkdv-cloudflare && npm run deploy:vinext`.
- [ ] **Step 5:** vérifier workers.dev + captures.

## Auto-contrôle

- [ ] 406×541 / 406×794.
- [ ] Header 60/40, X, rail, compteurs.
- [ ] 3 panes, tabs partage, comments Compte.
- [ ] Aucun dropdown/mini/panneau fil.
- [ ] Captures et tests.
