# Communauté v3 — « Pour toi », tiroirs et gestes : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer la pillule identité par « Pour toi » + menu de sections, ajouter un demi-tiroir
de navigation (Pour toi/Carnets/Clubs/Sorties) et des panneaux commentaires/partage superposés à la
carte du post, envoyer le post complet en messagerie, avec stories « la nôtre d'abord » et un drawer
de création refait.

**Architecture:** une coquille de demi-tiroir partagée (`CommunityDrawer`, 50dvh) et un sélecteur
4 cellules identique à la barre basse ; un menu déroulant ancré sur la pillule ; des sections
Carnets/Clubs/Sorties alimentées par Supabase ; des panneaux `inset:0` dans chaque carte de post,
ouverts au geste horizontal ; une carte `message_type='post'` dans la messagerie.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind, Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-communaute-drawers-swipe-design.md`

## Global Constraints

- Aucune nouvelle couleur, aucun nouveau jeton : `--bar-glass-bg`, `--bar-glass-blur`,
  `--bar-glass-shadow`, `--bar-thumb-shadow`, `#17402C`, `#56665D`, `#E0245E`, `#3A7A52`,
  `rgba(250,249,245,…)`.
- Aucune migration, aucune nouvelle table, aucune nouvelle colonne.
- Aucun import du runtime `compte-liquid-glass-v8-runtime.js`.
- Un seul fond de verre : `CommunityDrawer` + `PostPanel` partagent les valeurs de la spec.
- Le tiroir ne dépasse **jamais** 50dvh ; contenu scrollable.
- Le panneau commentaires/partage couvre **exactement** la carte (mêmes bounds).
- Tous les boutons ont un état, un feedback (toast) et un gate invité.
- Toutes les cartes du fil sont des carrés 1:1, y compris les posts texte.
- `prefers-reduced-motion` respecté ; cibles 44 px ; focus trap sur panneaux.
- Chaque tâche : test d'abord, test rouge, implémentation, test vert, commit.
- Aucune régression des actions v2 déjà vérifiées (like, save, report, envoi, copie).
- Les 5 pages métier (`/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide`) restent.

---

## Structure des fichiers

```
src/features/community/sections/
  CommunityDrawer.tsx
  CommunityTabSelector.tsx
  PourToiMenu.tsx
  CommunitySectionsDrawer.tsx
  useCommunitySections.ts
  SectionRow.tsx
  SectionDetail.tsx
  CarnetsSection.tsx
  ClubsSection.tsx
  SortiesSection.tsx
src/features/community/feed/
  CommunityCreateDrawer.tsx
  CommunityFeedTopBar.tsx          (modifié)
  PostAuthorPill.tsx               (nouveau)
  CommunityFeedPost.tsx            (modifié)
  PostCommentsPanel.tsx            (nouveau, remplace la Sheet)
  PostSharePanel.tsx
  useHorizontalSwipe.ts
  mention-utils.ts
  usePostShareTargets.ts
  useAccountUnreadCount.ts
  CommunityFeed.tsx                (modifié)
src/features/messaging/components/cards/PostMessageCard.tsx
src/features/messaging/types/messaging.types.ts (modifié)
src/app/api/compte/share-post/route.ts          (modifié)
src/components/communaute/CommunityStoriesBar.tsx (modifié)
src/styles/community-drawers.css                (nouveau)
src/app/communaute/page.tsx                     (modifié)
```

**Supprimés :** `CommunityCommentsSheet.tsx`, `AccountCreateSheet.tsx` (remplacés).

---

### Task 1: Baseline et contrat des demi-tiroirs

**Files:**
- Create: `src/styles/community-drawers.css`
- Modify: `src/app/layout.tsx` (import)
- Test: `tests/design/community-drawers-contract.spec.ts`

**Interfaces:**
- Produces: classes `.lkdv-half-drawer`, `.lkdv-tab-selector`, `.lkdv-tab-lens`,
  `.lkdv-section-row`, `.lkdv-post-panel`, `.lkdv-pourtoi-menu`.

- [ ] **Step 1: Écrire le test de contrat**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const css = readFileSync('src/styles/community-drawers.css', 'utf8');

describe('demi-tiroirs Communauté', () => {
  it('plafonne à 50dvh et reprend le verre du Compte', () => {
    expect(css).toMatch(/\.lkdv-half-drawer[\s\S]*max-height:\s*50dvh/);
    expect(css).toContain('--bar-glass-bg');
    expect(css).toContain('border-radius: 28px');
  });
  it('le sélecteur fait 48 px avec lentille 40 px', () => {
    expect(css).toMatch(/\.lkdv-tab-selector[\s\S]*height:\s*48px/);
    expect(css).toMatch(/\.lkdv-tab-lens[\s\S]*height:\s*40px/);
  });
  it('le panneau post est en inset 0 et rayon 28', () => {
    expect(css).toMatch(/\.lkdv-post-panel[\s\S]*inset:\s*0/);
    expect(css).toMatch(/\.lkdv-post-panel[\s\S]*border-radius:\s*28px/);
  });
});
```

- [ ] **Step 2: Lancer le test (échec)**

`npx vitest run tests/design/community-drawers-contract.spec.ts` → FAIL (fichier absent).

- [ ] **Step 3: Créer le CSS**

```css
.lkdv-half-drawer {
  --drawer-surface: rgba(250, 249, 245, 0.96);
  display: flex;
  flex-direction: column;
  max-height: 50dvh;
  height: 50dvh;
  overflow: hidden;
  border-radius: 28px 28px 0 0;
  background: var(--drawer-surface);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95), 0 -12px 40px rgba(23,43,36,.18);
  color: #17402c;
}
.lkdv-tab-selector { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); height: 48px; padding: 2px; border-radius: 999px; background: var(--bar-glass-bg); backdrop-filter: var(--bar-glass-blur); box-shadow: var(--bar-glass-shadow); }
.lkdv-tab-lens { position: absolute; top: 3px; bottom: 3px; left: 2px; width: calc((100% - 4px) / 4); height: 40px; border-radius: 999px; background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.75)); box-shadow: 0 2px 8px rgba(23,64,44,.12), inset 0 1px 0 #fff; transition: transform .42s cubic-bezier(.32,.72,0,1); }
.lkdv-post-panel { position: absolute; inset: 0; z-index: 12; overflow: hidden; border-radius: 28px; background: rgba(255,255,255,.88); backdrop-filter: blur(30px) saturate(1.8); box-shadow: inset 0 1px 0 rgba(255,255,255,.95); }
@media (prefers-reduced-motion: reduce) { .lkdv-tab-lens { transition: none; } }
```

- [ ] **Step 4: Vérifier + commit**

`npx vitest run tests/design/community-drawers-contract.spec.ts` → PASS.
`git commit -m "feat(communaute): socle verre des demi-tiroirs"`.

---

### Task 2: `CommunityDrawer` (50dvh partagé)

**Files:**
- Create: `src/features/community/sections/CommunityDrawer.tsx`
- Test: `src/features/community/sections/__tests__/CommunityDrawer.test.tsx`

**Interfaces:**
- Produces: `<CommunityDrawer open onOpenChange title children footer? />`
  - rend un portail bottom, `max-height:50dvh`, poignée, en-tête avec titre + fermeture.
  - `data-testid="community-drawer"`, `role="dialog"`.

- [ ] **Step 1: Test** — ouvert : `role=dialog`, titre, poignée, fermeture appelle `onOpenChange(false)` ;
  fermé : absent.
- [ ] **Step 2: Implémenter** avec `createPortal` sur `document.body`, focus initial, `Échap`,
  clic backdrop. Pas de Radix `Sheet` (il gère 90dvh) : coquille dédiée.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 3: `CommunityTabSelector` (4 cellules, lentille)

**Files:**
- Create: `src/features/community/sections/CommunityTabSelector.tsx`
- Test: `src/features/community/sections/__tests__/CommunityTabSelector.test.tsx`

**Interfaces:**
- Produces: `<CommunityTabSelector value onChange items />`, `items: { id, label, icon }[]`.
- 4 cellules ; `aria-current` sur l'actif ; lentille `translateX(index * 100%)`.

- [ ] **Step 1: Test** — 4 boutons, actif, clic appelle `onChange(id)`, lentille transformée.
- [ ] **Step 2: Implémenter** avec `.lkdv-tab-selector` / `.lkdv-tab-lens`, icônes 18, labels 10.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 4: Pillule « Pour toi » (texte) + menu déroulant

**Files:**
- Create: `src/features/community/sections/PourToiMenu.tsx`
- Modify: `src/features/community/feed/CommunityFeedTopBar.tsx`
- Test: `src/features/community/sections/__tests__/PourToiMenu.test.tsx`

**Interfaces:**
- Produces: `<PourToiMenu open onSelect(section) onClose />` — 3 items.
- `CommunityFeedTopBar` : **pastille texte** `Pour toi` + chevron (sans avatar), `aria-haspopup="menu"` ;
  `onOpenSection(section)` ; à droite `+` et **cloche** `<Link href="/compte?tab=notifications">`
  avec badge non-lus.
- `useAccountUnreadCount(userId)` : GET `/api/compte/compte/notifications` → `unread` (0 si invité).

- [ ] **Step 1: Test** — clic pillule ouvre le menu ; 3 items ; sélection appelle `onOpenSection('carnets')` ;
  `Échap` ferme ; clic extérieur ferme ; **aucun avatar dans la pillule** ; cloche `href`
  `/compte?tab=notifications` et badge si `unread>0`.
- [ ] **Step 2: Implémenter** — pastille 40 px, texte 600 13, chevron ; menu 240 px verre, 3 lignes ;
  bouton cloche 38 px, badge 16, lien Compte.
- [ ] **Step 3: Vérifier que `/compte?tab=notifications` ouvre le drawer Notifications**
  (`CompteLiquidGlassV8 initialTab='notifications'` → `openAccountDrawer(1)`) ; test e2e auth.
- [ ] **Step 4: Vérifier + commit**.

---

### Task 4b: Pillule auteur riche sur la carte (screen 2)

**Files:**
- Create: `src/features/community/feed/PostAuthorPill.tsx`
- Modify: `src/features/community/feed/CommunityFeedPost.tsx` (remplace `AccountAuthorPill`)
- Test: `src/features/community/feed/__tests__/PostAuthorPill.test.tsx`

**Interfaces:**
- `<PostAuthorPill author post />` : avatar 32, nom 13/700, badge `bouclier + trust_score`,
  méta `location · title · timeAgo` ; lien `/profil/[author.id]`.
- Fallback : `@handle · temps` si le lieu manque ; `lieu · temps` si le post n'a pas de titre.

- [ ] **Step 1: Test** — nom + badge 88 + « Chamonix · Lac Blanc · 2 h » ; lien profil ;
  fallback sans lieu ; pas de handle redondant.
- [ ] **Step 2: Implémenter** — verre `.pmi-author` élargi, 2 lignes, icône bouclier, méta tronquée.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 5: `CommunitySectionsDrawer` (coquille + nav + pile détail)

**Files:**
- Create: `src/features/community/sections/CommunitySectionsDrawer.tsx`,
  `src/features/community/sections/SectionDetail.tsx`
- Test: `src/features/community/sections/__tests__/CommunitySectionsDrawer.test.tsx`

**Interfaces:**
- Consumes: `CommunityDrawer`, `CommunityTabSelector`, sections.
- Produces: `<CommunitySectionsDrawer open initialTab onClose userId />`.
- Tabs : `pour-toi`, `carnets`, `clubs`, `sorties`. `pour-toi` appelle `onClose`.
- État : `selected: SectionItem | null` ; ligne → détail ; retour → liste ; changement de tab reset.
- Détail : cover 84, titre, méta, stats, description 3 lignes, action primaire, « Voir la page ».

- [ ] **Step 1: Test** — ouvre sur `initialTab`, 4 tabs, clic `pour-toi` ferme, changement de tab
  rend la section ; **hauteur ≤ 50dvh** ; ligne → détail ; retour → liste ; changement de tab reset.
- [ ] **Step 2: Implémenter** — en-tête « Explorer », sélecteur sticky, pile liste/détail scrollable.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 6: `useCommunitySections` (données + actions)

**Files:**
- Create: `src/features/community/sections/useCommunitySections.ts`
- Test: `src/features/community/sections/__tests__/useCommunitySections.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type SectionKind = 'carnets' | 'clubs' | 'sorties';
  type SectionFilter = 'discover' | 'mine';
  interface SectionsState {
    carnets: CarnetRow[]; clubs: ClubRow[]; sorties: EventRow[];
    filter: SectionFilter; setFilter: (f: SectionFilter) => void;
    loading: boolean; error: string | null;
    reload: () => Promise<void>;
    joinClub: (id: string) => Promise<void>;
    leaveClub: (id: string) => Promise<void>;
    toggleEvent: (event: EventRow) => Promise<void>;
  }
  ```
- Carnets : `carnets` `visibility='public'` + miens, 6.
- Clubs : `clubs` + `club_members` (user), 6.
- Sorties : `events` à venir + `event_participants`, 6.
- Auteurs : `fetchPublicProfilesWith`.

- [ ] **Step 1: Test** — 6 carnets, 6 clubs, 6 sorties ; filtres `discover`/`mine` ;
  `joinClub` insère et incrémente ; `leaveClub` supprime et décrémente ; `toggleEvent` appelle
  le bon RPC ; erreur → `error`.
- [ ] **Step 2: Implémenter** — requêtes, abort, états ; pas de localStorage legacy.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 7: Section Carnets

**Files:**
- Create: `src/features/community/sections/CarnetsSection.tsx`, `SectionRow.tsx`
- Test: `src/features/community/sections/__tests__/CarnetsSection.test.tsx`

- [ ] **Step 1: Test** — 6 lignes, cover/titre/auteur, badge Public/Mien, « Créer un carnet » href,
  « Tout voir » href, vide/chargement/erreur.
- [ ] **Step 2: Implémenter** — lignes 64 px verre, liens `/carnets/[id]`.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 8: Section Clubs

**Files:**
- Create: `src/features/community/sections/ClubsSection.tsx`
- Test: `src/features/community/sections/__tests__/ClubsSection.test.tsx`

- [ ] **Step 1: Test** — membre → « Quitter » ; non-membre → « Rejoindre » ; clic appelle
  `joinClub`/`leaveClub` ; badge « Membre » ; « Créer un club ».
- [ ] **Step 2: Implémenter** — lignes avec cover, membres, catégorie, action 44 px.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 9: Section Sorties

**Files:**
- Create: `src/features/community/sections/SortiesSection.tsx`
- Test: `src/features/community/sections/__tests__/SortiesSection.test.tsx`

- [ ] **Step 1: Test** — date, titre, lieu, participants ; inscrit → « Quitter » ; sinon
  « Rejoindre » ; RPC ; « Créer une sortie » → `/voyages`.
- [ ] **Step 2: Implémenter**.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 10: Refonte du drawer de création

**Files:**
- Create: `src/features/community/feed/CommunityCreateDrawer.tsx`
- Modify: `src/app/communaute/page.tsx`
- Delete: `src/components/account/AccountCreateSheet.tsx`
- Test: `src/features/community/feed/__tests__/CommunityCreateDrawer.test.tsx`

**Interfaces:**
- `<CommunityCreateDrawer open onOpenChange onStory />` : `CommunityDrawer` 50dvh, 5 tuiles.
- 4 tuiles 2×2 + story pleine largeur ; destinations `/carnets/nouveau`, `/voyages`, `/materiel`,
  `/clubs/nouveau`.

- [ ] **Step 1: Test** — 5 tuiles, 4 liens, story bouton, `max-height:50dvh`, pas de liste `<li>`
  serrée ; icônes.
- [ ] **Step 2: Implémenter** — grille, tuiles verre, story forêt.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 10b: Toutes les cartes au même format carré

**Files:**
- Modify: `src/features/community/feed/CommunityFeedPost.tsx`, `src/styles/community-feed.css`
- Test: `src/features/community/feed/__tests__/CommunityFeedPost.test.tsx`,
  `tests/e2e/community-v3.spec.ts`

**Interfaces:**
- `.lkdv-feed-post--text` : `aspect-ratio:1/1; height:auto?` **non** — `aspect-ratio:1/1` fixe,
  suppression de `height:auto`, `max-height:100cqw`, `min-height:120px`.
- Texte : `overflow:hidden`, dégradé bas, padding `58px 18px 64px` ; texte complet dans le panneau
  commentaires.

- [ ] **Step 1: Test** — carte image et carte texte ont la même hauteur (`getBoundingClientRect`),
  même largeur ; le texte long ne dépasse pas ; le panneau commentaires reste superposé.
- [ ] **Step 2: Implémenter** — carré unique, clamp/overflow, dégradé ; pas de hauteur variable.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 11: Stories — la nôtre d'abord, ring Compte

**Files:**
- Modify: `src/components/communaute/CommunityStoriesBar.tsx`
- Test: `tests/visual/community-stories.spec.ts` (nouveau) / unit `story-order` si possible

**Interfaces:**
- `storyUsers` réordonné : currentUser en premier ; si aucune story, première tuile = add vide.
- Suppression du bouton add en fin de rail.
- Ring : sage `linear-gradient(145deg, rgba(23,64,44,.55), rgba(91,127,85,.35), rgba(255,255,255,.85))`, inner 1.5 blanc.
- `showHeading` conservé.

- [ ] **Step 1: Test e2e** — avec session : première tuile = « Votre story » ; sans story : `+` ;
  aucun conic-gradient calculé ; le clic ouvre picker/viewer.
- [ ] **Step 2: Implémenter** — ordre, styles, suppression add fin.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 12: `useHorizontalSwipe`

**Files:**
- Create: `src/features/community/feed/useHorizontalSwipe.ts`
- Test: `src/features/community/feed/__tests__/useHorizontalSwipe.test.ts`

**Interfaces:**
- `useHorizontalSwipe({ onSwipeRight, onSwipeLeft, threshold = 64 })` →
  `{ onPointerDown, onPointerMove, onPointerUp, offset, dragging }`.
- Axe horizontal prioritaire ; tap < 8 px laissé au parent ; `touch-action: pan-y`.

- [ ] **Step 1: Test** — dx +80 → right ; dx -80 → left ; dx 20 → rien ; dy 100 → rien.
- [ ] **Step 2: Implémenter**.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 13: Panneau commentaires sur la carte

**Files:**
- Create: `src/features/community/feed/PostCommentsPanel.tsx`
- Modify: `src/features/community/feed/CommunityFeedPost.tsx`
- Delete: `src/features/community/feed/CommunityCommentsSheet.tsx`
- Test: `src/features/community/feed/__tests__/PostCommentsPanel.test.tsx`

**Interfaces:**
- `<PostCommentsPanel post user onClose initialFocusId? />` — `absolute inset:0`, header,
  `usePostComments`, composer, gate.
- `CommunityFeedPost` : `panel: 'comments' | 'share' | null` ; boutons + swipe ouvrent ;
  panneau rendu dans l'article ; `data-panel`.

- [ ] **Step 1: Test** — bouton commentaire ouvre le panneau ; `getBoundingClientRect` du panneau
  == carte (tolérance 1 px) ; 1 seul panneau ; `Échap` ferme.
- [ ] **Step 2: Implémenter** — panneau verre, liste, composer ; réutiliser `usePostComments`.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 14: Mentions `@` dans les commentaires

**Files:**
- Create: `src/features/community/feed/mention-utils.ts`
- Create: `src/features/community/feed/MentionPicker.tsx`
- Modify: `PostCommentsPanel.tsx`
- Test: `src/features/community/feed/__tests__/mention-utils.test.ts`

**Interfaces:**
- `encodeMention({id,name}) => '@[Name](uuid)'`
- `parseMentions(text) => Array<{type:'text'|'mention', ...}>`
- `renderMentions(text) => ReactNode` (liens `/profil/[id]`).
- `MentionPicker query profiles` (5 max) ; insère le token.

- [ ] **Step 1: Test** — token unique, noms avec parenthèses, texte mixte, lien profil, pas de
  token → texte simple.
- [ ] **Step 2: Implémenter** — regex robuste, picker `public_profiles`, dropdown verre.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 15: Panneau partage + envoi en messagerie

**Files:**
- Create: `src/features/community/feed/PostSharePanel.tsx`, `usePostShareTargets.ts`
- Modify: `CommunityFeedPost.tsx` (swipe gauche / bouton partager)
- Modify: `src/app/api/compte/share-post/route.ts` (membership + metadata)
- Test: `src/features/community/feed/__tests__/PostSharePanel.test.tsx`, API test.

**Interfaces:**
- `usePostShareTargets()` : `{ conversations, loading, send(postId, conversationId) }`.
- `PostSharePanel` : 4 actions, liste conversations, toast.
- API POST : vérifie `conversation_members`, insère message `message_type='post'` + metadata
  `{post_id, post_url, title, image_url, author_name, author_avatar}`.

- [ ] **Step 1: Test API** — non-membre → 403 ; membre → message `post` + `post_shares` ;
  metadata complète ; URL `/communaute?post=`.
- [ ] **Step 2: Test UI** — 4 actions, conversations, envoi, toast, fermeture.
- [ ] **Step 3: Implémenter**.
- [ ] **Step 4: Vérifier + commit**.

---

### Task 16: `PostMessageCard` dans la messagerie

**Files:**
- Create: `src/features/messaging/components/cards/PostMessageCard.tsx`
- Modify: `src/features/messaging/types/messaging.types.ts`
- Modify: `src/features/messaging/components/MessageBubble.tsx`
- Test: `src/features/messaging/components/cards/__tests__/PostMessageCard.test.tsx`

**Interfaces:**
- `MessageType` += `'post'` ; `PostMessageMeta`.
- `MessageBubble` rend `PostMessageCard` pour `message_type==='post'` et exclut le texte/OG.
- Carte : image 160×100, auteur, titre/extrait, lien `post_url`.

- [ ] **Step 1: Test** — carte visible, image/alt, lien, pas de double texte, fallback sans image.
- [ ] **Step 2: Implémenter**.
- [ ] **Step 3: Vérifier + commit**.

---

### Task 17: Intégration page, deep links, nettoyage

**Files:**
- Modify: `src/app/communaute/page.tsx`, `CommunityFeed.tsx`, `CommunityFeedTopBar.tsx`
- Modify: `src/styles/community-feed.css`
- Delete: `CommunityCommentsSheet.tsx`, `AccountCreateSheet.tsx` references.
- Test: `tests/e2e/community-v3.spec.ts`

**Interfaces:**
- Page : top bar `onOpenSection`, `CommunitySectionsDrawer` state, `CommunityCreateDrawer`.
- `?comment=<id>` : le post cible ouvre le panneau commentaires (prop `initialPanel`).
- `?post=` inchangé.

- [ ] **Step 1: Test e2e** — pillule → menu → tiroir ; 4 onglets ; hauteur ≤ 50 % ; rejoindre ;
  créer ; **cloche → `/compte?tab=notifications` + onglet Notifications actif** ; **toutes les
  cartes même hauteur** ; commentaire superposé ; swipe ; partage ; message ; mention ;
  story first ; barre.
- [ ] **Step 2: Implémenter** l'assemblage.
- [ ] **Step 3: Nettoyer** les anciens composants/états/CSS.
- [ ] **Step 4: Vérifier + commit**.

---

### Task 18: Visuel, accessibilité, build, rapport

**Files:**
- Create: `tests/visual/community-v3.spec.ts`, `docs/communaute/RAPPORT-V3.md`
- Modify: `tests/design/p5-direction-tokens.spec.ts` si nécessaire.

- [ ] **Step 1: Lancer**
  `npm run type-check`, `npm test`, `npx playwright test tests/e2e/community-v3.spec.ts`,
  `npx playwright test tests/visual/community-v3.spec.ts --config=playwright.visual.config.ts`,
  `npm run build`.
- [ ] **Step 2: Captures** 393/430/768/1440, clair/sombre : fil, menu, tiroir sections, création,
  commentaires, partage, message post.
- [ ] **Step 3: Mesurer** hauteur tiroir ≤ 50dvh ; panneau == carte ; 0 overflow ; 0 erreur console.
- [ ] **Step 4: Rédiger le rapport** et commit.

---

## Auto-contrôle

- [ ] Chaque exigence de la spec a une tâche.
- [ ] Les 5 pages métier restent.
- [ ] Aucune migration / table.
- [ ] Tiroir 50dvh et sélecteur 48 px testés.
- [ ] Toutes les cartes carrées, y compris texte, testées.
- [ ] Cloche → drawer Notifications du Compte testée.
- [ ] Panneau commentaires/partage exactement superposé testé.
- [ ] Story nôtre en premier + ring sans conic testés.
- [ ] Envoi message carte post testé.
- [ ] Mentions testées.
- [ ] Tous les boutons (rejoindre, quitter, créer, commenter, répondre, liker, éditer, supprimer,
  signaler, copier, envoyer, fermer) couverts.
