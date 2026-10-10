# Dispatch Instructions

## 2026-10-04T09:45:20Z

You are the Project Orchestrator for the task defined in ORIGINAL_REQUEST.md.

Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\orchestrator_2
Project directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810
Original Request file: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\ORIGINAL_REQUEST.md

Mission:
Implémenter et industrialiser de bout en bout l'architecture « LKDV Social » (système de messagerie et communauté outdoor d'aventure) sur la base du domaine canonique `src/features/messaging` et de Supabase sans créer de système parallèle.

Requirements:
1. R1. Audit et fiabilisation du socle canonique de messagerie:
   Consolider `src/features/messaging/` et les schémas de données associés sans rupture : support DM, groupes, adhésions, pagination cursor, ordonnancement déterministe avec séquence conversationnelle, idempotence d'envoi (`client_nonce`), lecture agrégée (`last_read_sequence`), synchronisation offline/reconnexion, RLS Supabase strict et tests de non-régression.
2. R2. Objets outdoor de premier rang & Cartes enrichies:
   Intégrer les cartes métier vivantes du Kit du Voyageur (tracés GPX/itinéraires, kits avec logique Pack Merge, pièces d'équipement, fiches d'activité, expéditions), avec snapshot d'affichage performant et synchronisation vers les entités canoniques de LKDV sans duplication d'objets métier corrompus.
3. R3. Espaces communautaires & Expedition Rooms:
   Implémenter la structure de clubs (salons thématiques, rôles et permissions modulaires : propriétaire, admin, guide, sécurité, membre) et les "Expedition Rooms" réunissant dans une même vue conversation, météo, itinéraire GPX, checklist partagée et check-ins terrain.
4. R4. Intégration de Terra & Réputation collaborative:
   Intégrer Terra comme participant explicite avec modèle d'isolation des permissions par conversation, résumés "Quiet Catch-Up", extraction de décisions et citations précises des messages sources. Déployer un modèle de points de contribution basé sur l'utilité réciproque et des streaks collectifs d'aventure sans incitation au spam de messages bruts. Les actions proposées par Terra (création d'expédition, sondages) restent au stade de brouillon avant validation par un utilisateur.

Acceptance Criteria:
- Aucun doublon de message lors d'une perte/reconnexion réseau (validation de l'idempotence via `client_nonce`).
- Ordonnancement strict garanti par numéro de séquence par conversation.
- Isolation RLS validée : aucun utilisateur ne peut lire ni poster dans des conversations dont il n'est pas membre.
- Maintien de l'intégrité de `messagingService.ts` avec tests unitaires et d'intégration validés.
- Affichage fluide et interactif des cartes GPX et Kits sans saturation du thread de discussion.
- Synchronisation temps réel des kits et expéditions sans duplication d'objets métier corrompus.
- Terra n'a accès qu'aux contextes expressément partagés dans la conversation et cite systématiquement ses messages sources.
- Les actions proposées par Terra (création d'expédition, sondages) restent au stade de brouillon avant validation par un utilisateur.
