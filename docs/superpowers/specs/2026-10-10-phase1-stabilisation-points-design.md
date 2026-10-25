# Phase 1 — Stabilisation du système de points LKDV — Design

> **Statut :** validé en autonomie (mandat utilisateur du 2026-10-10 : « agent autonome à 100 %, prends toutes les décisions seul, objectif : Phase 1 complète et opérationnelle »).
> **Environnement :** projet hébergé `icxyvwzfjbflcbqukpfz` (production) + stack locale `127.0.0.1:54321`.
> **Aucune donnée, aucun solde, aucun paramètre de production n'a été modifié pendant l'audit** (lecture seule).

---

## 1. Objectif et critères de sortie

Fiabiliser le moteur de points existant sans perdre les points acquis, jusqu'aux critères du rapport d'audit :

1. Les utilisateurs ne peuvent plus modifier arbitrairement leurs points.
2. Chaque nouveau gain est justifié par une action réelle, vérifiée côté serveur.
3. Un même événement ne crédite jamais deux fois (idempotence).
4. Soldes économiques et points de progression cohérents avec leurs journaux.
5. Données de démonstration exclues des calculs réels.
6. Les 7 producteurs d'aventure fonctionnent aux tests.
7. Les anciens comptes conservent droits et historiques.
8. Toute anomalie détectable, explicable et réparable sans correction manuelle opaque.
9. Tests de régression, sécurité et concurrence réussis.

---

## 2. Constat vérifié dans le dépôt (preuves)

| # | Fait | Preuve |
|---|------|--------|
| 1 | Les 15 transactions de progression sans événement viennent du seed démo : 15 `PROGRESSION_AWARD` (`counts_for_progression=true`), outbox neutralisée en `processed` sans passer par le consumer, projection `user_progression` écrite à la main. Signature exacte : 15 tx / 15 outbox / 0 événements. | `scripts/seed/seed_ultra_demo.mjs:478-618` |
| 2 | Écritures navigateur de `user_profiles.loyalty_points` encore actives : panier (débit + remboursement), fidélité (échange), checkout (fallback), rapport-expédition (+75). | `src/app/panier/page.tsx:86,108` · `src/app/fidelite/page.tsx:117` · `src/app/checkout/page.tsx:234` · `src/app/rapport-expedition/page.tsx:421` |
| 3 | `loyalty_history` accepte les INSERT `authenticated` (`WITH CHECK user_id = auth.uid()`) ; le trigger `sync_loyalty_points` (SECURITY DEFINER) recalcule `user_profiles.loyalty_points = SUM(points)`. ⇒ **forge de solde** possible sans toucher la colonne protégée. | policy `auth_insert_loyalty_history` (prod dump) · `supabase/baseline/prod_schema_20260911.sql:3200-3213` |
| 4 | `loyalty_redemptions` accepte les INSERT `authenticated` (policy `auth_insert_loyalty_redemptions`). | prod dump, policies |
| 5 | Le garde-fou Phase 8 protège role/trust_score/suspension/2FA/email mais **pas** `loyalty_points`, `loyalty_level`, `xp`, `level` (dette documentée). | `supabase/migrations/20260911551000_phase8_user_profile_privileged_columns.sql:17-20` |
| 6 | Le trigger `process_order_points` (actif en prod) crédite déjà les commandes confirmées (`total_eur × 10`, `source_id = 'order_<id>'`). Le bloc checkout côté client fait donc **double crédit** (ou code mort selon le chemin d'erreur du RPC inexistant `increment_loyalty_points`). | `prod_schema_20260911.sql:2440-2472, 10461` · `checkout/page.tsx:220-246` |
| 7 | Déjà verrouillés service_role (hardening 2026-09-20/21) : `claim_reward_points`, `redeem_reward`, `update_loyalty_points`, `process_order_points` (EXECUTE), `sync_loyalty_points` (EXECUTE), `process_progression_outbox`, purge/rejeu outbox. | `20260920110000_hardening.sql:205-214` · `20260921100000_legacy_hardening.sql:318-396` |
| 8 | Le moteur canonique existe et est testé : ledger `reward_transactions`, `progression_decisions` (idempotence `source_type:source_id`), outbox + consumer, `award_progression_gain` (service_role), rebuild, réconciliation, classements k-anonymes. | `20260919*` → `20260921*`, tests `supabase/tests/database/progression_canonique_*.test.sql` |
| 9 | Les 7 producteurs canoniques sont définis côté serveur. | `src/features/progression/server/awardProducer.ts:13-20` (`hike_session_processed`, `trail_prepared`, `kit_field_report`, `place_review`, `carnet_published`, `checklist_completed`, `trip_completed`) |
| 10 | Comptes démo déjà neutralisés en prod (mots de passe fermés, bannis) mais **données conservées** (profils, ledger, projections). | `supabase/migrations/20261009120000_invalidate_seed_credentials.sql` |

**Conclusion :** pas de panne du moteur. Le risque est l'ensemble des **chemins legacy d'écriture navigateur** encore ouverts en production + les **données de démo non réconciliées**.

---

## 3. Principes d'architecture

- **Un seul circuit de validation serveur** pour toute écriture de points ; des soldes séparés selon leur finalité :
  - **Progression** (`user_progression`, `progression_events`, `user_season_progress`) : projection du ledger `reward_transactions` via outbox. Point d'entrée unique : `award_progression_gain` (service_role).
  - **Économie legacy** (`loyalty_points`, `loyalty_history`, `loyalty_redemptions`) : conservée en Phase 1, protégée, journalière. Point d'entrée unique : RPC `legacy_loyalty_*` (service_role), appelées par des routes API à session vérifiée.
  - **Économie canonique de récompenses** (`reward_accounts`, `reward_transactions.affects_balance`) : déjà serveur-only ; non modifiée en Phase 1.
- **Le navigateur n'écrit plus jamais de points** : ni colonnes de `user_profiles`, ni `loyalty_history`, ni `loyalty_redemptions`, ni `reward_transactions`, ni `progression_*`.
- **Aucun solde perdu** : les soldes legacy sont d'abord réconciliés avec leur journal (backfill d'ouvertures), puis les écritures directes sont fermées.
- **Pas de nettoyage aveugle** : toute correction de données passe par snapshot + journal + script vérifiable (`progression_legacy_snapshot` existe déjà pour ce rôle).

---

## 4. Décisions prises (journal)

| # | Décision | Justification |
|---|----------|---------------|
| D1 | Ne pas fusionner l'économie legacy dans le reward engine pendant Phase 1 ; la conserver protégée et cohérente avec son journal. | Critère « les anciens comptes conservent leurs droits et historiques » ; la fusion est un chantier produit ultérieur. |
| D2 | Toute écriture points passe par RPC `SECURITY DEFINER` service_role + routes API à session vérifiée. | Critère 1 et 2 ; pattern déjà en place (`claim_reward_points` + `/api/rewards/claim`). |
| D3 | Backfill `loyalty_history` avec une ligne d'ouverture par utilisateur en écart (`type='opening_balance'`, `source_id='opening:<uuid>:v1'`) **avant** de fermer les écritures. | Le trigger `sync_loyalty_points` recalcule le solde = Σ journal ; sans backfill, le premier mouvement écraserait les soldes seedés. Critère « aucun solde perdu ». |
| D4 | Checkout : supprimer le crédit client ; le trigger `process_order_points` reste l'unique crédit commande (vérifié actif en prod avant déploiement). | Évite le double crédit (critère 3). |
| D5 | Données démo : reconstruire la progression du compte démo via le consumer canonique (rejeu propre de l'outbox), marquer `is_demo`, exclure des classements/agrégats. | Critères 5 et 8 ; provenance vérifiée sans perte (les tx seed sont déjà dans le ledger avec idempotency_key). |
| D6 | Ordre de déploiement : **backup prod → migration DB → déploiement app**, avec migration descendante fournie. La fenêtre où l'ancien client rencontre la nouvelle DB est fail-safe (opérations refusées proprement, aucune corruption). | Le pattern inverse (`claim_revoke_after_app_deploy`) laisserait la forge ouverte plus longtemps ; les pages legacy échouent proprement en 4xx. |
| D7 | Barèmes : la progression garde `progression_level_for` (1-10) comme source unique ; le `loyalty_level` legacy conserve l'échelle commerciale historique (7500/3500/1500/500 → Explorateur) recalculée côté serveur à chaque mouvement. | Critère 4 ; aucune contradiction nouvelle, alignement complet en incrément 5. |
| D8 | Idempotence : toute RPC legacy prend un `source_id` stable (`order_<id>`, `cart_free_apply:<item>`, `reward_<id>`, `rapport:<id>`, `opening:<uuid>:v1`) et refuse un rejeu. | Critère 3. |

---

## 5. Incréments

Mapping avec les chantiers du rapport : P0 = I1+I2 ; P1 = I3+I4 ; P2 = I5+I6a ; P3 = I6b.

### I1 — Soldes hors de portée du navigateur (P0) — détail §6
Garde colonnes élargi, fermeture des policies d'écriture legacy, backfill d'ouvertures, RPC `legacy_loyalty_*`, routes API, migration des 4 pages + 2 upserts, tests sécurité/concurrence, backup + rollback.

### I2 — Données démo isolées et réconciliées (P0)
- Diagnostic reproductible (`scripts/audit/phase1_demo_and_projection_scan.mjs`, lecture seule) : compte démo, totaux ledger ≠ projections, lignes outbox sans événement.
- Flag `user_profiles.is_demo boolean not null default false` + backfill (comptes démo et emails seedés) ; exclusion des classements/agrégats (`refresh_leaderboard_for_user`, purge `progression_leaderboard_agg`).
- Reconstruction canonique : outbox du compte démo remise `pending`, `process_progression_outbox()` rejoué → `progression_events` créés, projection recalculée (idempotent, ne recrédite pas : la projection est reconstruite, pas incrémentée — passage par `rebuild_progression_from_ledger` pour les users avec tx).
- Snapshot avant toute écriture (`progression_legacy_snapshot`).

### I3 — Producteurs et ledger (P1)
- Inventaire exhaustif des producteurs (`awardProducer` + tous les appels `award_progression_gain` / `claim_reward_points`) ; fermeture de tout chemin résiduel.
- Tests d'intégration des 7 producteurs (base locale) : un gain chacun, rejeu idempotent, cap respecté.

### I4 — Réconciliation des soldes historiques (P1)
- Rapport d'écarts (`scripts/audit/phase1_loyalty_reconcile.mjs`) : profil vs Σ journal vs ledger canonique.
- Correction documentée des écarts restants (jamais silencieuse).

### I5 — Uniformisation niveaux/barèmes + badges/saisons/classements + états vides (P2)
- Fidélité affiche le niveau canonique (`user_progression`), plus d'échelle dupliquée côté client.
- Vérification badges (déblocages réels), saisons (ouverture/clôture), classements (k-anonymat, exclusion démo).
- Correction des états vides/erreurs qui affichent de fausses récompenses.

### I6 — Supervision, E2E, déploiement (P2/P3)
- `scripts/ops/phase1_points_anomaly_scan.mjs` : contrôles (Σ journal ≠ profil, outbox dead, tx sans événement, gains sans décision) + sortie non-nulle si anomalie.
- Invariant CI (`scripts/verify/ci_invariants.mjs`) : interdiction des écritures clientes de points dans `src/`.
- E2E mobile (Playwright `mobile-chromium` / `mobile-webkit`) sur connexion → fidélité → panier → checkout.
- Déploiement progressif : migrations + app, rollback documenté et testé.

---

## 6. I1 — Design détaillé

### 6.1 Migration `supabase/migrations/20261010140000_phase1_balance_lockdown.sql`

1. **Garde colonnes v2** — `CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()` :
   - INSERT : refus pour authenticated/anon si `role ≠ 'user'`, `trust_score ≠ 50`, `is_suspended_groups ≠ false`, `suspended_from_groups_at IS NOT NULL`, `two_fa_enabled ≠ false`, **`loyalty_points ≠ 0`, `loyalty_level ≠ 'Explorateur'`, `xp ≠ 0`, `level ≠ 1`** (défauts vérifiés : `supabase/replay/a10_replay_bootstrap.sql:1273-1280`).
   - UPDATE : refus si l'une des colonnes privilégiées **ou l'une des 4 nouvelles** change (`IS DISTINCT FROM`). Valeurs inchangées : autorisées.
   - Admin existant (UPDATE) et rôles système (`auth.role()` NULL ou ≠ authenticated/anon) : inchangés.
2. **Fermeture des écritures legacy** :
   - `DROP POLICY IF EXISTS auth_insert_loyalty_history ON public.loyalty_history;`
   - `DROP POLICY IF EXISTS auth_insert_loyalty_redemptions ON public.loyalty_redemptions;`
   - `REVOKE INSERT, UPDATE, DELETE ON public.loyalty_history, public.loyalty_redemptions FROM anon, authenticated;` (ceinture + bretelles ; SELECT conservé).
3. **Backfill d'ouvertures** (idempotent) :
   ```sql
   INSERT INTO public.loyalty_history (user_id, action, points, type, source_id)
   SELECT p.id, 'Solde reporté (réconciliation Phase 1)', p.loyalty_points - COALESCE(j.sum_points, 0),
          'opening_balance', 'opening:' || p.id || ':v1'
   FROM public.user_profiles p
   LEFT JOIN (SELECT user_id, SUM(points) AS sum_points FROM public.loyalty_history GROUP BY user_id) j
     ON j.user_id = p.id
   WHERE p.loyalty_points - COALESCE(j.sum_points, 0) <> 0
     AND NOT EXISTS (SELECT 1 FROM public.loyalty_history h WHERE h.source_id = 'opening:' || p.id || ':v1');
   ```
   Le trigger `sync_loyalty_points` rejoue et fixe `loyalty_points = Σ journal` (valeur inchangée par construction).
4. **RPC legacy (SECURITY DEFINER, `SET search_path = public, pg_temp`, REVOKE PUBLIC/anon/authenticated, GRANT service_role)** :
   - `legacy_loyalty_spend(p_user_id uuid, p_points int, p_reason text, p_source_id text) RETURNS jsonb`
     - `p_points > 0`, verrou `SELECT id FROM user_profiles WHERE id = p_user_id FOR UPDATE` (sérialisation par utilisateur) ;
     - idempotence : `source_id` déjà présent ⇒ `{success:true, idempotent:true, balance}` ;
     - solde = Σ journal ; insuffisant ⇒ `{success:false, error:'insufficient_balance', balance}` ;
     - INSERT journal négatif (`type='spent'`), recalcul `loyalty_level` (échelle D7), retour `{success:true, balance}`.
   - `legacy_loyalty_earn(p_user_id, p_points, p_reason, p_source_id, p_type text default 'earned')` : symétrique, `p_points > 0`.
   - `legacy_loyalty_cart_refund(p_user_id uuid, p_cart_item_id text)` : n'agit que si `cart_free_apply:<id>` existe (montant repris **du journal**, jamais du client) ; `cart_free_remove:<id>` déjà présent ⇒ idempotent ; INSERT positif `type='cart_refund'`.
   - `legacy_loyalty_redeem(p_user_id uuid, p_reward_id uuid)` : verrou profil ; récompense existante et `available` ; échange déjà présent (user, reward) ⇒ `{success:false, error:'already_redeemed'}` ; solde suffisant ; INSERT journal négatif (`type='reward_redemption'`, `source_id='reward_<id>'`) + `loyalty_redemptions` ; recalcul niveau ; retour solde. (Reprend la logique de `redeem_reward`, déjà service_role, en ajoutant idempotence + verrou ; `redeem_reward` reste en place.)
5. **Commandes — fermeture du chemin client** (forge de commandes ⇒ forge de points via trigger) :
   - `DROP POLICY IF EXISTS users_manage_own_orders ON public.orders;` puis création `orders_select_own` (SELECT own uniquement) ;
   - `REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;`
   - Nouvelle RPC `create_shop_order(p_user_id uuid, p_payment_method text, p_shipping_address jsonb, p_items jsonb, p_shipping_option text) RETURNS jsonb` (SECURITY DEFINER, service_role) : résout chaque produit via la vue `products`/`shop_products` (tout slug inconnu ⇒ refus), calcule sous-total/livraison/total **côté serveur** (règles identiques page : livraison 5,9 € sauf standard ≥ 99 €), insère la commande `status='confirmed'`, décrémente le stock via `decrement_stock_on_order` (par article), retourne `{id, order_number, total_eur}`. Atomique (une transaction). Le trigger `process_order_points` reste l'unique créditeur.
6. **Aucune autre modification** : `sync_loyalty_points`, `process_order_points`, `update_loyalty_points` inchangés.

Migration descendante : `supabase/migrations_down/20261010140000_phase1_balance_lockdown.down.sql` (garde v1 restaurée, policies recréées, RPC supprimées, lignes `opening:%:v1` supprimées, grants restaurés).

### 6.2 Routes API (session vérifiée → service_role)

Helper `src/lib/loyalty/server.ts` :
- `spendPoints(userId, points, reason, sourceId)`, `refundCartItem(userId, cartItemId)`, `redeemLoyaltyReward(userId, rewardId)`, `earnForAction(userId, action, sourceId)` avec **barème serveur** (`rapport_expedition: 75` — constante actuelle reprise), jamais de points fournis par le client.
- Client service : `getServiceSupabase()` (`src/lib/ai/serviceClient.ts`) ; auth : `createClient()` serveur + `auth.getUser()` ; rate limit : `enforceRateLimit` (scope `loyalty-*`, 20/min, `failMode: 'closed'` — les points sont une ressource monétaire).

Routes :
- `src/app/api/loyalty/spend/route.ts` — body `{ points, reason, sourceId }` (points validés entiers > 0) ;
- `src/app/api/loyalty/refund/route.ts` — body `{ cartItemId }` ;
- `src/app/api/loyalty/redeem/route.ts` — body `{ rewardId }` ;
- `src/app/api/loyalty/earn/route.ts` — body `{ action, sourceId }` ;
- `src/app/api/orders/route.ts` — POST création commande virement (session vérifiée → `create_shop_order`) ;
- `src/app/api/orders/cancel/route.ts` — POST annulation (`user_id = session`, statut `confirmed` uniquement) ;
- Réponses : `{ success, balance, level? }` / `{ success, orderNumber }` ; erreurs métier 400/409, non authentifié 401, indisponible 503.

### 6.3 Pages modifiées

| Fichier | Changement |
|---------|------------|
| `src/app/panier/page.tsx` | `handleApplyLoyaltyFree` → POST `/api/loyalty/spend` ; `handleRemoveLoyaltyFree` → POST `/api/loyalty/refund` ; solde mis à jour depuis la réponse ; en échec, aucun état local modifié. |
| `src/app/fidelite/page.tsx` | `handleRedeem` → POST `/api/loyalty/redeem` ; recharge les données depuis la réponse ; erreurs affichées via l'état `error` existant. |
| `src/app/checkout/page.tsx` | Virement → POST `/api/orders` (plus d'insert commande/stock/points côté client) ; suppression du bloc « Award loyalty points » (double crédit). Le trigger `process_order_points` reste seul créditeur. |
| `src/app/rapport-expedition/page.tsx` | +75 → POST `/api/loyalty/earn` `{ action: 'rapport_expedition', sourceId: reportId }`. |
| `src/components/compte/CommandesTab.tsx` | Annulation → POST `/api/orders/cancel` (plus d'update client). |
| `src/app/connexion/page.tsx` | Upsert : suppression de `trust_score`, `loyalty_points`, `loyalty_level`, `xp`, `level` (créés par `handle_new_user`). |
| `src/app/auth/callback/route.ts` | Idem. |

### 6.4 Tests

- **pgTAP** `supabase/tests/database/phase1_balance_lockdown.test.sql` (pattern `phase8_rls_access.test.sql:199-201` pour les rôles) :
  1. authenticated ne peut PLUS modifier `loyalty_points` / `loyalty_level` / `xp` / `level` (erreur 42501) ;
  2. authenticated PEUT toujours modifier `full_name` / `bio` (contrôle positif) ;
  3. authenticated ne peut plus INSERT `loyalty_history` / `loyalty_redemptions` ;
  4. policies `auth_insert_*` absentes, `has_table_privilege` INSERT = false ;
  5. `legacy_loyalty_spend` : solde insuffisant refusé ; solde ok débité ; rejeu idempotent ; niveau recalculé ;
  6. `legacy_loyalty_earn` : crédit + niveau ;
  7. `legacy_loyalty_cart_refund` : sans apply refusé ; montant repris du journal ; rejeu idempotent ;
  8. `legacy_loyalty_redeem` : double échange refusé ; solde insuffisant refusé ; échange nominal ;
  9. privilèges : `has_function_privilege('authenticated', …) = false` pour les 4 RPC legacy + `create_shop_order` ;
  10. trigger commande : une commande confirmée ⇒ exactement 1 ligne `purchase` `source_id='order_<id>'` ;
  11. authenticated ne peut plus INSERT/UPDATE `orders` (RLS) ; SELECT own conservé ;
  12. `create_shop_order` : slug inconnu ⇒ refus ; prix/total recalculés serveur (le total client est ignoré) ; stock décrémenté + `stock_movements` tracé ; annulation `confirmed → cancelled` ⇒ ligne `purchase_cancel` négative, exactement une.
- **Vitest** : tests unitaires des handlers (mock service client) sur validation d'entrée et mapping d'erreurs ; invariant `scripts/verify/ci_invariants.mjs` étendu (aucune écriture client de points dans `src/` hors `src/app/api/`).
- **Intégration concurrence** (local, routes) : deux POST `/api/loyalty/spend` parallèles dont la somme dépasse le solde ⇒ exactement une réussite.

### 6.5 Déploiement et retour arrière

1. Branche `chantier/phase1-points` ; gates locaux : `npx supabase db reset`, `npx supabase test db`, `npm run type-check`, `npm run lint`, `npm test`, `npm run build`.
2. **Backup prod** (avant toute écriture) : dump des tables `user_profiles`, `loyalty_history`, `loyalty_redemptions`, `user_progression`, `user_season_progress`, `progression_events`, `progression_outbox`, `reward_transactions`, `progression_legacy_snapshot` (`scripts/ops/phase1_prod_backup.ps1`), vérifié non vide et horodaté.
3. Migration DB prod (`supabase db push --linked` si la file de migrations pendantes est exactement la nôtre ; sinon exécution ciblée du fichier via psql/pooler).
4. Vérification post-migration read-only (script d'inspection) : invariants 3, 4, 9 au vert ; compte des lignes d'ouverture créées.
5. Déploiement app (merge `main` → Vercel) ; vérification E2E prod légère (login, page fidélité, panier).
6. **Rollback** : exécuter la migration descendante + redéployer la version précédente ; documenter la fenêtre.

### 6.6 Fenêtre de transition (acceptée)

Après la migration DB et avant le déploiement app, les anciens bundles peuvent encore tenter des écritures directes : elles échouent proprement (4xx, aucune corruption, aucune forge). Aucun nouveau gain n'est perdu côté serveur : les commandes restent créditées par trigger.

---

## 7. Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Trigger `orders` absent en prod (crédit commande perdu si on retire le client) | Vérification `pg_trigger` + test pgTAP commande **avant** déploiement ; sinon repli : crédit commande via route earn `order_confirmed` (source `order_<id>`). |
| Backfill d'ouverture mal borné | Idempotent par `source_id` unique logique ; snapshot avant ; script de contrôle Σ journal = profil après coup. |
| Solde négatif par course | Verrou `FOR UPDATE` par utilisateur + refus serveur ; test de concurrence dédié. |
| `loyalty_level` désynchronisé après mouvements serveur | Recalcul dans chaque RPC (échelle historique D7) ; test pgTAP associé. |
| Migration prod interrompue | Fichier transactionnel unique ; down migration prête ; backup préalable. |
| Régression pages legacy | Tests vitest + E2E local ; réponses d'erreur typées affichées par les états existants. |

---

## 8. Hors périmètre Phase 1

- Fusion de l'économie legacy dans `reward_accounts` (chantier produit ultérieur, D1).
- Refonte du barème économique (valeurs de `loyalty_rewards`, `pointsNeededForFree`).
- Nouveaux droits monétaires (`cashout`) — déjà serveur-only.

---

## Annexe A — Inventaire des écrivains de points (avant I1)

| Producteur | Chemin actuel | Après I1 |
|------------|---------------|----------|
| Commandes boutique | Trigger `process_order_points` (serveur) + double crédit client checkout | Trigger seul |
| Rapport d'expédition | Client `+75` direct | Route earn (barème serveur) |
| Article offert (panier) | Client débit direct | Route spend |
| Remboursement panier | Client crédit direct | Route refund (montant journal) |
| Échange fidélité | Client débit direct | Route redeem |
| Connexion/SSO upsert | Client (valeurs par défaut seulement) | Champs retirés (trigger `handle_new_user`) |
| Progression (7 producteurs) | `award_progression_gain` service_role | inchangé |
| Récompenses communautaires | `claim_reward_points` service_role | inchangé |
| Seed démo | Script direct | I2 : rejeu canonique + `is_demo` |
