# Plan — Produits / inventaire unifiés
Spec : docs/superpowers/specs/2026-10-04-unified-inventory-design.md

1. Backend : module partagé src/features/materiel/domain/inventory.ts, schémas, InventoryItem, API items POST/PATCH et transitions, migration additive avec historique et compatibilité prêts. Tests comportementaux domaine/API et validation SQL locale. Ne pas toucher les composants.
2. Frontend : InventoryWorkspace et InventoryCard, formulaire contextualisé intégré à la page, statuts, modes, filtres et actions. Préremplissage catalogue via query product_id et API catalogue restreinte si nécessaire. Tests interactions.
3. Intégration et revue : lien fiche produit vers inventaire, corriger incohérences trouvées, vérifications et documentation mise en service et dépendances externes.

Ruling : la demande explicite d'autonomie prévaut sur les validations intermédiaires du skill brainstorming. Travaux dans la branche isolée work existante ; aucun déploiement production implicite. Exécuter les tâches sans pause de confirmation.
