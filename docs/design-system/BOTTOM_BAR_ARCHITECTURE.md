# Bottom bar — étude d'architecture (Web/React vs UITabBar native)

> **Décision non tranchée** (exigence Phase 2). Ce document compare les deux architectures,
> prépare l'intégration native sans casser Android/Web/routes/historique/deep links, et fixe
> l'abstraction qui permettra la bascule. Prérequis : vérification SDK macOS (`IOS27_REFERENCE.md` §6).

## 1. État actuel (constaté)

| Élément | Détail | Source |
|---|---|---|
| Barre | `BottomTabBar` web/React, 5 onglets (Accueil, Explorer, Matériel, Communauté, Moi), verre, `zIndex.nav`, `pointerEvents: 'none'` | `src/components/mobile-nav/BottomTabBar.tsx` |
| Shell | `AppShell` injecte `--bottom-nav-height` (base ou étendue selon route) + safe-area bottom | `src/components/shell/AppShell.tsx` |
| Assemblage | `MobileNavWrapper` = TopBar + BottomTabBar + MobileDrawer + SearchOverlay + OfflineBanner | `src/components/mobile-nav/MobileNavWrapper.tsx` |
| Implémentations concurrentes | 3 fichiers dédiés détectés (`BottomTabBar`, `AppShellDesktop`, `MobileNavWrapper`) ; hauteurs 80/68/52 px incohérentes (audit Phase 1 §3.9) | `baseline-metrics.json` |
| Coquille native | Capacitor 8.5, WebView charge **l'URL distante** `CAPACITOR_SERVER_URL` ; `public/index.html` = placeholder | `capacitor.config.ts` |
| Plugins utiles | `@capacitor/app` (deep links/`appUrlOpen`), `haptics`, `status-bar`, `keyboard` | `package.json` |
| Plugin navigation bar | **absent** (aucun plugin tab bar natif installé) | `package.json` |
| Contrat de bascule | `NavigationBar` (`NATIVE_TABBAR_ENABLED = false`) ; onglets + plateau centralisés dans `destinationRegistry` | `src/components/mobile-nav/NavigationBar.tsx` |
| Scheme | `lkdv` (deep links), `contentInset: 'never'`, `StatusBar.overlaysWebView: true` | `capacitor.config.ts` |

**Contrainte structurante** : le contenu est servi par une URL distante. Une barre native ne peut
donc pas rendre les écrans React ; elle ne peut que **piloter la navigation** de la WebView
(commandes + état de route remonté). C'est le coût principal de l'option native.

## 2. Option A+ — Barre Web/React au comportement iOS

**Principe** : garder la barre web (source de vérité unique), mais la refondre pour coller au
comportement système documenté : capsule flottante en verre, minimise/translate au scroll
(`tabBarMinimizeBehavior(.onScrollDown)` — WWDC25/284/323/256), scroll edge effect « soft »
au-dessus, safe-area unifiée via `--bottom-nav-height`.

| Critère | Évaluation |
|---|---|
| Compatibilité Web/Android | ✅ totale (un seul code) |
| Routes / historique React | ✅ inchangés |
| Deep links | ✅ inchangés (routage web existant) |
| Fidélité iOS | ⚠️ très proche visuellement, mais pas de morphing système ni de comportement UIKit |
| Risque | ✅ faible, incrémental |
| Prérequis SDK | aucun |

## 3. Option B — UITabBar native (plugin Capacitor à écrire)

**Principe** : une barre UIKit native (Liquid Glass automatique iOS 26+, `UITabBarController`)
affichée sous la WebView, synchronisée avec le routeur React.

**Ce qu'il faudrait construire (non vérifié tant que le SDK n'est pas inspecté)** :

1. Un plugin Capacitor Swift : `UITabBarController` (ou `UITabBar` autonome) + méthode
   `setSelectedTab`, événement `tabSelected`, `setTabBarMinimizeBehavior` (nom exact à vérifier
   dans le SDK — `IOS27_REFERENCE.md` §3.4 signale une divergence prose/code).
2. Un pont bidirectionnel : React pousse la route active (via un hook `useNavigationBridge`),
   le natif renvoie les sélections (via `@capacitor/app`/événement plugin), avec gestion
   **historique** (back système), **deep links** (`lkdv://`, `appUrlOpen`), et restauration d'état.
3. Un repli obligatoire Android/Web : la barre web reste rendue (feature flag), le natif ne
   s'affiche que sur iOS quand disponible.
4. Safe areas : `overlaysWebView` + insets à réinjecter côté web (`--safe-bottom`), sinon
   double espacement ou contenu masqué.

| Critère | Évaluation |
|---|---|
| Fidélité iOS | ✅ maximale (matériau, minimise, morphing système) |
| Compatibilité Android/Web | ⚠️ repli à maintenir (deux rendus à garder cohérents) |
| Routes / historique | ⚠️ pont custom, risque de désynchronisation |
| Deep links | ⚠️ à recâbler (`lkdv://` ↔ routes Next) |
| Risque | ⚠️ élevé : plugin Swift + synchronisation + double maintenance |
| Prérequis SDK | **Xcode/SDK macOS obligatoire** (disponibilité `UITabBar` iOS 27, `sidebar`, minimise) |

## 4. Recommandation de travail (sans trancher la cible)

1. **Livrer d'abord A+** : la barre web refondue est la base commune, testable partout, et sert
   de référence visuelle. Aucun blocage.
2. **Préparer B derrière une abstraction** : contrat unique `NavigationBar`
   (`tabs`, `activeTab`, `onSelect`, `minimizeOnScroll`, `material`) avec deux implémentations
   possibles — `WebNavigationBar` (défaut) et `NativeNavigationBar` (drapeau `NATIVE_TABBAR`
   désactivé par défaut, activable après vérification SDK sur macOS).
3. **Critères de bascule** : SDK vérifié (API réellement présente), parité de comportement
   (historique, deep links, back), absence de régression Android/Web, budget de maintenance
   accepté pour deux rendus.
4. **Interdits tant que la bascule n'est pas décidée** : modifier les routes, dupliquer la
   logique de navigation dans le natif, ou supprimer la barre web.

## 5. Points à vérifier dans le SDK macOS (avant toute ligne Swift)

```bash
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
xcrun simctl list runtimes
```

- Existence et nom exact des API de minimisation (`barMinimizationBehavior` vs
  `navigationBarMinimization.minimizationBehavior` — divergence relevée en WWDC26/278).
- `UITabBarController.sidebar` / `prominentTabIdentifier` (WWDC26/278) : disponibilité iOS 27.
- Comportement `overlaysWebView` + `contentInset: 'never'` avec une barre native.
- Compatibilité `IPHONEOS_DEPLOYMENT_TARGET` (15.0 actuel) : toute API ≥ iOS 26/27 impose un
  `@available` + repli.
