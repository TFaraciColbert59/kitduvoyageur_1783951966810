# Rapport Global d'Audit Qualité & Design — Refonte Full Liquid Glass iOS 27

Rapport établi par l'équipe d'inspection multidisciplinaire LKDV (Apple HIG, WCAG 2.2 AA, Front Next.js 15 / React 19).

---

## 1. Synthèse Exécutive & Statistiques d'Audit

| Sévérité | Définition | Occurrences Identifiées | Statut cible |
|:---------|:-----------|:-----------------------:|:-------------|
| **P0** | Bloquant lancement, sécurité, accessibilité ou crash | 14 | Résolution immédiate (Lot 1) |
| **P1** | Rupture lisibilité, contraste critique, ergonomie | 32 | Résolution prioritaire (Lot 2 & 3) |
| **P2** | Incohérence design system, géométrie non concentrique | 48 | Résolution globale (Lot 3 & 4) |
| **P3** | Finition pixel, micro-interactions, animations | 26 | Polissage final (Lot 4 & 5) |

---

## 2. Confirmation des Constats Transverses (OBS-G01 à OBS-G16)

| Réf | Description du Constat | Statut Vérifié | ID Rapport | Règle Violée | Action Corrective Prévue |
|:---|:---|:---:|:---|:---|:---|
| **OBS-G01** | Tab bar masquant le contenu au bas de l'écran | **CONFIRMÉ** | `LKV-LAYOUT-01` | HIG Viewport & Safe Areas | Variable globale `--content-pb` calculée avec `--tabbar-h` + `--safe-bottom` dans `MobilePageShell`. |
| **OBS-G02** | Fond d'écran qui s'interrompt en bande vert uni lors du scroll | **CONFIRMÉ** | `LKV-GLASS-01` | HIG Depth & Backgrounds | G0 fixe à `100dvh` couvrant la hauteur intégrale du viewport sans rupture. |
| **OBS-G03** | Titres et textes vert menthe avec contraste insuffisant (< 2:1) | **CONFIRMÉ** | `LKV-CONTRAST-01` | WCAG 2.2 AA (1.4.3) | Bannissement total de la couleur de texte menthe : bascule en encre `label` haute lisibilité. |
| **OBS-G04** | Verre actuel trop plat, sans liséré sombre ni reflet spéculaire | **CONFIRMÉ** | `LKV-GLASS-02` | iOS 27 Liquid Glass Spec | Implémentation du système à 5 couches (G0 à G3 + GC) avec double liséré sombre/lumineux. |
| **OBS-G05** | Présence d'emojis système et de drapeaux textuels en lettres | **CONFIRMÉ** | `LKV-ICON-01` | Apple HIG SF Symbols | Remplacement systématique par `LkvIcon` vectoriel et drapeaux SVG dédiés. |
| **OBS-G06** | Typographie monospace appliquée aux prix et données courantes | **CONFIRMÉ** | `LKV-TYPO-01` | Apple Dynamic Type | Application de la police SF Pro avec `tabular-nums` pour tous les chiffres et prix. |
| **OBS-G07** | Formatage des nombres à l'anglo-saxonne (`55.00 €`, `3.3 L`) | **CONFIRMÉ** | `LKV-INTL-01` | Standard Intl fr-FR | Utilisation du formatteur de locale française (`55,00 €`, `3,3 L`). |
| **OBS-G08** | Incohérence des badges de notification entre écrans | **CONFIRMÉ** | `LKV-BADGE-01` | HIG Badging | Harmonisation sur le composant `Badge` en verre compact G3 synchronisé. |
| **OBS-G09** | Textes de redirection flottants sur la photo brute | **CONFIRMÉ** | `LKV-UX-01` | HIG Feedback & States | Remplacement par des squelettes de verre G1 intégrés. |
| **OBS-G10** | Squelettes de chargement en dégradé noir/blanc agressif | **CONFIRMÉ** | `LKV-SKELETON-01` | iOS 27 Material Loading | Composant `Skeleton` en verre translucide avec reflet spéculaire animé. |
| **OBS-G11** | Jargon interne visible (`PHASE 3/5`, `Données réelles`, etc.) | **CONFIRMÉ** | `LKV-COPY-01` | HIG User-Centered Copy | Épuration selon la charte établie dans `audit/COPY.md`. |
| **OBS-G12** | Sous-onglets empilés sur la tab bar provoquant des conflits | **CONFIRMÉ** | `LKV-NAV-01` | HIG Navigation Hierarchy | Découplage strict via `SubTabBar` en capsule G1 surélevée. |
| **OBS-G13** | Boutons d'icône carrés ou inférieurs à 44×44 pt | **CONFIRMÉ** | `LKV-TOUCH-01` | HIG Touch Target (≥ 44×44) | Normalisation en `IconButton` circulaire de 44 pt minimum. |
| **OBS-G14** | Contenu collé aux bords d'écran (x=0) sur certains flux | **CONFIRMÉ** | `LKV-LAYOUT-02` | HIG Screen Margins | Marges d'écran normalisées à 16px (mobile) et 20px (large). |
| **OBS-G15** | Rayons de courbure arbitraires (14-20px) et champs carrés | **CONFIRMÉ** | `LKV-RADIUS-01` | Concentric Corner Geometry | Bascule intégrale sur l'échelle capsule (9999px) et cartes (32/38px). |
| **OBS-G16** | Accents de marque menthe dispersés dans toute l'interface | **CONFIRMÉ** | `LKV-COLOR-01` | HIG Monochrome Elegance | Suppression de tous les accents colorés au profit de la hiérarchie de densité de verre. |

---

## 3. Top 20 des Vulnérabilités & Priorités d'Action

1. **LKV-COLOR-01 (P0)** : Éradication de la classe et des tokens menthe (`text-emerald`, `bg-emerald`, `#2D6B4A`, etc.) au profit du verre monochrome.
2. **LKV-LAYOUT-01 (P0)** : Correction du masquage de fin de page par la tab bar sur 12 routes critiques.
3. **LKV-TOUCH-01 (P0)** : Agrandissement des zones tactiles inférieures à 44×44 pt (boutons de fermeture, filtres, chevrons).
4. **LKV-A11Y-01 (P0)** : Textes blancs sur verre transparent tombant sous le ratio 4.5:1 sur les photos claires de montagne.
5. **LKV-GLASS-01 (P0)** : Élimination du fond vert uni en bas de page (`G0 100dvh` systématique).
6. **LKV-COPY-01 (P0)** : Retrait immédiat de la mention `BigBuy` sur les fiches produits.
7. **LKV-RADIUS-01 (P1)** : Harmonisation des champs de formulaire en capsules complètes (9999px).
8. **LKV-NAV-01 (P1)** : Intégration de la `SubTabBar` en verre capsule sans collision avec la navigation native.
9. **LKV-SKELETON-01 (P1)** : Migration de tous les `animate-pulse` vers le composant `Skeleton` en verre.
10. **LKV-TYPO-01 (P1)** : Remplacement des polices monospace par SF Pro `tabular-nums` sur toutes les valeurs monétaires et pondérales.
11. **LKV-INTL-01 (P1)** : Formatage des devises et des mesures avec séparateur décimal à virgule et espaces insécables.
12. **LKV-ICON-01 (P1)** : Remplacement de tous les emojis par des icônes vectorielles Apple-like.
13. **LKV-STUDIO-01 (P1)** : Rétablissement du responsive sur les studios d'expédition et de carnet en affichage mobile.
14. **LKV-MAP-01 (P1)** : Normalisation des contrôles de carte MapLibre/Leaflet en grappe de verre `MapControlCluster`.
15. **LKV-EMPTY-01 (P2)** : Ajout d'états vides et d'erreur illustrés avec boutons d'action clairs sur les pages orphelines.
16. **LKV-CONCENTRIC-01 (P2)** : Alignement strict des rayons de courbure intérieurs selon la formule $R_{ext} - P$.
17. **LKV-INTENSITY-01 (P2)** : Câblage du contrôleur d'intensité de verre `--glass-intensity` dans les paramètres de profil.
18. **LKV-GPU-01 (P2)** : Limitation des backdrop-filters simultanés à 8 maximum pour garantir 60 fps constants.
19. **LKV-MOTION-01 (P3)** : Implémentation des transitions par ressorts physiques (spring damping 0.85).
20. **LKV-SQUIRCLE-01 (P3)** : Activation progressive de `corner-shape: squircle` pour les navigateurs compatibles.
