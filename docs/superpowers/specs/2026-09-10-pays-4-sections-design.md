# Page Pays — Design des 4 sections prioritaires

**Date :** 2026-09-10
**Périmètre :** Présentation, Destinations, Activités & Treks, Culture & Société
**Décision produit :** Option A — les 4 sections consomment en priorité les **blocs IA pays existants** (`country_content_blocks`) enrichis de **données réelles** (PostGIS, trails, Viator). Aucune donnée fictive, aucune nouvelle table.

## 1. Rôle des sections

| Section | Rôle | Blocs IA | Données réelles | Partenaire |
|---|---|---|---|---|
| Présentation | Résumé intelligent du pays + accès aux sections | `vue_ensemble` | `countries_geo` (repères) | — |
| Destinations | Zones, villes, lieux incontournables | `spots_incontournables` | `admin_regions_geo` / `places_geo` (P2) | Viator (tag 12716) |
| Activités & Treks | Treks, randos, expériences | `itineraires_suggeres`, `niveau_difficulte`, `meilleure_periode_activite` | `explore_trails`, `trail_pois` (P3) | Viator (général) |
| Culture & Société | Usages, traditions, savoir-vivre | `etiquette` | — (extension P4) | — |

## 2. Données

- **Source IA** : `country_content_blocks` via `/api/ai/country-guide/[code]` et `useCountryPracticalGuide` (`src/hooks/useCountryPracticalGuide.ts`). Champs : `content_md`, `content_json` (Zod structurés existants), `sources`, `generated_at`, `stale_after`, `reviewed_at`, `tier`.
- **Géo** : `countries_geo`, `admin_regions_geo`, `places_geo`, `place_names_geo` (`src/lib/geodata.ts`).
- **Outdoor** : `explore_trails` (`src/lib/queries/trails.ts`), `trail_pois` (`/api/pois`), `hiking_routes`.
- **Partenaires** : provider `viator` (`src/features/discovery/providers/viator/*`) — Basic Access, `POST /products/search`, liens `productUrl` verbatim, `rel="sponsored noopener"`.

## 3. Composants (socle Phase 1)

- `PaysSectionDef` / registre unique `paysSectionRegistry.ts` (labels, blocs, partenaire).
- `SectionBlocks` : consomme `useSectionContent`, gère loading/empty/error/partial.
- `EditorialBlockCard` : rendu markdown + `content_json` + sources + fraîcheur.
- `PaysContentStates` : skeleton/empty/notice (réutilisés).
- Les cartes partenaires restent `DiscoverySection`/`KlookCtaBlock` (existants).

## 4. Interactions

- Navigation inter-sections depuis la Présentation.
- Lien « Voir sur Viator » (cartes partenaires), lien vers treks/carte (P3).
- CTA kit IA existant.

## 5. Responsive

Mobile prioritaire (`MobileCountryDetailView`), desktop via `PaysLeftSidebar`. Un seul socle, pas de duplication. Cibles tactiles ≥ 44×44.

## 6. États

loading (skeleton), vide explicite, erreur discrète, données partielles, image absente, absence de note. Jamais de faux contenu.

## 7. IA (points d'intégration)

Blocs par pays déjà générés (cron `/api/cron/process-ai-jobs`, cache `responseStore`, quota `quota.ts`). Recommandations contextualisées prévues P5–P6 sans nouvelle infra.

## 8. Affiliation

Conserver Travelpayouts + `go/[slug]` + consentement Z7. Viator déjà connecté (preuve repo `src/features/discovery/providers/viator/*`). Données partenaires **distinctes** de l'éditorial (attribution + mention partenaire).

## 9. Critères d'acceptation

1. Les 4 sections affichent du contenu réel (IA ou partenaire) ou un état vide explicite.
2. Aucune donnée fictive ; aucune régression hors périmètre.
3. Desktop + mobile cohérents ; `tsc`/`vitest`/`lint` verts.
4. Aucun secret côté client.

## 10. Limites de périmètre

Ne pas refondre : Gastronomie, Hébergements, Pratique & Données, Communauté, header/navigation globale, compte, matériel. Aucune migration de schéma en Phase 1.

## 11. Références officielles

Viator Partner API (`docs.viator.com/partner-api`), Travelpayouts support, Supabase/RLS, PostGIS, OSM/Overpass, Open-Meteo, Next.js, React, TanStack Query, Leaflet, Tailwind, WCAG. Priorité des sources : code réel du repo > doc officielle fournisseur > doc librairie > tests > doc interne.
