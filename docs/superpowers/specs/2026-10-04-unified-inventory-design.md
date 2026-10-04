# Refonte produits / inventaire

Le rapport joint est une proposition fonctionnelle. La demande utilisateur autorise sa réalisation en autonomie ; les choix ordinaires de conception sont délégués.

## Architecture retenue
Conserver shop_products comme catalogue et product_ownership comme exemplaires privés : pas de duplication destructive ni migration des tables historiques. Ajouter product_id facultatif FK catalogue, serial_number privé (unicité par propriétaire, car non vérifié), description, location, listing_mode (personnel, vente, location, pret), status (en_stock, a_acheter, a_louer, a_preter, en_location, en_pret, vendu), rental_price_cents et deposit_cents. quantity existant conservé ; objet sérialisé quantité 1. condition reste l'état physique indépendant. Synchroniser is_lent avec en_pret pour les consommateurs existants. Migration additive, backfill fiable des prêts. RLS propriétaire conservée, historique privé des changements de statut horodaté et immuable côté client.

## Parcours
Inventaire unique : recherche nom / marque / série / description / localisation, filtres catégorie, statut, mode et localisation ; badge de statut en liste et cartes ; détail et création/édition contextualisés en page, formulaire commun avec mode d'abord et prix adaptés. Actions explicites vente finalisée (suivi manuel sans prétendre déclencher un paiement), départ/retour location et prêt. Empêcher transitions incohérentes et édition générique contournant les transactions actives. API authentifiée avec contrôle propriétaire, validation serveur et protection concurrence. Liens catalogue → inventaire pour enregistrer un objet prérempli ; inventaire → fiche catalogue pour achat.

## Limites honnêtes
Un numéro de série n'est pas un GTIN. Ne pas inventer de fournisseur GS1 ni affirmer garantie vérifiée. Réutiliser Stripe existant uniquement pour ses capacités réelles ; ne pas présenter les paiements manuels d'inventaire comme des paiements sécurisés marketplace. Fonds retenus, assurance, KYC et avis vérifiés demandent une intégration fournisseur et un cadre juridique ; documenter les dépendances et l'existant au lieu d'afficher un service fictif.

## Vérification
Tests domaine et schéma, routes (401, 400, 404, conflit, propriétaire et transitions), SQL sur base locale isolée si possible avec rôles/RLS, interface (filtres, formulaires et états réseau), type-check, lint ciblé et build. Revue indépendante avant clôture. Documenter séparément non-exécutés et dépendances.
