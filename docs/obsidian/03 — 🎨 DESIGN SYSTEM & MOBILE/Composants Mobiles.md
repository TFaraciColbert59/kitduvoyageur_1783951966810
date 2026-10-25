---
title: Composants Mobiles d'Itinérance — LKDV
description: Inventaire et spécification des composants réutilisables optimisés pour le terrain
tags:
  - design-system
  - composants
  - mobile
  - ui
  - react
aliases:
  - Composants Mobiles
  - Bibliothèque de Composants
date: 2026-09-04
status: active
---

# 📱 Composants Mobiles d'Itinérance

Les composants de **Le Kit du Voyageur** sont conçus pour un usage à une seule main en extérieur, avec des cibles tactiles généreuses (minimum 44x44 points) et des feedbacks visuels instantanés.

---

## 🧭 Catalogue des Composants Majeurs

### 1. `KitSheetModal` — La Feuille Déroulante Tactile
- **Rôle** : Afficher la fiche détaillée d'un kit, la composition de ses équipements ou les détails d'une lignée sans faire perdre le fil de navigation à l'utilisateur.
- **Caractéristiques** :
  - Barre d'accroche visuelle supérieure.
  - Geste de fermeture par glissement naturel vers le bas ([[03 — 🎨 DESIGN SYSTEM & MOBILE/Gestes Apple HIG|Gestes Apple HIG]]).
  - Fond dégradé subtil `bg-[#FBFAF6]` et liseré supérieur `border-[#A3C4A3]/30`.

### 2. `WeightGauge` — La Jauge Segmentée de Poids
- **Rôle** : Donner une lecture immédiate et sans équivoque de la répartition des masses dans le sac.
- **Segments** :
  - **Poids de Base (Base Weight)** : Couleur primaire `#17402C`.
  - **Consommables (Eau, Vivres, Gaz)** : Teinte sauge intermédiaire `#4A7C59`.
  - **Porté sur Soi (Bâtons, Vêtements)** : Teinte neutre douce `#8FA396`.
- **Comportement** : Animation fluide lors de l'ajout ou du retrait d'un équipement, recalcul instantané du total.

```
┌─────────────────────────────────────────────────────────────┐
│ [████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│ Base : 4 250 g    │ Consommables : 1 800 g │ Total : 6 050 g│
└─────────────────────────────────────────────────────────────┘
```

### 3. `OfflineBanner` — L'Indicateur de Statut Réseau
- **Rôle** : Rassurer l'utilisateur en montagne sur l'état de son paquetage.
- **États** :
  - *Connecté* : Discret ou masqué (icône verte minimaliste).
  - *Hors-Ligne (Zone Blanche)* : Bandeau supérieur ambré rassurant : *"Mode itinérance actif — Vos modifications sont sauvegardées localement"*.
  - *Synchronisation* : Micro-spinner lors de la réconciliation avec Supabase.

### 4. `CategoryPill` — Les Pastilles de Filtre
- **Rôle** : Filtrer le paquetage en un éclair (Abri, Sommeil, Popote, Vêtements, Sécurité).
- **Style** : Capsule `rounded-full`, fond `#EDF3ED`, texte `#17402C`. En état actif : fond vert forêt `#17402C` et texte pierre `#FBFAF6`.

### 5. `LineageTreeBadge` — Le Badge Généalogique
- **Rôle** : Situer un kit dans sa lignée familiale.
- **Affichage** : Pastille compacte `Gen 0 (Racine)`, `Gen 1 (Variante)` ou `Gen 2`, ouvrant la modale de comparaison de lignée au tap.

---

## 🔗 Voir Aussi
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Tokens & Palette v2|Tokens & Palette v2.0]]
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Gestes Apple HIG|Gestes Apple HIG & Friction Tactile]]
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]