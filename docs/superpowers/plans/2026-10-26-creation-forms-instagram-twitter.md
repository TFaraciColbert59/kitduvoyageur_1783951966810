# Création de contenu v2 — implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer six formulaires de création inspirés d’Instagram/X, avec inventaire Kit, carnet structuré, sorties et clubs, sans titre/sous-titre/label de structure visible.

**Architecture:** conserver `CreateFormEngine` (RHF + Zod), `StepPager`, `MediaPicker` et les contrôles partagés ; ajouter `InventoryPicker`, `KitCompletion`, `StageEditor`, `RouteField`, `RegistrationEditor`, `ClubRulesEditor`. Les migrations sont additives et compatibles avec les données existantes.

**Tech Stack:** React 19, TypeScript, React Hook Form, Zod, dnd-kit, react-dropzone, Supabase/Postgres, vinext/Cloudflare.

**Spec:** `docs/superpowers/specs/2026-10-26-creation-forms-instagram-twitter-design.md`

## Global Constraints

- Aucun titre, sous-titre ou libellé de structure visible ; `aria-label` obligatoire.
- Aucun fichier Compte modifié.
- Migrations additives uniquement ; RLS sur chaque nouvelle table.
- 44×44 minimum, contraste 4.5:1, textes ≥12 px.
- Une seule couche de blur par feuille ; reduced-motion.
- Tests avant implémentation ; un commit par tâche.
- Déploiement Cloudflare uniquement.

---

## Task 1: Migrations et types de création

**Files:**
- Create: `supabase/migrations/20261026100000_creation_forms_v2.sql`
- Create: `src/features/community/create/types.ts`
- Test: `tests/design/create-migrations.spec.ts`

**Interfaces:**
```ts
export type KitTemplateId = 'day' | 'bivouac' | 'alpine' | 'ski' | 'bike' | 'water';
export interface InventoryItem { id: string; name: string; photoUrl?: string | null; wearPercent?: number | null; weightG?: number | null; category?: string | null; }
export interface KitItemDraft { gearItemId?: string | null; name: string; category: string; weightG: number; quantity: number; worn: boolean; consumable: boolean; essential: boolean; photoUrl?: string | null; }
```

- [ ] **Step 1: Test rouge** — les colonnes/tables existent dans la migration.

```ts
it('ajoute les tables et colonnes additives', () => {
  const sql = readFileSync('supabase/migrations/20261026100000_creation_forms_v2.sql', 'utf8');
  for (const token of ['carnet_stages', 'community_outings', 'community_outing_registrations', 'club_join_requests', 'gear_item_id', 'worn_weight_g']) {
    expect(sql).toContain(token);
  }
});
```

- [ ] **Step 2: Run** `npx vitest run tests/design/create-migrations.spec.ts` → FAIL.
- [ ] **Step 3: Écrire la migration** :
  - `carnet_stages(id, carnet_id, day, title, start_place, end_place, distance_km, ascent_m, difficulty, kind, notes, sort_order)`.
  - `community_outings(id, organizer_id, club_id, title, activity, description, start_at, timezone, duration, meeting_point, destination, route_geojson, distance_km, ascent_m, difficulty, max_participants, waitlist_enabled, registration_deadline, price_cents, visibility, cover_image, created_at)`.
  - `community_outing_registrations(id, outing_id, user_id, status, answers jsonb, created_at)`.
  - `club_join_requests(id, club_id, user_id, answers jsonb, status, created_at)`.
  - `alter table kits add template_id text, base_weight_g int, worn_weight_g int, consumable_weight_g int, visibility text default 'private', cloneable boolean default true`.
  - `alter table kit_items add gear_item_id uuid references gear_items(id), worn boolean default false, consumable boolean default false, shared boolean default false, photo_url text`.
  - `alter table clubs add rules text, join_mode text default 'open', join_questions jsonb default '[]', member_limit int, welcome_post text, logo_image text`.
  - RLS : lecture publique selon visibilité ; écriture owner.
- [ ] **Step 4: Run test** → PASS ; commit.

---

## Task 2: InventoryPicker + KitCompletion

**Files:**
- Create: `src/features/community/create/inventory/InventoryPicker.tsx`
- Create: `src/features/community/create/inventory/kitCompletion.ts`
- Create: `src/features/community/create/inventory/inventory.css`
- Test: `tests/design/create-inventory-picker.spec.tsx`

**Interfaces:**
```ts
export function InventoryPicker(props: {
  items: InventoryItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCustomItem: (item: KitItemDraft) => void;
}): JSX.Element;
export function suggestKitCompletion(input: {
  selected: KitItemDraft[];
  template: KitTemplateId;
}): Array<{ category: string; reason: string; suggestedName: string }>;
```

- [ ] **Step 1: Test rouge** — sélection, désélection, usure, total poids, suggestion d’un manque.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implémenter** liste scrollable avec photo/nom/usure uniquement, 44×44, recherche, filtres, sélection, total.
- [ ] **Step 4: KitCompletion** : templates et catégories requises ; renvoie les manques.
- [ ] **Step 5: Run** → PASS ; commit.

---

## Task 3: MediaStudio + Post (4 étapes)

**Files:**
- Create: `src/features/community/create/media/MediaStudio.tsx`
- Modify: `src/features/community/create/PostCreateForm.tsx`
- Modify: `src/features/community/create/engine/createSchemas.ts`
- Test: `tests/design/create-post-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — formats, médias, alt, lieu, tags, audience, options.
- [ ] **Step 2: Implémenter** MediaStudio (1–10, ordre, cover, alt, crop).
- [ ] **Step 3: Brancher** 4 étapes : Format / Médias / Détails / Aperçu.
- [ ] **Step 4: Ajouter** sondage 2–4 options, événement conditionnel, commentaires on/off, likes masqués, planification.
- [ ] **Step 5: Run** + commit.

---

## Task 4: Story (3 étapes)

**Files:**
- Modify: `src/features/community/create/StoryCreateForm.tsx`
- Create: `src/features/community/create/story/OverlayEditor.tsx`
- Test: `tests/design/create-story-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — média, overlay, audience, reply policy.
- [ ] **Step 2: Implémenter** overlay texte/mention/lieu/lien, trim, cover.
- [ ] **Step 3: Brancher** 3 étapes ; upload privé + progression.
- [ ] **Step 4: Run** + commit.

---

## Task 5: Kit (4 étapes)

**Files:**
- Modify: `src/features/community/create/KitCreateForm.tsx`
- Create: `src/features/community/create/kit/KitStructureEditor.tsx`
- Test: `tests/design/create-kit-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — inventaire, complétion, structure, partage.
- [ ] **Step 2: Étape 1** InventoryPicker.
- [ ] **Step 3: Étape 2** suggestions + custom items + essentiel/porté/consommable.
- [ ] **Step 4: Étape 3** dnd-kit, totaux base/porté/consommable, objectif.
- [ ] **Step 5: Étape 4** nom, cover, visibilité, cloneable, aperçu.
- [ ] **Step 6: Run** + commit.

---

## Task 6: Carnet (5 étapes)

**Files:**
- Modify: `src/features/community/create/CarnetCreateForm.tsx`
- Create: `src/features/community/create/carnet/StageEditor.tsx`
- Create: `src/features/community/create/carnet/LogisticsEditor.tsx`
- Test: `tests/design/create-carnet-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — identité, étapes, logistique, récit, partage.
- [ ] **Step 2: Identité** titre/destination/dates/cover/visibilité.
- [ ] **Step 3: StageEditor** jours, départ/arrivée, distance, D+, difficulté, type.
- [ ] **Step 4: Logistique** budget, kit, matériel, eau/nourriture, permis, météo, urgences.
- [ ] **Step 5: Récit** moments/photos/citations.
- [ ] **Step 6: Partage** collaborateurs, commentaires, visibilité.
- [ ] **Step 7: Run** + commit.

---

## Task 7: Sortie (4 étapes)

**Files:**
- Modify: `src/features/community/create/SortieCreateForm.tsx`
- Create: `src/features/community/create/outing/RouteField.tsx`
- Create: `src/features/community/create/outing/RegistrationEditor.tsx`
- Test: `tests/design/create-sortie-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — type, date future, itinéraire, participants, sécurité.
- [ ] **Step 2: Étape 1** type/lieu/date/fuseau/visibilité.
- [ ] **Step 3: Étape 2** GPX/carte, distance, D+, difficulté, dangers.
- [ ] **Step 4: Étape 3** max, waitlist, deadline, approbation, prix, questions.
- [ ] **Step 5: Étape 4** sécurité, cover, aperçu, publier.
- [ ] **Step 6: Run** + commit.

---

## Task 8: Club (4 étapes)

**Files:**
- Modify: `src/features/community/create/ClubCreateForm.tsx`
- Create: `src/features/community/create/club/ClubRulesEditor.tsx`
- Test: `tests/design/create-club-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — identité, univers, adhésion, publication.
- [ ] **Step 2: Identité** nom/slug/catégorie/lieu/cover/logo.
- [ ] **Step 3: Univers** purpose/règles/tags/kit/post d’accueil.
- [ ] **Step 4: Adhésion** privacy/join mode/questions/rôles/invite.
- [ ] **Step 5: Aperçu** + commit.

---

## Task 9: Brouillon, aperçu, publication

**Files:**
- Modify: `src/features/community/create/engine/useCreateDraft.ts`
- Modify: `src/features/community/create/shared/FormPreview.tsx`
- Test: `tests/design/create-publish-v2.spec.tsx`

- [ ] **Step 1: Test rouge** — brouillon multi-étapes, preview, publish payload.
- [ ] **Step 2: Étendre** le brouillon aux nouveaux champs et aux étapes.
- [ ] **Step 3: Preview** réel par formulaire.
- [ ] **Step 4: Publish** atomique + toast/undo.
- [ ] **Step 5: Run** + commit.

---

## Task 10: Accessibilité, performance, tests

- [ ] **Step 1** tests focus/Échap/inert, 44×44, labels aria.
- [ ] **Step 2** images lazy/dimensions, virtualisation inventaire, reduced-motion.
- [ ] **Step 3** `npx tsc --noEmit`, `npx vitest run tests/design/create-*.spec.tsx`.
- [ ] **Step 4** commit.

---

## Task 11: Recette visuelle

- [ ] **Step 1** captures 430/768/1440 des 6 formulaires et étapes.
- [ ] **Step 2** vérifier empty/loading/error, clavier, brouillon.
- [ ] **Step 3** commit captures/docs.

---

## Task 12: Déploiement

- [ ] **Step 1** `npm run build:vinext`.
- [ ] **Step 2** `npx vinext-cloudflare deploy`.
- [ ] **Step 3** smoke `/communaute`, capture prod.
- [ ] **Step 4** commit final.

---

## Auto-contrôle

- [ ] 6 formulaires, toutes les étapes.
- [ ] Kit inventaire photo/nom/usure + complétion + partage.
- [ ] Carnet itinéraire/logistique/récit/partage.
- [ ] Sortie inscription/waitlist.
- [ ] Club adhésion/invitations.
- [ ] Aucun titre/sous-titre/label de structure.
- [ ] Aucun fichier Compte.
