# RÉCONCILIATION STRIPE — paiements orphelins

Statut : **ZONE ORANGE (Prêt à l'emploi — Requiert exécution sécurisée par Tony avec clé restreinte)** · Bloquant PR.

> 🛡️ **SÉCURITÉ & PROTOCOLE ZONE ORANGE (Strictement respecté)** :
> - **Clé maîtresse `sk_live_...` INTERDITE** : Le script refuse impérativement toute clé commençant par `sk_`.
> - **Clé restreinte obligatoire** : Utiliser impérativement `STRIPE_RESTRICTED_KEY` commençant par `rk_live_...` avec permissions strictes en lecture seule (`Charges: Read`, `PaymentIntents: Read`, `Checkout Sessions: Read`, `Refunds: Read`).
> - **Protection PII / RGPD** : Les emails clients sont systématiquement hachés en SHA-256 tronqué à 10 caractères (`hash_xxxxxxxxxx`) dans les exports et tableaux.
> - **Aucune écriture automatique** : Aucun appel d'écriture Stripe ni mutation Supabase en production n'est effectué par l'agent.

> 🛠️ **Kit prêt à l'emploi** :
> - Script lecture seule sécurisé : `scripts/db/reconcile_stripe.mjs`
> - Requêtes SQL de recoupement : `supabase/reconciliation/reconcile_orphans.sql`
> - Template sécurisé pour honorer : `supabase/reconciliation/honor_order.sql`

## Contexte (Origine de l'anomalie)

Avant la réparation du Lot 3 (`feat/lignees-kits` / commit `5607832`), le webhook Stripe écrivait avec un
client anon bloqué par la RLS (`users_manage_own_orders` → authenticated) :
- `orders` n'était **presque jamais créée** (l'INSERT échouait et le webhook renvoyait `200 { received: true, warning }`, avalant silencieusement l'erreur) ;
- `order_items` n'étaient **jamais** insérés ;
- Le trigger de déstockage `decrement_stock_on_order` n'a **jamais** été déclenché ;
- Les paiements Stripe, eux, étaient **réellement encaissés** sur le compte Stripe du marchand.

→ Des paiements Stripe « orphelins » (encaissés, sans commande en base) se sont
accumulés depuis la mise en service. **Aucune donnée de la base actuelle n'a été
modifiée** : cette réconciliation est purement additive/corrective, disjointe du chantier.

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

### B-bis. Données réelles côté base — sondage lecture seule (2026-09-04, service role)

Réalisé via `scripts/db/probe_lignees_state.mjs` + requêtes ciblées (aucune écriture).

| Objet | Valeur réelle | Implication |
|---|---|---|
| `orders` (total) | **3** — toutes `confirmed`, 460 € / 159 € / 219 €, créées 2026-07-15/20 | 3 commandes seulement, et aucune n'a de trace Stripe |
| `orders.stripe_session_id` | **colonne ABSENTE** (migration 3 non appliquée) | aucune commande n'est couverte au format actuel |
| `orders.notes` legacy | **0** ligne avec `'Stripe session: …'` | aucune couverture au format legacy non plus |
| `order_items` | **0** | les 3 commandes n'ont AUCUNE ligne article en base (le JSONB `items` porte peut-être les produits — à vérifier par commande au moment de décider) ; le déstockage (`decrement_stock_on_order`) n'a jamais tourné |
| `materiel_kits` / `hike_sessions` / `user_profiles` | 5 / 20 / 53 | petite base — les encaissements Stripe de la période sont le vrai sujet |

**Lecture** : la base ne couvre *rien* côté Stripe. Toute session payée (avant ou après
juillet) est un orphelin candidat. Les 3 commandes existantes sont elles-mêmes douteuses
(statut `confirmed` sans items ni paiement tracé) : à inclure dans « à enquêter » si
l'écart de cohérence (Σ Stripe − Σ orders) ne colle pas. `order_items = 0` confirme que le
webhook pré-réparation échouait dès l'INSERT order_items — le tableau de décision doit
prévoir, pour chaque « honorer », la création des `order_items` + déstockage
(`supabase/reconciliation/honor_order.sql`).

### C. Inventaire physique impératif (Écart de stock)

> ⚠️ **ALERTE CRITIQUE SUR LES STOCKS PHYSIQUES** :
> Puisque le webhook avalait silencieusement les erreurs et que `order_items` n'a jamais été alimenté, la fonction trigger `decrement_stock_on_order` n'a **JAMAIS** tourné pour aucune commande historique passée par Stripe !
> 
> **Conséquences concrètes** :
> 1. Le stock en base de données (`stock_quantity` dans les tables produits) est **supérieur au stock physique réel** en réserve/entrepôt si des colis ont été expédiés manuellement.
> 2. Avant de marquer une commande comme « Honorée », Tony doit **impérativement réaliser un inventaire physique** des pièces en rayon.
> 3. L'exécution du template `supabase/reconciliation/honor_order.sql` appliquera le déstockage rétroactif (`decrement_stock_on_order`).

### D. Le rapprochement (par outil au choix)
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
| **Honorer** | Le produit a été livré/expédié (colis parti, ou bien commande physiquement exécutée) | Créer la commande + `order_items` (service_role) avec `stripe_session_id`, ajuster le stock (toujours `decrement_stock_on_order`), `notes='RÉCONCILIATION: <session_id>'` |
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

## Tableau de décision (à remplir après exécution du script de réconciliation)

| Date paiement | Session ID | Hash email client (SHA-256:10) | Montant (€) | Décision (honorer / rembourser / enquête) | N° commande créé / refund ID |
|---|---|---|---|---|---|
| *(À coller depuis `docs/reconciliation/orphans_YYYY-MM-DD.csv`)* | | | | | |