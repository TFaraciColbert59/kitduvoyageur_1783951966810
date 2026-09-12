# Phase 8B — Durcissement des 18 tables à politiques RLS permissives

Date : 2026-09-12 · Worktree `ai-finalization` · Branche `feat/phase8b-policy-hardening`
Base : `a4f171a9` (= main). Migration : `20260911570000_phase8b_permissive_policy_hardening.sql`.
Tests : `supabase/tests/database/phase8b_policy_hardening.test.sql` (56 assertions).

## Constat

`pg_policies` + `has_table_privilege` (prod) : 18 tables avec des politiques
`USING(true)` / `WITH CHECK(true)` pour `authenticated` (et SELECT `public`), et des
grants `INSERT/UPDATE/DELETE/TRUNCATE` complets pour `authenticated` (voire `anon`).
Risques réels : réécriture de `promo_codes`, `feature_flags`, `affiliate_*`,
`stock_movements`, `loans`, `gear_history`, `gear_images`, `kit_items`, etc.

Note vérifiée : `feature_flags` n'a **pas** de colonne `key` ; sa clé est `id text`
(et `scope`, `enabled`, `updated_by`).

## Méthode

1. Analyse d'usage réelle dans `src/` : client navigateur (anon key + RLS, session
   utilisateur) vs `getServiceSupabase()` (service_role, routes serveur) vs RPC
   `SECURITY DEFINER`.
2. Migration additive : `DROP POLICY IF EXISTS` → `CREATE POLICY` au moindre
   privilège, REVOKE/GRANT explicites, contrôle final intégré qui échoue si une
   policy permissive d'écriture subsiste.
3. pgTAP : 56 assertions (policies, grants, refus d'écriture lambda, lectures
   propriétaire/catalogue/admin, RPC, service_role).
4. Non-régression complète (`type-check`, `lint`, `test`) + replay local strict.
5. Aucune écriture en production.

## Décisions par table (usage constaté → policy → grant final)

| # | Table | Usage constaté (preuve) | Nouvelle autorité | Grant final `authenticated` / `anon` |
|---|-------|-------------------------|-------------------|--------------------------------------|
| 1 | `affiliate_offers` | Aucun `.from()` direct ; vue `poi_offers_served` (phase4), catalogue | SELECT public ; écriture service_role | SELECT / SELECT |
| 2 | `affiliate_partners` | `src/lib/queries-affiliation.ts:187` (service_role, repli session) | SELECT public ; écriture service_role | SELECT / SELECT |
| 3 | `affiliate_programs` | Aucun usage direct ; catalogue | SELECT public ; écriture service_role | SELECT / SELECT |
| 4 | `ambassadors` | Aucun usage ; colonnes financières (`earnings`, `clicks`, `conversions`, `commission_pct`) | SELECT propriétaire (`user_id = auth.uid()`) ou admin ; écriture service_role | SELECT (own/admin), aucun DML / aucun SELECT |
| 5 | `carnet_gear_links` | Aucun usage direct ; SELECT scopé existant (`carnet_gear_links_read_scoped`) | SELECT scopé (carnet public/auteur) ; écriture auteur du carnet + service_role | SELECT, INSERT/UPDATE/DELETE own / SELECT |
| 6 | `club_challenges` | `src/app/clubs/page.tsx:312` (lecture session) ; `src/app/api/seed/route.ts:264` (service_role) | SELECT public ; écriture service_role (aucune création session prouvée) | SELECT, aucun DML / SELECT |
| 7 | `club_recommended_kits` | Aucun usage | SELECT public ; écriture service_role | SELECT, aucun DML / SELECT |
| 8 | `event_expenses` | `src/app/evenements/page.tsx:494` (embed `expenses:event_expenses(*)`, anon/auth) | SELECT public conservé ; écriture service_role | SELECT, aucun DML / SELECT |
| 9 | `events` | `evenements/page.tsx:492` SELECT, `:544/:551` compteurs, `:560` INSERT organisateur ; `communaute/page.tsx:117` SELECT | SELECT public ; INSERT organisateur ; UPDATE/DELETE organisateur/admin ; compteurs via RPC `join_event`/`leave_event` | SELECT, INSERT/UPDATE/DELETE scoped / SELECT |
| 10 | `experts` | Aucun usage table (texte marketing seulement) | SELECT public ; écriture service_role | SELECT, aucun DML / SELECT |
| 11 | `feature_flags` | Direct service_role : `src/app/api/cron/run-adventure-shadows/route.ts:31` ; client via RPC DEFINER (`features/*/server/featureFlags.ts`) | SELECT authenticated conservé ; écriture service_role/admin | SELECT, aucun DML / aucun SELECT |
| 12 | `gear_history` | `src/lib/supabase/queries.ts:125` (client navigateur, propriétaire via `gear_items.user_id`) | SELECT/INSERT/UPDATE/DELETE propriétaire de l'objet + service_role | SELECT + DML own / aucun SELECT |
| 13 | `gear_images` | `src/lib/supabase/queries.ts:71` (client navigateur, propriétaire) | SELECT/INSERT/UPDATE/DELETE propriétaire de l'objet + service_role | SELECT + DML own / aucun SELECT |
| 14 | `guides` | `src/app/guides/[slug]/GuideDetailClient.tsx:48`, `src/app/blog/page.tsx:147`, `src/app/sitemap.ts:126` (lectures) | SELECT public ; écriture service_role | SELECT, aucun DML / SELECT |
| 15 | `kit_items` | Catalogue : `src/app/kits/[slug]/KitDetailPage.tsx:79`, `recommendCountryKits.ts:79` (service) ; insert mort supprimé (`ConfiguratorWizard.tsx`) | SELECT public ; écriture service_role | SELECT, aucun DML / SELECT |
| 16 | `loans` | `src/lib/supabase/queries.ts:108` (client navigateur, propriétaire via `gear_items.user_id`) | SELECT/INSERT/UPDATE/DELETE propriétaire de l'objet + service_role | SELECT + DML own / aucun SELECT |
| 17 | `promo_codes` | Aucun usage ; `public_read_promo_codes` exposait codes/uses/revenue | SELECT ambassadeur propriétaire (`ambassadors.user_id`) ou admin ; écriture service_role | SELECT (own/admin), aucun DML / aucun SELECT |
| 18 | `stock_movements` | Admin session : `src/app/admin/produits/AdminProductsManager.tsx:282/465` (SELECT), `:582/:830` (INSERT) ; ventes réelles via RPC DEFINER `decrement_stock_on_order` (webhook Stripe `src/app/api/stripe/webhook/route.ts:204`) | SELECT admin (`is_admin()`) ; INSERT admin (policy conservée) ; écriture service_role | SELECT + INSERT (admin), pas d'UPDATE/DELETE / aucun |

## Tables laissées permissives (et pourquoi)

- **SELECT public `USING(true)`** conservé sur le catalogue réellement servi par
  l'app : `affiliate_offers/partners/programs`, `club_challenges`,
  `club_recommended_kits`, `event_expenses`, `events`, `experts`, `guides`,
  `kit_items`. Aucune de ces lectures n'expose de données personnelles ou
  financières ; les écritures sont fermées.
- **SELECT `authenticated` `USING(true)`** conservé sur `feature_flags` (consommé
  côté client + RPC), écriture fermée.
- `carnet_gear_links` et `hike_sessions`-like : SELECT scopé (public/auteur), jamais
  global.

## Flux app corrigés

1. `src/app/evenements/page.tsx` : inscription/désinscription passe par les RPC
   `join_event` / `leave_event` (SECURITY DEFINER, compteurs atomiques, contrôle
   complet/terminé) au lieu d'un `UPDATE events` client. La policy `UPDATE events`
   redevient strictement organisateur/admin.
2. `src/app/ai-configurator/components/ConfiguratorWizard.tsx` : suppression d'un
   insert `kit_items` mort (colonnes inexistantes `name/category/weight_g/price_eur/
   essential`, inatteignable derrière `if (kitError || !kit) return`).
3. `scripts/ops/phase10_capacity.mjs` : retrait du shebang qui faisait échouer
   `npm run test` (échec de chargement Vitest **préexistant**, sans rapport avec la
   RLS ; script toujours invoqué via `node`).

## Résultats bruts (local, 2026-09-12)

- **Replay strict** : baseline prod schema-only + 52 migrations post-baseline,
  ledger 195 versions / 0 en attente (`scripts/db/install-from-baseline.ps1 -Mode upgrade`).
- **pgTAP complet** : `npx supabase test db` → `Files=21, Tests=494, Result: PASS`
  (dont `phase8b_policy_hardening` 56/56, `phase8_rls_access` 40/40).
- **Vitest complet** : `npm run test` → `318 passed / 4 skipped (322 fichiers)`,
  `2259 passed / 27 skipped (2286 tests)`, **0 échec**.
- **`npm run type-check`** : exit 0.
- **`npm run lint`** : exit 0 (warnings `no-empty`/`no-unused-vars` préexistants,
  aucune erreur).

## Limites / écarts connus

- `checkout/page.tsx` met à jour `products.stock` et insère dans `stock_movements`
  côté client : ce bookkeeping était **déjà inopérant avant la Phase 8B** pour un
  non-admin (`products` et `stock_movements` en écriture admin-only depuis les
  durcissements précédents). Le flux de vente réel passe par le webhook Stripe →
  `decrement_stock_on_order` (DEFINER). Aucune régression introduite ; correction du
  checkout hors périmètre (tables `products`/`stock_movements` déjà verrouillées).
- `event_expenses` reste publiquement lisible (embed de la page Événements) :
  montants de cagnotte communautaire assumés publics.
- `promo_codes` : plus de SELECT public ; si une validation client de code devait
  être ajoutée, elle doit passer par un RPC serveur.
- Environnement local : le replay baseline strict ne contient pas le seed
  `countries_geo(FR)` (migration pré-baseline `20260905090000`, FK de
  `coverage_regions`) ; le seed idempotent documenté a été appliqué localement pour
  restaurer l'environnement de test certifié. Aucun impact production.
- Aucune policy n'a été modifiée en production ; aucun push autre que la branche
  `feat/phase8b-policy-hardening`.
