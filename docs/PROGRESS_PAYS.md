# PROGRESS PAYS — Chantier 4 sections prioritaires

**Dernière mise à jour :** 2026-09-10 (Phase 1 terminée + début Phase 2)

## Statut des phases (session autonome complète)

- **P1 — TERMINÉE** : socle `src/features/pays/` + câblage desktop/mobile + onglet Culture.
- **P2 — TERMINÉE** : Destinations = **régions réelles** (`admin_regions_geo`) + **spots IA** + **cartes Viator**. Rendu **structuré** des `content_json` (spots/itineraires/difficulté/période) opérationnel quand l'IA fournit du JSON.
- **P3 — TERMINÉE (v1)** : sentiers réels via **bbox `places_geo`** (`countries_geo.geometry` étant vide). Libellé « à proximité » (bbox frontalière possible). BE/FR renvoient 6 sentiers ; IS/DE/ES/JP sans sentiers dans le dataset.
- **P4 — TERMINÉE (v1)** : Culture = bloc IA `etiquette` + repli éditorial (usages/fêtes/gastronomie).
- **P5 — TERMINÉE** : **météo réelle Open-Meteo** + inter-sections + « Préparer ce voyage » → `/hub`.
- **P6 — TERMINÉE** : recommandations contextualisées (profil Facile/Modéré/Expert + durée Week-end/Semaine/Expédition + saison) via `/api/pays/[code]/recommendations` : sélection **déterministe** sur données réelles (blocs IA + sentiers + climat) + **synthèse IA** (`feature: pays-recommendations`, cache 30 j, fallback silencieux). UI dans la Présentation (desktop + mobile) avec états.

### P6 — preuve live
- `/api/pays/IS/recommendations?level=modere&duration=semaine` → `status=ok`, `synthesisProvider=ai`, 3 recommandations (Saison « Juin à septembre », Itinéraire Laugavegur 4 j, Fjords de l'Est 5 j).
- Rendu vérifié (capture `docs/h-captures/pays/p6-recommendations.png`), sélecteurs accessibles (`aria-pressed`), 0 erreur d'hydratation.
- Feature IA enregistrée dans `features/registry.ts` (`tier: fast`, `maxPerUserPerDay: 200`, fallback non vide).
- **P7 — EXISTANTE** : Communauté accessible (sidebar + mobile).
- **P8 — FAITE (v1)** : deep link `/hub`.
- **P9 — APPLIQUÉE** : états, cibles ≥36–44 px, rendu déterministe, mobile prioritaire.
- **P10 — VALIDÉE** : `tsc` 0 · `vitest` **185 fichiers / 1412 tests** · `lint` 0 · `build` OK.

### Génération IA (preuve)
- `GET /api/dev/generate-country-blocks?country=IS&block=…` → 5 blocs OK + `vue_ensemble` régénéré OK.
- `/api/ai/country-guide/IS` → `has_content=true`, blocs : `spots_incontournables, niveau_difficulte, itineraires_suggeres, meilleure_periode_activite, etiquette, vue_ensemble`.
- Rendu live vérifié : Présentation (vue d'ensemble IA), Destinations (spots + régions + Viator), Activités (itinéraires/niveau structurés + Viator), Culture (usages IA). 0 erreur d'hydratation.

### Reste optionnel
- Générer les blocs IA pour d'autres pays (FR/JP…) via la même route dev.
- P3 : affiner l'emprise par région/`admin_regions_geo` pour limiter les sentiers frontaliers.
- P6 : recommandations contextualisées (profil/durée/saison) via infra IA.

## État initial (audit vérifié repo)

- **Présentation** : statique éditorial (`PaysHeroOverview` + `countryDetails.ts`).
- **Destinations** : uniquement cartes Viator (`DiscoverySection`, tag 12716) + CTA Klook (statique LKDV retiré).
- **Activités & Treks** : uniquement cartes Viator ; socle `src/features/hiking/**` et `explore_trails` non branchés à la page Pays.
- **Culture & Société** : vide (en-tête seul).
- **Infra existante (preuves)** : blocs IA `country_content_blocks` via `useCountryPracticalGuide` ; PostGIS `countries_geo`/`admin_regions_geo`/`places_geo` (`src/lib/geodata.ts`) ; trails `explore_trails` (`src/lib/queries/trails.ts`) ; Viator connecté (`src/features/discovery/providers/viator/*`, route `/api/discovery/search`) ; affiliation Travelpayouts (`src/features/affiliation/**`, `go/[slug]`) ; voyages `/hub` (`src/features/trips/**`).

## Décisions techniques

1. **Option A** : blocs IA pays + données réelles + partenaires existants. Aucune donnée fictive, aucune nouvelle table.
2. **Socle partagé** `src/features/pays/` (registre, mapper, hook, composants, états) — desktop et mobile.
3. **Viator = déjà connecté** (preuve repo), conservé ; données partenaires distinctes de l'éditorial.
4. **Hors périmètre intacts** : Gastronomie, Hébergements, Pratique, Communauté, header/nav globale.
5. **États** systématiques : loading/empty/error/partial/image absente ; pas de fetch massif.

## Fichiers

### Créés (Phase 1)
- `docs/superpowers/specs/2026-09-10-pays-4-sections-design.md`
- `docs/superpowers/plans/2026-09-10-pays-sections-phase1.md`
- `docs/PROGRESS_PAYS.md` (ce fichier)
- `src/features/pays/types.ts`
- `src/features/pays/registry/paysSectionRegistry.ts`
- `src/features/pays/mappers/contentBlockToSection.ts`
- `src/features/pays/mappers/countryContentToSection.ts`
- `src/features/pays/hooks/useSectionContent.ts`
- `src/features/pays/components/PaysContentStates.tsx`
- `src/features/pays/components/BlockMarkdown.tsx`
- `src/features/pays/components/EditorialBlockCard.tsx`
- `src/features/pays/components/SectionBlocks.tsx`
- `src/features/pays/index.ts`
- `tests/features/pays/*`

### Modifiés (Phase 1)
- `src/components/pays/PaysDestinationsView.tsx`
- `src/components/pays/PaysActivitesView.tsx`
- `src/components/pays/PaysCultureView.tsx`
- `src/components/pays/PaysHeroOverview.tsx`
- `src/components/pays/MobileCountryDetailView.tsx`
- `src/components/mobile-nav/BottomTabBar.tsx`
- `tests/features/discovery/render.spec.tsx`

## Tests

- `npx vitest run tests/features/pays` : 5 fichiers / 22 tests (registre, mappers IA + éditorial, composants, états).
- Suite complète : **178 fichiers / 1384 tests verts** · `tsc` 0 · `lint` 0.

## Problèmes détectés / restant

- **Culture** : seule source = bloc `etiquette` → extension d'un bloc `culture_societe` prévue Phase 4.
- **Régions/villes** : mapping PostGIS → Destinations à concevoir (Phase 2).
- **Trails par pays** : filtrage bbox/PostGIS à valider (Phase 3).
- **Volumes** : imposer limites + lazy par section.

## Plan des phases

- P1 : socle — **TERMINÉE**.
- P2 : Destinations (repli réel fait ; zones PostGIS + `content_json` restants) — **EN COURS**.
- P3 : Activités & Treks (trails réels + blocs IA + carte).
- P4 : Culture (bloc `culture_societe`).
- P5 : Présentation (synthèse + météo + inter-sections).
- P6 : IA contextualisée.
- P7 : Communauté → sections.
- P8 : Préparation voyage (/hub).
- P9 : UX/UI & perf.
- P10 : Validation finale.
