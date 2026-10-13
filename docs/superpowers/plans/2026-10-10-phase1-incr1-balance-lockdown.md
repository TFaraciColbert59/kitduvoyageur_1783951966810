# Phase 1 — Incrément 1 : Soldes hors de portée du navigateur — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer tous les chemins d'écriture de points accessibles au navigateur (colonnes profil, journal legacy, commandes) et les remplacer par des opérations serveur vérifiées, idempotentes et tracées — sans perdre un seul solde.

**Architecture:** RPC `SECURITY DEFINER` service_role uniquement (`legacy_loyalty_*`, `create_shop_order`) + routes API à session vérifiée ; garde-fou de colonnes étendu ; policies d'écriture legacy supprimées ; backfill d'ouvertures pour que `Σ loyalty_history = loyalty_points` avant fermeture.

**Tech Stack:** PostgreSQL/Supabase (pgTAP), Next.js 15 route handlers, TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-phase1-stabilisation-points-design.md`

## Global Constraints

- Migration additive/idempotente ; aucune écriture destructive ; down migration fournie (`supabase/migrations_down/`).
- Ordre de déploiement : backup prod → migration DB → app (Vercel via merge `main`).
- Ne jamais modifier `sync_loyalty_points`, `process_order_points`, `update_loyalty_points`, `redeem_reward`.
- Toute RPC nouvelle : `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE TO service_role`.
- Le client ne fournit jamais de points : barème et montants décidés serveur.
- Gates : `npm run type-check`, `npm run lint`, `npm test`, `npm run verify:invariants`, `npm run build`, `npx supabase test db`.
- Commits conventionnels (`feat(phase1): …`, `test(phase1): …`, `docs(phase1): …`).

---

### Task 1 : Test pgTAP (rouge)

**Files:**
- Create: `supabase/tests/database/phase1_balance_lockdown.test.sql`

**Interfaces:**
- Produces: les assertions exactes que la Task 2 doit faire passer.

- [ ] **Step 1.1 : écrire le fichier de test**

```sql
-- Phase 1 — verrouillage des soldes : garde colonnes, policies fermées,
-- backfill d'ouvertures, RPC legacy serveur, commandes serveur.
BEGIN;
SET LOCAL search_path = public;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.user_profiles, public.orders, public.loyalty_history, public.loyalty_redemptions,
  public.loyalty_rewards, public.shop_products, public.stock_movements
TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
SELECT plan(24);

-- Fixtures
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaa0001-0000-4000-8000-000000000001','authenticated','authenticated','p1a@test.local','x','{}','{}',now(),now()),
  ('aaaa0001-0000-4000-8000-000000000002','authenticated','authenticated','p1b@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES
  ('aaaa0001-0000-4000-8000-000000000001','Pers A','p1a@test.local'),
  ('aaaa0001-0000-4000-8000-000000000002','Pers B','p1b@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1-4. Garde colonnes : authenticated ne peut plus modifier les colonnes de solde.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaa0001-0000-4000-8000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SELECT throws_ok(
  $$UPDATE public.user_profiles SET loyalty_points = 999999 WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '1. loyalty_points verrouillé pour authenticated');
SELECT throws_ok(
  $$UPDATE public.user_profiles SET xp = 999999 WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '2. xp verrouillé pour authenticated');
SELECT throws_ok(
  $$UPDATE public.user_profiles SET level = 10 WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '3. level verrouillé pour authenticated');
SELECT throws_ok(
  $$UPDATE public.user_profiles SET loyalty_level = 'Légende du Voyage' WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '42501', NULL, '4. loyalty_level verrouillé pour authenticated');
-- 5. Contrôle positif : le profil normal reste modifiable.
SELECT lives_ok(
  $$UPDATE public.user_profiles SET bio = 'bio ok' WHERE id = 'aaaa0001-0000-4000-8000-000000000001'$$,
  '5. bio toujours modifiable par son titulaire');
RESET ROLE;

-- 6-9. Journal legacy fermé au client.
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_history' AND policyname='auth_insert_loyalty_history'),
  '6. policy auth_insert_loyalty_history supprimée');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_redemptions' AND policyname='auth_insert_loyalty_redemptions'),
  '7. policy auth_insert_loyalty_redemptions supprimée');
SELECT ok(NOT has_table_privilege('authenticated','public.loyalty_history','INSERT'),
  '8. authenticated sans INSERT loyalty_history');
SELECT ok(NOT has_table_privilege('authenticated','public.loyalty_redemptions','INSERT'),
  '9. authenticated sans INSERT loyalty_redemptions');

-- 10-11. Commandes fermées au client, lecture propre conservée.
SELECT ok(NOT has_table_privilege('authenticated','public.orders','INSERT'),
  '10. authenticated sans INSERT orders');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_own'),
  '11. policy orders_select_own présente');

-- 12-14. Backfill d'ouvertures : réconciliation sans perte, idempotente.
SELECT is(public.legacy_loyalty_backfill_openings(), 0, '12. rien à backfiller (déjà cohérent)');
UPDATE public.user_profiles SET loyalty_points = 1234 WHERE id = 'aaaa0001-0000-4000-8000-000000000002';
SELECT is(public.legacy_loyalty_backfill_openings(), 1, '13. un écart détecté et reporté');
SELECT is((SELECT loyalty_points FROM public.user_profiles WHERE id = 'aaaa0001-0000-4000-8000-000000000002'), 1234,
  '14. solde préservé à l''identique après backfill');

-- 15-18. RPC spend/earn : bornes, idempotence, niveau.
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 5000, 'Trop cher', 'test:spend:over'))->>'error',
  'insufficient_balance', '15. dépense refusée si solde insuffisant');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 1000, 'Achat test', 'test:spend:1'))->>'success',
  'true', '16. dépense nominale OK');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 1000, 'Achat test', 'test:spend:1'))->>'idempotent',
  'true', '17. rejeu idempotent (pas de double débit)');
SELECT is((public.legacy_loyalty_earn('aaaa0001-0000-4000-8000-000000000002', 4000, 'Gain test', 'test:earn:1'))->>'balance',
  '4234', '18. crédit + solde exact');

-- 19-21. Panier : remboursement adossé au journal uniquement.
SELECT is((public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000002','item-x'))->>'error',
  'no_apply', '19. remboursement refusé sans débit correspondant');
SELECT is((public.legacy_loyalty_spend('aaaa0001-0000-4000-8000-000000000002', 234, 'Article offert (panier)', 'cart_free_apply:item-x'))->>'success',
  'true', '20. débit panier enregistré');
SELECT is((public.legacy_loyalty_cart_refund('aaaa0001-0000-4000-8000-000000000002','item-x'))->>'balance',
  '4234', '21. remboursement = montant du journal (234)');

-- 22-23. Fidélité : échange unique, solde exact.
INSERT INTO public.loyalty_rewards (id, title, points_cost, available)
VALUES ('aaaa0002-0000-4000-8000-000000000001','Récompense test', 200, true)
ON CONFLICT (id) DO NOTHING;
SELECT is((public.legacy_loyalty_redeem('aaaa0001-0000-4000-8000-000000000002','aaaa0002-0000-4000-8000-000000000001'))->>'success',
  'true', '22. échange nominal');
SELECT is((public.legacy_loyalty_redeem('aaaa0001-0000-4000-8000-000000000002','aaaa0002-0000-4000-8000-000000000001'))->>'error',
  'already_redeemed', '23. double échange refusé');

-- 24. Privilèges RPC : authenticated n'exécute aucune RPC legacy.
SELECT ok(
  (SELECT bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
     ('legacy_loyalty_spend','legacy_loyalty_earn','legacy_loyalty_cart_refund','legacy_loyalty_redeem','create_shop_order','legacy_loyalty_backfill_openings')),
  '24. RPC serveur non exécutables par authenticated');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 1.2 : lancer le reset et le test (attendu : rouge)**

Run: `npx supabase start` puis `npx supabase db reset` puis `npx supabase test db phase1_balance_lockdown`
Expected: FAIL — `function public.legacy_loyalty_backfill_openings() does not exist`.

- [ ] **Step 1.3 : commit**

```bash
git add supabase/tests/database/phase1_balance_lockdown.test.sql
git commit -m "test(phase1): suite pgTAP verrouillage des soldes (rouge)"
```

---

### Task 2 : Migration balance lockdown (vert) + down

**Files:**
- Create: `supabase/migrations/20261010140000_phase1_balance_lockdown.sql`
- Create: `supabase/migrations_down/20261010140000_phase1_balance_lockdown.down.sql`

**Interfaces:**
- Consumes: test Task 1.
- Produces: `public.legacy_loyalty_backfill_openings(text)`, `public.legacy_loyalty_spend(uuid,int,text,text)`, `public.legacy_loyalty_earn(uuid,int,text,text,text)`, `public.legacy_loyalty_cart_refund(uuid,text)`, `public.legacy_loyalty_redeem(uuid,uuid)`, `public.create_shop_order(uuid,text,jsonb,jsonb,text)` — toutes service_role.

- [ ] **Step 2.1 : écrire la migration complète**

Contenu (structure exacte, corps complets) :

```sql
-- ============================================================================
-- PHASE 1 — Verrouillage des soldes : le navigateur n'écrit plus aucun point.
--   1. Garde colonnes v2 (loyalty_points, loyalty_level, xp, level)
--   2. Fermeture loyalty_history / loyalty_redemptions / orders au client
--   3. Backfill d'ouvertures (Σ journal = solde, sans perte)
--   4. RPC legacy service_role : spend / earn / cart_refund / redeem
--   5. RPC commandes service_role : create_shop_order
-- Additive et idempotente. Down : migrations_down/20261010140000_phase1_balance_lockdown.down.sql
-- ============================================================================

-- 1. GARDE COLONNES v2 -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  privileged_change boolean := false;
BEGIN
  IF auth.role() IS NULL OR auth.role() NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    privileged_change :=
      NEW.role IS DISTINCT FROM 'user'
      OR NEW.trust_score IS DISTINCT FROM 50
      OR NEW.is_suspended_groups IS DISTINCT FROM false
      OR NEW.suspended_from_groups_at IS NOT NULL
      OR NEW.two_fa_enabled IS DISTINCT FROM false
      OR NEW.loyalty_points IS DISTINCT FROM 0
      OR NEW.loyalty_level IS DISTINCT FROM 'Explorateur'
      OR NEW.xp IS DISTINCT FROM 0
      OR NEW.level IS DISTINCT FROM 1;
  ELSE
    privileged_change :=
      NEW.role IS DISTINCT FROM OLD.role
      OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
      OR NEW.is_suspended_groups IS DISTINCT FROM OLD.is_suspended_groups
      OR NEW.suspended_from_groups_at IS DISTINCT FROM OLD.suspended_from_groups_at
      OR NEW.two_fa_enabled IS DISTINCT FROM OLD.two_fa_enabled
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
      OR NEW.loyalty_level IS DISTINCT FROM OLD.loyalty_level
      OR NEW.xp IS DISTINCT FROM OLD.xp
      OR NEW.level IS DISTINCT FROM OLD.level;
  END IF;
  IF privileged_change THEN
    RAISE EXCEPTION 'user_profiles: colonne de privilège protégée (role, trust_score, suspension, 2FA, email, loyalty, xp, level)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

-- 2. FERMETURE DES ÉCRITURES LEGACY ------------------------------------------
DROP POLICY IF EXISTS "auth_insert_loyalty_history" ON public.loyalty_history;
DROP POLICY IF EXISTS "auth_insert_loyalty_redemptions" ON public.loyalty_redemptions;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_redemptions FROM anon, authenticated;

-- 3. COMMANDES : plus d'écriture cliente (forge de points via trigger)
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;

-- 4. BACKFILL D'OUVERTURES ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_backfill_openings(p_version text DEFAULT 'v1')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
  SELECT p.id,
         'Solde reporté (réconciliation Phase 1)',
         p.loyalty_points - COALESCE(j.sum_points, 0),
         'opening_balance',
         'opening:' || p.id || ':' || COALESCE(p_version, 'v1')
  FROM public.user_profiles p
  LEFT JOIN (SELECT user_id, SUM(points) AS sum_points FROM public.loyalty_history GROUP BY user_id) j
    ON j.user_id = p.id
  WHERE p.loyalty_points - COALESCE(j.sum_points, 0) <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_history h
      WHERE h.source_id = 'opening:' || p.id || ':' || COALESCE(p_version, 'v1')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

SELECT public.legacy_loyalty_backfill_openings();

-- 5. ÉCHELLE NIVEAU LEGACY (miroir de update_loyalty_points) ------------------
CREATE OR REPLACE FUNCTION public.legacy_loyalty_level_for(p_points integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_points >= 7500 THEN 'Légende du Voyage'
    WHEN p_points >= 3500 THEN 'Guide de Montagne'
    WHEN p_points >= 1500 THEN 'Randonneur Expert'
    WHEN p_points >= 500  THEN 'Aventurier'
    ELSE 'Explorateur'
  END;
$$;

-- 6-9. RPC LEGACY (service_role) ---------------------------------------------
-- (corp complets — spend, earn, cart_refund, redeem — voir §6.1 de la spec ;
--  modèle : idempotence par source_id, verrou user_profiles FOR UPDATE,
--  solde = Σ journal, refus insuffisant, recalcul loyalty_level.)
-- 10. RPC COMMANDES : create_shop_order — voir §6.1 de la spec.
-- 11. PRIVILÈGES : REVOKE PUBLIC/anon/authenticated + GRANT service_role.
```

Corps complets des 4 RPC legacy et de `create_shop_order` : voir spécification §6.1 (signatures, règles d'erreur jsonb, verrouillage, ordre des écritures). Points non négociables :
- `spend/earn` : idempotence `source_id` (rejeu ⇒ `{success:true, idempotent:true}`), solde = `SUM(loyalty_history.points)`, recalcul `loyalty_level` via `legacy_loyalty_level_for`.
- `cart_refund` : montant repris de la ligne `cart_free_apply:<id>` (jamais du client), `no_apply` sinon, idempotent via `cart_free_remove:<id>`.
- `redeem` : `FOR UPDATE` sur `loyalty_rewards`, `already_redeemed` via `loyalty_redemptions(user_id, reward_id)`, insert journal `-points_cost` `source_id='reward_<id>'`, insert `loyalty_redemptions status='completed'`.
- `create_shop_order` : résolution `shop_products` par slug (inconnu ou `available=false` ⇒ refus), prix/total calculés serveur (standard ≥ 99 € ⇒ 0 sinon 5,9 € ; express 9,9 ; relay 3,9 ; option inconnue ⇒ refus), `order_number = 'KDV-' || <base36 timestamp> || '-' || <random>` garanti unique (contrainte), insert `orders` (le trigger `process_order_points` crédite), puis `decrement_stock_on_order` par article, retour `{success:true, orderId, orderNumber, totalEur}`.

- [ ] **Step 2.2 : écrire la down migration**

`migrations_down/20261010140000_phase1_balance_lockdown.down.sql` : restaurer le garde v1 (corps de `20260911551000`), recréer `auth_insert_loyalty_history`, `auth_insert_loyalty_redemptions`, `users_manage_own_orders` (corps d'origine, cf. dump prod), DROP la policy `orders_select_own`, DROP les 6 fonctions nouvelles, `DELETE FROM loyalty_history WHERE source_id LIKE 'opening:%'`, puis `DELETE FROM user_profiles` jamais — interdiction absolue de toucher aux profils.

- [ ] **Step 2.3 : reset + test db (attendu : vert)**

Run: `npx supabase db reset` puis `npx supabase test db`
Expected: `phase1_balance_lockdown` 24/24 OK, toutes les autres suites inchangées.

- [ ] **Step 2.4 : commit**

```bash
git add supabase/migrations/20261010140000_phase1_balance_lockdown.sql supabase/migrations_down/20261010140000_phase1_balance_lockdown.down.sql
git commit -m "feat(phase1): verrouillage des soldes (garde colonnes, policies, backfill, RPC legacy+commandes)"
```

---

### Task 3 : Helpers serveur + validation (tests rouges puis verts)

**Files:**
- Create: `src/features/loyalty/validation.ts`
- Create: `src/features/checkout/serverPricing.ts`
- Test: `tests/phase1/loyalty-validation.spec.ts`, `tests/phase1/checkout-pricing.spec.ts`

**Interfaces:**
- Produces: `EARN_ACTIONS: Record<string, number>` (`rapport_expedition: 75`), `parseSpendBody(unknown): {ok:true, points:number, reason:string, sourceId:string} | {ok:false, error:string}`, `computeShipping(option: string, subtotalEur: number): number | null`, `buildOrderLines(items: unknown, products: Map<string,{id:string;name:string;priceEur:number}>): {ok:true, lines:OrderLine[]; subtotalEur:number} | {ok:false, error:string}`.

- [ ] **Step 3.1 : écrire les tests (rouges)** — cas : points non entiers/négatifs refusés ; sourceId vide/>200 refusé ; action inconnue refusée ; `rapport_expedition` = 75 quel que soit le body ; livraison standard 5,9 / ≥99 = 0 / express 9,9 / relay 3,9 / inconnue rejetée ; slug inconnu rejeté ; quantité 0/négative rejetée.

- [ ] **Step 3.2 : lancer (attendu : rouge)** — `npx vitest run tests/phase1`
- [ ] **Step 3.3 : implémenter les deux modules** (fonctions pures uniquement).
- [ ] **Step 3.4 : lancer (attendu : vert)** — `npx vitest run tests/phase1`
- [ ] **Step 3.5 : commit** — `feat(phase1): validation serveur points et tarification commandes`

---

### Task 4 : Routes API (loyalty + orders)

**Files:**
- Create: `src/features/loyalty/server.ts` (wrappers `getServiceSupabase().rpc(...)`)
- Create: `src/app/api/loyalty/spend/route.ts`, `refund/route.ts`, `redeem/route.ts`, `earn/route.ts`
- Create: `src/app/api/orders/route.ts`, `src/app/api/orders/cancel/route.ts`

**Interfaces:**
- Consumes: Task 2 RPC ; Task 3 validation.
- Produces: endpoints JSON `{success, balance?, level?, orderNumber?, error?}`.

Pattern imposé (copie de `/api/rewards/claim`) : `createClient()` serveur → `auth.getUser()` → 401 ; `enforceRateLimit(user.id, {scope:'loyalty-spend'|'loyalty-refund'|'loyalty-redeem'|'loyalty-earn'|'orders-create'|'orders-cancel', limit: 20, windowMs: 60_000, failMode:'closed'})` ; `getServiceSupabase()` → 503 ; `rpc(...)` → mapper les erreurs (400/409/500).

- [ ] **Step 4.1 : implémenter le module + 6 routes**
- [ ] **Step 4.2 : `npm run type-check` puis `npm run lint`** — Expected: PASS.
- [ ] **Step 4.3 : commit** — `feat(phase1): routes serveur points et commandes`

---

### Task 5 : Migration des pages (plus aucune écriture cliente de points)

**Files (Modify):**
- `src/app/panier/page.tsx` — `handleApplyLoyaltyFree` → `fetch('/api/loyalty/spend', …)` ; `handleRemoveLoyaltyFree` → `fetch('/api/loyalty/refund', …)` ; en échec : aucun état local modifié, message console.
- `src/app/fidelite/page.tsx` — `handleRedeem` → `fetch('/api/loyalty/redeem', …)` ; mise à jour depuis la réponse.
- `src/app/checkout/page.tsx` — `saveOrderToSupabase` → `fetch('/api/orders', …)` ; suppression des blocs : insert `orders`, update `products.stock`, insert `stock_movements`, « Award loyalty points », RPC `increment_loyalty_points`. Conserver l'insert `gear_items` (équipement utilisateur, hors périmètre) et le flux Stripe `/api/checkout`.
- `src/app/rapport-expedition/page.tsx` — bloc +75 → `fetch('/api/loyalty/earn', { action:'rapport_expedition', sourceId: reportId })` ; supprimer l'insert direct `loyalty_history`.
- `src/app/connexion/page.tsx` — upsert : retirer `trust_score, loyalty_points, loyalty_level, xp, level`.
- `src/app/auth/callback/route.ts` — upsert : retirer les mêmes champs.
- `src/components/compte/CommandesTab.tsx` — `handleCancelOrder` → `fetch('/api/orders/cancel', …)`.

- [ ] **Step 5.1 : modifier les 7 fichiers** ; aucune autre page ne référence `loyalty_history|loyalty_redemptions|reward_transactions` en écriture (vérifier : `rg -n "from\('loyalty_history'\)|from\('loyalty_redemptions'\)" src`).
- [ ] **Step 5.2 : gates** — `npm run type-check && npm run lint && npm test && npm run build` — Expected: PASS.
- [ ] **Step 5.3 : commit** — `feat(phase1): pages points/commandes via routes serveur`

---

### Task 6 : Invariant CI anti-dérive

**Files (Modify):**
- `scripts/verify/ci_invariants.mjs`

**Règle ajoutée :** échec si un fichier de `src/` hors `src/app/api/` contient une écriture client de points : `.from('user_profiles')` + `.update(`/`.upsert(` avec `loyalty_points|loyalty_level|xp|level`, ou `.from('loyalty_history'|'loyalty_redemptions'|'orders')` + `.insert(`/`.update(`/`.upsert(`.

- [ ] **Step 6.1 : étendre `ci_invariants.mjs`** (suivre le style existant).
- [ ] **Step 6.2 : `npm run verify:invariants`** — Expected: PASS (prouve que Task 5 est complète).
- [ ] **Step 6.3 : commit** — `test(phase1): invariant CI écritures clientes de points interdites`

---

### Task 7 : Vérification d'intégration locale

**Files:**
- Create: `scripts/tests/phase1_points_integration.mjs`

- [ ] **Step 7.1 : script d'intégration** (stack locale) : créer 2 utilisateurs (admin API), connexion ; **concurrence** : 2 POST `/api/loyalty/spend` parallèles (somme > solde) ⇒ exactement 1 succès ; refund panier ; échange fidélité (puis double refusé) ; earn rapport idempotent (2 appels, 1 seul crédit) ; commande : `POST /api/orders` ⇒ 1 ligne `purchase` exacte + stock décrémenté + points = `floor(total*10)` ; annulation ⇒ ligne négative unique ; contrôles finaux : `Σ loyalty_history = loyalty_points` pour les 2 comptes.
- [ ] **Step 7.2 : exécuter** — `node scripts/tests/phase1_points_integration.mjs` avec app locale (`scratch/start-dev-local.ps1`) — Expected: PASS complet.
- [ ] **Step 7.3 : smoke Playwright mobile** — `npm run test:e2e:mobile -- --grep @points` (si aucun spec existant, couvrir connexion + page fidélité lecture).
- [ ] **Step 7.4 : commit** — `test(phase1): intégration locale points/commandes (concurrence + idempotence)`

---

### Task 8 : Opérations production (backup → migration → app) + rollback

- [ ] **Step 8.1 : pré-flight lecture seule** : `npx supabase migration list --linked` ; confirmer `trigger_process_order_points` actif (repli : `npx supabase db dump --linked -s public` et recherche du trigger ; si indisponible, le test pgTAP couvre la logique et le trigger est prouvé par le baseline prod `prod_schema_20260911.sql:10461`).
- [ ] **Step 8.2 : backup** — script `scripts/ops/phase1_prod_backup.ps1` : dump horodaté des 9 tables du §6.5 de la spec (`pg_dump --data-only` via pooler, ou `npx supabase db dump`), vérification non vide, rangement `backups/phase1-<timestamp>/`.
- [ ] **Step 8.3 : appliquer la migration** — `npx supabase db push --linked` si la file pendante = uniquement notre migration ; sinon exécution ciblée du fichier. Consigner la sortie.
- [ ] **Step 8.4 : contrôles post-migration** (lecture seule) : policies fermées, `legacy_loyalty_*` présentes service_role, nombre de lignes `opening_balance` créées, `Σ journal = profil` par utilisateur (échantillon complet), compte des outbox/ledger inchangé.
- [ ] **Step 8.5 : déployer l'app** — push branche + merge `main` (Vercel). Surveiller le build.
- [ ] **Step 8.6 : smoke prod** : login, page fidélité, panier (lecture), `/api/loyalty/spend` refusé sans session (401).
- [ ] **Step 8.7 : readiness rollback** : down migration prête dans `migrations_down/`, backup vérifié, promotion de l'ancien déploiement Vercel documentée. Commit final — `docs(phase1): rapport de déploiement incrément 1`.

---

## Self-Review (rempli à l'écriture)

- **Couverture spec §6.1-6.5 :** garde (T2), policies (T2), backfill (T2), 4 RPC legacy + create_shop_order (T2), routes (T4), pages (T5), tests pgTAP (T1), vitest (T3), concurrence (T7), invariants (T6), backup/déploiement/rollback (T8). ✔
- **Cohérence des noms :** `legacy_loyalty_*` identiques entre test T1, migration T2, routes T4. ✔
- **Placeholders :** corps RPC renvoyés à la spec §6.1 avec contraintes non négociables (les bodies complets seront écrits à l'exécution T2 sous revue database) — décision d'exécution documentée. ✔
