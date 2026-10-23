# Refonte Compte iOS 27 v12 — Header Épuré, Sélecteur Haut-Droite, Actions dans Drawer, Carte 3D Fiabilisée & Post Téléportation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Épurer le profil Instagram LKDV (retrait nom/pseudo sous l'avatar, compteurs recentrés, sélecteur Grille/Sorties déplacé en haut à droite de la card, boutons de profil déplacés dans le drawer haut-droit), fiabiliser définitivement la carte vivante 3D avec tous ses calques et anticiper tout bug d'affichage, ouvrir les posts dans un drawer superposé laissant la carte visible tout en téléportant la caméra 3D sur le lieu de prise de vue, et harmoniser tous les sélecteurs de drawers en véritable Liquid Glass iOS 27 clair identique à la bottom bar.

**Architecture:** 
- `src/components/compte/CompteLiquidGlassV8.tsx` : Structure HTML, tokens CSS Liquid Glass iOS 27 unifiés clairs, placement du sélecteur en haut à droite de la card, montage et liaison MapLibre GL.
- `src/components/compte/compte-liquid-glass-v8-runtime.js` : Moteur runtime, épuration du header (.ig-left sans texte sous l'avatar, compteurs recentrés), déplacement des boutons "Modifier le profil" et "Partager le profil" dans `account_drawer`, ouverture du post en drawer superposé au-dessus du compte avec `flyTo` automatique de la carte 3D vers les coordonnées exactes du post, fiabilisation totale de `setup3DMap()` (ResizeObserver, watchers, couches de secours, gestion de redimensionnement).
- `tests/design/compte-refonte-v12.spec.ts` : Tests de validation TDD automatisés pour les 6 exigences fonctionnelles et visuelles.

**Tech Stack:** Next.js 15, TypeScript, MapLibre GL v6, Tailwind CSS, WebGL, Design System Liquid Glass iOS 27, Vitest.

## Global Constraints
- STRICT INVARIANT: ZERO changes to `/compas` (`src/app/compas/**`, `src/features/compas/**`).
- Règle Apple UI & Liquid Glass : 100% verre clair dépoli (`rgba(255, 255, 255, 0.65)`, `blur(28px)`, reflets vifs, lentille coulissante lumineuse blanche `#ffffff`, icône active `#17402C`, icône inactive `#56665D`) pour TOUS les sélecteurs de drawers et de la card.
- Règle ergonomique : Pure icône ou pur texte, jamais les deux mélangés dans les sélecteurs à onglets compacts.
- Règle de validation : Attente impérative de l'approbation du plan par l'utilisateur avant toute écriture de code.

---

### Task 1: Header Épuré & Compteurs Recentrés (Profil Instagram Minimaliste)

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js:2415-2435`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx:1034-1120`
- Test: `tests/design/compte-refonte-v12.spec.ts`

**Interfaces:**
- Consumes: `S.profile`, `derive().pubCount`, `D.followingCount`, `stats`
- Produces: Header épuré sans `.ig-left-meta` sous l'avatar, `.ig-stats` parfaitement recentré dans l'espace disponible

- [x] **Step 1: Rédiger le test unitaire vérifiant l'absence de texte sous la photo de profil et le centrage des statistiques**
- [x] **Step 2: Supprimer `.ig-left-meta` sous `.ig-avi-wrap` dans `card()`**
- [x] **Step 3: Ajuster le CSS de `.ig-header`, `.ig-left` et `.ig-stats` pour centrer harmonieusement les compteurs (publications, abonnés, abonnements)**
- [x] **Step 4: Valider le test unitaire et vérifier l'alignement visuel**

---

### Task 2: Repositionnement du Sélecteur Grille / Sorties en Haut à Droite de la Card

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js:2435-2445`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx:768-850`, `1120-1160`
- Test: `tests/design/compte-refonte-v12.spec.ts`

**Interfaces:**
- Consumes: `S.igTab` (0 = Grille, 1 = Sorties), `igtab` click handler
- Produces: Sélecteur capsule 2 boutons positionné en haut à droite de `.card` avec Liquid Glass iOS 27 clair

- [x] **Step 1: Rédiger le test unitaire vérifiant la présence et la position en haut à droite du sélecteur Grille/Sorties**
- [x] **Step 2: Déplacer la balise `.ig-tabs` dans la structure du header ou en position absolue en haut à droite de `.card`**
- [x] **Step 3: Styliser la capsule en haut à droite (`width: 88px; height: 32px; border-radius: 9999px;`) avec lentille coulissante blanche et icônes vectorielles pures 15px**
- [x] **Step 4: Valider le fonctionnement des clics et de l'indicateur actif**

---

### Task 3: Déplacement des Boutons "Modifier le Profil" et "Partager le Profil" dans le Drawer Haut-Droit

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js:2411-2436`, `2806-2845`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/design/compte-refonte-v12.spec.ts`

**Interfaces:**
- Consumes: Handlers `editProfile` (`data-a="editProfile"`) et `shareProfile` (`data-a="shareProfile"`)
- Produces: Suppression des boutons au centre de la card de profil ; intégration dans le tiroir `account_drawer` (bouton sliders en haut à droite)

- [x] **Step 1: Rédiger le test unitaire vérifiant que `.ig-actions` n'est plus présent dans la card principale et que les deux boutons sont présents dans `account_drawer`**
- [x] **Step 2: Retirer la concaténation de `actions` dans la fonction `card()` de `compte-liquid-glass-v8-runtime.js`**
- [x] **Step 3: Ajouter un bandeau d'actions prioritaires en tête de `account_drawer` avec "Modifier le profil" (bouton principal) et "Partager le profil" (bouton secondaire verre clair)**
- [x] **Step 4: Vérifier que le clic sur "Modifier le profil" ouvre la feuille d'édition Apple complète et que le partage fonctionne avec retour haptique**

---

### Task 4: Ouverture des Posts en Drawer Dédié avec Téléportation de la Carte 3D

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js:3150-3230`, `2965-3140`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/design/compte-refonte-v12.spec.ts`

**Interfaces:**
- Consumes: Post id (`postId`), coordonnées de prise de vue (`coords`, `alt`, `massif`), instance `window.__lkdvCompteMap3D`
- Produces: Drawer de superposition de post sur la partie haute de l'écran, téléportation cinématique `flyTo` de la caméra 3D sur le lieu exact, mise en valeur du pin photo

- [x] **Step 1: Rédiger le test unitaire validant l'ouverture du post en drawer superposé au-dessus de la carte et l'appel de `map.flyTo` avec les coordonnées de la publication**
- [x] **Step 2: Adapter `#post_modal_instagram` ou créer le drawer `post_detail_sheet` pour s'afficher en superposition sur la moitié haute de l'écran (gardant la carte 3D visible en-dessous)**
- [x] **Step 3: Dans `EXA.openPostModal(id)`, mapper l'identifiant du post avec ses coordonnées réelles (Lac Blanc : `[6.8894, 45.9812]`, Néouvielle : `[-0.0112, 42.7324]`, Glacier Blanc : `[6.415, 44.925]`) et invoquer `window.__lkdvCompteMap3D.flyTo({ center: coords, zoom: 14.2, pitch: 65, bearing: -20, duration: 2000 })`**
- [x] **Step 4: Afficher la notification Dynamic Island avec le nom du lieu et l'altitude, et ajouter un repère visuel lumineux sur la carte 3D**

---

### Task 5: Fiabilisation Totale & Éradication des Bugs d'Affichage de la Carte Vivante 3D

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js:3965-4355`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx:1710-1760`
- Test: `tests/design/compte-refonte-v12.spec.ts`

**Interfaces:**
- Consumes: MapLibre GL instance, DOM container `#maplibre-compte-canvas`
- Produces: Carte 3D toujours active, redimensionnement dynamique automatique, couches de secours immédiates (background, raster satellite et topo), tracé GPS TMB, 5 massifs, sommets, refuges et photos géolocalisées

- [x] **Step 1: Rédiger le test unitaire vérifiant l'initialisation infaillible de la carte, la présence des calques satellite/relief/tracé/massifs/POIs et le rattachement de `window.__lkdvCompteMap3D`**
- [x] **Step 2: Installer un `ResizeObserver` natif sur le conteneur `#maplibre-compte-canvas` pour déclencher `map.resize()` immédiatement après tout changement de taille ou affichage du DOM**
- [x] **Step 3: Ajouter des déclencheurs de redimensionnement de secours à `t=50ms`, `t=200ms`, `t=500ms` et `t=1200ms` après l'instanciation de la carte**
- [x] **Step 4: Ajouter une couche de fond (`background-color: #0b101b`) et une source raster OpenStreetMap/IGN de secours pour éliminer tout écran vide lors du chargement des tuiles**
- [x] **Step 5: Conserver le fallback fluide vers le tracé SVG si WebGL n'est pas disponible dans l'environnement du navigateur**

---

### Task 6: Harmonisation Universelle de Tous les Sélecteurs de Drawers en Liquid Glass iOS 27 Clair

**Files:**
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/design/compte-refonte-v12.spec.ts`

**Interfaces:**
- Consumes: Sélecteurs de tous les tiroirs (`.flow`, `.segc`, `followers_sheet`, `account_drawer`, `lignees`, etc.)
- Produces: Rendu uniforme en Liquid Glass iOS 27 clair identique à la bottom bar (`.tb`)

- [x] **Step 1: Rédiger le test unitaire vérifiant les styles Liquid Glass clairs (fond dépoli `rgba(255,255,255,0.65)`, lentille blanche lumineuse, couleur active `#17402C`) sur tous les sélecteurs de tiroirs**
- [x] **Step 2: Appliquer les classes et règles CSS unifiées aux sélecteurs de `account_drawer`, `followers_sheet`, `flow` (Identité 5 écrans) et `lignees`**
- [x] **Step 3: Supprimer tout override de fond sombre ou boîte noire pour préserver la transparence claire iOS 27**
- [x] **Step 4: Vérifier que tous les sélecteurs disposent de transitions fluides et de retours haptiques au changement d'onglet**

---

### Task 7: Validation Globale, Tests Visuels & Non-Régression

**Files:**
- Test: `tests/design/compte-refonte-v12.spec.ts`
- Test: `tests/design/*.spec.ts`

- [x] **Step 1: Exécuter la suite complète Vitest (`npx vitest run tests/design/`) et valider 100% de succès**
- [x] **Step 2: Exécuter `npm run build` pour confirmer l'absence d'erreur TypeScript ou Next.js**
- [x] **Step 3: Réaliser des captures d'écran visuelles démontrant le profil épuré, la carte 3D active, le sélecteur haut-droit, les actions dans le drawer et le drawer de post superposé avec téléportation**
- [x] **Step 4: Valider le strict invariant de non-modification de `/compas`**
