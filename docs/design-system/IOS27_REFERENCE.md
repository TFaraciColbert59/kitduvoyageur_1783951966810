# iOS 27 / Liquid Glass — Référence documentaire vérifiée (Phase 2)

> **Objet** : figer les faits Apple lus le **2026-09-20** pour cadrer la Phase 2 du design system LKDV (Next.js/React dans une WebView Capacitor, refonte visuelle iOS 27 / Liquid Glass). Recherche + rédaction uniquement : aucune ligne de code, aucune API validée côté SDK.
> **Environnement** : Windows, **Xcode absent**, aucun SDK iOS ni simulateur local. Toute disponibilité d'API native reste **bloquée** jusqu'au passage sur macOS (§6).

## 1. Niveaux de preuve

| Niveau | Signification |
|---|---|
| **A — VÉRIFIÉ** | Fait lu explicitement sur une page Apple fetchée le 2026-09-20 (URL citée). Ne vaut **pas** preuve de disponibilité dans le SDK installé. |
| **B — NON VÉRIFIÉ** | Page inaccessible, contenu non inspecté, ou fait absent des pages fetchées. À ne pas utiliser. |
| **C — NON APPLICABLE WebView** | Concerne une mécanique native sans équivalent direct dans une page web. |

## 2. Priorité des sources (reprise du cahier des charges — `PHASE2_READINESS.md` §1)

1. Apple Design Resources iOS 27
2. Apple Human Interface Guidelines actuelles
3. WWDC26 (sessions 278, 251)
4. Documentation UIKit / SwiftUI actuelle
5. WWDC25 (fondations Liquid Glass — sessions 284, 356, 323, 243, 256)

Règles : aucune API/propriété/comportement n'est considéré disponible depuis la mémoire ; si une API iOS 27 est absente du SDK installé, ne pas l'inventer → abstraction compatible + blocage documenté.

## 3. Faits vérifiés par source (niveau A)

### 3.1 `https://developer.apple.com/design/resources/` — OK
- UI Kit **iOS 27 / iPadOS 27** publiée pour Figma et Sketch + App Icon Template iOS/iPadOS/watchOS 27.
- **SF Symbols 27** : « over 7,000 symbols », neuf graisses, trois échelles, dessins multi-couches pensés pour le mouvement, > 20 écritures localisées ; `.dmg` (macOS Sonoma ou ultérieur).
- **Icon Composer** : crée des icônes en couches « out of Liquid Glass », format multi-couches annoté par apparence, export aplati, compatible Xcode (macOS Sequoia ou ultérieur).
- Polices officielles distribuées : SF Pro, SF Compact, SF Mono, New York, SF Arabic/Armenian/Georgian/Hebrew.
- Kits watchOS encore en **watchOS 26** ; gabarits matériels iPhone 18/17/16, iPad Pro (M5), MacBook Air/Pro M5.

### 3.2 `https://developer.apple.com/design/` — OK
- Portail Design : HIG, Apple Design Resources, Icon Composer, SF Symbols, Pass Designer, Reality Composer Pro.
- Vidéos design mises en avant : « Meet Liquid Glass » (wwdc2025/219), « Get to know the new design system » (wwdc2025/356), icônes (220, 361), foundations (359), iPad (208).

### 3.3 `https://developer.apple.com/documentation/technologyoverviews/liquid-glass` — ÉCHEC en HTML (JS requis) → variante officielle `.md` OK
- Liquid Glass = « a new dynamic material » combinant propriétés optiques du verre et fluidité ; elle établit hiérarchie, harmonie et cohérence entre appareils.
- Les composants standard **SwiftUI, UIKit et AppKit** (contrôles, navigation) adoptent automatiquement l'apparence et le comportement du matériau ; il est possible de l'appliquer à des éléments custom.
- Adoption recommandée : refresh visuel matériaux/contrôles/icônes ; navigation et **recherche** universelles ; cohérence d'organisation ; bonnes pratiques fenêtres/modales/menus/toolbars ; tests multi-plateformes.
- Exemple officiel **Landmarks** (SwiftUI) : icône Icon Composer, background extension effect, scroll views sous sidebar, adaptabilité de fenêtre, conventions de recherche, verre sur éléments custom.
- Liste les vidéos 219, 356, 323, 284, 310 et renvoie à « Adopting Liquid Glass » (page non fetchée → niveau B).

### 3.4 WWDC26/278 « Modernize your UIKit app » — OK
- Les **apps iPhone deviennent pleinement redimensionnables** (iPhone Mirroring sur macOS 27, app iPhone sur iPad) : le layout doit s'adapter dynamiquement à toute taille de scène.
- Le **cycle de vie UIScene est obligatoire** avec les derniers SDK (sans `UISceneDelegate`, l'app ne se lance plus).
- Interdits de layout : `UIScreen.main` (→ `windowScene.screen`), scale (→ `traitCollection.displayScale`), bounds écran (→ effective geometry / bounds de vue), **user interface idiom** et **interface orientation** (→ size classes) ; observer avec `registerForTraitChanges`.
- iOS 27 : `UIRequiresFullscreen` est honoré sur iPhone en environnement redimensionnable → redimensionnement discret respectant les orientations supportées (jeux) ; **UIView conforme aux Body protocols** CoreMotion/CoreLocation.
- Barres : `tabBarController.sidebar.preferredPlacement = .sidebar`, `sidebar.isAvailable`, `prominentTabIdentifier` ; minimisation (prose : `barMinimizationBehavior` / `barMinimizationSafeAreaAdjustment` ; extrait de code : `navigationItem.navigationBarMinimization.minimizationBehavior` / `.safeAreaAdjustment` → **divergence à trancher dans le SDK**).
- Scroll edge effects : `.automatic` « no longer switches between the existing soft and hard styles » (réévaluer tout override `.soft`). Menus : `preferredImageVisibility` ; bouton **Ask Siri** automatique ; **View Annotations API** (AppEntities) ; drag sessions déclenchables sans geste utilisateur (éviter l'UI dans `sessionWillBegin`).
- Xcode 27 : Device Hub/resize mode, skill de modernisation, export `xcrun agent skills export`.

### 3.5 WWDC26/251 « Communicate your brand identity on iOS » — OK
- Modèle en **deux couches** : UI layer (navigation/actions, composants standard) et content layer (marque). La marque s'exprime d'abord dans le contenu.
- Depuis iOS 26 : **déplacer la couleur de marque dans la zone de contenu** ; les contrôles Liquid Glass « pick up your brand color dynamically » au-dessus.
- Couleur = sens (hiérarchie, action, statut) ; le Dark Mode doit être supporté sous peine d'expérience négative.
- Typographie custom : **support de Dynamic Type obligatoire** (agrandissement, passage multi-lignes plutôt que troncature) ; variantes citées : SF Pro, SF Compact, SF Mono, New York, SF Rounded.
- Icônes custom encouragées si reconnaissables et conformes aux conventions de plateforme (le glyphe Share diffère iOS/Android/Web) ; sinon SF Symbols (> 7 000, « built into Xcode »).
- Motion : transitions (dont Zoom Transitions SwiftUI) et animations améliorent la perception ; chargements lents/chutes de frames la dégradent. Logos à l'affichage discret.

### 3.6 WWDC25/284 « Build a UIKit app with the new design » — OK
- iOS 26 : `UITabBarController`/`UISplitViewController` en Liquid Glass ; tab bar iPhone flottante, `tabBarMinimizeBehavior = .onScrollDown` ; `UITabAccessory` + `bottomAccessory` ; trait `UITraitTabAccessoryEnvironment` (`.inline`).
- `UIBackgroundExtensionView` : `contentView`, `automaticallyPlacesContentView` ; les textes/contrôles de l'effet doivent être des **siblings**, pas des sous-vues.
- Barres transparentes par défaut : retirer `UIBarAppearance`/backgrounds custom ; regroupement automatique des items ; `UIBarButtonItem.tintColor` et `style = .prominent` ; `flexibleSpace` avec `hidesSharedBackground = false` ; `navigationItem.subtitle` et `largeSubtitleView`.
- Edge effects : `UIScrollEdgeElementContainerInteraction` (`scrollView`, `edge`) pour conteneurs custom ; `scrollView.topEdgeEffect.style = .hard` pour les UI denses.
- Search iOS 26 : `searchBarPlacementBarButtonItem`, `searchBarPlacementAllowsExternalIntegration`, onglet Search dédié avec `automaticallyActivatesSearch`, `preferredSearchBarPlacement = .integratedCentered`.
- Contrôles : `UIButton.Configuration.glass()` / `.prominentGlass()` ; sliders `trackConfiguration` (`allowsTickValuesOnly`, `neutralValue`, `numberOfTicks`) et `sliderStyle = .thumbless`.
- Verre custom UIKit : `UIVisualEffectView` + `UIGlassEffect` (materialize/dematerialize, `cornerConfiguration` `.fixed`/`.containerRelative`, `tintColor`, `isInteractive`) ; `UIGlassContainerEffect` (`spacing`, fusion/scission) ; action sheets ancrées via `popoverPresentationController.sourceItem`.

### 3.7 WWDC25/356 « Get to know the new design system » — OK
- Couleurs système ajustées Light/Dark/Increased Contrast ; typographie « bolder and left-aligned » ; formes guidées par la **concentricité** : fixed, capsule (rayon = ½ hauteur), concentric (rayon parent − padding).
- macOS : Mini/Small/Medium en rectangles arrondis, Large et X-Large en capsule.
- Structure : ancrage des surfaces sur leur source ; appliquer le matériau au contrôle, pas à ses sous-vues ; feuille modale + dimming layer ; au changement de focus, Liquid Glass « recedes » (plus opaque, grandit légèrement).
- Nettoyage attendu : supprimer fonds/bordures custom des barres ; hiérarchie par layout/groupement ; ne pas grouper symboles et texte ; action primaire séparée et teintée ; pas d'action spécifique à un écran dans un accessoire persistant.
- Scroll edge effects : **soft** (défaut iOS/iPadOS) et **hard** (surtout macOS) ; ne pas les empiler ; un seul par vue (hauteur cohérente en Split View) ; jamais sans UI flottante.
- Sidebars inset en Liquid Glass avec contenu passant derrière (background extension effect) ; scroll views étendues sous la sidebar par défaut ; textes/contrôles maintenus au-dessus.

### 3.8 WWDC25/323 « Build a SwiftUI app with the new design » — OK
- `NavigationSplitView` : sidebar Liquid Glass flottante ; **`.backgroundExtensionEffect()`** (miroir + flou hors safe area) ; inspector mieux hiérarchisé.
- `TabView` : `tabBarMinimizeBehavior(.onScrollDown)`, `.tabViewBottomAccessory { }` + environnement `tabViewBottomAccessoryPlacement`.
- Sheets : hauteur partielle inset avec fond Liquid Glass → plein écran plus opaque ; `.presentationDetents([.height(180), .medium, .large])` ; morph depuis un bouton via `matchedTransitionSource` + `.navigationTransition(.zoom(sourceID:in:))`.
- Toolbars : regroupement auto, `ToolbarSpacer(.fixed/.flexible)`, `.sharedBackgroundVisibility(.hidden)`, `.badge(...)`, icônes monochromes, `.scrollEdgeEffectStyle(.hard, for: .top)`.
- Search : `.searchable` (bas sur iPhone, top-trailing iPad/Mac), `.searchToolbarBehavior(.minimize)`, `Tab(role: .search)` qui remplace la tab bar par le champ.
- Contrôles : `.buttonBorderShape(.capsule)`, `controlSize`, styles `.glass` / `.glassProminent`, ticks et `neutralValue` sur Slider, icônes de menus en leading edge, forme `.rect(corner: .containerConcentric)`.
- Verre custom SwiftUI : `.glassEffect()`, `.glassEffect(in: .rect(cornerRadius: 16))`, `.glassEffect(.regular.tint(.green))`, `.glassEffect(.regular.interactive())`, **`GlassEffectContainer`** + `.glassEffectID(_:in:)` ; « glass can not sample other glass » → le conteneur partage la zone d'échantillonnage.

### 3.9 WWDC25/243 « What's new in UIKit » — OK
- Design : Liquid Glass + transitions de navigation fluides et interruptibles ; `updateProperties` (UIView/UIViewController, avant `layoutSubviews`, `setNeedsUpdateProperties`) ; **observation tracking automatique** des `@Observable` (actif par défaut iOS 26, back-deploy iOS 18 via `UIObservationTrackingEnabled`).
- Animation : option `.flushUpdates` (applique les updates en début/fin d'animation, plus de `layoutIfNeeded` manuel).
- iPadOS 26 : menu bar par swipe depuis le haut ; configuration du menu principal (`UIMainMenuSystem.Configuration`, préférences printing/inspector, style Find→Search) ; éléments différés basés sur le focus (`UIDeferredMenuElement.usingFocus`) ; `UIKeyCommand.repeatBehavior`.
- Interop : `UIHostingSceneDelegate` pour intégrer des scènes SwiftUI dans une app UIKit.
- HDR : couleurs HDR (`UIColor(..., linearExposure:)`, `maximumLinearExposure`) ; trait de repli (prose `UITraitHDRHeadroomUsage` vs code `UITraitHDRHeadroomUsageLimit`/`hdrHeadroomUsageLimit` → **divergence à trancher**).
- Cycle de vie : `UIScene` obligatoire (pas de lancement sinon) ; `openURL` accepte les file URLs ; notifications typées `NotificationCenter.Message` ; SF Symbols 7 (Draw On/Off, variable draw, Magic Replace, dégradés, `symbolContentTransition` sur UIButton).

### 3.10 WWDC25/256 « What's new in SwiftUI » — OK
- Nouveau design : sidebar verre, tab bar iPhone plus compacte, toolbar items Liquid Glass avec morph pendant les transitions, `ToolbarSpacer`, tint, scroll edge effect sous la barre.
- Search : bottom-aligned sur iPhone, top-trailing sur iPad, **onglet Search** séparé qui « morphs into the search field » (`role .search`).
- iPadOS 26 : menu bar par swipe ; `UIRequiresFullscreen` **déprécié** ; fenêtres redimensionnables ; macOS `windowResizeAnchor`.
- Performance : listes macOS > 100 000 items 6× plus rapides au chargement, jusqu'à 16× en update ; meilleur ordonnancement des frames au scroll ; instrument SwiftUI dans Xcode.
- Layout/animation : `@Animatable`/`@AnimatableIgnored` ; visionOS `Alignment3D`, `spatialOverlay`, `manipulable`, `surfaceSnappingInfo` ; `Chart3D`.
- Vues : **`WebView`** et **`WebPage`** SwiftUI (WebKit) ; drag & drop multi-items (`dragContainer`, `DragConfiguration`, `onDragSessionUpdated`) ; édition riche `TextEditor` + `AttributedString`.

### 3.11 `https://developer.apple.com/documentation/uikit/uisearchcontroller` — ÉCHEC en HTML (JS requis) → variante officielle `.md` OK
- `UISearchController` (UIKit, iOS/iPadOS 8.0+, visionOS 1.0+) « manages the display of search results based on interactions with a search bar » ; il coordonne un `UISearchBar` et un contrôleur de résultats.
- Sur iOS, le `searchBar` est incorporé à l'interface du view controller hôte ; les résultats sont affichés par un second contrôleur passé à `init(searchResultsController:)`.
- Mise à jour via `UISearchResultsUpdating` (`searchResultsUpdater`) ; transitions personnalisables via `UISearchControllerDelegate`.
- Propriétés : `isActive`, `obscuresBackgroundDuringPresentation`, `hidesNavigationBarDuringPresentation`, `automaticallyShowsCancelButton`, `automaticallyShowsSearchResultsController`, `showsSearchResultsController`, `searchBarPlacement` (`UINavigationItem.SearchBarPlacement`), `automaticallyShowsScopeBar`, `scopeBarActivation`, `ignoresSearchSuggestionsForSearchBarPlacementStacked`.
- **Suggestions** : `searchSuggestions: [any UISearchSuggestion]?` — « A list of suggestions to offer as shortcuts below the search field » ; `UISearchSuggestionItem`, protocole `UISearchSuggestion`.
- Dépréciés : `searchControllerObservedScrollView`, `dimsBackgroundDuringPresentation`.

### 3.12 Éléments NON VÉRIFIÉS (niveau B)
- Les 7 pages vidéo WWDC fetchées (2026/278, 2026/251, 2025/284, 2025/356, 2025/323, 2025/243, 2025/256) ont toutes livré une transcription : **aucune vidéo sans transcription**.
- Deux pages HTML exigent JS (`…/technologyoverviews/liquid-glass`, `…/uikit/uisearchcontroller`) : lues via leurs variantes `.md` officielles.
- Non fetchés donc non vérifiés : la page « Adopting Liquid Glass », toute page HIG (aucune spécification numérique HIG validée), les kits Figma/Sketch, le contenu de `SF-Symbols-27.dmg`, les vidéos citées 219/220/310/337/208/361/282, les autres sessions WWDC26.
- Non vérifiés par nature : disponibilité réelle des APIs dans le SDK installé, attribution exacte iOS 26 vs iOS 27, comportement WKWebView vs Chromium.

## 4. UISearchController : ce que la doc dit, et équivalent web

**Ce que dit la documentation (A)** : le contrôleur orchestre barre de recherche + contrôleur de résultats + suggestions ; sur iOS le `searchBar` est embarqué dans le view controller hôte et les suggestions sont un contrat natif (`UISearchSuggestion`) affiché sous le champ. L'intégration à la navigation bar est une affaire d'UIKit (`searchBarPlacement`), pas un service fourni à une page web.

**Pertinence pour un équivalent web (C, sans prétendre à l'API native)** :
- Un champ de recherche + overlay de résultats reproduit le modèle mental ; les suggestions deviennent une liste `role="listbox"` / `aria-activedescendant` sous le champ, navigable au clavier.
- Le placement (bas sur iPhone, top-trailing sur iPad) est un choix de layout CSS/React ; rien ne peut être délégué au système dans une WebView.
- **Aucune hypothèse** : `searchBarPlacement`, `automaticallyActivatesSearch` et `Tab(role: .search)` sont des APIs natives lues dans les sessions ; elles ne décrivent pas le DOM.

## 5. Implémentable immédiatement (React/WebView) vs API native

| Besoin | Équivalent web réaliste (CSS/React) | API native potentielle (nommée uniquement si vérifiée) | Statut |
|---|---|---|---|
| Verre sur cartes/boutons/overlays | `backdrop-filter`, bordures 1 px, gradients, `@supports` (bibliothèques déjà au repo) | `.glassEffect()`, `UIGlassEffect` (284, 323) | A (doc) — implémentable, rendu ≠ natif |
| Regroupement d'items de barre | flex + `gap` + conteneurs partagés | `hidesSharedBackground`, `ToolbarSpacer` (284, 323) | A (doc) |
| Scroll edge effect (soft/hard) | dégradé + flou de bord (`sticky` + `backdrop-filter`) | `UIScrollEdgeElementContainerInteraction`, `.scrollEdgeEffectStyle(.hard, for:)` (284, 323, 356) | A (doc) |
| Tab bar flottante + minimisation | barre fixe + masquage/translation au scroll | `tabBarMinimizeBehavior` (284, 323, 256) | A (doc) |
| Recherche + suggestions | overlay plein écran + input + listbox ARIA | `UISearchController`, `searchToolbarBehavior(.minimize)`, `Tab(role: .search)` (doc, 284, 323) | A (doc) |
| Sheets/detents + morph | overlay + translation + `prefers-reduced-motion` ; morph via View Transitions si supporté | `.presentationDetents`, `preferredTransition = .zoom`, `matchedTransitionSource` (284, 323) | A (doc) |
| Sidebar + image étendue derrière | panneau glass + image dupliquée/floutée ou masque | `UIBackgroundExtensionView`, `.backgroundExtensionEffect()` (284, 323) | A (doc) |
| Boutons verre/prominent | variantes CSS dédiées | `.glass()`, `.prominentGlass()`, `.buttonStyle(.glass/.glassProminent)` (284, 323) | A (doc) |
| Formes capsules/concentriques | `border-radius: 9999px`, rayon calculé (CSS vars) | `.buttonBorderShape(.capsule)`, `.rect(corner: .containerConcentric)` (323, 356) | A (doc) |
| Sliders ticks/neutre | composant maison ou input range custom | `trackConfiguration`, `neutralValue` (284, 323) | A (doc) |
| Fusion/scission de verre (morphing) | hors de portée CSS raisonnable | `UIGlassContainerEffect`, `GlassEffectContainer` + `glassEffectID` (284, 323) | C — abstraction à prévoir |
| Haptics | API web limitée | aucune API nommée dans les sources fetchées | B — non vérifié |
| Safe areas / Dynamic Island | `env(safe-area-inset-*)` (déjà utilisé par le repo) | non traité par les sources fetchées | B — non vérifié |
| Redimensionnement | media queries, size classes CSS | size classes UIKit, fin du layout par orientation (278) | C — non pertinent en WebView au-delà du responsive |

## 6. Blocages : ce qui exige macOS/Xcode

Aucune API native listée ci-dessus n'est utilisable avant exécution sur macOS :

```bash
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
xcrun simctl list runtimes
```

Puis, pour chaque API envisagée : vérifier `@available`/en-têtes du SDK réellement installé, la compatibilité avec `IPHONEOS_DEPLOYMENT_TARGET` (15.0 actuel) et la version OS cible (26 vs 27). Les numéros de version cités (284 = iOS 26, 278 = iOS 27) proviennent des pages/vidéos, **pas** des en-têtes SDK.

## 7. Règles de travail Phase 2

1. Ne jamais citer une API native sans preuve SDK ; en attendant, rester sur des abstractions web documentées.
2. Toute décision visuelle s'appuie sur les faits du §3 et cite son URL source.
3. Ne pas reproduire un écran existant : réutiliser/étendre les primitives `@/design` (règle anti-régression `PHASE2_READINESS.md` §7).
4. Signaler systématiquement le statut A/B/C dans les revues Phase 2.
5. Toute divergence prose Apple / extrait de code (§3.4, §3.9) se tranche dans le SDK, jamais par supposition.
