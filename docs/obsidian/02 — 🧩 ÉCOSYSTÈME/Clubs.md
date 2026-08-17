---
title: Fiche Module — Clubs Thématiques
aliases:
  - Clubs
  - Micro-Communautés
  - Clubs Outdoor
tags:
  - module
  - clubs
  - community
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# 🛡️ FICHE MODULE — CLUBS THÉMATIQUES

---

### 1. Objectif
Fédérer les passionnés autour de disciplines ou de massifs spécifiques (ex : Club des Bivouaqueurs Pyrénéens, Club Ultra-Light France, Alpinisme Éco-responsable) au sein d'espaces dédiés pour échanger des conseils, organiser des sorties locales et partager du matériel.

---

### 2. UX & Ergonomie
- **Modal de détail instantané (`ClubDetailModal`) :** Ouverture en 16ms au tap sur une carte de club sans rechargement lourd de page.
- **Fil de discussion structuré par sujets (Topics) :** Pas de flux désordonné ; les conversations sont rangées par thèmes (Matériel, Météo, Sorties du week-end).
- **Adhésion en 1 clic :** Pour les clubs ouverts, ou soumission d'une demande motivée pour les clubs privés/experts.

---

### 3. Pages & Routes
- `/clubs` : Annuaire et explorateur de clubs avec filtres géographiques et par discipline.
- `/clubs/nouveau` : Assistant de création d'un club pour les membres qualifiés.
- `/clubs/[id]` : Page d'accueil du club (Bannière, Membres, Discussions, Événements à venir).

---

### 4. Composants
- `src/components/clubs/ClubsGrid.tsx` : Grille d'affichage des clubs.
- `src/components/clubs/ClubDetailModal.tsx` : Vue modale rapide d'un club.
- `src/components/clubs/ClubTopicList.tsx` : Liste des fils de discussion.
- `src/components/clubs/JoinRequestModal.tsx` : Formulaire de demande d'adhésion.

---

### 5. Données & Schéma
- Les clubs utilisent le schéma étendu `travel_groups` avec l'attribut `type = 'club'`.
- Niveaux d'accès : `public` (ouvert à tous), `restricted` (validation par admin), `private` (sur invitation uniquement).

---

### 6. Tables Supabase
- `travel_groups` : Fiche du club (nom, description, photo de couverture, règles, localisation).
- `club_members` : Liste des membres avec statuts (`admin`, `moderator`, `member`).
- `club_join_requests` : Demandes d'adhésion en attente de modération.
- `club_topics` & `club_topic_messages` : Fils de discussion internes au club.

---

### 7. RLS & Sécurité
- **Politiques anti-escalade :** Migration `20260731170000_club_members_policy_escalation_fix.sql` appliquée pour interdire l'auto-attribution des rôles d'administration.
- **Sécurisation des demandes :** Migration `20260731171500_club_join_requests_moderate_with_check_tighten.sql` empêchant les utilisateurs d'approuver leurs propres demandes d'adhésion.

---

### 8. API Routes
- Requêtes sécurisées directes Supabase JS Client sous RLS.
- Dispatch de notifications automatiques aux administrateurs du club lors d'une nouvelle candidature.

---

### 9. Dépendances & Interactions
- **[[Communauté]] :** Les publications phares d'un club peuvent être promues sur le feed global.
- **[[Inventaire]] :** Les membres d'un même club peuvent se prêter du matériel en toute confiance via le système de prêt d'inventaire.

---

### 10. Notifications Associées
- Alerte aux administrateurs lors d'une demande d'adhésion.
- Notification aux membres lors de la création d'un événement ou d'un nouveau topic majeur.

---

### 11. Points & Récompenses
- +15 XP à l'adhésion d'un club.
- +50 XP et badge « Fondateur de Communauté » pour la création d'un club atteignant 20 membres actifs.

---

### 12. Problèmes Connus
- Aucun bug bloquant. Les règles de visibilité publique et privée ont été totalement auditées.

---

### 13. État
🟢 **Fonctionnel & Déployé**.

---

### 14. Roadmap
- [ ] Possibilité pour les clubs certifiés d'organiser des stages payants via Stripe Connect.
