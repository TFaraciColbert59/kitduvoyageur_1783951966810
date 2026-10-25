---
title: Expérience Desktop & Écrans Larges LKDV
aliases:
  - Desktop
  - Responsive Grand Écran
tags:
  - desktop
  - responsive
  - layout
updated: 2026-08-17
---

# 💻 EXPÉRIENCE DESKTOP & ÉCRANS LARGES

> [!abstract] **L'extension naturelle de l'expérience mobile pour la préparation à la maison**
> Sur tablette et ordinateur (> 768px et > 1024px), LKDV s'adapte sans rupture pour offrir des vues multi-colonnes propices à l'analyse fine des sentiers et de l'équipement.

---

## 🖥️ Adaptations Spécifiques Desktop

### 1. Explorateur de Sentiers en Double Colonne (`/explorer`)
- **Colonne Gauche (40%) :** Liste défilante des fiches sentiers avec filtres dynamiques, photos et dénivelés.
- **Colonne Droite (60%) :** Carte interactive Leaflet / PostGIS plein écran sticky avec surbrillance de la trace sélectionnée.

### 2. Inventaire & Matériel en Grille 4 Colonnes (`/mon-materiel`)
- Grille aérée avec affichage simultané des 5 catégories de matériel.
- Panneau de statistiques d'allègement du sac persistant sur la droite de l'écran.

### 3. Modales Centrées & Flou d'Arrière-Plan
- Les tiroirs coulissants (*bottom sheets*) du mobile se transforment sur desktop en modales flottantes élégantes avec `backdrop-blur-md` et fermeture au clic extérieur ou touche `Échap`.

---

> [!tip] **Notes complémentaires :**
> - Découvrir le système de navigation : [[00 — 🗺️ CARTE ULTIME/Navigation\|Navigation]]
> - Explorer la bibliothèque UI : [[Composants]]
