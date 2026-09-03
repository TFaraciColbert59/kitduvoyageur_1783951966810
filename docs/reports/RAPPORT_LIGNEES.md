# RAPPORT — Lignées de kits (L'Épreuve du terrain)

Date : 2026-09-03 · Branche : `feat/lignees-kits` · Statut : **code terminé et vert**
(tsc · 303 tests Vitest · build · lint), **base NON APPLIQUÉE** (validation sur copie en
attente — voir `docs/guides/LIGNEES_VALIDATION_BASE.md`).

## 1. Objectif

Un kit est une **lignée** : il naît dans le configurateur, est emporté sur le terrain,
revient marqué, et quand on le duplique il mute. La métrique fondatrice est le **taux de
conservation d'un objet à travers les générations, pondéré par la preuve terrain GPS** —
inimitable car il exige les trois signaux réunis : filiation (`materiel_kits`/ancestors),
terrain (`hike_sessions`, `kit_field_reports`), commerce (`order_items`, attributions).

**Vocabulaire public** : « lignée », « kit souche », « éprouvé sur le terrain », « gardé
par X voyageurs sur 10 », « part créateur ». Jamais de vocabulaire génétique dans l'UI.

## 2. Migrations livrées (à appliquer dans l'ordre, sur copie puis prod)

| Migration | Objet |
|---|---|
| `20260903010000_kit_lineage.sql` | Filiation : `forked_from`, `lineage_root_id`, `generation`, `ancestors uuid[]`, `origin`, `is_souche`, `field_proven_count` ; `materiel_kit_items.product_id → shop_products` ; `item_key` généré ; `kit_reports.kit_id` ; trigger `handle_kit_lineage` (anti-cycle, profondeur 50, lignée conservée au SET NULL) |
| `20260903020000_kit_field_proof.sql` | `hike_sessions.kit_id` ; `hiking_routes.region` ; `kit_field_reports` (RLS own) ; trigger compteur ≥ 1 km ; `get_kit_journal` (anonymisé RGPD) |
| `20260903030000_stripe_fix.sql` | `checkout_intents` (service_role) ; `orders.payment_method/subtotal_eur/shipping_eur/stripe_session_id UNIQUE` ; search_path sur `decrement_stock_on_order` |
| `20260903040000_kit_conservation.sql` | Matviews `kit_item_survival`, `kit_item_survival_by_kit`, `kit_trust_scores` (2 axes distincts, auto-forks exclus, plancher 5 sessions) ; `refresh_kit_conservation()` |
| `20260903041000_kit_souches_seed.sql` | Compte système LKDV + souches éditoriales (`is_souche`, `souche_editoriale`) |
| `20260903050000_kit_attributions.sql` | `royalty_config` (300 bps, 70/20/10) ; `kit_attributions` (UNIQUE order_item_id) ; `kit_royalty_shares` (RLS own) ; store credit (`reward_accounts.store_credit_cents`, `store_credit_ledger`) ; RPC insert/finalize/reverse |

**Backfill** : `supabase/backfill/kit_lineage_backfill.sql` (non destructif, transaction,
**ROLLBACK final volontaire** — inspecter les NOTICE avant COMMIT).

**Suite de tests DB** (pgTAP, à exécuter sur la copie) :
`lineage.test.sql` (14) · `field_proof.test.sql` (15) · `conservation.test.sql` (8) ·
`attributions.test.sql` (7) · `security_lignees.test.sql` (10).

## 3. Rollback par lot

- **Lot 1-2** : `DROP TRIGGER trg_materiel_kits_lineage / trg_hike_sessions_field_proven_count`,
  `DROP VIEW/CONCURRENTLY` non applicable → `DROP MATERIALIZED VIEW`, `ALTER TABLE ... DROP COLUMN`
  (colonies ajoutées), `DROP TABLE kit_field_reports`. Les données préexistantes ne sont jamais
  modifiées (backfill séparé, annulable).
- **Lot 3** : `DROP TABLE checkout_intents`, `DROP INDEX orders_stripe_session_id_key`,
  `ALTER TABLE orders DROP COLUMN ...` (colonnes v2).
- **Lot 4** : `DROP MATERIALIZED VIEW kit_*`, `DROP FUNCTION refresh_kit_conservation`.
- **Lot 6** : `DROP TABLE kit_royalty_shares, kit_attributions, store_credit_ledger, royalty_config`,
  `ALTER TABLE reward_accounts DROP COLUMN store_credit_cents`, `DROP FUNCTION ...`.

## 4. Checklist d'exposition de données (Lot 8.2) — RÉPONDU

- Aucune coordonnée GPS d'autrui : `get_kit_journal` n'émet que massifs (régions) et
  compteurs ; les `positions_geojson` ne sortent jamais via un partage. ✅
- Aucun nom d'utilisateur dans les compteurs d'usage : journal anonymisé. ✅
- `kit_field_reports` lisible uniquement par son propriétaire (RLS own) ; l'exposition
  publique passe par les matviews agrégées (read-only) — jamais les verdicts unitaires. ✅
- XSS : entrées (`name`, `description`, `note`, verdicts) validées zod côté serveur,
  rendu React (échappé) ; `note` plafonnée à 500 caractères. ✅
- Tables d'écriture : `checkout_intents`, `kit_attributions`, `kit_royalty_shares`
  (écriture), `store_credit_ledger` — aucun insert client possible (service_role seul),
  vérifié par `security_lignees.test.sql`. ✅

## 5. Endpoints livrés

`GET /api/kits/[id]/sheet` · `GET /api/kits/[id]/refer` · `POST /api/kits/[id]/field-report` ·
`GET /api/kits/discovery` · `GET /api/kits/my-royalties` · `GET /api/cron/refresh-kit-scores` ·
`GET /api/cron/finalize-kit-attributions` (Bearer CRON_SECRET) + refonte
`/api/materiel/fork` (filiation), `/api/checkout` (metadata + kit_ref), `/api/stripe/webhook`
(service_role + attributions + refund).

## 6. Ce qui reste à la main de Tony (infra UNIQUEMENT)

1. Appliquer les 6 migrations + backfill sur une **copie** Supabase (`icxyvwzfjbflcbqukpfz`),
   exécuter les 5 suites pgTAP, rapporter les compteurs → **GATE 1**.
2. `STRIPE_WEBHOOK_SECRET` dans `.env.local` + test Stripe CLI en mode test (commande
   complète : orders + order_items + déstockage + attribution) → **GATE 3**.
3. Puis application en production, activation des crons (refresh-kit-scores, 
   finalize-kit-attributions).
4. **Choix GATE 0 en attente** : taux bps réel (config `royalty_config`, défaut 300) ;
   consommation du crédit boutique au checkout (Phase 2, hors chantier).
5. Vérifier la rotation de la clé anon du routeur IA (chantier nemotron, branche parente).