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
| `20260903050000_kit_attributions.sql` | **❄️ EXCLUE de cette vague (Lot 6 gelé)** — code livré dans la branche, migration non appliquée : le crédit boutique n'est pas consommable au checkout (Phase 2), une part créateur serait une promesse non tenue. Tables absentes de la base tant que la décision n'est pas prise. |

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

## 4. Checklist d'exposition de données (Lot 8.2) — à confirmer par les sorties pgTAP réelles

> Les ✅ ci-dessous sont des garanties de DESIGN, pas des preuves d'exécution. Elles
> doivent être confirmées par les sorties des 5 suites pgTAP (GATE 1) — coller les
> sorties à la section 4bis.

- ☐ Aucune coordonnée GPS d'autrui : `get_kit_journal` n'émet que massifs (régions) et
  compteurs ; les `positions_geojson` ne sortent jamais via un partage.
- ☐ Aucun nom d'utilisateur dans les compteurs d'usage : journal anonymisé.
- ☐ `kit_field_reports` lisible uniquement par son propriétaire (RLS own) ; l'exposition
  publique passe par les matviews agrégées (read-only) — jamais les verdicts unitaires.
- ☐ XSS : entrées (`name`, `description`, `note`, verdicts) validées zod côté serveur,
  rendu React (échappé) ; `note` plafonnée à 500 caractères.
- ☐ Tables d'écriture : `checkout_intents`, `kit_attributions`, `kit_royalty_shares`
  (écriture), `store_credit_ledger` — aucun insert client possible (service_role seul),
  vérifié par `security_lignees.test.sql`.

### 4bis. Sorties pgTAP réelles (à coller après exécution sur copie)

| Suite | Assertions attendues | Sortie à coller |
|---|---|---|
| `lineage.test.sql` | ok 14/14 | ☐ |
| `field_proof.test.sql` | ok 15/15 | ☐ |
| `conservation.test.sql` | ok 8/8 | ☐ |
| `attributions.test.sql` | ok 7/7 | ☐ |
| `security_lignees.test.sql` | ok 10/10 | ☐ |

## 5. Endpoints livrés

`GET /api/kits/[id]/sheet` · `GET /api/kits/[id]/refer` · `POST /api/kits/[id]/field-report` ·
`GET /api/kits/discovery` · `GET /api/kits/my-royalties` · `GET /api/cron/refresh-kit-scores` ·
`GET /api/cron/finalize-kit-attributions` (Bearer CRON_SECRET) + refonte
`/api/materiel/fork` (filiation), `/api/checkout` (metadata + kit_ref), `/api/stripe/webhook`
(service_role + attributions + refund).

## 6. Ce qui reste à la main de Tony (infra UNIQUEMENT)

1. **Réconciliation Stripe** (bloquant PR) : `docs/reports/RECONCILIATION_STRIPE.md` —
   paiements encaissés sans commande (avant Lot 3), décision par orphelin.
2. Appliquer les **5 migrations de la vague** (la 6e, attributions, est EXCLUE — Lot 6
   gelé) + backfill sur une **copie** Supabase (`icxyvwzfjbflcbqukpfz`) ; exécuter les
   5 suites pgTAP ; coller les sorties en section 4bis → **GATE 1**.
3. `STRIPE_WEBHOOK_SECRET` dans `.env.local` + test Stripe CLI en mode test (commande
   complète : orders + order_items + déstockage) → **GATE 3**.
4. **Scan de sécurité historique (fait, 2026-09-04)** : `.env.local` n'a jamais été
   commité ; `.env` commité puis retiré (`086e6b1`) contenait des clés provider
   probablement placeholder (formats non-live, longueurs 24-53). **Aucun `sk_live_`,
   `whsec_`, `SUPABASE_SERVICE_ROLE_KEY` dans tout l'historique (808 commits).**
   Précaution recommandée : vérifier que les 4 valeurs du `.env.local` actuel diffèrent
   de celles de l'historique ; si doute, rotation OPENAI/GEMINI/ANTHROPIC/PERPLEXITY.
5. **Lot 6 gelé** : flag serveur `KIT_ROYALTY_ENABLED` (défaut désactivé) coupe
   `/api/kits/my-royalties` et la mention KitSheet tant que le crédit boutique n'est pas
   dépensable. Aucun objet Lot 6 en base.
6. **Vitest** : include élargi à `src/**/__tests__/**/*.test.ts` — les 9 suites hiking
   s'exécutent enfin dans `npm test` (312 tests / 52 fichiers). CLAUDE.md corrigé.
7. Application en production + crons (`refresh-kit-scores` ; `finalize-kit-attributions`
   à n'activer qu'avec le Lot 6). Taux bps réel (`royalty_config`) au dégel.