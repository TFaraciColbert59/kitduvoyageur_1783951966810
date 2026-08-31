# Spécification de Design UX / UI Mobile — LKDV (Focus Terrain & Sac)

**Date :** 31 août 2026  
**Auteur :** Antigravity & Lead Mobile Product Designer  
**Statut :** Validé / Prêt pour Plan d'Implémentation  
**Périmètre :** Module Mobile /materiel (Préparation, Checklist, Poids & Autonomie Terrain)

---

## 1. Vision Produit & Philosophie

Sur smartphone, **Le Kit du Voyageur (LKDV)** n'est pas un site web de bureau compressé, mais une **application native de référence de randonnée et bivouac**, pensée selon les standards **Apple iOS 18 Human Interface Guidelines (HIG)** :
- **Usage à une main (One-Handed Thumb Reach)** : Contrôles d'actions et filtres situés dans la zone basse naturelle du pouce.
- **Rapidité d'emballage (Fast Packing)** : Cibles tactiles généreuses (min 48px), gestuelles *Swipe-to-Pack*, retours haptiques instantanés.
- **Fiabilité Terrain & Autonomie** : Mode Éco Batterie Noir Pur OLED (#000000), fonctionnement hors-ligne par cache local transparent, alertes de sécurité contextuelles non intrusives.

---

## 2. Architecture Visuelle & Découpage de l'Écran

```
┌──────────────────────────────────────────────────────────┐
│  [☀️ Chamonix 18°C]              [⚡ Éco 78%]   [📶 Cache] │  ← 1. Status Bar ultra-fine (18px)
├──────────────────────────────────────────────────────────┤
│  [ (69%) ]   [ 🎒 Base 4.8kg ] [ 🥾 Porté 1.2kg ] [ 💧 Eau 2.5kg ] │  ← 2. En-tête Poids Apple Health (48px)
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🛑 1 équipement vital manquant : Filtre à eau     │  │  ← 3. Alerte contextuelle rétractable
│  │ [ Voir l'article → ]                               │  │     (Style Notification iOS)
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ▼ BIVOUAC & COUCHAGE                            (4/5)   │  ← 4. Catégorie dépliable avec badge
│  ┌────────────────────────────────────────────────────┐  │
│  │ (✓) Tente Big Agnes Copper Spur        1420g   [🖼️] │  │  ← 5. Ligne Item (52px / Hitbox 48px)
│  │ ( ) Matelas Therm-a-Rest NeoAir         430g   [🖼️] │  │     • Coche circulaire 32px
│  │ (✓) Duvet Cumulus Panyam 600            980g   [🖼️] │  │     • Swipe Droit = Cocher
│  └────────────────────────────────────────────────────┘  │     • Vibration haptique
│                                                          │
│  ▶ VIVRES & HYDRATATION (3/3 complet)           (✓ 3/3)  │  ← Catégorie repliée auto si finie
│  ▶ VÊTEMENTS & SÉCURITÉ                          (2/4)   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│           ┌───────────────────────────────────┐          │  ← 6. Capsule Flottante Liquid Island
│           │ [Tous (16) | Restants (5)] (🔊) (+)│          │     (Zone naturelle du pouce)
│           └───────────────────────────────────┘          │     (S'affine au défilement)
└──────────────────────────────────────────────────────────┘
```

---

## 3. Spécifications Détaillées des Composants

### 3.1. En-Tête Poids & Statut (Style Apple Health / Fitness)
- **Anneau de progression** : Cercle SVG fluide avec pourcentage au centre (69%), animation spring lors des modifications d'état.
- **3 Pastilles d'analyse horizontales** (hauteur 36px, rounded-full, fond Liquid Glass blanc pur / dark stone) :
  1. **Base Weight** : 🎒 4.8 kg (matériel fixe du sac hors consommables).
  2. **Poids Porté** : 🥾 1.2 kg (chaussures, bâtons, vêtements portés).
  3. **Consommables** : 💧 2.5 kg (eau potable, gaz et rations de nourriture).
- **Interaction** : Tap sur une pastille pour ouvrir une *Bottom Sheet* native contenant le détail par catégorie et la comparaison de charge.

### 3.2. Lignes d'Équipements (Style Apple Reminders)
- **Zone tactile principale** :
  - Cercle de coche à gauche de 32px de diamètre, centré dans une hitbox de 48px minimum.
  - Animation de remplissage émeraude (#2D6B4A) et checkmark blanc.
  - Déclenchement d'un retour haptique subtil (navigator.vibrate(8)).
- **Contenu central** :
  - Nom de l'article en typographie SF Pro (text-[13.5px] font-bold text-[#17402C]).
  - Ligne secondaire : Poids formaté (text-[11px] font-mono text-[#5A7064]) + badges discrets pour *Vital* (rouge/rose) ou *Consommable* (bleu/émeraude).
- **Miniature droite** :
  - Photo cadrée en ratio 1:1 (w-9 h-9 rounded-xl object-cover bg-black/5).
- **Gestuelle Swipe-to-Pack** :
  - Glissement horizontal vers la droite avec seuil de déclenchement (trigger threshold 80px).
  - Révélation d'un fond vert émeraude avec icône check, basculant instantanément l'état de l'objet.

### 3.3. Capsule Flottante Basse « Liquid Island »
- **Positionnement** : Flottante à 12px au-dessus de env(safe-area-inset-bottom).
- **Conteneur** : Verre translucide Liquid Glass ultra-poli (rounded-full px-4 py-2 border border-white/60 shadow-lg backdrop-blur-md).
- **Contenu** :
  - **Segmented Control compact** : Bascule Tous (16) / Restants (5).
  - **Bouton Audio TTS (🔊)** : Lecture vocale synthétisée des équipements restants pour préparation les mains occupées.
  - **Bouton Ajout Rapide (➕)** : Déclenche une Bottom Sheet d'ajout rapide d'équipement ou d'objet oublié.
- **Rétraction dynamique** : Lors d'un défilement rapide vers le bas, la capsule s'amenuise en une micro-pastille pour libérer 100% du champ de vision, puis réapparaît dès l'arrêt ou le scroll inverse.

### 3.4. Alerte de Sécurité & Notifications Contextuelles
- **Bannière rétractable** : Placée immédiatement sous l'en-tête de poids.
- **Style** : Carte de notification iOS (rounded-2xl p-3 border border-rose-200/80 bg-rose-50/90 text-[#8A241B]).
- **Action** : Un tap effectue un défilement automatique avec mise en surbrillance temporaire de l'équipement vital concerné.
- **Dismiss/Snooze** : Bouton fermer discret pour masquer temporairement l'alerte.

### 3.5. Mode Éco Batterie OLED Pur (#000000)
- **Activation** : Automatique si la batterie descend sous 20% ou manuelle via le bouton ⚡ ÉCO.
- **Comportement CSS/Engine** :
  - Fond de page appliqué en #000000 (pixels éteints sur écran OLED).
  - Suppression de tous les backdrop-blur et filtres graphiques GPU.
  - Typographie blanche #FFFFFF et contrastes émeraude haute visibilité en plein soleil.

---

## 4. Stratégie de Résilience Hors-Ligne (Offline First)

- **Stockage Local** : Cache automatique de la fiche de départ, de la météo et de la checklist dans localStorage (lkdv_depart_cache_<id>).
- **File d'attente d'actions (Offline Queue)** : Toutes les coches et modifications hors-ligne sont enregistrées dans IndexedDB / queue locale et synchronisées en arrière-plan dès la reconnexion réseau (flushOfflineQueue()).
- **Indicateur transparent** : Badge discret 📶 Hors-ligne (Cache) sans bloquer ni ralentir l'utilisateur.

---

## 5. Critères d'Acceptation & Tests de Validation

1. **Accessibilité & Ergonomie** : Toutes les cibles tactiles interactives mesurent au minimum 48x48px.
2. **Performance Mobile** : 60 fps constants lors du défilement et des animations de swipe.
3. **Zéro Erreur TypeScript & Vitest** : Validation continue de la suite de tests unitaires et d'intégration.
4. **Fluidité Safe-Area** : Espacements respectant scrupuleusement les encoches et la Dynamic Island iOS sur iPhone 14/15/16 Pro.