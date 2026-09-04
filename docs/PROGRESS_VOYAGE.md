# MODULE VOYAGE — JOURNAL DE PROGRESSION & CONFORMITÉ

## 1. Vue d'Ensemble des 8 Chantiers

| N° | Chantier | Statut | Branche | Début | Fin | Commit Fin |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| **C1** | **Fondations de l'entité Trip (Schéma, RLS, Services, Vue Read-Only)** | 🟡 **En cours** | `feat/c1-trips-core` | 2026-09-04 | - | - |
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
| **1.1 Migration Supabase** | ✅ Fait | `supabase/migrations/20260904050000_trips_core.sql` | `apply_migration` exécuté avec succès sur `icxyvwzfjbflcbqukpfz`. Preuve SQL : 9 tables créées, 100% `rls_enabled = true`, 4 policies chacune. | 2026-09-04 |
| **1.2 Types TypeScript & Schémas Zod** | ✅ Fait | `src/features/trips/types/trip.types.ts`, `schemas/trip.schema.ts`, `index.ts`, `tests/trips/trip-schemas.spec.ts` | 20 tests Vitest réussis (100%), `npx tsc --noEmit` code 0 (Zod 4 compatible) | 2026-09-04 |
| **1.3 Service Layer (Server-Only)** | ⬜ À faire | `src/lib/queries-trips.ts` | Tests TDD d'intégration et mocks Supabase | 2026-09-04 |
| **1.4 Routes & Pages** | ⬜ À faire | `src/app/voyages/page.tsx`, `src/app/voyages/[slug]/page.tsx`, composants | Tests de rendu et accessibilité | 2026-09-04 |
| **1.5 Composants UI Dédiés** | ⬜ À faire | `src/features/trips/components/*` | Liquid Glass DS, LkvButton, GlassCard, AppShell | 2026-09-04 |
| **1.6 Suite de Tests & Validation** | ⬜ À faire | `tests/trips/*`, `tests/visual/trips.spec.ts` | Vitest, Playwright, Invariants CI | 2026-09-04 |

---

## 3. Journal des Décisions d'Architecture

| Date | Décision | Justification | Impact sur les chantiers suivants |
| :--- | :--- | :--- | :--- |
| 2026-09-04 | Utilisation de `public.travel_groups(id)` pour la FK `trips.group_id` | Audit approfondi de la base : `travel_groups` est la seule table de groupes active et alimentée (la table `groupes` étant un reliquat legacy vide). | Les chantiers C2 et C3 lieront directement les voyages aux groupes réels de la plateforme sans discordance de schéma. |
| 2026-09-04 | Pas de dépendance `date-fns` ; formateurs natifs `Intl.DateTimeFormat` | `package.json` n'inclut pas `date-fns`. `Intl` est natif, sans impact bundle, et couvre 100% des besoins de formatage FR/locale. | Cohérence et légèreté du First Load JS. |
| 2026-09-04 | Adoption exclusive d'`AppShell` (`@/components/shell`) pour `/voyages` | Règle ESLint stricte du projet interdisant les nouveaux imports de `MobilePageShell`. | Assure une gestion canonique du safe-area CSS (`--safe-top`, `--safe-bottom`). |
| 2026-09-04 | Fonctions RLS `security definer stable` pour casser la récursion | Empêche la récursion infinie entre `trips` et `trip_collaborators`. | Robustesse et performances d'accès sur toutes les tables filles (C1 à C8). |
| 2026-09-04 | `affiliate_link_id` sans foreign key sur `trip_items` au C1 | La table d'affiliation cible est programmée pour le Chantier 5. | Champ présent dès le schéma C1 pour ne pas bloquer les futures migrations C5. |

---

## 4. Invariants de Sécurité & Conformité

| Règle / Invariant | Mécanisme de Contrôle | Statut | Preuve |
| :--- | :--- | :---: | :--- |
| **RLS activée sur 100% des tables** (`trips` + 8 tables filles) | Migration SQL `alter table ... enable row level security;` + pg_policy check | 🟡 En cours | Vérifié lors de l'application de la migration C1 |
| **Anti-récursion RLS** (`can_read_trip`, `can_edit_trip`) | Fonctions `security definer stable` avec `search_path = public` | 🟡 En cours | Vérifié par tests RLS et inspection SQL |
| **Protection RGPD Documents** (`trip_documents` SELECT réservé à `can_edit_trip`) | Policy restrictive : inaccessible aux simples `viewer` | 🟡 En cours | Testé unitairement avec mock rôles |
| **Conformité Palette Liquid Glass** (Zéro orange `#E4501C`, Zéro `#1C2620`, etc.) | Script `scripts/verify/ci_invariants.mjs` + grep | 🟡 En cours | Vérifié à chaque étape |
| **Pas de composants custom réinventés** | Utilisation stricte de `GlassCard`, `LkvButton`, `LkvChip`, `LkvIcon` | 🟡 En cours | Revue de code DS |
| **Navigation Mobile Canonique** | `AppShell` avec safe-areas et touch-targets $\ge 44\text{px}$ | 🟡 En cours | Visual tests Playwright |
| **Zero ESLint errors & zero TS errors** | `npx tsc --noEmit` & `npm run lint` | ✅ Conforme | Baseline validée avec succès |
| **Supabase Project ID officiel** | `icxyvwzfjbflcbqukpfz` (eu-west-3, jamais `lwrmuggefbmboikjgudc`) | ✅ Conforme | Configuration vérifiée dans `.env` et Supabase MCP |
