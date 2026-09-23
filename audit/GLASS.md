# Spécification Technique du Verre — Full Liquid Glass iOS 27

Ce document définit les spécifications physiques, chromatiques, optiques et géométriques du système **Full Liquid Glass iOS 27** implémenté dans le design system de *Le Kit du Voyageur (LKDV)*.

---

## 1. La Hiérarchie à 5 Couches (G0, G1, G2, G3, GC)

```
┌────────────────────────────────────────────────────────┐
│ G0 : Fond d'ambiance 100dvh (Photographie + Scrim)     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ G1 : Verre Principal (Backdrop-filter réel)       │  │
│  │   TopBar, BottomTabBar, Cartes, Sheets, Modales  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ G2 : Verre Intérieur (Lumière + Spéculaire)│  │  │
│  │  │   Cellules, Lignes, Tuiles, Champs, Chips  │  │  │
│  │  │  ┌──────────────────────────────────────┐  │  │  │
│  │  │  │ G3 : Verre Prominent (Action Unique) │  │  │  │
│  │  │  │   Light: Encre 84% | Dark: Lumière 88%│ │  │  │
│  │  │  └──────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│ GC : Verre Clair Flottant (HUD / Contrôles sur carte)  │
└────────────────────────────────────────────────────────┘
```

### Spécifications détaillées par niveau :

### **G0 · Toile de fond (App Background)**
- **Rôle :** Arrière-plan global continu, éliminant toute rupture visuelle en fin de défilement.
- **Propriétés CSS :**
  - `position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: -1;`
  - `background-image: var(--lkv-app-bg-image);`
  - `background-size: cover; background-position: center;`
  - Voile de lisibilité (scrim) : dégradé vertical combiné à une opacité diffuse sombre garantissant un contraste uniforme.

### **G1 · Verre de Premier Niveau (Regular Glass)**
- **Rôle :** Conteneur de premier plan (Barres de navigation, cartes mères, tiroirs modaux).
- **Propriétés CSS :**
  - `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));`
  - `-webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));`
  - Double contour iOS 27 : bord extérieur assombri (`0 0 0 0.5px rgba(0,0,0,0.22)`) + liséré intérieur spéculaire (`inset 0 0 0 0.5px rgba(255,255,255,0.45)`).
  - Reflet zénithal supérieur : `inset 0 1px 0 rgba(255,255,255,0.55)`.
  - Ombre diffuse : `0 10px 36px rgba(0,0,0,0.16)`.

### **G2 · Verre Intérieur (Nested Glass — Zéro coût GPU additionnel)**
- **Rôle :** Éléments interactifs secondaires posés sur un G1 (cellules de liste, champs de formulaire, chips, pilules).
- **Technique optique :** Pas de second `backdrop-filter` (afin de ne pas casser la *backdrop root* et d'économiser le processeur graphique). La matière est créée par une hausse locale de luminosité relative, un liséré clair et un reflet spéculaire.
- **Propriétés CSS :**
  - Light : `background: rgba(255, 255, 255, calc(0.35 + 0.20 * var(--glass-intensity)));`
  - Dark : `background: rgba(255, 255, 255, calc(0.08 + 0.08 * var(--glass-intensity)));`
  - Liséré : `box-shadow: 0 0 0 0.5px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.40);`

### **G3 · Verre Prominent (Call-to-Action Monochrome)**
- **Rôle :** Remplace l'ancien bouton coloré de validation ou de paiement. Un seul par vue.
- **Propriétés CSS :**
  - Light : Fond encre dense (`rgba(18, 18, 20, 0.88)`), texte blanc pur, reflet spéculaire net au sommet.
  - Dark : Fond lumière dense (`rgba(255, 255, 255, 0.90)`), texte encre sombre, ombre d'illumination.
  - Interaction : Effet ressort à l'appui (`scale(0.97)`) avec intensification instantanée du reflet.

### **GC · Verre Clair (Clear Glass pour Médias & Cartes)**
- **Rôle :** Boutons flottants de zoom, de recentrage et HUD GPS posés directement sur la cartographie ou les photographies.
- **Propriétés CSS :**
  - Translucidité accrue avec flou concentré (16px).
  - Pastille d'assombrissement local sous les glyphes pour certifier un ratio de contraste ≥ 3:1 quelles que soient les tuiles de carte sous-jacentes.

---

## 2. Échelle de Rayons Concentriques

Formule de concentricité stricte :
$$\text{Rayon}_{\text{enfant}} = \max(\text{Rayon}_{\text{parent}} - \text{Padding}, 20\text{px})$$

| Élément | Rayon Cible | Classe Tailwind / Token |
|:--------|:-----------:|:------------------------|
| Boutons, Chips, Pilules, Champs, Segmented | **Capsule (9999px)** | `rounded-full` / `var(--lkv-radius-full)` |
| Grandes Modales & Bottom Sheets | **44px** (sommet) | `var(--lkv-radius-sheet)` |
| Cartes Hero & Bannières | **38px** | `var(--lkv-radius-hero)` |
| Cartes de contenu standards | **32px** | `var(--lkv-radius-card)` |
| Popovers, Menus volants | **28px** | `var(--lkv-radius-popover)` |
| Tuiles & Cellules intérieures | **24px** | `var(--lkv-radius-tile)` |
| Plancher absolu | **12px** | `var(--lkv-radius-min)` *(checkbox seule à 8px)* |

---

## 3. Matrice de Contraste & Accessibilité au Pire Pixel

| Encre Typographique | Valeur Light | Valeur Dark | Ratio garanti sur pire pixel |
|:--------------------|:-------------|:------------|:-----------------------------|
| `--glass-label` | `rgba(18, 24, 21, 0.96)` | `rgba(255, 255, 255, 0.98)` | **≥ 7.5:1** (dépasse largement 4.5:1) |
| `--glass-label-secondary` | `rgba(40, 52, 46, 0.82)` | `rgba(235, 240, 237, 0.78)` | **≥ 4.6:1** (conforme WCAG AA) |
| `--glass-label-tertiary` | `rgba(60, 75, 68, 0.65)` | `rgba(200, 210, 205, 0.58)` | **≥ 3.2:1** (conforme éléments graphiques) |
| `--glass-label-quaternary`| `rgba(80, 95, 88, 0.40)` | `rgba(180, 190, 185, 0.35)` | Éléments décoratifs et séparateurs |

---

## 4. Prise en Charge des Préférences Utilisateur

1. **`prefers-reduced-transparency: reduce`** :
   - Désactivation immédiate de tous les `backdrop-filter`.
   - Remplacement par des fonds opaques à 100% avec bordure renforcée (`1px solid var(--glass-rim-opaque)`).
2. **`prefers-contrast: more`** :
   - Contours contrastés doublés d'épaisseur (1.5px).
   - Différence de luminance accentuée de +20%.
3. **`prefers-reduced-motion: reduce`** :
   - Suppression des transitions et durées ramenées à `0s`.
