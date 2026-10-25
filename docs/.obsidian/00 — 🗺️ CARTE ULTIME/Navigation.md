---
title: Navigation & Structure des Écrans LKDV
aliases:
  - Navigation
  - Architecture de Navigation
  - Menu et Shell
tags:
  - navigation
  - ux
  - mobile
updated: 2026-08-17
---

# 🧭 NAVIGATION & STRUCTURE DES ÉCRANS

> [!abstract] **Architecture de navigation unifiée**
> LKDV adopte un modèle de navigation hybride mobile-first : une barre d'onglets persistante en bas d'écran (`BottomTabBar`) sur mobile, couplée à un Shell adaptatif (`MobilePageShell`) qui gère les zones sécurisées (`safe-area-insets`) et les micro-transitions sans saut de layout.

---

## 📱 Modèle Mobile (BottomTabBar + Shell)

Sur mobile, l'utilisateur a accès à 5 points d'ancrage majeurs, complétés par un panneau hamburger contextuel :

```text
┌─────────────────────────────────────────────────────────┐
│                    MobilePageShell                      │
│                                                         │
│  [Contenu de la page : Défilement fluide 60fps]         │
│  [Padding bottom réservé de 6rem / pb-24]               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                   BottomTabBar                          │
│  [ 🧭 Explorer ] [ 🎒 Matériel ] [ 📸 Carnets ] [ 👥 Club ] [ ☰ Menu ] │
└─────────────────────────────────────────────────────────┘
```

### 1. Les 4 Onglets Principaux + Menu d'Actions
1. **🧭 Explorer (`/explorer`) :** Carte interactive plein écran, recherche de sentiers OSM, filtres par dénivelé/distance.
2. **🎒 Mon Matériel (`/mon-materiel`) :** Inventaire unifié, poids de base, fiches techniques, alertes d'entretien, accès boutique.
3. **📸 Carnets (`/carnets`) :** Récits d'expéditions, galeries photo, timeline interactive, bouton de création rapide.
4. **👥 Communauté / Clubs (`/communaute` & `/clubs`) :** Feed social, discussions entre membres, expéditions de groupe.
5. **☰ Menu & Recherche Persistante :** Déclenche le panneau latéral/overlay (`SearchOverlay`) avec accès à :
   - 🔍 Recherche globale multi-entités
   - 🔔 Centre d'alertes & SOS (`/alertes`)
   - 🛒 Panier & Commandes (`/panier` avec badge dynamique)
   - 👤 Espace Compte & Préférences (`/compte`)

---

## ⚡ Optimisations de Fluidité Tactile

Afin d'éliminer toute sensation de latence sur mobile, les mécanismes suivants sont appliqués :
- **État `pressedTab` instantané :** Feedback visuel sous 16ms (1 frame) dès l'événement `pointerdown`.
- **Préchargement au survol (`router.prefetch`) :** Les routes cibles sont préchargées dès que le doigt effleure l'icône de l'onglet.
- **Retour Haptique (`useHapticFeedback`) :** Vibrations douces calibrées sur les appareils compatibles (iOS / Android / PWA).
- **Zéro blocage asynchrone :** Aucun `await` avant un appel de navigation (`router.push`).

---

## 💻 Modèle Desktop (Header Flottant & Grille Large)

Sur les écrans larges (> 768px) :
- La `BottomTabBar` est masquée au profit d'une barre de navigation supérieure épurée.
- Les interfaces s'étendent en multi-colonnes (ex : carte à gauche / liste des sentiers à droite sur `/explorer`).
- Les tiroirs coulissants mobiles deviennent des modales centrées avec flou d'arrière-plan (*backdrop-blur*).

---

> [!tip] **Pour approfondir :**
> - Voir la liste exhaustive des routes et URLs : [[Carte des routes]]
> - Découvrir les directives ergonomiques : [[Principes UX]]
> - Examiner les tokens graphiques : [[Design System]]
