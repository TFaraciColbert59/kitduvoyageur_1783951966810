# AUD-VA-03 — Reprise transactionnelle du checkout Stripe

État du 30 octobre 2026 : correction source, tests locaux et migration préparés.
Aucune migration ni écriture Stripe/Supabase en production n'a été exécutée.

## Problème et comportement obtenu

Une commande existante n'attestait pas la création des articles, du mouvement de
stock, des droits ou de la part créateur. Le webhook s'arrêtait pourtant sur son
existence. Un incident entre deux écritures pouvait laisser une commande
incomplète définitivement acquittée ; plusieurs erreurs étaient également
avalées.

Le webhook reprend désormais les événements checkout restés `processing`, y
compris après l'arrêt d'un worker. L'index unique de session conserve une seule
commande. Le RPC `resume_stripe_checkout` verrouille celle-ci et les produits dans
un ordre stable, puis traite les articles, mouvements de stock, encaissement et
droits dans la même transaction. Une erreur annule tous ces effets du RPC. Un
article historique unique et son prix sont conservés ; le mouvement de stock
historique constitue la preuve de déstockage. Des doublons historiques ambigus
provoquent un refus explicite plutôt qu'une seconde vente devinée.

Les prix des nouveaux articles proviennent des montants des lignes Stripe
effectivement réglées, après remise, sans relire le prix actuel du catalogue.
Toutes les pages Stripe sont lues. Les nouveaux paiements transportent le
`product_id` dans les métadonnées du produit Stripe. Les anciens paiements ne
peuvent reprendre automatiquement que si leurs descriptions et quantités serveur
identifient les produits sans ambiguïté et réconcilient le panier complet.

La part créateur, idempotente par article, est rejouée après le RPC. Ses erreurs
de lecture et d'écriture empêchent l'acquittement de l'événement. `p_shares` est
transmis sous forme de tableau JSON, conformément au paramètre PostgreSQL JSONB.
Le marquage `processed` vérifie que la réservation existe encore. Un worker
checkout en échec ne supprime jamais la réservation d'un autre worker.

Les wrappers d'attribution et de remboursement utilisent le même verrou de
commande. Le remboursement inscrit `stripe_refund_seen_at` avant de reverser les
parts. Une attribution tardive ou une reprise ne peut donc recréer des effets
après cette barrière. Si le remboursement précède le premier encaissement,
la reprise refuse explicitement une réussite et exige une réconciliation
financière : le marqueur reste conservé, aucun article ni droit n'est ressuscité.

Les anciens identifiants de kits sans ligne canonique dans `shop_products` ne
peuvent pas satisfaire la clé étrangère des articles de commande. Un nouveau
checkout les refuse maintenant **avant** la création de la session Stripe, avec
un message d'indisponibilité. L'échec de persistance d'un panier externalisé
empêche également la création d'un paiement.

## Validation reproductible

- Vitest : `tests/security/phase8-stripe-{webhook,eventstore,events}.spec.ts` et
  `tests/checkout/`. Tests hors réseau, faux Stripe/Supabase.
- SQL : `psql "$LOCAL_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f tests/sql/stripe-checkout-resume.sql`
  dans une base locale vide et jetable. Le fixture charge les véritables
  migrations historiques de stock, attributions, droits et encaissement, puis
  la nouvelle migration. Les tables de prérequis sont minimales ; ce n'est pas
  un rejeu de l'ensemble du schéma de production.
- Rejeu effectué localement sur PostgreSQL 18.6 via PGlite 0.5.13 : 160
  instructions réussies, réparation historique, prix conservés, idempotence,
  union des passes et plan maximal, plan sans passe, barrière de remboursement,
  rollback après panne d'encaissement puis reprise et contrôle des privilèges.
- `node tests/sql/stripe-checkout-concurrency.mjs` : charge ce même fixture et
  ouvre deux connexions natives. Le contrôleur observe un véritable verrou
  PostgreSQL avant de libérer le premier worker, puis vérifie un seul effet de
  chaque type. Un second scénario fait attendre l'attribution derrière un
  remboursement. Le lanceur refuse les hôtes distants et les noms de bases
  autres que des bases de test LKDV. Ce test nécessite `psql` ; PGlite seul ne
  prouve pas la concurrence entre connexions. Son résultat CI doit être vérifié
  séparément avant clôture de ce contrôle.

## Ordre de livraison et limites

1. Sauvegarder et réconcilier les commandes historiques ambiguës sur une copie.
2. Rejouer les tests sur le schéma cible et appliquer
   `20261029120000_stripe_checkout_resume.sql` avant le nouveau webhook.
3. Vérifier les cas Stripe de test, puis activer le webhook avec les secrets
   existants. Aucun secret n'est inclus dans ce correctif.

La migration conserve les fonctions historiques sous des noms privés et leur
retire `EXECUTE` pour les rôles clients et `service_role` ; seuls les nouveaux
wrappers publics du serveur peuvent les appeler. Il s'agit d'une migration
en avant, pas d'un script de retour arrière destructif.

Restent à réconcilier explicitement : anciens paiements de kits non canoniques,
lignes ou mouvements historiques multiples, descriptions legacy ambiguës et
événements déjà marqués `processed` par l'ancien code. Ils ne sont pas réparés
automatiquement par cette migration.

Un remboursement arrivé avant toute création de commande n'a toujours pas de
tombstone de session : ce correctif ne prétend pas résoudre ce cas. Le calcul
concurrent des deltas de plusieurs événements de remboursement cumulés reste à
durcir dans un RPC dédié. Les sorties de stock et droits déjà accordés avant un
remboursement suivent encore les règles historiques de retour ; cette barrière
empêche leur création tardive, elle ne les révoque pas rétroactivement.
