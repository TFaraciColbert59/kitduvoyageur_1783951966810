# Tripadvisor Content API Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich LKDV Pays pages (`/pays/[code]`) with Tripadvisor locations/restaurants/hotels via a provider-agnostic discovery layer, with strict key security, quota control, attribution, and no regressions to editorial content.

**Architecture:** A new `src/features/discovery/` feature exposes a normalized `DiscoveryItem` model. Provider-agnostic: **Terra** (default, `X-API-Key` header, `GET /locations/search` which already returns the full Location → no Details/N+1) and **legacy Content API** (explicit opt-in only). A single secured internal route (`/api/discovery/tripadvisor`) is the only network edge; client sections fetch on open via TanStack Query with `no-store`. Reviews/photos endpoints and all caching beyond `location_id` are deliberately excluded in v1.

**Tech Stack:** Next.js 15 RSC + route handlers, React 19, TypeScript, Zod 4, TanStack Query, Vitest, Tailwind `glass` tokens.

**Spec:** mission brief (Tripadvisor Content API integration).

## Global Constraints
- Never expose/log/commit `TRIPADVISOR_API_KEY`; no `NEXT_PUBLIC_TRIPADVISOR_*`; never log a URL containing `?key=`.
- Server-only calls; HTTPS. Terra = clé dans l'en-tête `X-API-Key` (jamais en URL), `locale=fr-FR`, catégories `ATTRACTION|RESTAURANT|HOTEL`. Legacy = `?key=` + `language=fr`.
- `cache: 'no-store'`; persist only `location_id` (none in v1 DB); no JSON-LD; no static generation of TA content.
- Content API is **not** a booking API -> `isBookable: false` always; no prices/availability.
- V1 caps: attractions 6, restaurants 6, hotels 4.
- TA logos/rating images served directly from Tripadvisor URLs (plain `<img>`, never `next/image`); logo >=20px; bubble rating >=55px, white background, left-aligned; never recolor/invert.
- Mobile + desktop parity; taps >=44x44; works with JS/API failing (editorial LKDV unaffected).

## Billing, appels et coût maximal
Terra est facturé **par entité retournée** (et non par requête HTTP) ; **1 000 entités/mois gratuites**.
Le `size` de chaque recherche est borné aux plafonds métier → coût par section borné.

| Parcours | Appels HTTP | Entités max | Coût max à 0,015 $/entité |
|---|---:|---:|---:|
| Destinations | 1 | 6 | 0,09 $ |
| Activités | 1 | 6 | 0,09 $ |
| Gastronomie | 1 | 6 | 0,09 $ |
| Hébergements | 1 | 4 | 0,06 $ |
| Visite complète | 4 | 22 | 0,33 $ |

- Réouverture d'une section (aucun cache de contenu autorisé) : +0,09 $ (6) ou +0,06 $ (4).
- 1 000 entités gratuites ≈ 45 visites complètes (22 entités).
- Pas de reviews/photos ; pas d'auto-retry ; 429 -> UI discrète + fallback éditorial.
- **Terra ≠ Legacy** : ne jamais estimer le coût Legacy avec le tarif Terra de 0,015 $/entité — les deux plateformes ont des modèles de facturation distincts. Legacy (secours explicite uniquement) = 1 search + N details par section.

## Open contractual validation points
1. Migration Terra réalisée (provider `tripadvisor-terra`). Legacy conservé en **secours explicite** uniquement.
2. Terra : HTTP 200 confirmé en live (Search, `country_code` respecté). L'ancien 403 concernait la clé
   legacy Content API. Reste à vérifier le **périmètre allowlist/package** (résultats limités aux locations autorisées).
3. `language` vs `lang`: la doc Tripadvisor est réellement contradictoire (Localization dit `lang`,
   l'OpenAPI des endpoints dit `language`). Centralisé dans `tripadvisorClient.ts` ; à trancher
   par test live.
4. Logo d'attribution: utiliser un asset fourni/autorisé explicitement par Tripadvisor — aucune URL
   statique (ex. `static.tacdn.com`) n'est contractuellement garantie. Surchargeable via
   `TRIPADVISOR_LOGO_URL`.
5. Non-indexation: le rendu client-only + `no-store` ne garantit pas contre les crawlers qui
   exécutent JavaScript -> point de validation contractuel.
6. Endpoint Photos exclu en v1 (maîtrise des coûts).

## Suivi manuel (à faire hors agent)
1. Terra est opérationnel (`TRIPADVISOR_TERRA_API_KEY`, en-tête `X-API-Key`). Vérifier au dashboard le
   périmètre **allowlist/package** : Search ne renvoie que les Locations autorisées.
2. Validation sémantique live : `node scripts/tripadvisor-terra-live-check.mjs`
   (3 appels `size=2`, métadonnées sûres uniquement, aucune clé).
3. Valider : asset logo officiel, non-indexation (crawlers exécutant JS), arbitrage cache/réouverture.
4. Legacy : utilisé **uniquement** via `TRIPADVISOR_PROVIDER=legacy` explicite — aucun fallback
   automatique Terra -> Legacy (testé).
5. Dernier contrôle du diff, puis commit **uniquement sur autorisation explicite**.

