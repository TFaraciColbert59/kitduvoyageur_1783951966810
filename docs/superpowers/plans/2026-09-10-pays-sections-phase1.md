# Page Pays — Phase 1 : Socle des 4 sections (Implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Poser un socle partagé (registre + mapper + hook + composants + états) pour que Présentation, Destinations, Activités & Treks et Culture & Société consomment les blocs IA pays réels + les données partenaires existantes, desktop et mobile, sans données fictives.

**Architecture:** `src/features/pays/` expose un registre unique des 4 sections, un mapper `ContentBlockRecord → SectionContent`, un hook `useSectionContent` (wrap `useCountryPracticalGuide`) et des composants de rendu/états. Les vues Pays et `MobileCountryDetailView` consomment ce socle ; les cartes partenaires (Viator/Klook) restent inchangées.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TanStack Query (existant), Vitest, Tailwind `glass`.

**Spec:** `docs/superpowers/specs/2026-09-10-pays-4-sections-design.md`

## Global Constraints
- Aucune nouvelle table Supabase ; aucune donnée fictive.
- Ne pas refondre Gastronomie / Hébergements / Pratique / Communauté / header / compte / matériel.
- Secrets serveur uniquement ; aucun `NEXT_PUBLIC_*` sensible.
- Mobile prioritaire, cibles tactiles ≥ 44×44, états explicites.
- `tsc` 0 · `vitest` vert · `lint` 0. Pas de `npm run build` avec `next dev` actif.

---

### Task 1 : Registre + types
- [ ] Créer `src/features/pays/types.ts` (`PaysSectionId`, `PaysSectionDef`, `SectionBlock`, `SectionContent`).
- [ ] Créer `src/features/pays/registry/paysSectionRegistry.ts` (4 sections, blocs IA, partenaire).
- [ ] Test `tests/features/pays/registry.spec.ts` (les 4 sections, blocs non vides, lookup).

### Task 2 : Mapper
- [ ] Créer `src/features/pays/mappers/contentBlockToSection.ts` (`toSectionBlock`, `buildSectionContent`).
- [ ] Test `tests/features/pays/mapper.spec.ts` (fixtures `BlockGuideData`, hasContent, ordre, sources).

### Task 3 : Hook
- [ ] Créer `src/features/pays/hooks/useSectionContent.ts` (wrap `useCountryPracticalGuide`, sélection section).
- [ ] Test `tests/features/pays/hooks.spec.tsx` (`vi.mock` du hook pays ; états loading/error).

### Task 4 : Composants
- [ ] Créer `components/PaysContentStates.tsx`, `components/BlockMarkdown.tsx`, `components/EditorialBlockCard.tsx`, `components/SectionBlocks.tsx`, `index.ts`.
- [ ] Test `tests/features/pays/editorial.spec.tsx` (rendu markdown/sources ; empty/skeleton/error).

### Task 5 : Câblage desktop
- [ ] `PaysDestinationsView` : `SectionBlocks sectionId="destinations"` avant le bloc Viator.
- [ ] `PaysActivitesView` : `SectionBlocks sectionId="activites"`.
- [ ] `PaysCultureView` : `SectionBlocks sectionId="culture"` sous l'en-tête.
- [ ] `PaysHeroOverview` : `SectionBlocks sectionId="presentation"` + liens inter-sections.

### Task 6 : Câblage mobile
- [ ] `MobileCountryDetailView` : `SectionBlocks` en presentation/destinations/activites + nouvel onglet Culture.
- [ ] `BottomTabBar` : ajouter l'onglet `culture` au tray Pays (desktop inchangé).

### Task 7 : Tests impactés
- [ ] `tests/features/discovery/render.spec.tsx` : mock `@/hooks/useCountryPracticalGuide`.

### Task 8 : Docs + validation
- [ ] Mettre à jour `docs/PROGRESS_PAYS.md`.
- [ ] `npx tsc --noEmit` · `npx vitest run tests/features/pays tests/features/discovery` · suite complète · `npm run lint`.
