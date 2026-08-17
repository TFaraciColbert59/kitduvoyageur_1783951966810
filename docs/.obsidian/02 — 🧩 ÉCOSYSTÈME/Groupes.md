---
title: Fiche Module — Groupes d'Expédition
aliases:
  - Groupes
  - Expéditions Collectives
  - Coordination de Groupe
tags:
  - module
  - groups
  - social
  - expenses
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# 👥 FICHE MODULE — GROUPES D'EXPÉDITION

---

### 1. Objectif
Faciliter la préparation, l'organisation et la conduite d'expéditions collectives (treks entre amis, sorties club, stages d'alpinisme) en centralisant la communication, le partage équitable des dépenses type Tricount, la répartition du matériel lourd et les votes décisionnels.

---

### 2. UX & Ergonomie
- **Hub d'Expédition Centralisé :** Tableau de bord du groupe avec barre de progression de la préparation.
- **Tricount Intégré :** Saisie ultra-rapide des dépenses communes avec calcul d'équilibre automatique en 1 tap.
- **Sondages Dynamiques :** Votes interactifs avec choix de dates, itinéraires alternatifs et niveaux de difficulté.
- **Répartition du Matériel :** Matrice d'équipements collectifs (tente, popote, réchaud, balise satellite) pour éviter les doublons inutiles dans les sacs.

---

### 3. Pages & Routes
- `/groupes` : Liste des expéditions actives et passées de l'utilisateur.
- `/nouveau-groupe` : Assistant de création d'une nouvelle expédition avec lien d'invitation magique.
- `/groupes/[groupId]` : Vue principale de l'expédition (Chat, Dépenses, Sondages, Tâches, Matériel).

---

### 4. Composants
- `src/components/groups/GroupDashboard.tsx` : Vue d'ensemble de l'expédition.
- `src/components/groups/ExpenseSplitter.tsx` : Module de calcul et d'équilibrage des frais.
- `src/components/groups/GroupChat.tsx` : Messagerie d'expédition avec partage de positions.
- `src/components/groups/PollCard.tsx` : Composant de vote en direct avec visualisation des résultats.

---

### 5. Données & Schéma
- Rôles hiérarchiques dans le groupe : `owner` (créateur), `admin` (co-organisateur), `member` (participant).
- Statuts de membre : `invited`, `pending`, `accepted`, `declined`.
- Calcul des balances financières en centimes d'euros pour éviter les erreurs d'arrondi flottant.

---

### 6. Tables Supabase
- `travel_groups` : Entité groupe (titre, dates de départ/retour, visibilité, statut).
- `group_members` : Adhésions, rôles et droits d'administration.
- `group_expenses` : Dépenses individuelles et répartition des quotes-parts.
- `group_polls` & `group_poll_votes` : Sondages et bulletins de vote.
- `group_tasks` : Tâches logistiques assignées aux participants.
- `group_messages` : Fil de discussion interne à l'expédition.

---

### 7. RLS & Sécurité
- **Isolation stricte :** Seuls les membres acceptés (`status = 'accepted'`) peuvent lire les messages, les dépenses et les sondages d'un groupe.
- **Élévation de privilèges bloquée :** Un membre standard ne peut pas s'auto-promouvoir `admin` ou `owner`.
- Validation sécurisée vérifiée par les migrations `20260716000000_group_system_complete.sql` et `20260815000000_group_rls_and_replies.sql`.

---

### 8. API Routes
- Requêtes sécurisées directes Supabase JS Client via triggers PostgreSQL automatiques.
- Notification push envoyée lors de l'ajout d'une nouvelle dépense ou d'un message urgent.

---

### 9. Dépendances & Interactions
- **[[Voyages]] :** Le groupe est attaché à un itinéraire de randonnée précis.
- **[[Inventaire]] :** Les membres peuvent voir le matériel possédé par leurs camarades pour mutualiser le portage.
- **[[Notifications]] :** Triggers SQL avec regroupement des notifications de chat sur 15 minutes pour éviter le spam.

---

### 10. Notifications Associées
- Invitation à rejoindre un groupe par email ou push.
- Notification lors de l'équilibrage final des comptes de l'expédition.

---

### 11. Points & Récompenses
- +30 XP pour chaque participant lorsqu'une expédition de groupe est menée à son terme.

---

### 12. Problèmes Connus
- Aucun bug actif. Les fonctions de vérification d'appartenance `is_groupe_member` ont été auditées et sécurisées.

---

### 13. État
🟢 **Fonctionnel & Déployé**.

---

### 14. Roadmap
- [ ] Génération automatique d'un bilan d'expédition partagé regroupant les photos et stats de tous les membres.
