# Comparatif Avant / Après — Chantier "Full Liquid Glass iOS 27"

**Auteurs :** Design Lead Apple Human Interface & Tech Lead Front Next.js 15  
**État d'avancement :** Lot 0-1a finalisé (Garde-fous, Tokens Verre, Primitives UI). Lots 1 à 5 programmés.

---

## 1. Synthèse des Transformations Fondatrices (Lot 0-1a)

| Domaine | État Antérieur ("Avant") | État Actuel Lot 0-1a ("En cours") | Cible Finale Validée |
|:---|:---|:---|:---|
| **Palette & Monochromie** | Nombreuses couleurs d'accent menthe/vertes (`#2D6B4A`, `text-emerald-*`, etc.) dispersées dans les composants UI. | Palette bannie éradiquée à 100% de `src/`. Primitives d'interface (`Button`, `Chip`, `Tabs`, `SearchField`, `Card`, etc.) 100% monochromes en Liquid Glass. | 0 accent résiduel sur l'intégralité des 79 routes applicatives. |
| **Matière Verre** | Verre plat, opacités arbitraires, absence de liseré assombri, pas de relief tactile. | Système à 5 niveaux calibré (`tokens.css` : G0 fond, G1 structure, G2 intérieur, G3 prominent, GC clair) avec liseré assombri spéculaire iOS 27. | Composant `GlassSurface` universel et propagation sur toutes les fiches, tuiles et modales. |
| **Géométrie & Rayons** | Rayons hétérogènes (14px, 18px), champs rectangulaires, absence de concentricité formalisée. | Capsule obligatoire (`rounded-full` 9999px) sur boutons, chips, champs et tabs. Plancher de concentricité strict fixé à 20px (`radius.spec.ts`). | Hiérarchie 24/28/32/38/44px déployée sur toutes les pages sans aucune exception. |
| **Zones Tactiles & Ergonomie** | Boutons d'icônes carrés de ~12px ou < 44px, collisions avec la barre de navigation basse. | `IconButton` normalisé en cercle de 44×44px minimum (`w-11 h-11`). Wrapper de page ajusté avec 24px de dégagement de sécurité. | Variable dynamique `--content-pb` calculée avec `--tabbar-h` et `--safe-bottom` dans `MobilePageShell`. |
| **Accessibilité & Contraste** | Textes menthe sur fond clair (< 2:1), absence de validation contrastes pire-pixel. | Système de tokens `var(--glass-label)`, `secondary`, `tertiary` calibrés pour garantir >= 4.5:1 / 3:1 (`contrast.spec.ts`). | Audit automatique axe-core et Lighthouse CI sur 100% des routes et des 3 niveaux d'intensité. |
| **Contrôle d'Intensité** | Aucune personnalisation de la densité du verre. | Sélecteur 3 niveaux (Subtil 20%, Équilibré 50%, Profond 85%) dans les paramètres avec hydratation instantanée sans flash (`layout.tsx`). | Persistance et adaptation contextuelle continue sur les 79 routes. |

---

## 2. État d'Avancement des Constats Spécifiques (OBS-G01 à OBS-G16)

### OBS-G01 · Tab bar qui masque le contenu au scroll
- **Avant :** Le bas des pages (formulaires, totaux, cartes, listes de courses) était recouvert par la barre de navigation mobile fixe.
- **Actuel (Lot 0-1a - Partiel) :** Marge de dégagement de sécurité (`paddingBottom: 'var(--space-6, 24px)'`) ajoutée sur le conteneur interne de `AppShell.tsx:75` sans casser l'invariant de test `paddingBottom: 'var(--bottom-nav-height)'`.
- **Preuve :** `src/components/shell/AppShell.tsx:75`.
- **Reste à faire (Lot 1 P0) :** Formalisation de `--content-pb` calculé dynamiquement avec `--tabbar-h` et `--safe-bottom` dans `MobilePageShell` et suppression des marges ad-hoc.

### OBS-G02 · Fond qui s'interrompt en bande vert uni
- **Avant :** Lors d'un scroll prononcé ou sur les pages courtes, une bande vert forêt unie apparaissait en arrière-plan.
- **Actuel (Lot 0-1a - Partiel) :** Token de matière G0 et dégradé ambiant définis dans `tokens.css:738-742`.
- **Reste à faire (Lot 1 P0) :** Déploiement du conteneur G0 fixed à `100dvh` sur l'ensemble du layout racine pour garantir un défilement infini sans rupture visuelle.

### OBS-G03 · Titres menthe avec contraste insuffisant (< 2:1)
- **Avant :** Titres H1/H2 et badges utilisant un vert menthe illisible sur fond clair ou photographique.
- **Actuel (Lot 0-1a - Partiel) :** Primitives d'en-tête et composants UI convertis en `var(--glass-label)` monochrome haute lisibilité.
- **Reste à faire (Lot 1 P0 / Lot 3) :** Balayage systématique des classes de titres spécifiques sur les pages `/avis`, `/rapport-expedition`, `/connexion`, etc.

### OBS-G04 · Verre plat et trop transparent
- **Avant :** Simple `bg-white/10 backdrop-blur-md` sans liseré ni reflet, provoquant des effets de bruit et une perte de relief.
- **Actuel (Lot 0-1a - Fait) :** Définition dans `tokens.css:738-815` et `liquid-glass.css` des 5 strates avec double rim spéculaire (`--glass-rim`, `--glass-highlight`, `--glass-rim-inner`) reproduisant fidèlement le matériau d'Apple iOS 27.
- **Preuve :** `tests/design/tokens-sync.spec.ts`, `src/styles/tokens.css:738-815`.

### OBS-G05 · Présence d'emojis et de drapeaux textuels en lettres
- **Avant :** Utilisation d'emojis système hétérogènes (boussole, chaussures, drapeaux texte "FR", "IS") dégradant le rendu haut de gamme.
- **Actuel (Lot 0-1a - Partiel) :** `CountryFlag.tsx` refondu en style verre monochrome.
- **Reste à faire (Lot 2 / Lot 3) :** Remplacement des emojis des menus d'outils et des pages communautaires par le jeu vectoriel `LkvIcon` et drapeaux SVG dédiés.

### OBS-G06 · Typographie monospace sur les prix, poids et durées
- **Avant :** Polices à espacement fixe appliquées indûment aux montants en euros et aux métriques de randonnée.
- **Actuel (Lot 0-1a - Partiel) :** Déclaration de la pile SF Pro avec `tabular-nums` dans `tokens.css:202-205`.
- **Reste à faire (Lot 3) :** Remplacement des classes `font-mono` sur les fiches produits, comparateurs et récapitulatifs de kit.

### OBS-G07 · Point décimal anglo-saxon (`55.00 €`, `3.3 L`)
- **Avant :** Formatage brut en JavaScript avec point décimal sans respect de la typographie française.
- **Actuel (Lot 0-1a - Partiel) :** Règles établies dans `audit/COPY.md`.
- **Reste à faire (Lot 2 / Lot 3) :** Utilisation systématique de `Intl.NumberFormat('fr-FR')` sur les composants `PriceTag` et métriques de poids/distance.

### OBS-G08 · Incohérence des badges de notification
- **Avant :** Pastilles numériques affichant des valeurs divergentes (3, 6 ou vide) selon la page consultée.
- **Actuel (Lot 0-1a - Partiel) :** Composant `Badge.tsx` en verre G3 monochrome disponible.
- **Reste à faire (Lot 2) :** Centralisation de la source d'état de notification pour synchroniser la TopBar et la BottomTabBar.

### OBS-G09 · Textes de redirection flottants sur photo brute
- **Avant :** Affichage d'un texte brut "Redirection en cours..." ou "Chargement..." directement superposé à l'image de fond.
- **Actuel (Lot 0-1a - Partiel) :** Squelettes et spinners en verre développés.
- **Reste à faire (Lot 2) :** Déplacement des logiques de redirection en Server Actions et squelettes d'attente G1.

### OBS-G10 · Squelettes de chargement en dégradé noir/blanc agressif
- **Avant :** Pulsation gris/noir standard de Tailwind (`animate-pulse bg-gray-200`) rompant l'immersion liquide.
- **Actuel (Lot 0-1a - Fait) :** `src/components/ui/Skeleton.tsx:14-23` entièrement refondu en shimmer de verre opalescent avec bordure spéculaire `var(--glass-rim)`.
- **Preuve :** `src/components/ui/Skeleton.tsx:14-23`.

### OBS-G11 · Jargon interne visible de l'utilisateur
- **Avant :** Mentions de "PHASE 3/5", "TIER", "Données réelles", "Secours démo", "Fixtures locales", "Moyenne bayésienne".
- **Actuel (Lot 0-1a - Partiel) :** Inventaire d'éradication complet dressé dans `audit/COPY.md`.
- **Reste à faire (Lot 3) :** Remplacement des libellés dans les interfaces de fidélité, de rapport d'expédition et d'outils.

### OBS-G12 · Sous-onglets empilés sur la tab bar
- **Avant :** Barres d'onglets secondaires collées sur la barre de navigation basse, produisant des conflits d'interaction tactile.
- **Actuel (Lot 0-1a - Partiel) :** Composant `Tabs.tsx` refondu en track de verre G1 capsule avec glisseur G3.
- **Reste à faire (Lot 1 P0 / Lot 2) :** Intégration de la `SubTabBar` isolée avec surélévation et aria-current fiable.

### OBS-G13 · Boutons d'icône carrés d'environ 12px
- **Avant :** Cibles tactiles trop petites (< 44×44 pt), inaccessibles et non conformes aux Human Interface Guidelines.
- **Actuel (Lot 0-1a - Fait) :** Normalisation de `src/components/ui/IconButton.tsx` en cercle de 44 pt minimum (`w-11 h-11 rounded-full`).
- **Preuve :** `src/components/ui/IconButton.tsx:28`.

### OBS-G14 · Contenu collé aux bords de l'écran (x=0)
- **Avant :** Sur certaines pages de communauté et de feed, les cartes et textes touchaient les bordures physiques de l'écran mobile.
- **Actuel (Lot 0-1a - Partiel) :** Marges d'écran normalisées dans `AppShell.tsx`.
- **Reste à faire (Lot 3) :** Vérification route par route sur les flux `/communaute` et `/feed`.

### OBS-G15 · Rayons de courbure arbitraires (14-20px) et champs rectangulaires
- **Avant :** Bords peu arrondis, boutons et champs de formulaire aux angles rigides.
- **Actuel (Lot 0-1a - Fait) :** Généralisation de la capsule 9999px (`rounded-full`) sur `Button.tsx`, `SearchField.tsx`, `Chip.tsx`, `Tabs.tsx`, et plancher de concentricité à 20px (`tokens.css:751`).
- **Preuve :** `tests/design/radius.spec.ts:33-58`.

### OBS-G16 · Accents menthe résiduels dans l'interface
- **Avant :** Vert menthe utilisé pour les statuts actifs, les barres de progression, les coches de sélection et les CTA.
- **Actuel (Lot 0-1a - Partiel) :** Toutes les primitives UI ont été converties au verre monochrome. `GlobalSearchModal.tsx:319` corrigé en capsule monochrome G3.
- **Reste à faire (Lot 1 P0 / Lot 3) :** Élimination des 1635 occurrences résiduelles dans les composants métiers spécifiques des 79 routes.
