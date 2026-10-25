# Formulaires de création — 20 améliorations par formulaire : plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer un socle de formulaire partagé puis 20 améliorations visuelles, techniques et fonctionnelles pour chacun des six formulaires de création.

**Architecture:** React Hook Form + Zod pour l’état/validation, un `StepPager` commun basé sur `LensPager`, des contrôles partagés (média, lieu, dates, chips, combobox, stepper), un brouillon local et un aperçu réel. Chaque formulaire reste un sous-drawer du `CreateDrawer`.

**Tech Stack:** React 19, TypeScript strict, React Hook Form, Zod, Radix/shadcn patterns, Vaul/LensPager, react-dropzone, dnd-kit, react-day-picker, cmdk, Sonner, vinext/Cloudflare.

**Spec:** `docs/superpowers/specs/2026-10-25-creation-forms-ux-design.md`

## Global Constraints

- Cible : Cloudflare Workers, worktree `/Users/fr168256/Desktop/lkdv-cloudflare`, branche `cloudflare/vinext`.
- Aucun déploiement Vercel.
- Drawer création : `406×466`, formulaire scrollable, footer `69 px`.
- 20 améliorations par formulaire, P0 obligatoire.
- Pas de perte de saisie : brouillon local versionné.
- Médias : upload réel, plus d’URL brute pour Carnet/Sortie/Kit/Club.
- Tests avant implémentation ; un commit par tâche.

---

## Structure

```
src/features/community/create/
  engine/CreateFormEngine.tsx
  engine/createSchemas.ts
  engine/useCreateDraft.ts
  shared/StepPager.tsx
  shared/MediaPicker.tsx
  shared/LocationCombobox.tsx
  shared/DateRangeField.tsx
  shared/TagChips.tsx
  shared/NumberStepper.tsx
  shared/FormPreview.tsx
  shared/FormErrorSummary.tsx
  forms/PostFormContent.tsx
  forms/StoryFormContent.tsx
  forms/CarnetFormContent.tsx
  forms/SortieFormContent.tsx
  forms/KitFormContent.tsx
  forms/ClubFormContent.tsx
  CreateDrawer.tsx
  CreateFormHost.tsx
```

---

### Task 1: Moteur de formulaire + schémas Zod

**Files:**
- Create: `src/features/community/create/engine/createSchemas.ts`
- Create: `src/features/community/create/engine/CreateFormEngine.tsx`
- Test: `tests/design/create-form-engine.spec.tsx`
- Modify: `package.json` (`react-hook-form`, `@hookform/resolvers` si absents)

**Interfaces:**
```ts
export type CreateKind = 'post' | 'story' | 'carnet' | 'sortie' | 'kit' | 'club';
export const createSchemas: Record<CreateKind, z.ZodTypeAny>;
export function CreateFormEngine<T extends FieldValues>({ kind, defaultValues, onSubmit, children }: {
  kind: CreateKind;
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => Promise<void>;
  children: (form: UseFormReturn<T>) => React.ReactNode;
}): JSX.Element;
```

- [ ] **Step 1: Test rouge**

```tsx
it('refuse une sortie sans date future', async () => {
  const result = createSchemas.sortie.safeParse({ title: 'Lac Blanc', date: '2020-01-01' });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/design/create-form-engine.spec.tsx` → FAIL.
- [ ] **Step 3: Écrire les schémas** avec messages français, `.superRefine` pour dates/URLs/poids.
- [ ] **Step 4: Écrire `CreateFormEngine`** avec `useForm`, `zodResolver`, mode `onTouched`.
- [ ] **Step 5: Run** → PASS ; commit `feat(create): moteur de formulaire Zod`.

---

### Task 2: StepPager commun aux six types

**Files:**
- Create: `shared/StepPager.tsx`
- Modify: `CreateDrawer.tsx`, `CreateFormHost.tsx`
- Test: `tests/design/create-step-pager.spec.tsx`

**Interfaces:**
```ts
export interface CreateStep { id: string; label: string; }
export function StepPager({ steps, index, onIndexChange }: {
  steps: CreateStep[]; index: number; onIndexChange: (index: number) => void;
}): JSX.Element;
```

- [ ] **Step 1: Test rouge** — 6 types exposent au moins 2 étapes ; swipe change ; footer Continuer.
- [ ] **Step 2: Implémenter** avec `LensPager` + mini `CapsuleTabs` en bas à droite.
- [ ] **Step 3: Brancher** Publication (3), Story (2), Carnet (3), Sortie (3), Kit (2), Club (3).
- [ ] **Step 4: Run** + commit.

---

### Task 3: MediaPicker partagé

**Files:**
- Create: `shared/MediaPicker.tsx`
- Test: `tests/design/create-media-picker.spec.tsx`
- Use: `react-dropzone`, Supabase Storage existant.

**Interfaces:**
```ts
export function MediaPicker({ value, onChange, max, accept, label }: {
  value: MediaItem[]; onChange: (items: MediaItem[]) => void;
  max: number; accept: string; label: string;
}): JSX.Element;
```

- [ ] **Step 1: Test rouge** — drag/drop, preview, alt, cover, suppression, upload retry.
- [ ] **Step 2: Implémenter** upload + progression + validation taille/type.
- [ ] **Step 3: Remplacer** les champs `Cover (URL)` et `MediaInput` des formulaires.
- [ ] **Step 4: Commit**.

---

### Task 4: Contrôles partagés

**Files:**
- Create: `shared/LocationCombobox.tsx`, `DateRangeField.tsx`, `TagChips.tsx`, `NumberStepper.tsx`, `FormErrorSummary.tsx`
- Test: `tests/design/create-controls.spec.tsx`

- [ ] **Step 1: Test rouge** — combobox clavier, plage de dates, chips, stepper, résumé d’erreurs cliquable.
- [ ] **Step 2: Implémenter** avec cmdk/Radix, react-day-picker, ARIA.
- [ ] **Step 3: Commit**.

---

### Task 5: Publication

**Files:**
- Create: `forms/PostFormContent.tsx`
- Modify: `PostCreateForm.tsx`
- Test: `tests/design/create-post.spec.tsx`

- [ ] **Step 1: Test rouge** — type, média, titre, texte, lieu, tags, audience, club, événement.
- [ ] **Step 2: Brancher** le moteur, StepPager, MediaPicker, combobox lieu, chips, stepper participants.
- [ ] **Step 3: Aperçu** carte feed + validation par étape.
- [ ] **Step 4: Run** + commit.

---

### Task 6: Story

**Files:**
- Create: `forms/StoryFormContent.tsx`
- Modify: `StoryCreateForm.tsx`
- Test: `tests/design/create-story.spec.tsx`

- [ ] **Step 1: Test rouge** — média 9:16, légende, audience, reply policy, 2 étapes.
- [ ] **Step 2: Brancher** MediaPicker, preview, overlays texte, upload progress.
- [ ] **Step 3: Run** + commit.

---

### Task 7: Carnet

**Files:**
- Create: `forms/CarnetFormContent.tsx`
- Modify: `CarnetCreateForm.tsx`
- Test: `tests/design/create-carnet.spec.tsx`

- [ ] **Step 1: Test rouge** — dates cohérentes, cover upload, visibilité, 3 étapes.
- [ ] **Step 2: Brancher** DateRangeField, MediaPicker, combobox destination, preview.
- [ ] **Step 3: Run** + commit.

---

### Task 8: Sortie

**Files:**
- Create: `forms/SortieFormContent.tsx`
- Modify: `SortieCreateForm.tsx`
- Test: `tests/design/create-sortie.spec.tsx`

- [ ] **Step 1: Test rouge** — date future, lieu, niveau, participants, cover, 3 étapes.
- [ ] **Step 2: Brancher** DateRangeField, LocationCombobox, NumberStepper, MediaPicker.
- [ ] **Step 3: Run** + commit.

---

### Task 9: Kit

**Files:**
- Create: `forms/KitFormContent.tsx`
- Modify: `KitCreateForm.tsx`
- Test: `tests/design/create-kit.spec.tsx`

- [ ] **Step 1: Test rouge** — nom, saison, poids > 0, items réordonnables, total, 2 étapes.
- [ ] **Step 2: Brancher** dnd-kit, NumberStepper, MediaPicker, preview.
- [ ] **Step 3: Run** + commit.

---

### Task 10: Club

**Files:**
- Create: `forms/ClubFormContent.tsx`
- Modify: `ClubCreateForm.tsx`
- Test: `tests/design/create-club.spec.tsx`

- [ ] **Step 1: Test rouge** — nom, catégorie, lieu, cover, confidentialité, 3 étapes.
- [ ] **Step 2: Brancher** combobox, MediaPicker, preview, invitation link.
- [ ] **Step 3: Run** + commit.

---

### Task 11: Brouillon, aperçu, toasts, accessibilité

**Files:**
- Create: `engine/useCreateDraft.ts`, `shared/FormPreview.tsx`
- Modify: all forms
- Test: `tests/design/create-draft.spec.tsx`, `tests/e2e/create-accessibility.spec.ts`

- [ ] **Step 1: Test rouge** — fermeture/restauration du brouillon, aperçu, toast undo, focus/ARIA.
- [ ] **Step 2: Implémenter** localStorage versionné, Sonner, `aria-describedby`, `prefers-reduced-motion`.
- [ ] **Step 3: Run** + commit.

---

### Task 12: Recette visuelle, E2E, déploiement Cloudflare

- [ ] **Step 1: Lancer**

```bash
cd /Users/fr168256/Desktop/lkdv-cloudflare
npx tsc --noEmit
npx vitest run tests/design/create-*.spec.tsx
npx playwright test tests/e2e/create-*.spec.ts --project=mobile-chromium
npm run deploy:vinext
```

- [ ] **Step 2: Capturer** les 6 sous-drawers + étapes.
- [ ] **Step 3: Vérifier** scroll, footer, clavier, brouillon, upload, erreurs.
- [ ] **Step 4: Commit final.**

---

## Auto-contrôle

- [ ] 20 améliorations par formulaire couvertes par la spec.
- [ ] P0 complet : moteur, étapes, média, lieu/dates, brouillon, aperçu.
- [ ] Aucune URL brute pour les covers.
- [ ] Aucun contenu sous le footer sans scroll.
- [ ] Tests visuels/E2E et build Cloudflare.
