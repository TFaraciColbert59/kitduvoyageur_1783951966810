---
title: Fiche Module — Communauté & Feed Mobile
aliases:
  - Communauté
  - Feed
  - Réseau Social Outdoor
tags:
  - module
  - community
  - feed
  - social
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# 🌐 FICHE MODULE — COMMUNAUTÉ & FEED MOBILE

---

### 1. Objectif
Offrir aux passionnés d'outdoor un espace social inspirant et bienveillant, orienté retour d'expérience de terrain, partage de photos de voyage, entraide technique et célébration des réussites sportives.

---

### 2. UX & Ergonomie
- **Design Épuré & Instagram-like :** Cartes de posts avec coins arrondis de 12px (`rounded-[0.75rem]`), espacements harmonieux (`gap-3`).
- **Interactions Optimistes :** Le clic sur « J'aime » incrémente instantanément le compteur sans attendre la réponse serveur (rollback automatique en cas d'échec réseau).
- **Accès Invité Sans Friction :** Les visiteurs non connectés peuvent parcourir l'ensemble du feed en lecture seule sans être bloqués par un mur de connexion intrusif.
- **Skeletons Shimmer :** Pendant le chargement des nouveaux posts, des cartes grises animées évitent tout saut d'écran (*Cumulative Layout Shift - CLS*).

---

### 3. Pages & Routes
- `/communaute` : Fil d'actualité principal (Explorer les aventures, posts populaires, activités récentes).
- `/communaute/publier` : Compositeur de publication avec ajout de photos et tags de matériel.
- `/communaute-pro` : Espace réservé aux professionnels, guides et marques partenaires.
- `/entraide` : Forum de questions/réponses techniques.

---

### 4. Composants
- `src/components/community/CommunityFeed.tsx` : Composant maître du feed.
- `src/components/community/PostCard.tsx` : Carte de post individuelle (auteur, photo, texte, badges, likes, commentaires).
- `src/components/community/PostComposer.tsx` : Formulaire de création de contenu.
- `src/components/community/ShareModal.tsx` : Partage direct vers WhatsApp, Instagram Stories ou copie de lien.

---

### 5. Données & Schéma
- Modèle relationnel normalisé : `posts` -> `comments` -> `likes`.
- Compteurs dénormalisés mis à jour automatiquement via des triggers PostgreSQL (`likes_count`, `comments_count`) pour des temps de réponse inférieurs à 10ms.

---

### 6. Tables Supabase
- `posts` : Publications du feed (auteur `user_id`, contenu texte, URLs médias, sentier lié `route_id`, compteurs).
- `comments` : Commentaires sous les posts.
- `likes` : Enregistrement des mentions « J'aime » avec contrainte unique `(user_id, post_id)` pour bloquer les doublons.
- `comment_reports` : Signalements d'abus pour modération automatique ou humaine.

---

### 7. RLS & Sécurité
- **Lecture :** Publique pour tous les posts marqués comme publics.
- **Écriture :** Réservée aux utilisateurs authentifiés (`auth.uid() = user_id`).
- **Anti-Spam :** Plafonnement SQL empêchant la création de plus de 10 commentaires par minute par un même utilisateur.

---

### 8. API Routes
- Requêtes en temps réel via le client Supabase avec subscriptions pour l'affichage en direct des nouveaux commentaires.
- Endpoint de signalement pour envoyer une alerte dans la file de modération `/admin`.

---

### 9. Dépendances & Interactions
- **[[Carnets]] :** Un carnet publié apparaît sous forme de carte spéciale enrichie dans le feed.
- **[[Inventaire]] :** Les utilisateurs peuvent taguer le matériel utilisé sur une photo pour renvoyer vers la fiche produit.
- **[[Récompenses]] :** Les créateurs des posts les plus utiles reçoivent des micro-rémunérations via le Reward Engine.

---

### 10. Notifications Associées
- Notification in-app et push lorsqu'un autre membre aime ou commente une publication.

---

### 11. Points & Récompenses
- +5 XP par post publié (limité à 1 par jour pour éviter le spam).
- +2 XP par commentaire pertinent validé.

---

### 12. Problèmes Connus
- Les hooks `useInfiniteScroll` et `usePullToRefresh` sont développés dans `src/hooks/` mais attendent d'être branchés dans `src/app/communaute/page.tsx`.

---

### 13. État
🟢 **Fonctionnel & Déployé**.

---

### 14. Roadmap
- [ ] Finaliser l'intégration du Pull-to-refresh mobile natif et du défilement infini sans fin.
- [ ] Stories éphémères de bivouac (24h).
