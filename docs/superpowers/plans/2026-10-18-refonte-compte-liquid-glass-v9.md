# Refonte Compte iOS 27 Liquid Glass v9 — Plan d'Implémentation Complet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'écran `/compte` selon le Design System Liquid Glass iOS 27 LKDV : éliminer les filtres de grille et "Tribu" du sélecteur, adopter des sélecteurs à icônes pures (zéro texte), intégrer un écran complet de modification de profil, afficher les sorties faites en défilement horizontal de cartes épurées, remplacer Tribu par un affichage Abonnements/Abonnés avec toggle, sublimer la visionneuse de stories à la une, connecter les boutons d'en-tête (Drawer Commandes/Notifs/Paramètres et Sheet Création Tout-en-un), supprimer Mission Control et la barre de données superposée, et afficher le véritable Globe 3D avec relief et atmosphère dès l'ouverture.

**Architecture:** Maintien du moteur hybride React/DOM Liquid Glass haute performance dans `src/components/compte/CompteLiquidGlassV8.tsx` et `compte-liquid-glass-v8-runtime.js`. Séparation nette entre le rendu d'en-tête, les 4 onglets à icônes pures (Grille, Voyages carrousel, Réseau toggle, Lignées), le drawer latéral iOS, la sheet de modification intégrale du profil, la visionneuse de stories Liquid Glass et le viewport MapLibre GL JS v4 3D Globe natif sans obstruction SVG ni barre d'accessoire superposée.

**Tech Stack:** Next.js 15, React 19, TypeScript, MapLibre GL JS v4.7.1, WebGL, Tailwind CSS, Supabase PostGIS, Vitest.

**Spec:** Recommandations et captures d'écran mobiles du 18 octobre 2026 (`media_1792336411863_a7697268.png`, `media_1792336620856_5c99d68a.png`, `media_1792336838771_f5f924ab.png`).

## Global Constraints

- **STRICT INVARIANT :** Aucune modification de `/compas` (`src/app/compas/**`, `src/features/compas/**`).
- **RÈGLE DU SÉLECTEUR :** Des icônes vectorielles pures dans les sélecteurs (onglets profil et échelle de carte), AUCUN texte superflus ou tronqué.
- **PALETTE NATURELLE LKDV :** Vert Forêt `#17402C`, Sauge `#5B7F55`, Brume `#EBF2EC`, Blanc translucide `rgba(255,255,255,0.7)`. AUCUN orange `#E4501C` sur `/compte`.
- **APPLE HIG & LIQUID GLASS :** Cibles tactiles ≥ 44×44pt, flous `backdrop-filter: blur(20px)`, reflets dynamiques, transitions spring physics.
- **MILLIONS D'UTILISATEURS :** LOD pyramidal pour le globe, chargement paresseux des tracés et des profils, RLS stricte Supabase.

---

### Task 1: Nettoyage Sélecteur de Profil, Suppression Filtres de Grille & Déconnexion Dépliant Pseudo

**Files:**
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Test: `tests/design/compte-liquid-glass-v8.spec.ts`

**Interfaces:**
- Consumes: `S.igTab`, `S.profile`, `onSignOut()`
- Produces: 4 onglets profil à icônes pures (Grille: 9 carrés, Voyages: tracé/boussole, Réseau: utilisateurs, Lignées: sac à dos). Popover déconnexion minimale sur `#rpvis`.

- [ ] **Step 1: Écrire le test unitaire pour les icônes de sélecteur et l'absence de filtres de grille**
  Ajouter dans `tests/design/compte-liquid-glass-v8.spec.ts` la vérification que `.ig-filt` est absent, que les 4 onglets contiennent des SVG et non du texte (`Grille`, `Sorties`, `Lignées`, `Tribu` supprimés des balises boutons), et que `#rpvis` ouvre un menu avec uniquement `Se déconnecter`.

- [ ] **Step 2: Exécuter le test pour confirmer l'échec initial**
  ```bash
  npx vitest run tests/design/compte-liquid-glass-v8.spec.ts
  ```

- [ ] **Step 3: Mettre à jour `compte-liquid-glass-v8-runtime.js`**
  - Supprimer le bloc `ig-filt` (`bar = '<div class="ig-filt">...'`).
  - Remplacer le contenu texte des 4 boutons d'onglets `.ig-tabs` par 4 icônes SVG iOS pures (Grille 3x3, Boussole/Tracé de voyage, Duo d'utilisateurs Réseau, Sac à dos).
  - Modifier le clic sur `#rpvis` : afficher un popover épuré en verre dépoli contenant un bouton unique : `<button data-a="signout" class="mi bad"><span>Se déconnecter</span></button>`.

- [ ] **Step 4: Exécuter les tests et vérifier qu'ils passent**
  ```bash
  npx vitest run tests/design/compte-liquid-glass-v8.spec.ts
  ```

- [ ] **Step 5: Valider visuellement et commiter**
  ```bash
  git commit -m "style(compte): pure icon profile tabs, remove grid filters and minimal signout popover"
  ```

---

### Task 2: Onglet Voyages en Carrousel Horizontal & Onglet Réseau avec Toggle Abonnements/Abonnés

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/design/compte-voyages-reseau.spec.ts`

**Interfaces:**
- Consumes: `OUTINGS`, `TRIBU`, `userFollows`
- Produces: Onglet 1 `Voyages` (carrousel horizontal `.voyages-carousel` de cards 280px avec photo ou carte SVG de trace), Onglet 2 `Réseau` (toggle segmented `Abonnements` / `Abonnés` avec listes filtrées).

- [ ] **Step 1: Créer le test unitaire pour le carrousel Voyages et le toggle Réseau**
  Créer `tests/design/compte-voyages-reseau.spec.ts` vérifiant :
  - La présence d'un conteneur `.voyages-carousel` avec défilement horizontal et cartes de sorties terminées.
  - La présence du composant de bascule `.reseau-toggle` avec `Abonnements` et `Abonnés`.
  - L'affichage des utilisateurs suivis / followers avec bouton d'action tactile.

- [ ] **Step 2: Exécuter le test pour confirmer l'échec**
  ```bash
  npx vitest run tests/design/compte-voyages-reseau.spec.ts
  ```

- [ ] **Step 3: Implémenter le rendu de l'onglet Voyages**
  - Dans `renderIgTabContent(D)` pour l'onglet 1 :
    * Générer un carrousel horizontal avec `overflow-x: auto; scroll-snap-type: x mandatory; gap: 14px; padding: 12px 16px;`.
    * Chaque card comprend l'image de couverture (ou le tracé SVG de la trace avec profil topo), le titre de la sortie, la date, la distance (`km`), le D+ (`m`), l'altitude max et le badge `Preuve GPS ✓`.
    * Au clic sur une carte : recentrage cinématique de la carte 3D sur les coordonnées du parcours.

- [ ] **Step 4: Implémenter le rendu de l'onglet Réseau (remplaçant Tribu)**
  - Dans `renderIgTabContent(D)` pour l'onglet 2 :
    * Intégrer un sélecteur segmenté en verre Liquid Glass : `Abonnements (${followingCount})` | `Abonnés (${followersCount})`.
    * Variable d'état `X.reseauMode = 'following' | 'followers'`.
    * Liste des comptes avec avatar photo, badge vérifié GPS, nombre de sorties communes / massifs, et bouton interactif toggle `Abonné(e)` / `Suivre`.

- [ ] **Step 5: Exécuter les tests et vérifier la conformité**
  ```bash
  npx vitest run tests/design/compte-voyages-reseau.spec.ts
  ```

- [ ] **Step 6: Commiter les changements**
  ```bash
  git commit -m "feat(compte): horizontal scrolling voyages carousel and clean followers/following toggle"
  ```

---

### Task 3: Sheet Complète "Modifier le Profil" (Design System Apple Liquid Glass)

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/design/compte-edit-profile.spec.ts`

**Interfaces:**
- Consumes: `S.profile`, `S.orient`, `S.traveller`
- Produces: `openSheet('edit_profile_full')` permettant d'éditer l'intégralité du profil (Nom, Handle, Bio, Photo/Avatar, Allure, Terrain, Autonomie, Priorité sac, Ville, Confidentialité).

- [ ] **Step 1: Rédiger le test unitaire pour la sheet d'édition complète**
  Créer `tests/design/compte-edit-profile.spec.ts` s'assurant que :
  - Le clic sur "Modifier le profil" ouvre une sheet contenant les champs nom, handle, bio, allure, terrain, autonomie, priorité.
  - Les boutons avec texte tronqué (`Pr...`, `Voy...`, `Em...`) sont définitivement éradiqués.
  - La mise à jour persiste dans l'état et déclenche la notification à l'hôte.

- [ ] **Step 2: Exécuter le test pour confirmer l'échec initial**
  ```bash
  npx vitest run tests/design/compte-edit-profile.spec.ts
  ```

- [ ] **Step 3: Implémenter le formulaire unifié Liquid Glass**
  - Remplacer le flow morcelé de `step 0` par une vue fluide en sections claires :
    1. *Identité & Bio* : Photo d'avatar avec anneau d'empreinte, input Nom, input @handle, textarea Bio voyageur.
    2. *Pratique & Randonnée* : Allure de marche (`input type="range"` 3,0 à 6,0 km/h), puces de terrain favori, niveau d'autonomie (Bivouac / Refuge), priorité équipement (Légèreté / Confort).
    3. *Départ & Voyage* : Ville habituelle, nationalités, devise budgétaire.
    4. *Visibilité & Données* : Toggle profil public / privé, flou 1 km sur domicile.
    5. *Bouton Enregistrer* : Grand bouton Liquid Glass vert forêt (`#17402C`) avec retour haptique et confirmation Dynamic Island.

- [ ] **Step 4: Connecter avec la mise à jour Supabase**
  - Dans `CompteLiquidGlassV8.tsx`, écouter l'action de sauvegarde et persister dans `user_profiles`.

- [ ] **Step 5: Exécuter les tests et valider**
  ```bash
  npx vitest run tests/design/compte-edit-profile.spec.ts
  ```

- [ ] **Step 6: Commiter**
  ```bash
  git commit -m "feat(compte): unified full profile editor matching Apple Liquid Glass design system"
  ```

---

### Task 4: Sublimation du Système de Stories à la Une (Highlights)

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/design/compte-stories-polish.spec.ts`

**Interfaces:**
- Consumes: `HIGHLIGHTS`, `STORIES`, `S.invs`
- Produces: Visionneuse de stories Liquid Glass plein écran avec photographies alpines haute résolution, jauges de poids épurées pour la story Sac (3,2 kg), barres de progression temporelles et navigation tactile gestuelle.

- [ ] **Step 1: Créer le test unitaire pour la visionneuse de stories**
  Créer `tests/design/compte-stories-polish.spec.ts` validant :
  - Rendu Liquid Glass de la story Sac avec décomposition élégante des poids par catégorie.
  - Présence de photographies en arrière-plan avec flou cinématographique.
  - Contrôles de navigation : barres de progression segmentées, tap gauche/droite, pause au maintien tactile.

- [ ] **Step 2: Exécuter le test pour confirmer l'échec**
  ```bash
  npx vitest run tests/design/compte-stories-polish.spec.ts
  ```

- [ ] **Step 3: Refondre `renderStory()` et `slideView()` dans `compte-liquid-glass-v8-runtime.js`**
  - Éliminer le fond vert sombre opaque de la story Sac.
  - Intégrer un arrière-plan photographique alpin haute définition avec superposition de verre dépoli (`backdrop-filter: blur(28px) saturate(1.8)`).
  - Présentation de la répartition du sac :
    * Poids total mis en avant avec jauge de progression semi-transparente.
    * Liste des catégories clés (Abri, Couchage, Portage, Vêtements, Popote) avec pourcentages et poids.
    * Bouton d'action tactile : "Dupliquer ce kit dans mon Compas".
  - Multi-slides pour les autres moments clés (Chamonix, Néouvielle, Vercors, Bavella).
  - Bouton fermer iOS (croix dans pastille de verre circulaire en haut à droite).

- [ ] **Step 4: Exécuter les tests**
  ```bash
  npx vitest run tests/design/compte-stories-polish.spec.ts
  ```

- [ ] **Step 5: Commiter**
  ```bash
  git commit -m "feat(compte): premium Apple Liquid Glass story highlights viewer with high-res photography"
  ```

---

### Task 5: Boutons d'En-tête — Drawer Commandes/Notifications/Paramètres & Action Sheet Création Tout-en-un

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Test: `tests/design/compte-header-actions.spec.ts`

**Interfaces:**
- Consumes: `S.orders`, `S.notifications`, `openDrawer()`, `openCreate()`
- Produces: Drawer latéral iOS complet (Commandes, Notifications, Paramètres) et Sheet de création multi-objets (Carnet, Sortie GPS, Kit matériel, Club, Publication).

- [ ] **Step 1: Rédiger le test unitaire pour le drawer et le bouton plus**
  Créer `tests/design/compte-header-actions.spec.ts` vérifiant :
  - Le bouton Sliders (haut à droite) ouvre le drawer avec les onglets Commandes, Notifications et Paramètres.
  - Le bouton Plus ouvre le menu de création complet avec les 5 options.

- [ ] **Step 2: Exécuter le test pour constater l'échec**
  ```bash
  npx vitest run tests/design/compte-header-actions.spec.ts
  ```

- [ ] **Step 3: Implémenter le Drawer iOS Latéral (`openDrawer`)**
  - Créer l'action `openDrawer` avec slide-over fluide depuis la droite.
  - 3 sections ergonomiques :
    * **Commandes** : Historique des commandes de matériel, statuts de livraison, tracking.
    * **Notifications** : Alertes météo massifs favoris, likes et nouveaux abonnements.
    * **Paramètres** : Thème clair/sombre, Mode extérieur, RGPD (export complet), Support LKDV.

- [ ] **Step 4: Implémenter la Sheet de Création Tout-en-un (`openCreate`)**
  - Remplacer le saut direct d'étape par une Action Sheet iOS 27 Liquid Glass proposant :
    1. *Nouveau carnet de voyage* (récit, photos géocodées)
    2. *Nouvelle sortie / voyage GPS* (import trace GPX, préparation Compas)
    3. *Nouveau kit de matériel* (composer sac ultraléger)
    4. *Nouveau club ou tribu* (créer communauté de randonnée)
    5. *Nouvelle photo terrain* (publier moment instantané)

- [ ] **Step 5: Exécuter les tests et vérifier qu'ils passent**
  ```bash
  npx vitest run tests/design/compte-header-actions.spec.ts
  ```

- [ ] **Step 6: Commiter**
  ```bash
  git commit -m "feat(compte): iOS side-drawer for orders/notifications/settings and all-in-one creation action sheet"
  ```

---

### Task 6: Moteur de Carte 3D Globe Vivant, Icônes Pures & Élimination Définitive des Éléments Parasites

**Files:**
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx`
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Modify: `tests/design/compte-3d-living-map.spec.ts`
- Test: `tests/design/compte-3d-living-map.spec.ts`

**Interfaces:**
- Consumes: MapLibre GL JS v4 Globe projection, AWS Terrarium DEM, Esri Satellite, Massif & Trail GPS data.
- Produces: Globe 3D initialisé dès le premier chargement (sans superposition du SVG `#tm`), sélecteur d'échelle à icônes pures (Globe, Montagne, Sentier), suppression totale de Mission Control et suppression de la barre `.acc` flottante.

- [ ] **Step 1: Mettre à jour `tests/design/compte-3d-living-map.spec.ts`**
  - Retirer l'attente de `btn-3d-fullscreen` et `MISSION CONTROL`.
  - Ajouter l'assertion que `btn-3d-fullscreen` et la barre `.acc` sont absents de la carte.
  - Ajouter l'assertion que le sélecteur d'échelle de carte utilise des icônes SVG pures sans texte.

- [ ] **Step 2: Exécuter le test pour confirmer les échecs**
  ```bash
  npx vitest run tests/design/compte-3d-living-map.spec.ts
  ```

- [ ] **Step 3: Supprimer Mission Control et la barre de données `.acc`**
  - Dans `CompteLiquidGlassV8.tsx` et `compte-liquid-glass-v8-runtime.js` :
    * Retirer définitivement `<a href="/carte-3d" class="btn-3d-fullscreen">...</a>`.
    * Retirer `<div class="lg acc" id="acc"></div>` de l'en-tête de la barre d'onglets pour dégager la vue de la carte.

- [ ] **Step 4: Mettre en place les icônes pures dans le sélecteur de carte**
  - Remplacer le texte des 3 boutons de zoom par des icônes SVG pures :
    * Bouton Orbite : SVG Globe terrestre avec méridiens
    * Bouton Massif : SVG Chaîne de montagnes
    * Bouton Sentier : SVG Sentier / Empreinte de pas
  - Zéro texte dans ces boutons, dimensionnés selon Apple HIG avec hit-target 44×44pt.

- [ ] **Step 5: Corriger l'affichage du Globe 3D et masquer définitivement le SVG `#tm`**
  - Dans `setup3DMap()` et `drawMap()` :
    * Dès l'initialisation de MapLibre, masquer totalement le SVG `#tm` (`display: none !important`), empêchant le rectangle opaque de masquer le canvas WebGL.
    * Régler la vue initiale de la carte au niveau Globe Terrestre (`zoom: 1.8`, `center: [2.5, 46.5]`, `pitch: 0`), activant immédiatement le globe avec son halo atmosphérique et ses repères de massifs lumineux.
    * Au clic sur les icônes de zoom : transitions de vol cinématiques fluides vers l'échelle Massif (`zoom: 8.5`) ou Sentier (`zoom: 12.8`, `pitch: 62`).

- [ ] **Step 6: Exécuter les tests de la carte 3D**
  ```bash
  npx vitest run tests/design/compte-3d-living-map.spec.ts
  ```

- [ ] **Step 7: Commiter**
  ```bash
  git commit -m "feat(compte): real 3d globe visible on load, pure icon scale selector, remove mission control and acc bar"
  ```

---

### Task 7: Validation Globale, Tests E2E, Compilation de Production & Déploiement

**Files:**
- Test: `tests/design/*.spec.ts`
- Run: `npm run build`
- Git: Commit & Push to `origin/main`

**Interfaces:**
- Consumes: Toutes les fonctionnalités implémentées des Tasks 1 à 6
- Produces: Build de production propre validé par l'ensemble des suites de tests.

- [ ] **Step 1: Exécuter l'intégralité de la suite Vitest**
  ```bash
  npx vitest run tests/design/
  ```

- [ ] **Step 2: Lancer le build Next.js pour vérifier l'absence d'erreurs TypeScript et ESLint**
  ```bash
  npm run build
  ```

- [ ] **Step 3: Vérification E2E sur serveur local**
  - Démarrer le serveur Next.js en local et valider les flux clés :
    * Déconnexion sur dépliant pseudo
    * Ouverture du drawer commandes/notifs/paramètres
    * Action sheet bouton plus
    * Navigation par icônes pures (Grille, Voyages carrousel, Réseau toggle, Lignées)
    * Affichage du Globe 3D sans obstruction
    * Visionneuse de stories Liquid Glass

- [ ] **Step 4: Commiter et pousser sur `origin/main`**
  ```bash
  git push origin main
  ```
