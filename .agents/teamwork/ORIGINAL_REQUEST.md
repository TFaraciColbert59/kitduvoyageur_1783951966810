# Original User Request

## 2026-10-03T17:15:53Z

Use a coordinated multi-agent team partitioned by domain specialties: Database & Security Specialist, Recommendation Algorithm & Backend Specialist, and Apple HIG Frontend Specialist.

Implémentation de production de bout en bout de l'architecture communautaire LKDV par étapes coordonnées : durcissement de sécurité du Reward Engine (RLS / RPC / search_path), migrations du graphe social & interactions persistantes (saves, feedback, hide), moteur de recommandation déterministe Feed V1 (pools de candidats, score d'utilité multi-signaux, reranking de diversité) et intégration UI Next.js respectant l'ergonomie mobile native.

Working directory: `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810`
Integrity mode: development

## Requirements

### R1. Hardening sécurité du Reward Engine et des RPC Supabase
Auditer et restreindre les fonctions `SECURITY DEFINER` (notamment `claim_reward_points` et interactions sociales), fixer des `search_path` stricts (`search_path = public, pg_temp`), et garantir qu'aucun utilisateur non authentifié ou falsifié ne puisse s'octroyer des points ou contourner les politiques RLS.

### R2. Schéma & Graphe social d'interactions persistantes
Étendre le modèle de données Supabase pour stocker et indexer de manière pérenne les signaux d'intérêt forts (enregistrements/saves de posts et carnets, masquages/hide, retours explicites 'pas intéressé', réactions d'utilité et de sécurité, signalements) avec RLS étanches.

### R3. Moteur de recommandation Feed V1 déterministe & Multi-surfaces
Implémenter un pipeline de recommandation côté serveur articulé en génération de pools de candidats (Abonnements, Clubs, Géo/Territoire, Voyage/Intention, Découverte), filtrage strict de confidentialité, calcul de score d'utilité multi-signaux valorisant la préparation d'aventures réelles, et reranking de diversité.

### R4. Interface communautaire et contrôles de transparence utilisateur
Moderniser l'expérience mobile Next.js (/communaute) avec les quatre vues principales (Pour toi, Abonnements chronologique, Autour de moi, Clubs), intégrer les contrôles explicites de transparence ('Pourquoi je vois ce contenu', 'Moins comme ceci', 'Enregistrer'), et fiabiliser l'accès aux carnets durables et clubs.

## Acceptance Criteria

### Sécurité & Données (R1, R2)
- [ ] Les fonctions RPC privilégiées (dont `claim_reward_points`) exigent une authentification stricte (`auth.uid() = user_id`) et interdisent les appels anonymes avec code d'erreur explicite.
- [ ] Toutes les fonctions `SECURITY DEFINER` ciblées possèdent un `SET search_path = public, pg_temp` immuable.
- [ ] Les tables `post_saves`, `content_feedback`, et les réactions sémantiques sont créées avec clés étrangères, index de performance et politiques RLS validées.

### Moteur de Recommandation & Feed V1 (R3)
- [ ] Le pipeline de scoring Feed V1 calcule les scores de candidats via la formule d'utilité pondérée (Intent, Quality, Geographic, Utility > simple engagement) avec tests unitaires Vitest automatisés.
- [ ] Le reranker de diversité garantit un plafond d'éléments consécutifs par auteur (max 2) et par typologie de format.
- [ ] Les éléments recommandés incluent les métadonnées de transparence explicatives ("Pourquoi je vois ceci").

### Interface & Intégration Mobile (R4)
- [ ] La page `/communaute` prend en charge les 4 onglets opérationnels (Pour toi, Abonnements chronologique, Autour de moi, Clubs) avec transition fluide.
- [ ] Les boutons Sauvegarder, Masquer et "Moins comme ceci" déclenchent une mutation persistante et un retour haptique/visuel immédiat.
- [ ] `npm run type-check` (TypeScript) s'exécute avec 0 erreur.
- [ ] `npm run lint` s'exécute avec succès sans régression sur les fichiers modifiés.
- [ ] La suite de tests unitaires `npm run test` (Vitest) passe à 100% au vert.


## 2026-10-04T09:43:18Z

Implémenter et industrialiser de bout en bout l'architecture « LKDV Social » (système de messagerie et communauté outdoor d'aventure) sur la base du domaine canonique `src/features/messaging` et de Supabase sans créer de système parallèle.

Working directory: c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810
Integrity mode: development

## Requirements

### R1. Audit et fiabilisation du socle canonique de messagerie
Consolider `src/features/messaging/` et les schémas de données associés sans rupture : support DM, groupes, adhésions, pagination cursor, ordonnancement déterministe avec séquence conversationnelle, idempotence d'envoi (`client_nonce`), lecture agrégée (`last_read_sequence`), synchronisation offline/reconnexion, RLS Supabase strict et tests de non-régression.

### R2. Objets outdoor de premier rang & Cartes enrichies
Intégrer les cartes métier vivantes du Kit du Voyageur (tracés GPX/itinéraires, kits avec logique Pack Merge, pièces d'équipement, fiches d'activité, expéditions), avec snapshot d'affichage performant et synchronisation vers les entités canoniques de LKDV.

### R3. Espaces communautaires & Expedition Rooms
Implémenter la structure de clubs (salons thématiques, rôles et permissions modulaires : propriétaire, admin, guide, sécurité, membre) et les "Expedition Rooms" réunissant dans une même vue conversation, météo, itinéraire GPX, checklist partagée et check-ins terrain.

### R4. Intégration de Terra & Réputation collaborative
Intégrer Terra comme participant explicite avec modèle d'isolation des permissions par conversation, résumés "Quiet Catch-Up", extraction de décisions et citations précises des messages sources. Déployer un modèle de points de contribution basé sur l'utilité réciproque et des streaks collectifs d'aventure sans incitation au spam de messages bruts.

## Acceptance Criteria

### Socle & Fiabilité
- [ ] Aucun doublon de message lors d'une perte/reconnexion réseau (validation de l'idempotence via `client_nonce`).
- [ ] Ordonnancement strict garanti par numéro de séquence par conversation.
- [ ] Isolation RLS validée : aucun utilisateur ne peut lire ni poster dans des conversations dont il n'est pas membre.
- [ ] Maintien de l'intégrité de `messagingService.ts` avec tests unitaires et d'intégration validés.

### Objets Métier & Expéditions
- [ ] Affichage fluide et interactif des cartes GPX et Kits sans saturation du thread de discussion.
- [ ] Synchronisation temps réel des kits et expéditions sans duplication d'objets métier corrompus.

### IA Terra & Sécurité
- [ ] Terra n'a accès qu'aux contextes expressément partagés dans la conversation et cite systématiquement ses messages sources.
- [ ] Les actions proposées par Terra (création d'expédition, sondages) restent au stade de brouillon avant validation par un utilisateur.
