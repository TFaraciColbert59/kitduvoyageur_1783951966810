# Complément marketplace et mise en production

Autorisation : l’utilisateur demande de terminer en autonomie et publier en production. Les confirmations procédurales du workflow sont couvertes par cette autorisation ; les contrats fournisseur et clés manquantes ne peuvent pas être inventés.

## Architecture

Conserver l’inventaire privé canonique et ajouter annonces publiques par consentement explicite. Aucune série, localisation privée, contact ou historique dans la projection publique. Les descriptions et communes publiques sont saisis explicitement. Aucune annonce statique, score inventé, succès sans persistance ou versement fictif dans les parcours occasion/location.

Les transactions sont des accords et remises suivis manuellement, sans encaissement, fonds retenus ni garantie. Un paiement externe ne sera jamais présenté comme protégé. Le prix et la caution sont figés à la demande. Les participants et états sont contrôlés dans PostgreSQL, avec verrouillage pour empêcher les engagements concurrents, actions atomiques avec inventaire et audit immuable. Vente terminée seulement après remise propriétaire et réception acquéreur ; location/prêt terminés après retour demandé par emprunteur puis confirmé par propriétaire. Avis réservés aux participants de transactions terminées, un par participant, sans prétendre à un paiement vérifié. Signalements persistants, propriétaires ne peuvent ni s’auto-évaluer ni modérer leurs avis. Admin/modérateur contrôlé par fonctions existantes, jamais user_metadata.

## Interface et contrat

- GET `/api/marketplace/listings?mode=vente|location|pret` public, `{listings}` ; POST auth `{item_id,description,public_location,price_cents}` → `{listing}` (201).
- POST `/api/marketplace/listings/[id]/actions` `{action:withdraw|publish|hide}` ; hide réservé admin/modérateur.
- GET `/api/marketplace/transactions` auth → `{transactions}` avec snapshots annonce.
- POST même endpoint `{listing_id,start_date?,end_date?}` → `{transaction}` (201). Email confirmé requis publication/demande ; âge/budgets/assurance non prétendus.
- POST `/api/marketplace/transactions/[id]/actions` `{action:accept|handover|receive|return|complete_return|cancel|dispute,note?,tracking_code?}` → `{transaction}`. requested → accepted (propriétaire) → active (remise propriétaire) → completed (réception acheteur vente) ou return_pending (retour emprunteur) → completed (confirmation propriétaire). Annulation requested/accepted seulement, pas après remise. Litige active/return_pending conserve l’indisponibilité et crée un dossier durable ; clôture admin documentée et autorisée.
- POST `/api/marketplace/reviews` `{transaction_id,rating,comment}` ; GET mêmes avis publics liés à annonces, pas coordonnées personnelles.
- POST `/api/marketplace/reports` `{listing_id,reason}`. Déduplication et plafonds en base ; endpoint/actions modération réservé aux rôles existants.
- Contact vendeur par messagerie directe existante, erreurs réelles visibles.
- `/occasion` et `/location` réutilisent un composant public commun, sans formulaires modaux ; publier via `/hub/inventaire` (choix objet existant).
- Hub inventory : lien vers le suivi des annonces et transactions dans la même page ; choix objet à publier + prix/location/caution, description publique et commune distincte. Transactions inline selon rôle et état. UI claire sur suivi manuel et services non activés.
- `/contact` persiste un ticket privé via `/api/support/tickets` auth ; le succès contient un numéro réel. Lecture auteur/admin seulement, utilisateur n’altère pas l’état de traitement. Aucun engagement 24/7 sans équipe.
- Recherche EAN dans catalogue local, contrôle clé EAN, aucune affirmation de vérification universelle de série/GS1. Reprise du formulaire inventaire via identifiant catalogue.

## Dépendances impossibles à activer sans configuration

Stripe Connect, reversements, GS1/constructeur, KYC, assurance et transporteur exigent comptes/contrats vérifiables. Sans eux, aucune collecte de pièce d’identité, préautorisation de caution, paiement prétendument protégé ou garantie. Interface et documentation donnent un état honnête ; pages légales ne prétendent pas une validation juridique.

## Validation et déploiement

Tests domaine/API/composants ; PostgreSQL 17 isolé : rôles, concurrence, confidentialité, audit, transitions et avis. Tests réels avec comptes jetables, nettoyage exact de ces comptes. TypeScript, lint, build production, revue indépendante. Migrations additives en base confirmée avant frontend ; publication par PR attendue puis fusion explicitement autorisée. Vérifier Vercel commit de production, URL de production renvoyée par le déploiement et les parcours. Préserver les données historiques ; ne pas rejouer les anciens bootstraps en production.
