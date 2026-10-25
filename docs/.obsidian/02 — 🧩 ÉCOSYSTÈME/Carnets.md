---
title: Fiche Module — Carnets de Voyage & Vision IA
aliases:
  - Carnets
  - Récits de Voyage
  - Journal de Trek
tags:
  - module
  - carnets
  - media
  - ai-vision
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# 📸 FICHE MODULE — CARNETS DE VOYAGE & VISION IA

---

### 1. Objectif
Permettre aux aventuriers de consigner leurs expéditions dans un carnet multimédia vivant : chronologie des étapes, photos géolocalisées sur le tracé de la randonnée, notes d'ambiance, météo relevée, et identification assistée par intelligence artificielle de la biodiversité rencontrée.

---

### 2. UX & Ergonomie
- **Timeline Immersive :** Défilement chronologique élégant reliant les moments forts de l'aventure aux points GPS de la trace.
- **Ajout de Moment en 1-tap :** Prise de photo directe avec capture automatique de la position GPS et de l'altitude.
- **Vision IA Intégrée :** Clic sur une photo d'animal ou de plante pour lancer l'analyse de l'espèce et enrichir le carnet d'une fiche naturaliste.
- **Partage Sélectif :** Option de visibilité (Public, Amis / Membres de Club, Privé).

---

### 3. Pages & Routes
- `/carnets` : Feed public des carnets d'expédition les plus inspirants.
- `/carnets/nouveau` : Éditeur de création d'un nouveau carnet de voyage.
- `/carnets/[id]` : Vue détaillée d'un carnet avec carte interactive et photos.
- `/mes-aventures` : Espace personnel regroupant les carnets de l'utilisateur (brouillons et publiés).

---

### 4. Composants
- `src/components/carnets/CarnetTimeline.tsx` : Vue chronologique des étapes et moments.
- `src/components/carnets/MomentCard.tsx` : Carte affichant une photo, les coordonnées, l'heure et la légende.
- `src/components/carnets/SpeciesViewer.tsx` : Panneau d'identification de la faune/flore avec niveau de certitude.
- `src/components/carnets/MediaUploader.tsx` : Téléversement direct vers Supabase Storage avec compression client.

---

### 5. Données & Schéma
- Stockage spatial des moments via PostGIS (`ST_Point(longitude, latitude)`).
- Les métadonnées EXIF des images sont extraites automatiquement pour caler l'heure et le lieu.

---

### 6. Tables Supabase
- `carnets` : En-tête du carnet (titre, auteur `user_id`, route associée `route_id`, date début/fin, statut visibilité, statistiques globales).
- `carnet_moments` : Événements individuels (timestamp, coordonnées, url média, légende, espèce identifiée).
- Supabase Storage Bucket : `carnet-media` (avec politiques d'accès sécurisées).

---

### 7. RLS & Sécurité
- **Carnets publics :** Lisibles par tous (`visibility = 'public'`).
- **Carnets privés :** Lisibles uniquement par l'auteur (`auth.uid() = user_id`).
- **Écriture :** Modification et suppression réservées exclusivement au propriétaire du carnet.

---

### 8. API Routes
- `GET /api/carnets/[id]` : Récupération des données du carnet et des moments associés.
- `POST /api/carnet/identify-species` : Endpoint d'analyse IA par vision par ordinateur pour la classification d'espèces.

---

### 9. Dépendances & Interactions
- **[[Voyages]] :** Le carnet se greffe directement sur la trace GPS d'une session de randonnée.
- **[[Communauté]] :** Les carnets publics alimentent le flux d'actualités et peuvent être likés et commentés.
- **[[Récompenses]] :** Les carnets labellisés « Récit Exemplaire » génèrent des gains financiers pour l'auteur.

---

### 10. Notifications Associées
- Notification lorsque d'autres voyageurs commentent ou s'inspirent d'un carnet.
- Notification de badge débloqué (ex: « Naturaliste Alpin » après 10 espèces identifiées).

---

### 11. Points & Récompenses
- +100 XP lors de la publication d'un carnet complet avec au moins 3 moments géolocalisés.
- Éligibilité aux commissions du Reward Engine basées sur le taux d'engagement.

---

### 12. Problèmes Connus
- Aucun bug critique. La fonction de contrôle d'accès `can_view_carnet` a été sécurisée avec `search_path` fixé.

---

### 13. État
🟢 **Fonctionnel & Déployé**.

---

### 14. Roadmap
- [ ] Export du carnet de voyage sous forme de livre photo imprimable ou livret PDF souvenir.
- [ ] Mode collaboratif permettant à plusieurs randonneurs d'ajouter leurs photos dans un même carnet de groupe.
