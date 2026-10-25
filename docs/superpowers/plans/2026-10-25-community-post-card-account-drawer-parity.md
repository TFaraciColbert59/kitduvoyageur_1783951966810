# Carte post Communauté = drawer post Compte — plan de parité

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer la carte du fil Communauté par la surface exacte du drawer post du Compte, au pixel et au comportement.

**Architecture:** extraire une surface partagée `PostCardSurface` + `PostLensPager` + panes partage/commentaires du `PostDrawer`, puis la rendre dans l’overlay Compte et dans une carte de fil aux mêmes dimensions. Supprimer la carte, les panneaux et les compteurs spécifiques au fil.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, vinext/Cloudflare, `LensPager`, CSS Compte, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-community-post-card-account-drawer-parity-design.md`

## Global Constraints

- Vérité unique : `src/components/compte/overlay/PostDrawer.tsx` + `compte-overlay.css`.
- Carte fil à 430 px : **406×541**, `x=12`, rayon 28.
- Média **4:5**, header verre, capsule **3×40 px sans compteurs**.
- **Aucun** `PostGlassPanel`, `lkdv-share-mini`, compteurs, carte verte, média 1:1 dans le fil.
- Le drawer Compte et la carte fil doivent rendre le **même composant**.
- Aucune migration DB. Aucun secret. Aucun déploiement Vercel.
- Tests et vérifications obligatoires ; build Cloudflare avant commit final.

---

## Relevé exhaustif des différences

| # | Point | Compte (vérité) | Fil actuel | Action |
|---|---|---|---|---|
| 1 | Conteneur | sheet overlay `406×541 x12 y48` | carte `410×410 x10 y163` | même `PostCardSurface`, largeur 406 |
| 2 | Fond | transparent + verre | `#17402C` | supprimer fond vert |
| 3 | Ratio média | 4:5 | 1:1 | `aspect-ratio:4/5` partagé |
| 4 | Header | `lkdv-overlay-heading` verre, avatar 36, nom 13, handle + temps | `pmi-author` verre, avatar 28, sans temps | composant header Compte |
| 5 | Header cliquable | retour Compte/profil | lien profil seul | même action |
| 6 | Options | menu 6 : Enregistrer, Copier, Republier, Signaler, Supprimer, Fermer | 4 : Enregistrer, Republier, Copier, Signaler | menu partagé 6 |
| 7 | Déclencheur options | `lkdv-post-options-trigger` 38 px | `pmi-more-pill` 34 px | même bouton |
| 8 | Actions | 3 × 40 px, sans compteur | 3 boutons 34 px + compteurs | capsule Compte |
| 9 | Compteurs | absents | 12 / 3 / 1 | retirer |
| 10 | Icônes actions | Heart / MessageCircle / Send | Heart / MessageCircle / Share2 | mêmes icônes |
| 11 | Like | `on`/`liked`, rempli | compteur local + état | même état, sans compteur |
| 12 | Partage | onglets Envoyer / Partage externe | 3 actions rondes + mini 132×30 | pane partagée Compte |
| 13 | Mini partage | absent | présent | supprimer |
| 14 | Commentaires | pane `.lkdv-comments-pane` + composer textarea | `.lkdv-post-panel` + input | pane partagée |
| 15 | Navigation | LensPager 3 panes (share/post/comments) | PostGlassPanel 2 panes | même pager 3 |
| 16 | Swipe | horizontal panes + swipe bas ferme | panneaux 80 %, swipe | même gestes |
| 17 | Animation | overlay-in 260 ms, lens snap | height .4 s | animations Compte |
| 18 | Lightbox | `.lkdv-post-lightbox` | absent | ajouter |
| 19 | Carrousel | flèches + compteur médias | premier média seulement | ajouter |
| 20 | Texte | post = photo uniquement | fallback texte | conserver fallback mais même cadre |
| 21 | Vidéo | média img (drawer) | vidéo supportée | surface média partagée |
| 22 | Fermeture | header cliquable, swipe, menu Fermer | pas de Fermer | menu/gestes Compte |
| 23 | Scrim | transparent pour post | pas de scrim | même overlay |
| 24 | Bottom bar | visible sous la sheet | visible | inchangé |
| 25 | Largeur feed | 406 | 410 | colonne 12 px |
| 26 | Focus/scroll | body lock + focus trap | expansion locale | mêmes comportements |
| 27 | Partage externe | 4 boutons | 3 actions | mêmes boutons |
| 28 | Recherche partage | input 35 px | input 40 px | même style |
| 29 | Liste conversations | `.lkdv-share-list` | `.lkdv-share-conv` | même markup |
| 30 | Composer commentaire | textarea 2 lignes + send 34 | input 40 + send 40 | composer Compte |
| 31 | Liste commentaires | `lkdv-comment` + actions | liste fil | composant Compte |
| 32 | Police | SF Pro/Inter 12–13 px | feed 10–13 px | tokens Compte |
| 33 | Menu largeur | 210 | 226 | 210 |
| 34 | Position menu | top 48/right 12 | pmi top 52/right 12 | 48/12 |
| 35 | Accessibilité | role dialog, focus trap | role dialog local | mêmes attributs |
| 36 | Entrée | depuis grille Compte | toujours inline | carte inline, ouverture panes |
| 37 | Scroll body | lock | non lock | lock pendant panes |
| 38 | Tap média | lightbox | like/double tap | lightbox + like seulement sur bouton |
| 39 | État vide commentaires | message Compte | message fil | même texte/style |
| 40 | Partage natif | boutons Compte | actions fil | même handlers |

---

## Fichiers

```
src/components/compte/overlay/
  PostDrawer.tsx                 (refactor)
  PostCardSurface.tsx            (create)
  PostLensPager.tsx              (create)
  PostSharePane.tsx              (create)
  PostCommentsPane.tsx           (create)
  PostMediaLightbox.tsx          (create)
  compte-overlay.css             (source styles)
src/features/community/feed/
  CommunityFeedPost.tsx          (refactor)
  PostCommentsPanel.tsx          (supprimer du fil / garder legacy)
  PostSharePanel.tsx             (supprimer du fil / garder legacy)
src/features/posts/ui/
  post-system.css                (tokens partagés)
tests/visual/
  post-card-parity.spec.ts       (create)
tests/e2e/
  post-card-parity.spec.ts       (create)
```

---

### Task 1: Fixture et harnais de comparaison

**Files:**
- Create: `scripts/fixtures/post-card-parity.mjs`
- Create: `tests/visual/post-card-parity.spec.ts`
- Test: captures `account-post-*` / `community-post-*`

**Interfaces:**
- `ensureParityPost(): Promise<string>` insère un post de test pour le compte démo et retourne son id.
- `deleteParityPost(id)` nettoie.

- [ ] **Step 1: Test rouge** — le test vérifie que les deux captures existent et que la carte du fil a `406×541`.
- [ ] **Step 2: Écrire le fixture** — service role, `community_posts`, `post_type='post'`, image Unsplash, cleanup.
- [ ] **Step 3: Capturer** — `/compte` → tuile → drawer ; `/communaute` → carte ; mêmes viewport 430×932.
- [ ] **Step 4: Commit** `test(post): fixture et captures de parité`.

---

### Task 2: Extraire `PostCardSurface`

**Files:**
- Create: `src/components/compte/overlay/PostCardSurface.tsx`
- Modify: `PostDrawer.tsx:304-324`
- Test: `tests/design/post-card-surface.spec.tsx`

**Interfaces:**
```ts
export interface PostCardSurfaceProps {
  post: PostDetail;
  mediaIndex: number;
  onMediaIndexChange: (index: number) => void;
  onOpenMedia: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onOpenOptions: () => void;
  onOpenProfile: () => void;
  onClose: () => void;
}
```

- [ ] **Step 1: Test rouge** — rend `.lkdv-post-main`, `.lkdv-post-media-wrap`, `.lkdv-post-media-glass`, 3 boutons, aucun compteur.
- [ ] **Step 2: Déplacer le markup exact** du panneau post de `PostDrawer`.
- [ ] **Step 3: Remplacer dans `PostDrawer`** par `<PostCardSurface … />`.
- [ ] **Step 4: Run** test + `tsc` ; commit.

---

### Task 3: Extraire le pager 3 panes

**Files:**
- Create: `PostLensPager.tsx`, `PostSharePane.tsx`, `PostCommentsPane.tsx`
- Modify: `PostDrawer.tsx:259-360`
- Test: `tests/design/post-lens-pager.spec.tsx`

**Interfaces:**
```ts
export type PostPane = 'share' | 'post' | 'comments';
export function PostLensPager({ pane, onPaneChange, post, comments, onComment, onShare, onClose }: {...}): JSX.Element;
```

- [ ] **Step 1: Test rouge** — 3 panes, `share` à index 0, `post` à 1, `comments` à 2, swipe met à jour.
- [ ] **Step 2: Extraire** le `LensPager` + les trois panes, garder le CSS `lkdv-post-pane`.
- [ ] **Step 3: Vérifier** partage Envoyer/Partage externe et commentaires.
- [ ] **Step 4: Commit**.

---

### Task 4: Brancher le drawer Compte sur les composants partagés

**Files:**
- Modify: `PostDrawer.tsx`
- Test: captures Compte inchangées.

- [ ] **Step 1: Test de non-régression** — capture `account-post-post/options/share/comments`.
- [ ] **Step 2: Remplacer** markup/CSS locaux par `PostCardSurface` + `PostLensPager`.
- [ ] **Step 3: Run** tests + comparaison pixel ; commit.

---

### Task 5: Remplacer la carte du fil

**Files:**
- Modify: `src/features/community/feed/CommunityFeedPost.tsx`
- Modify: `src/styles/community-feed.css`
- Test: `tests/visual/post-card-parity.spec.ts`

- [ ] **Step 1: Test rouge** — carte `406×541`, ratio 4:5, `.lkdv-overlay-heading`, `.lkdv-post-media-glass`, pas de `.lkdv-count-btn`, pas de `.lkdv-share-mini`.
- [ ] **Step 2: Remplacer** `article` par `<PostCardSurface>` dans un wrapper `article` de même largeur.
- [ ] **Step 3: Supprimer** `PostGlassPanel`, `PostCommentsPanel`, `PostSharePanel` du rendu fil.
- [ ] **Step 4: Mapper** `FeedPost` vers `PostDetail` minimal (auteur, handle, createdAt, mediaUrls, userLiked, counts non affichés).
- [ ] **Step 5: Run** + commit.

---

### Task 6: Panes dans la carte, interactions et options

**Files:**
- Modify: `CommunityFeedPost.tsx`, `PostCardSurface.tsx`, `PostDrawer.tsx`
- Test: `tests/e2e/post-card-parity.spec.ts`

- [ ] **Step 1: Test rouge** — clic `···` ouvre 6 entrées ; clic partage ouvre pane Envoyer ; clic commentaire ouvre pane commentaires ; swipe ferme.
- [ ] **Step 2: Utiliser** `PostLensPager` dans la carte, pas d’overlay plein écran.
- [ ] **Step 3: Aligner** menu 6 entrées, suppression, fermeture, like sans compteur.
- [ ] **Step 4: Run** + commit.

---

### Task 7: Lightbox et carrousel média

**Files:**
- Create: `PostMediaLightbox.tsx`
- Modify: `PostCardSurface.tsx`
- Test: `tests/e2e/post-card-media.spec.ts`

- [ ] **Step 1: Test rouge** — clic média ouvre `.lkdv-post-lightbox` ; flèches changent l’index ; compteur `1/N`.
- [ ] **Step 2: Implémenter** le même markup/CSS Compte.
- [ ] **Step 3: Run** + commit.

---

### Task 8: Nettoyage, tests et déploiement

**Files:**
- Modify: `tests/visual/post-card-parity.spec.ts`, docs.
- Test: Cloudflare.

- [ ] **Step 1: Lancer**

```bash
cd /Users/fr168256/Desktop/lkdv-cloudflare
npx tsc --noEmit
npx vitest run tests/design/post-card-surface.spec.tsx tests/design/post-lens-pager.spec.tsx
npx playwright test tests/visual/post-card-parity.spec.ts --config=playwright.visual.config.ts
npx playwright test tests/e2e/post-card-parity.spec.ts --project=mobile-chromium
npm run deploy:vinext
```

- [ ] **Step 2: Vérifier** captures Compte/Fil, dimensions, options, partage, commentaires, lightbox.
- [ ] **Step 3: Commit final + déploiement Cloudflare.**

---

## Auto-contrôle

- [ ] Une seule surface : `PostCardSurface` utilisée par Compte et Fil.
- [ ] Carte 406×541, 4:5, header verre, 3×40, zéro compteur.
- [ ] Menu 6 entrées, partage 2 onglets, commentaires Compte.
- [ ] 3 panes + swipe + animations Compte.
- [ ] Lightbox + carrousel.
- [ ] Aucun `PostGlassPanel`, `lkdv-share-mini`, `lkdv-count-btn` dans le fil.
- [ ] Tests visuels/E2E et build Cloudflare.
