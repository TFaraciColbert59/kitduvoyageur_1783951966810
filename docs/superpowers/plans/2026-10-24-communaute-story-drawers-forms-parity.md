# Story + drawers Communauté — parité Profil et formulaires : plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** finaliser la story (pillule cliquable, `···`, cœur, composer identique aux commentaires), remettre les drawers sections/création dans la grammaire Profil avec une hauteur maximale de 50dvh, et faire vivre les six formulaires de création dans un seul drawer à sélecteur et étapes.

**Architecture:** un composer, une pillule, un bouton/menu d'options et un cœur partagés ; une coquille `CommunityDrawerShell` à 50dvh avec `CapsuleTabs` ; un `CreateDrawer` unique qui héberge les six formulaires, leurs étapes et un `StepPager` basé sur `LensPager`.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind, Supabase, `CapsuleTabs`, `LensPager`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-communaute-story-drawers-forms-parity-design.md`

## Global Constraints

- Hauteur d'ouverture des drawers sections/création : **50dvh maximum**.
- Aucun titre, aucune croix dans les drawers ; fermeture backdrop / Échap / drag.
- La pillule story est **la même** que la pillule post (classes `.lkdv-post-author`).
- Le composer story est **le même composant** que le composer commentaires (`.lkdv-comments-composer`, `.lkdv-comments-send`).
- Le bouton `···` story est **le même** que celui du post (`.pmi-more-pill`, même SVG).
- Aucune migration DB, aucune nouvelle table, aucun secret côté client.
- Les champs/écritures des six formulaires sont conservés ; l'amélioration du contenu est hors lot.
- Tests avant implémentation ; un commit par tâche.

---

## Structure des fichiers

```
src/features/posts/ui/
  PostIdentityPill.tsx
  PostOptionsButton.tsx
  PostOptionsMenu.tsx
  PostReplyComposer.tsx
  PostHeartButton.tsx
  post-actions.css
src/features/community/drawers/
  CommunityDrawerShell.tsx
  DrawerCapsuleSelector.tsx
  StepPager.tsx
  drawers.css
src/features/community/create/
  CreateDrawer.tsx
  CreateFormHost.tsx
  steps.ts
  forms/
    PostFormContent.tsx
    StoryFormContent.tsx
    CarnetFormContent.tsx
    SortieFormContent.tsx
    KitFormContent.tsx
    ClubFormContent.tsx
src/components/communaute/StoriesViewer.tsx   (modifié)
src/features/community/sections/CommunitySectionsDrawer.tsx (modifié)
src/features/community/feed/PostCommentsPanel.tsx (modifié)
src/features/community/feed/CommunityFeedPost.tsx (options partagées)
```

---

### Task 1: `PostReplyComposer` — source unique commentaires + story

**Files:**
- Create: `src/features/posts/ui/PostReplyComposer.tsx`
- Modify: `src/features/community/feed/PostCommentsPanel.tsx`
- Test: `tests/design/post-reply-composer.spec.tsx`

**Interfaces:**
- `PostReplyComposer({ value, onChange, onSend, placeholder, ariaLabel, busy, disabled })`.
- Markup exact :
  ```tsx
  <div className="lkdv-comments-composer">
    <input … />
    <button type="button" className="lkdv-comments-send" aria-label={ariaLabel} disabled={disabled || busy}>
      <Icon name="send" size={15} aria-hidden="true" />
    </button>
  </div>
  ```

- [ ] **Step 1: Test rouge**

```tsx
it('rend le même composer que les commentaires', () => {
  const { container } = render(
    <PostReplyComposer value="" onChange={() => {}} onSend={() => {}} placeholder="Répondre…" ariaLabel="Envoyer la réponse" />
  );
  expect(container.querySelector('.lkdv-comments-composer')).toBeTruthy();
  expect(container.querySelector('.lkdv-comments-send svg')).toBeTruthy();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/design/post-reply-composer.spec.tsx` → FAIL.
- [ ] **Step 3: Implémenter** le composant avec les classes existantes, puis remplacer le bloc composer de `PostCommentsPanel`.
- [ ] **Step 4: Run** → PASS ; vérifier que `PostCommentsPanel` n'a plus d'input local.
- [ ] **Step 5: Commit** `feat(posts): composer de réponse partagé`.

---

### Task 2: Pillule, bouton `···`, menu et cœur partagés

**Files:**
- Create: `PostIdentityPill.tsx`, `PostOptionsButton.tsx`, `PostOptionsMenu.tsx`, `PostHeartButton.tsx`, `post-actions.css`
- Modify: `src/features/community/feed/PostAuthorPill.tsx`, `CommunityFeedPost.tsx`
- Test: `tests/design/post-shared-actions.spec.tsx`

**Interfaces:**
```ts
export interface PostIdentity {
  id: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  trustScore?: number | null;
}
export function PostIdentityPill({ identity, meta, href }: { identity: PostIdentity; meta?: string; href?: string }): JSX.Element;
export function PostOptionsButton({ open, onToggle }: { open: boolean; onToggle: () => void }): JSX.Element;
export function PostOptionsMenu({ open, items }: { open: boolean; items: Array<{ id: string; label: string; danger?: boolean; onSelect: () => void }> }): JSX.Element;
export function PostHeartButton({ liked, onToggle }: { liked: boolean; onToggle: () => void }): JSX.Element;
```

- [ ] **Step 1: Test rouge** — pillule rend `.lkdv-post-author` et `href` ; `···` rend `svg` + `aria-label="Options de la publication"` ; menu liste les items ; cœur `aria-pressed`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** en extrayant le markup exact de `PostAuthorPill`/`PostOptionsButton` (SVG trois cercles) et du menu `AccountMoreMenu` ; ne pas dupliquer les styles.
- [ ] **Step 4: Adapter** `CommunityFeedPost` pour utiliser ces composants sans changement visuel.
- [ ] **Step 5: Run** tests + `npx tsc --noEmit` ; **commit**.

---

### Task 3: Story — pillule cliquable, `···`, cœur persisté, composer partagé

**Files:**
- Modify: `src/components/communaute/StoriesViewer.tsx`
- Test: `tests/design/stories-viewer-clean.spec.tsx`

**Interfaces:**
- Conserve `users/startUser/onClose/onView/onReply/onToggleLike/onShowViews/onDelete/onReport/onBlock/likedStoryIds/followedAuthorIds/myUserId`.
- Utilise `PostIdentityPill` (Link `/profil/${user.id}`), `PostOptionsButton` + menu, `PostHeartButton`, `PostReplyComposer`.

- [ ] **Step 1: Test rouge**

```tsx
it('garde uniquement pillule, options, cœur et envoi', () => {
  render(<StoriesViewer users={[USER]} startUser={0} myUserId="me" onClose={vi.fn()} onReply={vi.fn()} onToggleLike={vi.fn()} likedStoryIds={new Set()} />);
  expect(screen.getByRole('link', { name: /Léa Martin/ })).toHaveAttribute('href', '/profil/author');
  expect(screen.getByLabelText('Options de la story')).toBeTruthy();
  expect(screen.getByLabelText('Aimer cette story')).toBeTruthy();
  expect(screen.getByLabelText('Envoyer la réponse')).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(3);
});
```

- [ ] **Step 2: Run** → FAIL (le viewer actuel n'a qu'un bouton).
- [ ] **Step 3: Implémenter**
  - remplacer le span auteur par `<PostIdentityPill identity={...} meta={user.time} href={`/profil/${user.id}`} />` ;
  - ajouter `PostOptionsButton` en haut à droite + menu (Vues/Supprimer pour owner ; Signaler/Bloquer sinon) ;
  - ajouter `PostHeartButton` en bas à droite au-dessus du composer ;
  - remplacer l'input/arrow par `PostReplyComposer` ; garder `sendReply`.
- [ ] **Step 4: Persistance du like** — vérifier que le cœur appelle `onToggleLike` et que `CommunityStoriesBar.handleToggleLike` écrit dans `public.story_likes` (insert/delete, `23505`, rollback). Test :
  ```ts
  expect(source).toContain("from('story_likes')");
  expect(source).toContain('.insert({ story_id: storyId, user_id: currentUser.id })');
  expect(source).toContain(".delete()");
  ```
- [ ] **Step 5: Run** tests + `tsc` → PASS.
- [ ] **Step 6: Commit** `feat(story): pillule, options, cœur persisté et composer partagés`.

---

### Task 4: `CommunityDrawerShell` — coquille Profil 50dvh + sélecteur

**Files:**
- Create: `CommunityDrawerShell.tsx`, `DrawerCapsuleSelector.tsx`, `drawers.css`
- Modify: `CommunityDrawer.tsx` (déprécié/absorbé), `CommunitySectionsDrawer.tsx`
- Test: `tests/design/community-drawer-shell.spec.tsx`

**Interfaces:**
```ts
export function CommunityDrawerShell({
  open, onClose, ariaLabel, selector, children, footer,
}: { open: boolean; onClose: () => void; ariaLabel: string; selector: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }): JSX.Element;
export function DrawerCapsuleSelector<T extends string>({ items, value, onChange }: { items: Array<{ id: T; label: string; icon: React.ReactNode }>; value: T; onChange: (id: T) => void }): JSX.Element;
```

- [ ] **Step 1: Test rouge** — `height <= 50dvh`, `border-radius`, `selector` premier, pas de titre/croix, entrée Recherche dans le sélecteur.
- [ ] **Step 2: Implémenter**
  - surface Profil (verre .59/.49, blur 29, radius 32 pour 50dvh) ;
  - `height:50dvh; max-height:50dvh; bottom:0; left/right 8px` ;
  - drag/backdrop/Échap/focus ; `selector` en haut, body scroll.
- [ ] **Step 3: Remplacer** `CommunityDrawer` par `CommunityDrawerShell` dans le sections drawer ; `CommunityFormDrawer` sera absorbé en Task 6.
- [ ] **Step 4: Commit**.

---

### Task 5: Sections — Recherche comme sous-drawer du sélecteur

**Files:**
- Modify: `CommunitySectionsDrawer.tsx`, `CommunityTabSelector.tsx`
- Test: `tests/design/community-sections-search.spec.tsx`

- [ ] **Step 1: Test rouge**
  - sélecteur top à **5 entrées** : Recherche, Pour toi, Carnets, Clubs, Sorties ;
  - `Recherche` affiche **son propre sous-drawer** (champ + scopes + résultats) et **pas** les onglets de sections ;
  - les 4 autres affichent chacune leur sous-drawer (filtres + liste/détail) ;
  - hauteur ≤50dvh ; 6 scopes ; recherche membre (`kind:'member'`).
- [ ] **Step 2: Implémenter**
  - ajouter `'recherche'` à `SectionTabId` et `SECTION_TABS` (en première position, icône loupe) ;
  - `CommunitySectionsDrawer` switch `tab` : `recherche` → `SearchPane`, autres → leur pane ;
  - supprimer la section recherche permanente sous le sélecteur ;
  - chaque sous-drawer a son état (query/scope/filter/selected) et son scroll.
- [ ] **Step 3: Run + commit**.

### Task 6: `CreateDrawer` unique — sélecteur 6 types

**Files:**
- Create: `CreateDrawer.tsx`, `CreateFormHost.tsx`, `steps.ts`
- Modify: `CommunityCreateDrawer.tsx` (devient un simple bouton d'ouverture), `src/app/communaute/page.tsx`
- Test: `tests/design/create-drawer.spec.tsx`

**Interfaces:**
```ts
export type CreateKind = 'post' | 'carnet' | 'sortie' | 'kit' | 'club' | 'story';
export const CREATE_TABS = [
  { id: 'post', label: 'Publication', icon: 'edit' },
  { id: 'carnet', label: 'Carnet', icon: 'book-open' },
  { id: 'sortie', label: 'Sortie', icon: 'map' },
  { id: 'kit', label: 'Kit', icon: 'backpack' },
  { id: 'club', label: 'Club', icon: 'users' },
  { id: 'story', label: 'Story', icon: 'plus' },
] as const;
```

- [ ] **Step 1: Test rouge** — ouverture du `+`, 6 onglets, clic Carnet affiche le formulaire Carnet **dans le même drawer**, pas un second dialog.
- [ ] **Step 2: Implémenter**
  - `CommunityCreateDrawer` ne garde que l'ouverture (`onOpenKind`);
  - `CreateDrawer` rend `CommunityDrawerShell` avec `DrawerCapsuleSelector` ;
  - `CreateFormHost` switch le contenu ; pas de `CommunityFormDrawer`.
- [ ] **Step 3: Commit**.

---

### Task 7: `StepPager` + étapes

**Files:**
- Create: `StepPager.tsx` in `src/features/community/create/`, `steps.ts`
- Test: `tests/design/create-steps.spec.tsx`

**Interfaces:**
```ts
export interface CreateStep { id: string; label: string; }
export const CREATE_STEPS: Record<CreateKind, CreateStep[]> = {
  post: [{ id: 'format', label: 'Format' }, { id: 'content', label: 'Contenu' }, { id: 'audience', label: 'Audience' }],
  story: [{ id: 'media', label: 'Média' }, { id: 'caption', label: 'Légende' }],
  carnet: [{ id: 'infos', label: 'Infos' }, { id: 'dates', label: 'Dates' }, { id: 'visibility', label: 'Visibilité' }],
  sortie: [{ id: 'infos', label: 'Infos' }, { id: 'details', label: 'Détails' }, { id: 'people', label: 'Participants' }],
  kit: [{ id: 'identity', label: 'Identité' }, { id: 'weight', label: 'Poids' }],
  club: [{ id: 'identity', label: 'Identité' }, { id: 'about', label: 'Présentation' }, { id: 'join', label: 'Adhésion' }],
};
```

- [ ] **Step 1: Test rouge** — 3 étapes post, swipe change, mini-sélecteur bas-droite, footer Continuer/Publier.
- [ ] **Step 2: Implémenter** `StepPager` avec `LensPager`, un mini `CapsuleTabs` d'étapes en bas à droite, flèches, `aria-current`.
- [ ] **Step 3: Commit**.

---

### Task 8: Formulaires Publication + Story en étapes

**Files:**
- Create/move: `forms/PostFormContent.tsx`, `forms/StoryFormContent.tsx`
- Modify: `PostCreateForm.tsx`, `StoryCreateForm.tsx`
- Test: `tests/design/create-post-story.spec.tsx`

- [ ] **Step 1: Test rouge** — étape 1 format, étape 2 contenu, étape 3 audience, retour conserve les champs, submit appelle l'insert.
- [ ] **Step 2: Extraire** les champs/validation/submit existants en hooks ; le contenu reçoit `step`, `values`, `setValue`, `error`.
- [ ] **Step 3: Story** : média puis légende/audience ; composer/soumettre.
- [ ] **Step 4: Run tests + commit**.

---

### Task 9: Formulaires Carnet + Sortie en étapes

**Files:**
- Create/move: `forms/CarnetFormContent.tsx`, `forms/SortieFormContent.tsx`
- Test: `tests/design/create-carnet-sortie.spec.tsx`

- [ ] **Step 1: Test rouge** — champs requis par étape, validation, payload inchangé.
- [ ] **Step 2: Extraire** les champs `CarnetCreateForm`/`SortieCreateForm` dans les contenus d'étapes ; conserver les inserts/post-bridge.
- [ ] **Step 3: Run + commit**.

---

### Task 10: Formulaires Kit + Club en étapes

**Files:**
- Create/move: `forms/KitFormContent.tsx`, `forms/ClubFormContent.tsx`
- Test: `tests/design/create-kit-club.spec.tsx`

- [ ] **Step 1: Test rouge** — étapes, validation, submit.
- [ ] **Step 2: Extraire** les champs existants ; conserver `materiel_kits`/`clubs`/`club_members`/post.
- [ ] **Step 3: Run + commit**.

---

### Task 11: Footer et comportements du CreateDrawer

**Files:**
- Modify: `CreateDrawer.tsx`, `StepPager.tsx`, `drawers.css`
- Test: `tests/design/create-drawer-behaviour.spec.tsx`

- [ ] **Step 1: Test rouge** — footer désactivé pendant submit, libellé Continuer puis action finale, swipe, fermeture, reset au changement de type.
- [ ] **Step 2: Implémenter** le footer ; `onSubmit` du formulaire actif ; toast/refresh ; fermer après succès.
- [ ] **Step 3: Commit**.

---

### Task 12: Visual, E2E, build, déploiement

**Files:**
- Create: `tests/visual/story-drawers-forms.spec.ts`, `tests/e2e/story-drawers-forms.spec.ts`
- Modifier: docs/RAPPORT.

- [ ] **Step 1: Lancer**

```bash
npm run type-check
npx vitest run tests/design/post-reply-composer.spec.tsx tests/design/post-shared-actions.spec.tsx tests/design/stories-viewer-clean.spec.tsx tests/design/community-drawer-shell.spec.tsx tests/design/create-steps.spec.tsx
npx playwright test tests/e2e/story-drawers-forms.spec.ts --config=playwright.config.ts --project=mobile-chromium
npx playwright test tests/visual/story-drawers-forms.spec.ts --config=playwright.visual.config.ts
npm run build
```

- [ ] **Step 2: Vérifier** 50dvh, sélecteurs, pillule/link, composer identique, 3 boutons story, 6 types, étapes, résultats.
- [ ] **Step 3: Captures 430/768/1440, commit, déploiement.**

---

## Auto-contrôle

- [ ] Story : pillule lien, `···`, cœur **persisté story_likes**, composer partagé, aucun autre bouton.
- [ ] Drawers : 50dvh max, sélecteur top, pas de titre/croix, drag.
- [ ] Recherche : **sous-drawer du sélecteur**, 6 scopes, 5 types distinctifs, pas de recherche sous les onglets.
- [ ] Création : un seul drawer, 6 types, formulaire en place, étapes + mini-sélecteur + swipe + footer.
- [ ] Aucune migration/secret.
- [ ] Tests, build, captures.
