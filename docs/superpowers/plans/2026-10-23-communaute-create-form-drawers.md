# Communauté — drawers de création : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer les liens du drawer `+` par des formulaires en drawer pour créer une publication
(photo/billet/question/événement), une story, un carnet, une sortie GPS, un kit et un club.

**Architecture:** un shell `CommunityFormDrawer` à 76dvh sans en-tête (forme du drawer Profil), des
formulaires contrôlés avec validation et footer collant, un `post-bridge` qui ajoute le post lié
dans `community_posts`, et un hub `CommunityCreateDrawer` qui ne fait plus qu'ouvrir le bon
formulaire.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind, Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-communaute-create-form-drawers-design.md`

## Global Constraints

- Aucune migration, aucune nouvelle table, aucune nouvelle colonne.
- `post_type` reste `post | tip | question | share` ; un événement est publié en `share`.
- Aucune nouvelle couleur : verre du Compte, `#17402C`, `#56665D`, `#E0245E`.
- Le hub de création reste à **50dvh** ; les formulaires à **76dvh**.
- Aucun en-tête, aucune croix : poignée, footer, fermeture backdrop/Échap/glissement.
- Les inserts liés sont séquentiels ; un échec de post ne supprime pas la ressource.
- `prefers-reduced-motion` respecté ; cibles 44 px ; labels accessibles.
- Chaque tâche : test d'abord, test rouge, implémentation, test vert, commit.
- Aucune régression du feed v3 (swipe, panneaux, sections, messagerie).

---

## Structure des fichiers

```
src/features/community/create/
  CommunityFormDrawer.tsx
  CreateFormProvider.tsx
  useCreateForm.ts
  form-fields.tsx
  PostCreateForm.tsx
  StoryCreateForm.tsx
  CarnetCreateForm.tsx
  SortieCreateForm.tsx
  KitCreateForm.tsx
  ClubCreateForm.tsx
  upload.ts
  post-bridge.ts
  __tests__/
    CommunityFormDrawer.test.tsx
    useCreateForm.test.ts
    PostCreateForm.test.tsx
    StoryCreateForm.test.tsx
    CarnetCreateForm.test.tsx
    SortieCreateForm.test.tsx
    KitCreateForm.test.tsx
    ClubCreateForm.test.tsx
src/features/community/feed/CommunityCreateDrawer.tsx   (modifié)
src/app/communaute/page.tsx                            (modifié)
src/styles/community-feed.css                          (complété)
```

Le code du formulaire de publication existe encore dans l'historique Git :
`git show 3c8ae297^:src/app/communaute/publier/page.tsx`. On en reprend les règles de validation,
l'audience, l'upload et les payloads, pas le rendu complet.

---

### Task 1: Baseline et récupération du composeur

**Files:**
- Read: `git show 3c8ae297^:src/app/communaute/publier/page.tsx`
- Create: `docs/communaute/create-forms-baseline.md`

- [ ] **Step 1: Vérifier la branche et les tests**

```bash
git status --short | head
npx vitest run tests/design/community-feed-contract.spec.ts
```

- [ ] **Step 2: Extraire les règles réutilisables**

```bash
git show 3c8ae297^:src/app/communaute/publier/page.tsx > /tmp/old-publier.tsx
grep -n "POST_TYPES\|AUDIENCES\|handlePublish\|uploadPublicationPhoto\|post_type" /tmp/old-publier.tsx
```

Documenter dans `docs/communaute/create-forms-baseline.md` : types, audiences, champs, validation,
règle médias privés, payload.

- [ ] **Step 3: Commit**

```bash
git add docs/communaute/create-forms-baseline.md
git commit -m "docs(communaute): baseline des formulaires de creation"
```

---

### Task 2: `CommunityFormDrawer` (76dvh, sans en-tête)

**Files:**
- Create: `src/features/community/create/CommunityFormDrawer.tsx`
- Test: `src/features/community/create/__tests__/CommunityFormDrawer.test.tsx`

**Interfaces:**
- `<CommunityFormDrawer open onClose footer busy error>{children}</CommunityFormDrawer>`
- `role="dialog"`, `aria-modal`, `data-testid="community-form-drawer"`, `max-height:76dvh`.
- Poignée, drag-to-dismiss > 90 px, backdrop, Échap, focus premier champ.

- [ ] **Step 1: Test**

```tsx
it('ouvre un formulaire 76dvh sans titre ni croix', () => {
  render(<CommunityFormDrawer open onClose={vi.fn()} footer={<button>Publier</button>}><input aria-label="Titre" /></CommunityFormDrawer>);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('data-testid', 'community-form-drawer');
  expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Publier' })).toBeVisible();
});
```

- [ ] **Step 2: Implémenter** avec portail, `lkdv-form-drawer` 76dvh, footer sticky, drag.
- [ ] **Step 3: Vérifier + commit**

`npx vitest run src/features/community/create/__tests__/CommunityFormDrawer.test.tsx` → PASS.

---

### Task 3: `useCreateForm` + primitives

**Files:**
- Create: `src/features/community/create/useCreateForm.ts`, `form-fields.tsx`
- Test: `src/features/community/create/__tests__/useCreateForm.test.ts`

**Interfaces:**
- `useCreateForm<T>({ initial, validate, submit })` →
  `{ values, setValue, errors, busy, submitError, canSubmit, submit, reset }`.
- `validate(values) => Record<string,string> | null`.
- `submit(values) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>`.

- [ ] **Step 1: Test** — validation bloque, `submit` appelé une fois, erreur conservée,
  succès remonte `id`.
- [ ] **Step 2: Implémenter** — état contrôlé, `busy`, `errors`, `submitError`.
- [ ] **Step 3: Commit**

---

### Task 4: Formulaire Publication — photo / billet / question

**Files:**
- Create: `src/features/community/create/PostCreateForm.tsx`
- Test: `src/features/community/create/__tests__/PostCreateForm.test.tsx`

**Interfaces:**
- Types : `photo`, `billet`, `question` ; onglets accessibles.
- Champs : `title`, `content`, `photos`, `audience`, `clubId`, `location`, `tags`,
  `linkedCarnetId`, `linkedKitId`.
- Payload :
  ```ts
  {
    author_id: user.id,
    title: title.trim() || null,
    content: fullContent,
    post_type: type === 'question' ? 'question' : 'post',
    audience,
    club_id: audience === 'club' ? clubId : null,
    location: location.trim() || null,
    tags,
    linked_carnet_id: linkedCarnetId || null,
    linked_kit_id: linkedKitId || null,
    media_urls: mediaUrls,
    image_url: mediaUrls[0] ?? null,
  }
  ```

- [ ] **Step 1: Test** — photo sans média → erreur ; billet sans titre → erreur ; question publie
  `post_type='question'` ; audience club sans club → erreur ; payload correct.
- [ ] **Step 2: Implémenter** — onglets, champs, validation, upload (Task 5), submit.
- [ ] **Step 3: Commit**

---

### Task 5: Upload média + audience

**Files:**
- Create: `src/features/community/create/upload.ts`
- Test: `src/features/community/create/__tests__/upload.test.ts`

**Interfaces:**
- `uploadPostMedia(files, userId, audience) => Promise<string[]>`.
- Public : bucket `carnet-media`, URLs publiques ; privé : refus si média (règle existante).
- `stripImageMetadata` avant upload ; 10 fichiers max ; types image/vidéo.

- [ ] **Step 1: Test** — audience privée + fichier → refus ; 11 fichiers → refus ; type invalide → refus.
- [ ] **Step 2: Implémenter** en réutilisant le code de l'ancien composeur.
- [ ] **Step 3: Commit**

---

### Task 6: Variante Événement

**Files:**
- Modify: `PostCreateForm.tsx`
- Test: `PostCreateForm.test.tsx`

- [ ] **Step 1: Test** — type événement : date/lieu requis ; insert `events` puis post `share` ;
  le post contient le titre, la date, le lieu et le lien `/evenements`.
- [ ] **Step 2: Implémenter** — champs event (date, durée, lieu, max, cover, cagnotte) ;
  `events.insert` avec `organizer_id`, `status='upcoming'`, `current_participants=0` ;
  puis `community_posts` `post_type='share'`.
- [ ] **Step 3: Commit**

---

### Task 7: Formulaire Story

**Files:**
- Create: `StoryCreateForm.tsx`
- Test: `StoryCreateForm.test.tsx`

**Interfaces:**
- Média (1 à 10), légende 280, audience `public|abonnies|only_me`.
- Réutilise l'upload `stories-private` et `post_stories` (extraire `publishStory` du
  `CommunityStoriesBar` dans un helper partagé).

- [ ] **Step 1: Test** — sans média → erreur ; audience ; légende > 280 tronquée/refusée ;
  succès remonte l'id.
- [ ] **Step 2: Implémenter** — sélecteur natif, aperçu, upload, insert.
- [ ] **Step 3: Commit**

---

### Task 8: Formulaire Carnet + post lié

**Files:**
- Create: `CarnetCreateForm.tsx`, `post-bridge.ts`
- Test: `CarnetCreateForm.test.tsx`

- [ ] **Step 1: Test** — titre/destination requis ; payload `carnets` exact ; post
  `post_type='share'`, `linked_carnet_id`, cover, audience selon visibilité.
- [ ] **Step 2: Implémenter** — champs rapides ; lien « Ouvrir l'éditeur complet »
  `/carnets/nouveau` ; après succès, `onCreated('carnet', id)`.
- [ ] **Step 3: Commit**

---

### Task 9: Formulaire Sortie GPS

**Files:**
- Create: `SortieCreateForm.tsx`
- Test: `SortieCreateForm.test.tsx`

- [ ] **Step 1: Test** — titre/date requis ; `events.insert` avec `organizer_id`, `status`,
  `current_participants` ; post `share` avec lien `/evenements`.
- [ ] **Step 2: Implémenter** — champs date/durée/lieu/max/description/cover.
- [ ] **Step 3: Commit**

---

### Task 10: Formulaire Kit

**Files:**
- Create: `KitCreateForm.tsx`
- Test: `KitCreateForm.test.tsx`

- [ ] **Step 1: Test** — nom requis ; payload `materiel_kits` (`user_id`, `is_public`) ;
  post `share` avec `linked_kit_id`.
- [ ] **Step 2: Implémenter** — nom/catégorie/poids/description/visibilité.
- [ ] **Step 3: Commit**

---

### Task 11: Formulaire Club

**Files:**
- Create: `ClubCreateForm.tsx`
- Test: `ClubCreateForm.test.tsx`

- [ ] **Step 1: Test** — nom requis ; slug généré ; `clubs.insert` + `club_members` admin ;
  post `share` `audience='club'` + `club_id` ; échec du post → club conservé + message.
- [ ] **Step 2: Implémenter** — nom/catégorie/description/cover/lieu/visibilité/règles.
- [ ] **Step 3: Commit**

---

### Task 12: Brancher le hub de création

**Files:**
- Modify: `src/features/community/feed/CommunityCreateDrawer.tsx`,
  `src/app/communaute/page.tsx`
- Test: `src/features/community/feed/__tests__/CommunityCreateDrawer.test.tsx`,
  `tests/e2e/community-create-forms.spec.ts`

**Interfaces:**
- Le hub a 6 tuiles : Publication, Carnet, Sortie GPS, Kit, Club, Story.
- Chaque tuile appelle `onOpenForm(kind)` ; le hub se ferme ; `CommunityFormDrawer` s'ouvre.
- `onCreated` : toast, fermeture, `refresh()` du feed et des sections.

- [ ] **Step 1: Test** — 6 tuiles, aucune navigation, ouverture du bon formulaire, succès rafraîchit.
- [ ] **Step 2: Implémenter** le provider et le câblage page.
- [ ] **Step 3: Commit**

---

### Task 13: Tests visuels, e2e, build, rapport

**Files:**
- Create: `tests/visual/community-create-forms.spec.ts`,
  `docs/communaute/RAPPORT-CREATE-FORMS.md`

- [ ] **Step 1: Lancer**

```bash
npm run type-check
npx vitest run src/features/community/create tests/design/community-feed-contract.spec.ts
npx playwright test tests/e2e/community-create-forms.spec.ts --config=playwright.config.ts --project=mobile-chromium
npx playwright test tests/visual/community-create-forms.spec.ts --config=playwright.visual.config.ts
npm run build
```

- [ ] **Step 2: Vérifier** 6 formulaires, footer, validation, upload, post créé, 0 erreur console.
- [ ] **Step 3: Captures** 430/768/1440, chaque formulaire.
- [ ] **Step 4: Rédiger le rapport et commit.**

---

## Auto-contrôle

- [ ] Chaque formulaire de la spec a une tâche.
- [ ] Aucune migration.
- [ ] 6 tuiles, aucun lien de navigation.
- [ ] Footer collant et validation testés.
- [ ] Post lié pour carnet/kit/club/événement.
- [ ] Story réutilise l'upload existant.
- [ ] `post_type='share'` pour les événements.
- [ ] Tests, build, captures.
