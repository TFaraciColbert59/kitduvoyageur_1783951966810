# Audit attribut par attribut — carnet vs Compte

**Date :** 24 octobre 2026
**Méthode :** script Playwright sur les deux pages en production, 430 × 932. Pour chaque paire d'éléments (Compte ↔ fiche), comparaison de 32 propriétés calculées plus la géométrie. Sortie brute conservée dans `/tmp/ckp-diff.json`.

## Constats de page

| Mesure | Compte | Carnet |
|---|---|---|
| `scrollHeight` / `innerHeight` | 932 / 932 (**aucun scroll**) | 2061 / 932 (**+1129 px de scroll**) |
| Scroll interne de la carte | oui (`.card-scroll`) | **non** |
| Surfaces de drawer montées | 8 | **0** |


## Synthèse : 12 causes racines qui expliquent 80 % des 221 écarts

| # | Cause racine | Compte | Carnet | Effet mesuré |
|---|---|---|---|---|
| 1 | **Typo de base héritée** | `14px` | **`17px`** | 41 écarts `fontSize` / `lineHeight` en cascade sur les conteneurs |
| 2 | **Interlettrage global** | `-0.14px` | `normal` | 18 écarts `letterSpacing` |
| 3 | **Couleur de texte** | `#172b24` | `#17402c` | 12 écarts `color` |
| 4 | **Scroll** | page verrouillée, `.card-scroll` interne | page de **2061 px** qui défile | 1 constat majeur + hauteurs de carte |
| 5 | **Drawers** | 8 surfaces montées | **0** | aucun élément de la carte n'ouvre de panneau |
| 6 | **Padding de la carte** | `0`, contenu dans `.card-scroll` (`8px 12px 56px`, `gap 7`) | `10px 14px 14px` | 17 écarts sur la zone de contenu |
| 7 | **Anneau du visuel** | base `linear-gradient(145deg, #ffffffeb, #ebf2eca6)` + `::before` conique + `border 2px #ffffffeb` | conique seul | 13 écarts de matière |
| 8 | **Anneau d'action** | `linear-gradient(145deg, rgba(23,64,44,.55), rgba(91,127,85,.35), rgba(255,255,255,.85))`, disque `rgba(244,247,243,.88)` + `1.5px #fffffff2` | conique `from 140deg` | 8 écarts `backgroundImage` |
| 9 | **Grille de stats** | `gap 4`, colonnes `1fr` (101 px) | `gap 0` (99 px) | 9 écarts de boîte |
| 10 | **Sélecteur** | `.ig-tabs` 31 px radius 12, lentille `.ig-th` 320 ms | `.ckp-toggle` 30 px radius 999 | 2 écarts de forme + 3 d'animation |
| 11 | **Barre basse** | `button`, lentille visible, libellés 10/500 | `a`, lentille masquée | 9 écarts |
| 12 | **Filtre liquid-glass** | `backdrop-filter: url(#lf…) blur(4px)…` sur pilule et boutons | `blur(4px)…` sans displacement | 6 écarts de matière (non reproductible en CSS pur) |

**Lecture :** les points 1 à 3 sont trois lignes de CSS et referment ~70 écarts. Les points 4 et 5 sont la structure (écran fixe + drawers). Les points 6 à 11 sont les formes déjà prévues au plan. Le point 12 est la seule différence **non reproductible** sans importer le runtime de la maquette Compte : elle se compense par le bord 1 px et le fond `.14` déjà mesurés.

## 221 différences mesurées

### Barre du haut — 13 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 0×0 430×597 | 12×0 406×48 |
| `position` | relative | sticky |
| `width` | 430px | 406px |
| `height` | 597.078px | 48px |
| `padding` | 6px 12px 8px | 6px 0px 8px |
| `gap` | 4px | normal |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `zIndex` | auto | 20 |
| `alignItems` | normal | center |
| `flexDirection` | column | row |

### Pilule identité — 13 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 12×7 109×34 | 44×6 244×34 |
| `width` | 109.031px | 244.156px |
| `backgroundColor` | rgba(255, 255, 255, 0.14) | rgba(0, 0, 0, 0) |
| `backgroundImage` | none | linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 25… |
| `backdropFilter` | url("#lf109x34r17") blur(4px) saturate(1.9) brightness(… | blur(4px) saturate(1.9) brightness(1.07) |
| `border` | 1px solid rgba(255, 255, 255, 0.3) | 1px solid rgba(255, 255, 255, 0.55) |
| `boxShadow` | rgba(255, 255, 255, 0.9) 0px 1px 0px 0px inset, rgba(25… | rgba(255, 255, 255, 0.9) 0px 1px 0px 0px inset, rgba(25… |
| `fontSize` | 16px | 17px |
| `fontWeight` | 600 | 400 |
| `lineHeight` | 16px | 23.8px |
| `letterSpacing` | -0.32px | normal |
| `color` | rgba(255, 255, 255, 0.94) | rgb(23, 64, 44) |
| `transition` | transform 0.35s cubic-bezier(0.3, 1.5, 0.5, 1) | all |

### Bouton rond (+ / cloche) — 5 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 294×5 38×38 | 294×4 38×38 |
| `backdropFilter` | url("#lf38x38r19") blur(4px) saturate(1.9) brightness(1… | blur(4px) saturate(1.9) brightness(1.07) |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |

### Carte — 13 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 12×48 406×541 | 12×50 406×644 |
| `display` | flex | block |
| `height` | 541.078px | 644.062px |
| `padding` | 0px | 10px 14px 14px |
| `gap` | 0px | normal |
| `boxShadow` | rgba(255, 255, 255, 0.95) 0px 1px 0px 0px inset, rgba(2… | rgba(255, 255, 255, 0.95) 0px 1px 0px 0px inset, rgba(2… |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `overflow` | hidden | visible |
| `transition` | transform 0.3s cubic-bezier(0.3, 1.2, 0.4, 1), opacity … | all |
| `flexDirection` | column | row |

### Zone de scroll de la carte — 16 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 12×48 406×541 | 12×50 406×644 |
| `position` | static | relative |
| `display` | flex | block |
| `height` | 541.078px | 644.062px |
| `padding` | 8px 12px 56px | 10px 14px 14px |
| `gap` | 7px | normal |
| `borderRadius` | 0px | 24px |
| `backgroundImage` | none | linear-gradient(rgba(255, 255, 255, 0.486), rgba(255, 2… |
| `backdropFilter` | none | blur(25.2px) saturate(1.8) brightness(1.05) |
| `boxShadow` | none | rgba(255, 255, 255, 0.95) 0px 1px 0px 0px inset, rgba(2… |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `overflow` | hidden auto | visible |
| `flexDirection` | column | row |

### Visuel identité — 13 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 26×58 66×66 | 28×62 66×66 |
| `display` | grid | block |
| `backgroundImage` | linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba… | conic-gradient(from 140deg, rgba(23, 64, 44, 0.62), rgb… |
| `border` | 0px none rgb(23, 43, 36) | 0px none rgb(23, 64, 44) |
| `boxShadow` | rgba(23, 64, 44, 0.14) 0px 3px 14px 0px, rgba(255, 255,… | rgba(23, 64, 44, 0.14) 0px 3px 14px 0px, rgba(255, 255,… |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `transition` | transform 0.2s cubic-bezier(0.3, 1.4, 0.5, 1) | all |
| `alignItems` | center | normal |
| `gridTemplateColumns` | 61px | none |
| `cursor` | pointer | zoom-in |

### Cellule statistique — 10 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 102×72 101×39 | 104×76 99×39 |
| `width` | 100.656px | 99.3281px |
| `height` | 38.5312px | 39px |
| `border` | 0px none rgb(23, 43, 36) | 0px solid rgba(255, 255, 255, 0.16) |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `transition` | transform 0.15s | all |
| `cursor` | pointer | auto |

### Valeur statistique — 4 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 142×74 21×20 | 120×78 67×20 |
| `width` | 21.1406px | 66.8906px |
| `overflow` | visible | hidden |
| `cursor` | pointer | auto |

### Libellé statistique — 3 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 121×96 63×13 | 127×100 53×13 |
| `width` | 62.9062px | 53.2812px |
| `cursor` | pointer | auto |

### Ligne de bio — 9 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 26×151 378×16 | 28×138 374×13 |
| `display` | flow-root | block |
| `width` | 378px | 374px |
| `height` | 15.5938px | 13.4062px |
| `margin` | 0px | 10px 2px 0px |
| `fontSize` | 12px | 11px |
| `lineHeight` | 15.6px | 13.42px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(86, 102, 93) | rgb(23, 64, 44) |

### Action rapide — 8 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 28×177 72×56 | 28×207 72×57 |
| `width` | 71.5938px | 72px |
| `height` | 56.3906px | 57.2656px |
| `border` | 0px none rgb(23, 43, 36) | 0px none rgb(23, 64, 44) |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |

### Anneau action — 11 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 42×177 44×44 | 42×207 44×44 |
| `position` | static | relative |
| `display` | grid | block |
| `fontSize` | 9.8px | 17px |
| `fontWeight` | 500 | 400 |
| `lineHeight` | 10.78px | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `overflow` | hidden | visible |
| `alignItems` | center | normal |
| `gridTemplateColumns` | 40px | none |

### Disque action — 10 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 45×180 38×38 | 44×209 40×40 |
| `position` | relative | static |
| `width` | 38px | 40px |
| `height` | 38px | 40px |
| `fontSize` | 9px | 17px |
| `fontWeight` | 500 | 400 |
| `lineHeight` | 9.9px | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `gridTemplateColumns` | 36px | 38px |

### Libellé action — 13 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 42×177 44×44 | 48×253 31×11 |
| `display` | grid | block |
| `width` | 44px | 31.3594px |
| `height` | 44px | 10.7656px |
| `padding` | 2px | 0px |
| `borderRadius` | 50% | 0px |
| `backgroundImage` | conic-gradient(from 140deg, rgba(23, 64, 44, 0.7), rgba… | none |
| `boxShadow` | rgb(255, 255, 255) 0px 1px 0px 0px inset, rgba(23, 43, … | none |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `transition` | transform 0.15s | all |
| `alignItems` | center | normal |
| `gridTemplateColumns` | 40px | none |

### Wrap grille — 12 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 12×243 406×814 | 12×274 406×406 |
| `display` | flex | grid |
| `height` | 814px | 406px |
| `margin` | 0px -12px -14px | 10px -14px 0px |
| `gap` | 3px | 2px |
| `borderRadius` | 22px | 0px 0px 24px 24px |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `gridTemplateColumns` | none | 134px 134px 134px |
| `flexDirection` | column | row |

### Tuile — 8 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 12×243 134×134 | 12×274 134×134 |
| `backgroundColor` | rgb(23, 64, 44) | rgb(223, 232, 220) |
| `border` | 0px none rgb(23, 43, 36) | 0px none rgb(23, 64, 44) |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `transition` | transform 0.15s | all |

### Sélecteur 31 — 18 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 320×549 88×30 | 330×640 64×30 |
| `position` | relative | absolute |
| `display` | grid | flex |
| `width` | 88px | 64px |
| `padding` | 2.5px | 2px |
| `borderRadius` | 9999px | 999px |
| `backgroundColor` | rgba(0, 0, 0, 0) | rgba(255, 255, 255, 0.34) |
| `backgroundImage` | linear-gradient(rgba(255, 255, 255, 0.486), rgba(255, 2… | none |
| `backdropFilter` | url("#lf88x30r15") blur(4px) saturate(1.9) brightness(1… | blur(7.2px) saturate(1.9) brightness(1.07) |
| `border` | 0px none rgb(23, 43, 36) | 0px solid rgba(255, 255, 255, 0.16) |
| `boxShadow` | rgba(255, 255, 255, 0.9) 0px 1px 0px 0px inset, rgba(25… | rgba(23, 43, 36, 0.08) 0px 0px 0px 0.5px inset, rgba(23… |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `zIndex` | 10 | 5 |
| `alignItems` | normal | center |
| `gridTemplateColumns` | 41.5px 41.5px | none |

### Lentille sélecteur — 20 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 323×552 42×25 | 332×642 30×26 |
| `position` | absolute | relative |
| `display` | block | grid |
| `width` | 41.5px | 30px |
| `height` | 25px | 26px |
| `borderRadius` | 9999px | 999px |
| `backgroundColor` | rgba(0, 0, 0, 0) | rgb(255, 255, 255) |
| `backgroundImage` | linear-gradient(rgba(255, 255, 255, 0.62), rgba(255, 25… | none |
| `border` | 0px solid rgba(255, 255, 255, 0.16) | 0px none rgb(23, 64, 44) |
| `boxShadow` | rgb(255, 255, 255) 0px 1px 0px 0px inset, rgba(255, 255… | rgba(23, 43, 36, 0.14) 0px 1px 3px 0px, rgba(23, 43, 36… |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `zIndex` | 1 | auto |
| `transition` | transform 0.28s cubic-bezier(0.3, 1.35, 0.4, 1) | all |
| `transform` | matrix(1, 0, 0, 1, 0, 0) | none |
| `alignItems` | normal | center |
| `gridTemplateColumns` | none | 30px |
| `cursor` | auto | pointer |

### Barre basse — 9 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 14×868 402×48 | 14×874 402×48 |
| `position` | absolute | fixed |
| `backdropFilter` | url("#lf402x48r24") blur(4px) saturate(1.9) brightness(… | blur(7.2px) saturate(1.9) brightness(1.07) |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `transition` | opacity 0.25s, transform 0.35s cubic-bezier(0.32, 0.72,… | all |
| `transform` | none | matrix(1, 0, 0, 1, -201, 0) |

### Lentille barre basse — 9 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 334×872 79×40 | 17×878 79×40 |
| `fontSize` | 14px | 17px |
| `lineHeight` | normal | 23.8px |
| `letterSpacing` | -0.14px | normal |
| `color` | rgb(23, 43, 36) | rgb(23, 64, 44) |
| `opacity` | 1 | 0 |
| `zIndex` | 1 | auto |
| `transition` | transform 0.55s cubic-bezier(0.3, 1.35, 0.4, 1), backgr… | transform 0.42s cubic-bezier(0.32, 0.72, 0, 1) |
| `transform` | matrix(1, 0, 0, 1, 316.75, 0) | none |

### Item barre basse — 4 écarts

| Propriété | Compte | Carnet |
|---|---|---|
| `box` | 16×870 80×44 | 16×876 80×44 |
| `padding` | 3px 0px | 0px |
| `letterSpacing` | -0.1px | normal |
| `transition` | color 0.16s | all |

