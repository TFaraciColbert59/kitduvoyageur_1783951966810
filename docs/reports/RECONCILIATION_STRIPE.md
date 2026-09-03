# RÉCONCILIATION STRIPE — paiements orphelins

Statut : **À EXÉCUTER (données réelles requises)** · Bloquant PR · Document cadre.

## Contexte (pourquoi il y a des orphelins)

Avant la réparation du Lot 3 (`feat/lignees-kits`), le webhook Stripe écrivait avec un
client **anon** bloqué par la RLS (`users_manage_own_orders` → authenticated) :
- `orders` n'était **presque jamais créée** (l'INSERT échouait → retour `warning` 200) ;
- `order_items` **jamais** insérés, `decrement_stock_on_order` **jamais** appelé ;
- les paiements Stripe, eux, étaient **réellement encaissés** (client payait).

→ Des paiements Stripe « orphelins » (encaissés, sans commande en base) se sont
accumulés depuis la mise en service. **Aucune donnée de la base actuelle n'a été
modifiée** : cette réconciliation est purement additive/corrective, disjoint du chantier.

Après correctif : les nouvelles commandes ont `stripe_session_id` (idempotence) et les
metadata posées ; les ORPHELINS restent ceux d'avant.

## Inventaire nécessaire

Exécuter dans l'ordre (accès admin requis : dashboard Stripe + console Supabase
`icxyvwzfjbflcbqukpfz` / requêtes service_role).

### A. Côté Stripe — la vérité des encaissements
Lister toutes les **sessions checkout `paid`** (ou `charges.succeeded`, non refundées) :

```bash
# CLI Stripe (ou dashboard > Paiements > réussi, non remboursé)
stripe checkout sessions list --limit 100
# convention : exporter en CSV : date, session_id, email, montant, statut, refund
```

Champs nécessaires par paiement : `session_id`, `customer_email`, `amount_total`,
`created`, `refunded` (bool), `line_items` (identité produit).

### B. Côté base — l'existant
```sql
-- Commandes couvertes (nouveau format + ancien notes)
SELECT id, order_number, user_id, total_eur, stripe_session_id, notes, created_at
FROM public.orders
ORDER BY created_at DESC;

-- Paiements Stripe déjà matérialisés (couverture) : par session_id (nouveau)
SELECT stripe_session_id, order_number FROM public.orders
WHERE stripe_session_id IS NOT NULL;

-- (ancien format : notes LIKE 'Stripe session: %')
SELECT id, order_number, notes FROM public.orders
WHERE stripe_session_id IS NULL AND notes LIKE 'Stripe session: %';
```

### C. Le rapprochement (par outil au choix)
Pour chaque session `paid` et non refundée de la liste A, chercher une commande
correspondante en B (par `stripe_session_id`, puis par `notes`). Toute session sans
correspondance = **orphelin**.

En SQL (si on a importé les sessions dans une table de travail `tmp_stripe_sessions`) :
```sql
SELECT ts.session_id, ts.customer_email, ts.amount_total, ts.created
FROM tmp_stripe_sessions ts
LEFT JOIN public.orders o
  ON o.stripe_session_id = ts.session_id
  OR o.notes = 'Stripe session: ' || ts.session_id
WHERE ts.refunded = false
  AND o.id IS NULL
ORDER BY ts.created;
```

## Décision par orphelin (honorer OU rembourser)

Pour CHAQUE orphelin, cocher une case et tracer la décision (tableau en fin de doc) :

| Option | Quand | Action |
|---|---|---|
| **Honorer** | Le produit a été livré/expédié (colis parti, ou bien commande physiquement excécutée) | Créer la commande + `order_items` (service_role) avec `stripe_session_id`, ajuster le stock (toujours `decrement_stock_on_order`), `notes='RÉCONCILIATION: <session_id>'` |
| **Rembourser** | Rien n'a été livré, ou le client demande le remboursement | `stripe refund` de la session (CLI/dashboard), tracer la décision |
| **À enquêter** | Doute (montant incohérent, produit inconnu…) | Ne pas toucher, ouvrir une ligne "enquête" |

**Règle d'engagement** : ne jamais créer une commande "honorée" sans confirmer la
livraison ; ne jamais rembourser sans vérifier qu'aucun colis n'est parti. Prioriser les
montants récents puis les plus élevés.

## Après réconciliation

1. Mettre à jour `MISSION_LOG.md` (n orphelins, n honorés, n remboursés, n en enquête).
2. Vérifier la cohérence : `sum(orders.total_eur)` (période) ≈ `sum(Stripe amount_total)`
   − refunds − orphelins en enquête.
3. Activer la réconciliation périodique (mensuelle) comme contrôle de santé.

## Tableau de décision (à remplir)

| Date paiement | Session ID | Email | Montant (€) | Décision (honorer/rembourser) | N° commande créé / refund ID |
|---|---|---|---|---|---|
| (…) | (…) | (…) | (…) | ☐ … | (…) |