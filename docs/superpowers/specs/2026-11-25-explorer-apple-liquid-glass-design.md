# Explorer 20/20 — Apple Liquid Glass Redesign & Interactive Map Architecture

**Date :** 2026-11-25  
**Statut :** Draft pour validation (post-brainstorming Approche A+B)  
**Références canoniques obligatoires :**
- `.agents/rules/lkdv-design-system.md` (Design System LKDV permanent, 100 % Light Liquid Glass)
- **Clubs** : `ClubLiquidGlassV8`, `ClubDrawerHost`, `ClubOutingDetailSheet`, `ClubPokedexDrawerBody`, `ClubGearProductCard`, `ClubMapHud`, `ClubIsland`, `club-drawers-v2.css`, `club-map.css`
- **Carnets** : `CarnetScreenV2`, `CarnetDrawerV2`, `CarnetHorizontalTimeline`, `CarnetAltitude`, `CarnetPokedexDrawerBody`, `KitCard`, `CarnetIsland`, `carnet-v2.css`
- **Coquille canonique partagée** : `SlotShell`, `CapsuleTabs`, `LensPager`, `SortMenuButton`, `CollapsibleHeroPreview`, `AnimatedNumber` (`@number-flow/react`)

---

## 1. Intention & Pourquoi

La première implémentation UI d'Explorer (`PresetPillRail`, `AdaptiveReadinessCard`, `TerritorialEncyclopediaSheet`, `UnifiedLayersSheet`, `GpsActiveHud`, `ExplorerSheet`, monolithe `SheetContent.tsx` de 4 682 lignes) a été jugée **0/20** car elle accumulait des rails flottants sur la carte, des cartes surchargées de texte inline hors Design System, des boutons en double et des overlays qui se chevauchaient.

L'objectif est de **retirer intégralement cette couche UI ad hoc** et de reconstruire toute la présentation front-end d'Explorer en **20/20 Apple Liquid Glass** — à parité pixel-exacte avec **Clubs** et **Carnets** — tout en conservant **100 % intacts** tous les moteurs headless et optimisations perf déjà construits et testés (MapLibre 3D, `layerLifecycle`, `slopeProtocol`, `safetyCorridor`, `adaptive/*`, `kalmanFilter`, `useWakeLock`, store Zustand, et les 28 routes `/api/explorer/v2/*` avec cache LRU).

---

## 2. Objectifs, Non-Objectifs & Anti-Objectifs

### Objectifs (Goals)
1. **Un seul drawer principal ancré en bas (Approche A+B)** : toujours accessible en 3 crans GPU fluides (`peek` ~16 %, `mid` ~56 %, `full` ~86 % animés via `transform` GPU, jamais `height`), avec poignée `.lkdv-mgrab` en haut. La carte au-dessus reste **toujours visible et 100 % interactive** (zéro scrim bloquant en `peek` et `mid`).
2. **En-tête unique du drawer** :
   - **Sélecteur principal `CapsuleTabs` (56 px, icônes pures)** pour les 5 catégories.
   - **Bouton circulaire `▶` Lancer Sport / Activité** fixé en haut à droite du drawer (dans la même rangée que `CapsuleTabs`, 44 px cible tactile), ouvrant le sous-drawer sport visuel.
3. **Tout est hiérarchisé en Catégories → Sous-drawers (`SlotShell` + `LensPager`)** :
   - Sous-catégories / sous-drawers **exclusivement en bas à droite** (`.lkdv-lens-tabs`, 30 px verre fumé, icônes seules) synchronisés au swipe horizontal `LensPager`.
   - Tous les filtres, tris et actions secondaires **exclusivement en bas à droite** via `SortMenuButton` (30 px circulaire, décale automatiquement `.lkdv-lens-tabs.has-sort` à `right: 46px`).
   - Action primaire contextuelle **en bas à gauche** (`.club-drawer-floating-left` / `.lkdv-pill-reprendre`).
   - Fermeture de toute fiche/sous-vue de détail : **pilule circulaire `×` sans libellé** (`<X size={15} />`).
4. **Visuel avant l'écriture** : photos plein cadre, grilles 2 colonnes (`aspect-ratio: 1/0.85` ou `16/10`), cartes Pokédex holographiques 3D, anneaux `conic-gradient`, courbes Recharts / sparklines SVG, `CarnetHorizontalTimeline`, chiffres tabulaires `AnimatedNumber` (`@number-flow/react`), badges numériques courts (icône + valeur uniquement). **Zéro paragraphe descriptif inutile, zéro eyebrow en majuscules répétitif, zéro bouton dupliqué pour la même action.**
5. **Interconnexion bidirectionnelle totale Carte ↔ Drawer** :
   - Chaque catégorie/lentille active synchronise automatiquement les repères et calques contextuels sur `MapStage` (`selectExplorerMapContext`).
   - Chaque clic sur la carte (pays, région, sentier, POI eau/refuge/sommet/danger, espèce Pokédex, carnet, club, story, **Bouteille à la mer**, feu/crue/séisme) sélectionne et focalise l'entité dans la carte (halo/flyTo) **et** ouvre directement sa fiche sous-drawer correspondante.
   - Chaque clic sur une carte du drawer (spot, étape, espèce, alerte, bouteille, carnet, club, point du profil altimétrique) centre/zoome la carte 3D dessus (`flyTo` / `revealAt`).
6. **Intégration native de Bouteille à la mer** : lentille dédiée dans `Communauté`, épingles interactives sur la carte 3D (filtrées par pays/zone visible et `user_blocks`), cartes visuelles propres (`travel_groups` + RPC `group_public_card_stats`), et feuille modale portalisée (`createPortal(..., document.body)`) pour candidater ou lancer une bouteille (seuil Trust Score ≥ 65, plancher 50, max 3 actives).
7. **Mode GPS actif (« Changement de costume ») épuré** : quand une activité démarre, la carte passe en plein écran (~78 %) avec le même drawer compacté en bas (3 métriques `AnimatedNumber` sans libellés verbeux + 3 boutons tactiles ≥ 52 px : Pause, Repère, Stop maintien 0,8 s + contraste `Standard / Plein soleil / Nuit rouge` dans `SortMenuButton` bas-droite + déchargement GPU déterministe inchangé).

### Non-Objectifs (Non-Goals)
- Ne pas réécrire les moteurs métier/SIG/API déjà validés (`MapStage` WebGL core, `layerLifecycle`, `slopeProtocol`, `safetyCorridor`, `adaptive/*`, `kalmanFilter`, `useWakeLock`, `/api/explorer/v2/*`).
- Ne pas modifier les pages **Clubs**, **Carnets** ni `SortieFormV2.tsx`.
- Ne pas ajouter de nouvelles dépendances npm lourdes (tout le stack `framer-motion`, `vaul`, `@number-flow/react`, `recharts`, `lucide-react` est déjà installé).

### Anti-Objectifs (Ce qui ferait échouer le design même si le code compile)
- Aucun rail flottant de presets ou de filtres posé sur la carte (`PresetPillRail` supprimé).
- Aucune barre de sous-onglets horizontale en haut du contenu d'un drawer.
- Aucune ligne texte plate là où une carte visuelle (photo, holo, courbe, jauge, tuile) existe.
- Aucun doublon de bouton (ex. 2 boutons recherche dans la topbar, 2 boutons fermer, 2 listes de calques dans le même onglet, 2 panneaux de métriques GPS simultanés).
- Aucun formulaire inline dans un drawer de lecture (toujours en feuille portalisée `document.body`).

---

## 3. Approches étudiées & Choix retenu

| Approche | Description | Compromis | Décision |
|---|---|---|---|
| **Approche A (Pure `ClubDrawerHost`)** | Drawer qui s'ouvre/ferme complètement depuis un bouton lanceur flottant sur la carte. | Oblige un bouton lanceur supplémentaire sur la carte + 1 geste de plus pour voir les catégories. | Écartée seule |
| **Approche B (Apple Plans pur)** | Tiroir bas multi-crans avec onglets texte custom. | Casserait l'identité visuelle LKDV (`SlotShell` / `CapsuleTabs` / `SortMenuButton`) de Clubs & Carnets. | Écartée seule |
| **Approche A+B (Retenue)** | **Coquille exacte Clubs/Carnets (`SlotShell` + `CapsuleTabs` + `LensPager` + `SortMenuButton`)** montée dans un **tiroir bas permanent à 3 crans GPU (`peek / mid / full`)** avec carte 100 % interactive au-dessus et **bouton `▶` Lancer sport en haut à droite du drawer**. | Meilleur des deux mondes : 0 bouton lanceur en double, 100 % fidèle au Design System LKDV, carte libre en `peek`, richesse complète en `mid`/`full`. | **VALIDÉE** |

---

## 4. Architecture Spatiale & Contrôles (Zéro Doublon)

### 4.1 Surface Carte (Au-dessus du drawer)
La carte 3D (`MapStage`) occupe `100 %` du viewport en arrière-plan. Seuls **3 éléments minimalistes** (repris de `ClubMapHud` & `CarnetTopBarV2`) y flottent — **rien d'autre** :
1. **Haut-gauche** : Pilule lieu / recherche unique (`.lkdv-title-pill` / `.xp-loc-pill`, 38 px, verre clair `rgba(255,255,255,0.78)` + `blur(20px)`) affichant `[ 📍 Nom territoire ▾ ]` (avec flèche retour intégrée quand `level > 0`, clic ouvre la recherche/sélection d'échelle dans le drawer). **1 seul contrôle** (suppression du bouton `.xp-scan-btn` en double).
2. **Haut-droite** : Colonne verticale compacte `ClubMapHud` (`.lkdv-map-controls`, `36 px` de large, `r18`, verre clair) :
   - **Boussole 3D** (rotation temps réel `-bearing`, tap remet Nord en haut / recentre)
   - **Ma position GPS** (`LocateFixed`)
   - **Style de fond 1-tap** (cycle discret ou mini-popover `Relief 3D / Satellite / Plan / IGN`)
3. **Toast Dynamic Island** : `ClubIsland` (`top: safe-top + 10px`, auto-dismiss 3,8 s, jamais bloquant).

### 4.2 Drawer Principal (`ExplorerDrawerHost` — 3 crans GPU)
- **Conteneur** : `.lkdv-carnet-drawer.lkdv-explorer-drawer` (`border-radius: 24px 24px 0 0` en plein bas, surface ivoire verre `linear-gradient(180deg, rgba(255,255,255,0.97), rgba(251,250,246,0.95))`, `backdrop-filter: blur(36px) saturate(1.1)`).
- **3 crans GPU (`transform: translate3d(0, Y, 0)`)** via `useDragDismiss` / Framer Motion spring (`stiffness: 380, damping: 34, mass: 0.85`) :
  - **`peek`** : montre uniquement la poignée `.lkdv-mgrab` + la rangée supérieure (`CapsuleTabs` 5 icônes + bouton `▶` Sport) — ~`94 px` + safe-bottom (carte visible à ~85 % !).
  - **`mid`** : `56 dvh` (carte visible et 100 % interactive sur les `44 dvh` du haut).
  - **`full`** : `86 dvh` (exploration riche des grilles, Pokédex holo, timeline, recherche).
- **Rangée d'en-tête unique (`.lkdv-slot-topnav`, fixe, ne scrolle jamais)** :
  - À gauche (`flex: 1`) : **`CapsuleTabs`** (`height: 52px`, 5 onglets **icônes seules** avec lentille glissante `.sel-lens`).
  - À droite (`flex: none`, `margin-left: 8px`) : **Bouton circulaire Sport / Activité** (`48×48px`, `border-radius: 9999px`, dégradé forêt `#1f543a → #17402c`, icône `Play` blanche — ou icône du sport armé). Cliquer ouvre immédiatement le **sous-drawer Sport** (`ExplorerSportLaunchSheet`) en glissement interne ou passe au cran `mid` sur la grille visuelle des sports.

---

## 5. Arborescence Complète : 5 Catégories → Sous-Drawers (`SlotShell`) → Fiches Détail

Toutes les lentilles (sous-drawers) sont des **icônes pures dans la mini-capsule sombre 30 px en bas à droite** (`.lkdv-lens-tabs`) + **swipe horizontal `LensPager`**.

### Catégorie 1 — Explorer (`Compass`)
*Point d'entrée du territoire courant (`Monde → Continent → Pays → Région → Ville → Secteur`) :*
1. **Lentille 1.0 `spots` (`Mountain`) — Spots & Itinéraires** :
   - Grille 2 colonnes de **cartes visuelles** (`.club-glass-card`, photo/aperçu relief, `km · D+`, badge difficulté couleur, zéro paragraphe).
   - Clic carte → `flyTo` sur la carte 3D + ouvre **Sous-drawer Détail Itinéraire** (identique à `OutingOverviewLens` : rangée 4 pilules icône+chiffre, courbe altimétrique Recharts cliquable synchronisée carte, météo compacte, bouton bas-gauche `Suivre / Démarrer`, fermeture `×` circulaire).
2. **Lentille 1.1 `territory` (`Globe2`) — Territoire & Encyclopédie visuelle** :
   - Header réduit au scroll (`CollapsibleHeroPreview` : photo/visuel + nom territoire + badge échelle).
   - Grille 3 tuiles KPI `AnimatedNumber` (Superficie / Altitude max / Température actuelle), pastille cliquable Urgences `tel:112` (ou numéro local), bandeau horizontal de pastilles visuelles (climat, monnaie, langue — 1 mot par pastille, zéro pavé).
3. **Lentille 1.2 `readiness` (`Activity`) — Forme & Fit adaptatif** :
   - Anneau `conic-gradient` 104×104 px (score `/100` ou `Init` en `cold_start` — zéro mock) + 3 barres horizontales animées (ACWR, Récupération, Plafond altitude `m`) + carte 1-tap du créneau / sport recommandé.
- **Bas-droite `SortMenuButton`** : `Trier` (Proximité, Distance, D+, Fit adaptatif) + `Sport` (Tous, Rando, Trail, VTT, Nautique, Alpi).
- **Bas-gauche flottant** : quand un itinéraire est sélectionné → pilule `Démarrer` (ou `Exporter GPX` dans `SortMenuButton`).
- **Synchro Carte** : affiche les itinéraires (`xp-routes`), sommets/POIs de la zone visible, et surbrille le tracé/spot sélectionné.

### Catégorie 2 — Carte & Calques (`Layers`)
*Épuration instantanée et maîtrise totale des couches SIG sans jamais polluer la carte :*
1. **Lentille 2.0 `presets` (`Sparkles`) — Pré-réglages visuels (9 tuiles)** :
   - Grille 2 colonnes de tuiles visuelles compactes (`height: 68px`, `r18`, grande icône + nom court 1–2 mots + pastille active forêt `#17402C`) pour les 9 presets atomiques (`Épuré`, `Rando`, `Trail`, `VTT`, `Bivouac`, `Nautique`, `Sécurité`, `Pokédex`, `Communauté`).
   - 1 tap applique atomiquement le preset sur la carte (zéro fuite de couches précédentes).
2. **Lentille 2.1 `overlays` (`SlidersHorizontal`) — Calques Outdoor & Live** :
   - **Liste unique unifiée** (suppression définitive des doublons `LayersTab` vs `UnifiedLayersSheet`).
   - Tuiles toggle compactes en grille 2 colonnes par famille visuelle (Sentiers, Pentes >30°, Pollution lumineuse, OpenSeaMap, Voies navigables, Radar pluie, Feux, Crues, Séismes, Aérien, Heatmaps) avec micro-pastille de fraîcheur (`● 2m`) et compteur discret `X/2 rasters`.
3. **Lentille 2.2 `offline` (`CloudDownload`) — Cartes Hors-ligne** :
   - Cartes visuelles des packs téléchargés (mini-aperçu + Mo + barre de progression) + bouton bas-gauche `Télécharger cette zone`.
- **Bas-droite `SortMenuButton`** : Choix du fond de carte (`Relief 3D`, `Satellite`, `Plan`, `IGN/National`) + `Relief 3D` / `Ombrage`.
- **Bas-gauche flottant** : pilule `Épurer` (1-tap vers preset `clean`, visible uniquement si au moins 1 calque est actif).
- **Synchro Carte** : bascule immédiate via `syncUnifiedOverlayLayers` + aperçu de la zone hors-ligne (`xp-offline-coverage`) sur la lentille `offline`.

### Catégorie 3 — Pokédex Biodiversité (`Leaf`)
*Réutilisation directe de la grammaire `CarnetPokedexDrawerBody` / `ClubPokedexDrawerBody` :*
1. **Lentille 3.0 `all` (`Leaf`) — Toutes espèces de la zone**
2. **Lentille 3.1 `faune` (`Bird` / `Compass`) — Faune**
3. **Lentille 3.2 `flore` (`Flower2` / `Mountain`) — Flore & Milieux**
- Grille 2 colonnes de **cartes holographiques 3D** (`PokedexHoloCard` : photo `16/10`, tilt 3D Framer Motion, reflet irisé sur espèces rares/menacées, badge rareté + compteur d'observations iNaturalist).
- Clic sur une espèce → `flyTo` sur l'observation sur la carte + glissement `StackSlideView` vers `PokedexSpeciesDetailCard` (fermeture pilule `×` circulaire sans texte, CTA `J'ai observé` en bas-gauche).
- **Bas-droite `SortMenuButton`** : `Rareté` (Toutes, Menacées, Rares, Communes) + `Densité GBIF` (Activer/Masquer la couche raster GBIF sur la carte).
- **Synchro Carte** : active les clusters géolocalisés `xp-pokedex-species` (iNaturalist) sur la carte ; cliquer un cluster zoome, cliquer un point ouvre directement la fiche espèce dans le drawer.

### Catégorie 4 — Sécurité & Terrain (`ShieldAlert`)
*Sécurité vitale lisible en 1 coup d'œil, zéro pavé de texte :*
1. **Lentille 4.0 `hazards` (`Flame`) — Risques actifs (Feux, Crues, Séismes, Alertes CAP)** :
   - Cartes visuelles compactes code-couleur (rouge feu / bleu crue / ambre séisme) avec distance `km`, sévérité et horodatage `il y a X min`. Clic → `flyTo` sur l'incident sur la carte.
2. **Lentille 4.1 `weather` (`CloudRain`) — Météo, Vent & Radar** :
   - Hero visuel : icône météo + température `AnimatedNumber` + vent `km/h` + crépuscule civil offline (`Coucher 19h42 · Demi-tour 17h15`).
   - Courbe température/pluie Recharts 12 h (`110 px`) + bascule 1-tap du radar pluie sur la carte.
3. **Lentille 4.2 `survival` (`Droplets`) — Eau, Refuges & Secours** :
   - Grille 2 colonnes des points vitaux proches (sources potables, refuges/abris, postes secours) triés par distance, avec pastille `tel:112` / `PGHM` en bas-gauche. Clic → `flyTo` + itinéraire d'approche sur la carte.
- **Bas-droite `SortMenuButton`** : Filtre types (`Tous`, `Feux`, `Crues`, `Séismes`, `Aérien`) + `Pentes >30°` ON/OFF.
- **Synchro Carte** : affiche les couches de sécurité (`xp-hazard-fires`, `xp-hazard-floods`, `xp-hazard-seismic`, `xp-raster-radar`, POIs eau/refuges) et met en évidence l'incident ou le point d'eau touché.

### Catégorie 5 — Communauté & Bouteille à la mer (`Users`)
*Tout le social géolocalisé de LKDV réuni au même endroit, 100 % connecté à la carte :*
1. **Lentille 5.0 `bottles` (`Send` / `Waves`) — Bouteille à la mer** :
   - **Cartes visuelles Bouteille** (`.club-glass-card`, `r20`) : avatar créateur + Trust Score badge + destination/dates + avatars participants + compteur places restantes (`3/6`) + 1 seul bouton pill (`Rejoindre` / `En attente` / `Gérer`).
   - **Bas-gauche flottant** : pilule `Lancer une bouteille` → ouvre une **modale portalisée** (`createPortal(..., document.body)`, design verre identique à `OutingTransportLens` modal) respectant les règles serveur (`trust_score >= 65`, majorité, max 3 actives, `user_blocks`).
   - **Synchro Carte** : épingles Bouteilles à la mer sur le pays/secteur ; clic épingle → ouvre la carte Bouteille ; clic carte → `flyTo` sur la destination.
2. **Lentille 5.1 `carnets` (`BookOpen`) — Carnets de voyage** :
   - Grille 2 colonnes de mini-cartes éditoriales photo `4:5` (inspirées `CarnetCoverCard` : cover plein cadre, drapeau/lieu, `km · jours`, avatar). Clic → focus trace sur carte + aperçu / lien direct `/carnets/[id]`.
3. **Lentille 5.2 `clubs` (`Flag`) — Clubs & Sorties locales** :
   - `CarnetHorizontalTimeline` (déjà réutilisé par Clubs !) des sorties publiques à proximité + cartes clubs actives (clic → focus carte / `/clubs/[slug]`).
4. **Lentille 5.3 `stories` (`Sparkles`) — Stories & Amis** :
   - Rangée `.ig-hl-row` de bulles Stories géolocalisées (clic → `StoriesViewer`) + pilules amis à proximité (floutage HMAC ≥ 250 m, authentifié uniquement, état discret si déconnecté).
- **Bas-droite `SortMenuButton`** : Filtre (`Dans la zone`, `Pays`, `Mes clubs`) + tri (`Récents`, `Proximité`, `Places dispo`).
- **Synchro Carte** : affiche les clusters `xp-social-carnets`, `xp-social-clubs`, `xp-social-stories`, `xp-social-friends` et les épingles **Bouteilles à la mer** selon la lentille active.

---

## 6. Sous-Drawer Sport (`▶` haut-droite) & Mode GPS Actif

### 6.1 Lancement d'activité (`ExplorerSportLaunchSheet`)
- Déclenché par le **bouton circulaire `▶` en haut à droite du drawer** (et uniquement là — zéro autre bouton de départ dupliqué).
- S'ouvre en sous-drawer glissé (`StackSlideView`) avec bouton `×` circulaire en haut à gauche + grille visuelle **2 colonnes de tuiles sport** (`Rando`, `Trail`, `VTT`, `Gravel`, `Course`, `Alpinisme`, `Ski`, `Kayak`, `Bivouac`, `Vélo route`, `Escalade`, `Natation`) : grande icône + nom 1 mot + badge `Prêt` / variante compacte.
- 1 tap sur un sport lance le compte à rebours propre (plein écran flouté) puis bascule en `GPS_ACTIVE`.

### 6.2 Mode GPS Actif (« Changement de costume »)
- **Déchargement déterministe** (déjà implémenté) : `explorerAbortRegistry.abortAllNonCritical()`, `disposeNonEssentialMapLayers(map, sport)`, cache tuiles `48`, `Screen Wake Lock`, filtre Kalman 2D (corrigé : `kf.process(...)`), corridor sécurité 3 km (corrigé : clés `SafetyCorridorState` alignées).
- **UI minimaliste unifiée** :
  - Haut de carte **totalement dégagé** (uniquement un micro-badge statut GPS + chrono discret si besoin, zéro empilement `GpsActiveHud` + `TurnByTurn` + `LiveSegments`).
  - **Le drawer principal se transforme en tiroir GPS compact** en bas de l'écran (`peek` ~150 px, extensible en `mid` pour voir le profil altimétrique / tours / sécurité corridor) :
    - 3 grands chiffres `AnimatedNumber` (Distance · Temps · D+ ou Allure) — **pas de sous-titres longs**.
    - 3 actions tactiles ≥ 52 px en pilules : `Pause / Reprendre`, `Repère`, `Stop (0,8 s)`.
    - Bas-droite : `SortMenuButton` pour basculer le contraste terrain (`Standard` / `Plein soleil` / `Nuit rouge`) + `SOS 112`.
  - À l'arrêt : retour fluide en mode `EXPLORE`, contraste réinitialisé sur `standard`, `ExploreSnapshot` restauré sans perte.

---

## 7. Recherche & Navigation Territoriale

- Tapping la pilule lieu en haut-gauche de la carte (`[ 📍 Annecy ▾ ]`) monte le drawer en `full` et bascule sur la vue **Recherche** (`StackSlideView`, champ `.club-search-box-v2` sticky en haut, bouton `×` circulaire, résultats visuels groupés : Lieux, Itinéraires, Espèces, Clubs/Carnets, Bouteilles).
- Sélectionner un résultat ferme la recherche, exécute `flyTo` sur la carte et ouvre la catégorie/fiche correspondante.

---

## 8. Contraintes Globales & Qualité

1. **Design System strict** : 100 % Light Liquid Glass (`#17402C`, `#172B24`, `#96BA8E`, `#FBFAF6`, `#56665D`), jamais d'orange `#E4501C`, jamais de `dangerouslySetInnerHTML` sur contenu externe, validation `https://` sur toutes URLs médias.
2. **Corrections techniques intégrées** :
   - Corriger `kf.update` → `kf.process` dans le câblage Kalman.
   - Aligner les clés de `updateSafetyCorridor` sur `SafetyCorridorState`.
   - Ajouter la source GeoJSON `xp-social-bottles` dans `layerRegistry.ts` + endpoint `/api/explorer/v2/social/map?kinds=...,bottles` (utilisant `travel_groups` + `group_public_card_stats` + `user_blocks` fail-closed).
3. **Budget perf conservé** : 0 appel `/api/explorer/v2/*` inutile au boot en `peek`, `React.memo` sur `MapStage`, `transform` GPU pour le drag du drawer (zéro animation `height`), lazy-loading des sous-drawers non actifs (`next/dynamic`).
4. **Tests & Vérification** : tous les tests Vitest headless existants (68/68) restent verts + nouveaux tests de câblage UI (drawer 3 crans, 5 catégories, bouton `▶` top-right, sous-drawers bas-droite, interconnexion carte ↔ drawer, Bouteille à la mer) + QA visuelle live dans le navigateur (`390×844`).

---

## 9. Décisions d'Architecture & Contrats Techniques (Résolution Builder Check)

Toutes les zones d'ambiguïté relevées par la contre-expertise architecturale sont tranchées ci-dessous :

1. **Coexistence avec la `NavigationBar` globale LKDV (web & Capacitor iOS/Android)** *(Choix architecte)* :
   - En cran **`peek`**, la `NavigationBar` globale reste **visible** (`lkdv-toggle-bottom-bar { hide: false }`) et le drawer Explorer se docke proprement juste au-dessus (`bottom: calc(var(--safe-bottom, 0px) + 74px)`), en pilule verre flottante compacte (`CapsuleTabs` + bouton `▶` Sport).
   - Dès le passage en **`mid`**, **`full`** ou **`GPS_ACTIVE`**, Explorer émet `lkdv-toggle-bottom-bar { hide: true }` et le drawer s'étend jusqu'à `bottom: 0`. L'utilisateur n'est jamais piégé sur `/explorer`.
2. **Flux historiques (`summary`, `planner`/`multiday`, `TurnByTurn`/`OffRoute`/`SOS`, `?scene=`)** *(Choix architecte)* :
   - **`summary` (Bilan post-sortie)** : reconstruit proprement en `StackSlideView` Liquid Glass (3 chiffres `AnimatedNumber`, mini-trace/altitude, état de synchro + réessayer, fermeture `×` circulaire) pour préserver la persistance IndexedDB 24 h et la synchro serveur.
   - **`planner` & `multiday`** : conservés via wrappers lazy-loadés (`next/dynamic`) déclenchés uniquement par deep-link (`?planner=library`, `consumePendingStageLaunch`) sans encombrer les 5 catégories principales.
   - **Guidage actif (`GPS_ACTIVE`)** : le bandeau `TurnByTurn` ou `Hors-trace` réutilise l'emplacement unique **Dynamic Island** (`ClubIsland`) en haut de carte (zéro empilement de bandeaux) ; le compte à rebours **SOS 112** et les réglages vocaux/auto-pause s'ouvrent en modale portalisée depuis `SortMenuButton` en bas à droite du tiroir GPS.
   - **`?scene=`** : compatibilité conservée dans `store.ts` (`low` mappé sur `mid`).
3. **Géolocalisation & écritures « Bouteille à la mer » (`travel_groups`)** *(Vérifié dans le codebase)* :
   - **Lecture carte** : `/api/explorer/v2/social/map?kinds=...,bottles` lit `travel_groups` (`visibility = 'public'`) + `group_public_card_stats` RPC + filtrage `user_blocks` fail-closed ; les coordonnées sont dérivées du centroïde `countries_geo` (ou destination géocodée si présente) avec léger décalage déterministe par ID pour le clustering `xp-social-bottles` — **zéro migration SQL destructive**.
   - **Écritures (Lancer / Candidater / Gérer)** : réutilisation directe des règles RLS `travel_groups` / `group_members` (`trust_score >= 65`, plancher 50, max 3 actives, majorité) dans une modale portalisée Apple Liquid Glass.
4. **Stratégie données sans nouvelles migrations lourdes** *(Choix architecte)* :
   - **Cartes Spots & Itinéraires (`1.0`)** : rendu visuel vectoriel SVG du tracé réel (`route.geojson`, même grammaire que `.lkdh-trace` dans Carnets) + badges `km` / réseau (`GR`, `PR`, `VTT`) / altitude ; zéro photo factice.
   - **Forme adaptative (`1.2`)** : alimentée par les séances réelles persistées localement + état `Init` honnête en démarrage à froid.
   - **Pokédex « J'ai observé » (`3.x`)** : ouvre `CarnetSpeciesCreatePane` en feuille portalisée (ou invitation connexion si déconnecté).
   - **Recherche unifiée (`Section 7`)** : combine `/api/explorer/v2/search` en parallèle d'un filtrage instantané côté client sur pays, espèces Pokédex, carnets, clubs et bouteilles déjà chargés.
5. **Interactivité MapLibre (`MapStage.tsx`) & priorité de tap** *(En périmètre explicite)* :
   - Ajout d'un hit-test `queryRenderedFeatures` sur clic carte dans `MapStage.tsx` (sans réécrire le cœur WebGL) + surbrillance de l'entité sélectionnée (`selectedFeature`) et callbacks `onUnifiedFeatureClick` / `onRouteClick`.
   - **Priorité de tap stricte** : `1. Points Risques / Bouteilles / Social / Pokédex` (clic cluster → zoom) > `2. Itinéraires (xp-routes-line/casing)` > `3. Régions` > `4. Pays`.
6. **Contexte carte `selectExplorerMapContext` & Zéro appel au démarrage** *(Choix architecte)* :
   - Les surcouches contextuelles par catégorie/lentille sont **éphémères** (superposées à `store.layerVisibility` sans écraser le pré-réglage choisi en Catégorie 2, toujours soumises au plafond de 2 rasters analytiques).
   - Au démarrage à froid en cran **`peek`**, le contexte reste **dormant** jusqu'au premier geste utilisateur (`mid`/`full` ou tap catégorie) → garantie stricte de **0 appel `/api/explorer/v2/*` au boot**.

