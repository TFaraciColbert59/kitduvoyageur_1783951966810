# Réconciliation Stripe — kit de déblocage

> Document cadre : `docs/reports/RECONCILIATION_STRIPE.md` (tableau de décision à remplir).
> Antoine de la PR Lignées — blocage identifié le 2026-09-04 : le doc existe mais n'est
> **pas rempli** ; le chantier « Orientation & Empreinte » ne démarre pas avant.

## Deux chemins, une seule vérité (sessions checkout payées, en mode LIVE)

| Chemin | Quand | Quoi |
|---|---|---|
| **A. Script Node** (recommandé) | `node` dispo, clés dans `.env.local` | `scripts/db/reconcile_stripe.mjs` — liste, croise, sort CSV+JSON prêts à décider |
| **B. SQL console** | pas de CLI/node, ou vérification croisée | `supabase/reconciliation/reconcile_orphans.sql` |

Puis, par orphelin, une décision → `supabase/reconciliation/honor_order.sql` (honorer) ou
`stripe refunds create --payment-intent <pi>` (rembourser). Chaque ligne tracée dans le
tableau de `RECONCILIATION_STRIPE.md`.

## A. Script Node

```bash
# .env.local — ajouter (ne jamais commiter) :
#   STRIPE_SECRET_KEY=sk_live_...        ← MODE LIVE obligatoire pour les vrais orphelins
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SUPABASE_URL=...   (ou NEXT_PUBLIC_SUPABASE_URL)

node scripts/db/reconcile_stripe.mjs [--limit 300]
```

- **Lecture seule** : aucune écriture Stripe ni Supabase.
- `sk_test_…` → warning : la réconciliation test ne montre pas les encaissements réels.
- Sorties : `docs/reconciliation/orphans_<date>.csv` (tableau de décision) +
  `orphans_<date>.json` (line items, product_id → alimente `honor_order.sql`).
- Affiche aussi un indicateur de cohérence ΣStripe − refunds − Σorders (à interpréter).

## B. SQL console (copie d'abord)

1. `CREATE TABLE tmp_stripe_sessions …` + import CSV (voir `reconcile_orphans.sql` §0).
2. Exécuter les requêtes de couverture puis la requête des orphelins (§1-2).

## Décisions — règle d'engagement (du doc cadre)

- **Honorer** : UNIQUEMENT si le colis est parti / commande exécutée. → `honor_order.sql`.
- **Rembourser** : rien n'a été livré → refund Stripe (jamais de commande créée).
- **Enquête** : doute (montant incohérent, produit inconnu) → ne rien toucher.

Priorité : montants récents, puis les plus élevés. Après traitement : vérifier
`Σ orders(total_eur) ≈ Σ Stripe − refunds − enquêtes` et activer la réconciliation
mensuelle comme contrôle de santé.