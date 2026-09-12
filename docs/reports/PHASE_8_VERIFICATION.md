# PHASE 8 — Vérification (Paiement, sécurité, vie privée et conformité)

**Date :** 2026-09-12
**Branche :** `feat/phase8-security-payments` — commit code `b43d9ecd` (base `919afdef` = `origin/main`)
**Environnement :** Supabase local Docker (`127.0.0.1:54322`, replay baseline prod + migrations) + vitest + pgTAP ; **aucune clé Stripe, aucun paiement réel, aucun appel réseau Stripe**
**Responsable :** agent SECURITY/BACKEND/DATABASE + ORCHESTRATOR (périmètre technique) ; juridique = humain habilité non saisi
**Décision :** **PASS (périmètre local technique)** — **INSUFFICIENT_DATA** pour Stripe réel, Upstash réel, juridique et opérations externes (jamais `PASS`)

---

## 1. Revue RLS exhaustive

### 1.1 Inventaire (schéma local réel, `information_schema` + `pg_class`/`pg_policies`)

- **224 tables** dans `public` ; **223 avec RLS activée**.
- 1 table sans RLS : `spatial_ref_sys` (catalogue PostGIS, propriétaire `supabase_admin`).
  Vérifié : **aucun privilège** accordé à `anon`/`authenticated` → aucun accès
  client possible. Activation RLS impossible avec le rôle de migration
  (`must be owner of table`) → `INSUFFICIENT_DATA` ops (propriétaire requis).
- 3 tables RLS activée sans policy : `message_mentions`, `notification_deliveries`,
  `royalty_config` → **deny-all clients** (service uniquement). Comportement sûr,
  documenté ; pas un trou d'accès.

### 1.2 Trous trouvés (héritage baseline, non couverts A1–A14) et corrigés

Migration additive `supabase/migrations/20260911550000_phase8_rls_hardening.sql` :

| # | Table(s) | Trou | Correctif |
|---|---|---|---|
| 1 | `hike_sessions` | 4 policies `USING/CHECK true` pour `public` → lectures GPS/traces et UPDATE/DELETE de **toutes** les sessions | SELECT propriétaire **ou** carnet explicitement `public` ; INSERT/UPDATE/DELETE propriétaire (`user_id = auth.uid()`) |
| 2 | `carnet_moments`, `carnet_kit_items` | policies seed `true` → contenus de carnets **privés** lisibles par tous | policies seed supprimées (la lecture scopée existante reste l'autorité) |
| 3 | `groupe_messages` | SELECT `true` → messages de groupe privés lisibles par tous | SELECT réservé aux membres (`groupe_membres`) |
| 4 | `comment_reports` | SELECT `true` → tous les signalements lisibles par tous | SELECT signalant / modérateur / admin |
| 5 | `community_posts` | `auth_like_community_posts` UPDATE `true` → modification de n'importe quel post par tout compte | policy supprimée (aucun code ne l'utilise) |
| 6 | `affiliate_clicks/conversions/offers/partners/programs` | policies `FOR ALL` publiques → INSERT/UPDATE/DELETE anonymes | lectures publiques réduites à SELECT ; conversions en service_role (code `recordAffiliateConversion` passé service) |
| 7 | `hub_dashboard_kpis` | grants anon/authenticated restaurés (dérive post-REVOKE V7) sur vue DEFINER | `REVOKE ALL` ré-appliqué |
| 8 | 6 vues publiques (`terrain_reports_public`, `public_profiles`, …) | privilèges DML complets hérités | DML révoqué, SELECT conservé |
| 9 | `spatial_ref_sys` | RLS off (cf. 1.1) | tentative idempotente (échec privilèges → notice), pas d'exposition constatée |

### 1.3 Escalade verticale corrigée

Migration `20260911551000_phase8_user_profile_privileged_columns.sql` :

- Constat : `users_manage_own_profiles` laissait chaque compte modifier
  **`role`** (→ `is_admin()`), **`trust_score`** (→ lecture `moderation_queue`),
  suspension, 2FA, e-mail.
- Correctif : trigger `guard_user_profile_privileged_columns` (BEFORE INSERT OR
  UPDATE) refusant ces colonnes aux rôles `authenticated`/`anon` (admin existant
  et rôles système exemptés). `is_admin()` repassé **SECURITY DEFINER** +
  `search_path` figé pour supprimer la récursion de policy révélée par les tests.
- Neutralisé côté client : `ReportBlockModal.tsx` tentait déjà de suspendre
  autrui (bloqué par RLS, désormais aussi par le trigger).

### 1.4 Tests d'accès (pgTAP, exécutés)

`supabase/tests/database/phase8_rls_access.test.sql` — **40/40 ok** :

- **Horizontal** (A vs B) : carnets privés, sessions GPS, moments/matériel de
  carnet, voyages, POI, plans, documents, commandes, messages, signalements,
  entitlements d'autrui invisibles ; modifications croisées sans effet (valeurs
  revérifiées post-rollback) ; contrôle positif carnet/session `public`.
- **Vertical** : auto-promotion `role='admin'` refusée, `trust_score=100`
  refusé, `full_name` autorisé ; `moderation_queue` invisible ; entitlements
  non insérables/non modifiables par le client (serveur uniquement) ;
  `stripe_events` inaccessible à `authenticated`, accessible `service_role`.

## 2. Stripe robuste (sans clé)

### 2.1 Livré

- **Vérification de signature** conservée : `stripe.webhooks.constructEvent`
  (corps brut + en-tête `stripe-signature` + `STRIPE_WEBHOOK_SECRET`).
- **Idempotence événement** : table additive `public.stripe_events`
  (migration `20260911552000_phase8_stripe_events.sql`), RLS FORCE, zéro policy,
  `service_role` uniquement, **aucune PII** (id, type, kind, objet, statut).
  Réservation avant effets de bord ; doublon `23505` acquitté ; échec ⇒
  réservation supprimée + HTTP 500 (retry Stripe), jamais de perte silencieuse.
- **Classification explicite** (`src/lib/stripe/events.ts`) : paiement
  (`checkout.session.completed`), renouvellement (`invoice.paid` /
  `invoice.payment_succeeded`), échec (`invoice.payment_failed`), remboursement
  (`charge.refunded`), annulation (`customer.subscription.deleted`), `ignored`.
- **Renouvellement** : grant d'entitlement uniquement si les métadonnées serveur
  portent un `user_id` + plan/pass reconnus (aucun plan deviné).
- **Annulation / échec** : journalisés sans écriture (pas de révocation sans
  stockage d'abonnement vérifié — limite assumée).
- **Entitlements serveur uniquement** : écritures `user_entitlements`
  réservées au service_role/webhook (testé pgTAP + vitest) ; le client ne peut
  ni forger, ni modifier, ni lire que sa propre ligne.
- **Price IDs** : 6 clés pilotées par env (`STRIPE_PRICE_*`), fail-safe
  `configured:false` sans clé/price (aucune valeur inventée). Liste exacte et
  procédure dans `docs/compliance/07_STRIPE_PRICE_IDS.md`.

### 2.2 Tests (mockés, zéro réseau) — 28 vitest

- `tests/security/phase8-stripe-webhook.spec.ts` (10) : secret absent 503,
  signature invalide 400 sans réservation, type inconnu `ignored`, doublon
  acquitté, **paiement** (commande + articles + déstockage + grant),
  **renouvellement**, **échec**, **remboursement** (reverse commission),
  **annulation**, échec de traitement ⇒ libération + 500.
- `tests/security/phase8-stripe-events.spec.ts` (13) : classifications,
  résumé sans PII, extraction de grant, 6 price IDs + fail-safe.
- `tests/security/phase8-stripe-eventstore.spec.ts` (5) : réservation/doublon/
  erreur/marquage/libération.
- `tests/security/phase8-entitlements-forge.spec.ts` (2) : paramètres client
  forgés ignorés, secret/prix jamais exposés.

## 3. Anti-abus (code-side)

- Rate limiting Phase 6 existant vérifié sur 9 routes.
- Garde uniforme `src/lib/rate-limit/routes.ts` + **10 handlers** nouvellement
  protégés : `rewards/claim` (30/min, closed), `rewards/withdraw` (5/h, closed),
  `account/export` (10/h, open), `account/delete` (5/h, open),
  `carnet/identify-species` (10/min, closed), `kit-report/generate` (10/min,
  closed), `trip-assistant` (20/min, closed), `telemetry/hub` (120/min, open),
  `notifications/subscribe` (20/min, open), `hike-sessions` POST (30/min, open).
- Webhook Stripe volontairement non limité (signature + idempotence ; préserver
  les retries).
- WAF / bot management Vercel = **configuration externe** documentée
  (`docs/compliance/08_ANTI_ABUS_OPS_WAF.md`) — `INSUFFICIENT_DATA`.

## 4. Conformité (brouillons)

`docs/compliance/` : README + 8 squelettes, tous marqués
**`À VALIDER PAR UN HUMAIN HABILITÉ`** : rétention/sauvegardes, DPA/transferts,
AIPD, DPO/contact (**aucun DPO nommé**), règles communautaires + modération +
appel, mentions légales par marché, price IDs Stripe, anti-abus ops/WAF.

**Aucune validation juridique n'est simulée ; le gate Phase 8 reste fermé.**

## 5. Commandes et résultats bruts

| Commande | Résultat |
|---|---|
| `npm run type-check` | **exit 0** (0 erreur) |
| `npm run lint` | **exit 0** (0 erreur, warnings préexistants) |
| `npm run test` (vitest complet) | **2155 passed / 27 skipped / 0 failed** — 303 fichiers passés, 4 skipped |
| `npx supabase test db --db-url …:54322` | **19 fichiers / 380 tests — Result: PASS** |
| `supabase/tests/…/phase8_rls_access.test.sql` | **40/40 ok** |
| Nouveaux tests vitest Phase 8 | **30/30** (28 Stripe + 2 entitlements) |
| `npm run verify:invariants` | **exit 0** (aucun secret, invariants CI verts) |

## 6. Baselines visuelles

**Aucune UI modifiée** (aucun composant, aucune page) → **aucune baseline
visuelle impactée, aucune régénération nécessaire.**

## 7. Limites (honnêtes) et risques résiduels

1. **Aucune clé Stripe** : `configured:false`, **aucun paiement/abonnement réel
   testé** ; les tests sont exclusivement mockés (`INSUFFICIENT_DATA`).
2. **Annulation/échec d'abonnement** : journalisés, pas de révocation
   d'entitlement (aucun stockage d'abonnement vérifié) — à implémenter avec les
   clés réelles.
3. **Upstash réel absent** : rate limiting testé en repli mémoire uniquement
   (`INSUFFICIENT_DATA`).
4. **Affiliation** : `recordAffiliateConversion` exige désormais le service_role ;
   le postback réel Travelpayouts n'a pas été rejoué (`INSUFFICIENT_DATA`).
5. **`spatial_ref_sys`** : RLS non activable avec le rôle de migration (owner
   `supabase_admin`) ; aucun accès client constaté, item ops.
6. **`loyalty_points`/`xp`/`level` restent modifiables par leur propriétaire**
   (flux produit existants panier/fidélité) : dette d'intégrité métier
   documentée, non un vecteur d'accès inter-utilisateurs ni admin.
7. **Aucune validation juridique** : brouillons uniquement.

## 8. Décision

**PASS (périmètre local technique)**.
`INSUFFICIENT_DATA` (jamais `PASS`) : Stripe réel, Upstash réel, juridique,
WAF/bot management, région/sauvegardes, DPO.
