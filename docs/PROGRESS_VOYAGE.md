# MODULE VOYAGE — JOURNAL DE PROGRESSION & CONFORMITÉ

## 1. Vue d'Ensemble des 8 Chantiers

| N° | Chantier | Statut | Branche | Début | Fin | Commit Fin |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| **C1** | **Fondations de l'entité Trip (Schéma, RLS, Services, Vue Read-Only)** | ✅ **Validé** | `feat/c1-trips-core` | 2026-09-04 | 2026-09-04 | `9e9caed` |
| C2 | Création & Épisodes (Wizard, Itinéraire, Hébergement, Transport) | ⬜ À venir | `feat/c2-trips-episodes` | - | - | - |
| C3 | Collaboration & Partage (Membres, Rôles, Invitations, Sécurité) | ⬜ À venir | `feat/c3-trips-collab` | - | - | - |
| C4 | Préparation & Équipement (Liaison Sac à Dos, Poids, Shakedown) | ⬜ À venir | `feat/c4-trips-gear` | - | - | - |
| C5 | Budget & Dépenses (Split, Catégorisation, Multi-devises) | ⬜ À venir | `feat/c5-trips-budget` | - | - | - |
| C6 | Documents & Réservations (Storage, Chiffrement, Offline) | ⬜ À venir | `feat/c6-trips-docs` | - | - | - |
| C7 | Intégration IA & Copilote Terrain (Météo, Recommandations, Alertes) | ⬜ À venir | `feat/c7-trips-ai` | - | - | - |
| C8 | Rétrospective & Publication Communautaire (Carnet, Retour d'Expérience) | ⬜ À venir | `feat/c8-trips-retro` | - | - | - |

---

## 2. Chantier 1 — Suivi des Sous-Étapes

| Étape | Statut | Fichiers touchés | Preuve / Commande | Date |
| :--- | :---: | :--- | :--- | :---: |
| **1.0 Reconnaissance & Baseline** | | | | |
| 1.0.1 Vérifier PK auth.users | ✅ Fait | `supabase/migrations/*` | UUID confirmé dans les migrations actives et auth Supabase | 2026-09-04 |
| 1.0.2 Vérifier nom réel table groupes | ✅ Fait | `docs/reports/AUDIT_SUPPORT_ET_SCHEMA_GROUPE.md`, `20260716000000_group_system_complete.sql` | Table active = `public.travel_groups` (FK `group_id` adaptée) | 2026-09-04 |
| 1.0.3 Relever numéro dernière migration | ✅ Fait | `supabase/migrations/20260904040000_country_content_blocks.sql` | Dernière = `20260904040000`. C1 utilisera `20260904050000` | 2026-09-04 |
| 1.0.4 Baseline technique | ✅ Fait | Terminal | `tsc` : 0 err (code 0)<br>`lint` : 0 err, warnings préexistants (code 0)<br>`build` : Next.js 15.5.18 succès (code 0) | 2026-09-04 |
| 1.0.5 Créer fichier de suivi | ✅ Fait | `docs/PROGRESS_VOYAGE.md` | Fichier initialisé avec formats et sections imposés | 2026-09-04 |
| 1.0.6 Baseline visuelle | ✅ Fait | `scripts/baseline_screenshots.mjs`, `tests/visual/baseline/*` | Screenshots 1440px & 430px capturés pour `/` et `/materiel` | 2026-09-04 |
| 1.0.7 Créer branche git | ✅ Fait | Git | `git checkout -b feat/c1-trips-core` (exécuté avec succès) | 2026-09-04 |
| **1.1 Migration Supabase** | ✅ Fait | `supabase/migrations/20260904050000_trips_core.sql` | `apply_migration` exécuté avec succès sur `icxyvwzfjbflcbqukpfz`. Preuve SQL : 9 tables créées, 100% `rls_enabled = true`, 4 policies chacune. Fonctions anti-récursion `can_read_trip` et `can_edit_trip` créées. RGPD document policy active. | 2026-09-04 |
| **1.2 Types TypeScript & Schémas Zod** | ✅ Fait | `src/features/trips/types/trip.types.ts`, `schemas/trip.schema.ts`, `index.ts`, `tests/trips/trip-schemas.spec.ts` | Types canoniques complets, schémas Zod 4 avec validation dates et devises, `computeTripPermissions`. 20 tests Vitest réussis (100%), `npx tsc --noEmit` code 0. | 2026-09-04 |
| **1.3 Service Layer (Server-Only)** | ✅ Fait | `src/lib/queries-trips.ts`, `tests/trips/queries-trips.spec.ts` | 8 fonctions serveur (`getPublicTrips`, `getUserTrips`, `getTripBySlug`, `getTripById`, `createTrip`, `updateTrip`, `deleteTrip`, `getTripStats`). RGPD document gating validé, 7 tests Vitest réussis (100%), `npx tsc --noEmit` code 0. | 2026-09-04 |
| **1.4 Routes & Pages** | ✅ Fait | `src/app/voyages/*`, `src/app/api/voyages/*` | Routes `/voyages` (liste, recherche, filtres) et `/voyages/[slug]` (cockpit lecture seule avec 8 onglets). Route API GET/POST `/api/voyages`. Server Action `createTripAction`. Métadonnées SEO et schémas JSON-LD Schema.org. Build Next.js validé (`npm run build` exit 0). | 2026-09-04 |
| **1.5 Composants UI Dédiés** | ✅ Fait | `src/features/trips/components/*` | Composants créés : `TripBadge`, `TripCard`, `TripHero`, `TripOverviewTab`, `TripPlaceholderTab`, `TripFiltersBar`, `QuickCreateTripModal`. Palette Liquid Glass (Forest, Sage, Stone, zéro orange `#E4501C`), primitives `GlassCard`, `LkvButton`, `LkvChip`, `AppShell`. 9 tests unitaires dédiés verts. | 2026-09-04 |
| **1.6 Suite de Tests & Validation** | ✅ Fait | `tests/trips/*`, `npm run test`, `npm run build` | 47 tests unitaires/intégration trips (100% verts sur 4 fichiers). 402/402 tests globaux Vitest réussis (60 suites). Invariants CI vérifiés (`npm run verify:invariants`). Audit RLS automatisé. 0 erreur TypeScript, 0 erreur ESLint, build production Next.js exit 0. | 2026-09-04 |

---

## 3. Journal des Décisions d'Architecture

| Date | Décision | Justification | Impact sur les chantiers suivants |
| :--- | :--- | :--- | :--- |
| 2026-09-04 | Utilisation de `public.travel_groups(id)` pour la FK `trips.group_id` | Audit approfondi de la base : `travel_groups` est la seule table de groupes active et alimentée (la table `groupes` étant un reliquat legacy vide). | Les chantiers C2 et C3 lieront directement les voyages aux groupes réels de la plateforme sans discordance de schéma. |
| 2026-09-04 | Pas de dépendance `date-fns` ; formateurs natifs `Intl.DateTimeFormat` | `package.json` n'inclut pas `date-fns`. `Intl` est natif, sans impact bundle, et couvre 100% des besoins de formatage FR/locale. | Cohérence et légèreté du First Load JS. |
| 2026-09-04 | Adoption exclusive d'`AppShell` (`@/components/shell`) pour `/voyages` | Règle ESLint stricte du projet interdisant les nouveaux imports de `MobilePageShell`. | Assure une gestion canonique du safe-area CSS (`--safe-top`, `--safe-bottom`). |
| 2026-09-04 | Fonctions RLS `security definer stable` pour casser la récursion | Empêche la récursion infinie entre `trips` et `trip_collaborators`. | Robustesse et performances d'accès sur toutes les tables filles (C1 à C8). |
| 2026-09-04 | `affiliate_link_id` sans foreign key sur `trip_items` au C1 | La table d'affiliation cible est programmée pour le Chantier 5. | Champ présent dès le schéma C1 pour ne pas bloquer les futures migrations C5. |
| 2026-09-04 | Onglets C2-C8 avec composant `TripPlaceholderTab` affichant les données réelles | Permet de rendre dès le C1 les éléments existants (étapes, matériel, participants, dépenses, etc.) en lecture seule sans modifier le scope des chantiers suivants. | Expérience utilisateur cockpit complète et prête à être enrichie aux chantiers C2 à C8. |

---

## 4. Invariants de Sécurité & Conformité

| Règle / Invariant | Mécanisme de Contrôle | Statut | Preuve |
| :--- | :--- | :--- :---: | :--- |
| **RLS activée sur 100% des tables** (`trips` + 8 tables filles) | Migration SQL `alter table ... enable row level security;` + pg_policy check | ✅ Conforme | Vérifié via Supabase MCP `apply_migration` sur `icxyvwzfjbflcbqukpfz` : 9 tables avec RLS activée, 4 policies distinctes par table. |
| **Anti-récursion RLS** (`can_read_trip`, `can_edit_trip`) | Fonctions `security definer stable` avec `search_path = public` | ✅ Conforme | Testé dans `tests/trips/rls-isolation.spec.ts` (6 assertions RLS concluantes, zéro récursion). |
| **Protection RGPD Documents** (`trip_documents` SELECT réservé à `can_edit_trip`) | Policy restrictive : inaccessible aux simples `viewer` et visiteurs anonymes | ✅ Conforme | Testé dans `tests/trips/rls-isolation.spec.ts` (test RLS-06 garantit que `viewerCanReadDocs = false`). |
| **Conformité Palette Liquid Glass** (Zéro orange `#E4501C`, Zéro `#1C2620`, Forest `#17402C`, Sage `#5B7F55`, Stone `#FAF8F5`) | Script `scripts/verify/ci_invariants.mjs` + ripgrep complet | ✅ Conforme | `npm run verify:invariants` valide l'absence de tokens parallèles ; grep pour `#E4501C` dans `src/features/trips` et `src/app/voyages` = 0 résultat. |
| **Pas de composants custom réinventés** | Utilisation stricte de `GlassCard`, `LkvButton`, `LkvChip`, `LkvIcon` | ✅ Conforme | 100% des composants de `src/features/trips/components` consomment les primitives canoniques du Design System LKDV. |
| **Navigation Mobile Canonique** | `AppShell` avec safe-areas (`safeTop={true}`, `hasBottomNav={true}`) et touch-targets $\ge 44\text{px}$ | ✅ Conforme | Utilisé sur `/voyages`, `/voyages/[slug]`, `loading.tsx` et `not-found.tsx`. |
| **Zero ESLint errors & zero TS errors** | `npx tsc --noEmit` & `npm run lint` | ✅ Conforme | `tsc --noEmit` exit 0 (0 erreur) ; `eslint src/features/trips src/app/voyages src/app/api/voyages src/lib/queries-trips.ts` exit 0 (0 erreur, 0 warning). |
| **Build de Production Next.js** | `npm run build` | ✅ Conforme | Next.js 15.5.18 compile et génère toutes les routes statiques et dynamiques (`/voyages`, `/voyages/[slug]`, `/api/voyages`) sans erreur. |
| **Supabase Project ID officiel** | `icxyvwzfjbflcbqukpfz` (eu-west-3, jamais `lwrmuggefbmboikjgudc`) | ✅ Conforme | Configuration vérifiée dans `.env` et Supabase MCP. |
