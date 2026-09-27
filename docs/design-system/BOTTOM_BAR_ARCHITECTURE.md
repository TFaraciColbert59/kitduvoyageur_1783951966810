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

## 6. Bifurcation desktop / mobile : les deux arbres sont rendus (arbitrage Phase 7)

**Décision retenue : on garde les deux arbres dans le DOM, la visibilité est décidée en CSS.**

Les pages publiées rendent le contenu deux fois, dans deux conteneurs mutuellement exclusifs :

| Arbre | Conteneur | Coquille | Layout |
|---|---|---|---|
| Desktop | `hidden md:flex flex-col h-[100dvh] overflow-hidden` | `Header` + `Footer`, scroll interne | Grille de cartes (`Card`) |
| Mobile | `block md:hidden` | `AppShell` (tab bar) | Liste groupée (`InsetGroupedList`) |

C'est systématique : 48 fichiers de `src/app` suivent ce motif. Ce n'est pas une optimisation
manquante sur quelques pages, c'est l'architecture du produit.

### Pourquoi ne pas basculer sur un rendu unique côté client

La piste évidente est `useMediaQuery('(min-width: 768px)')`. Elle est **écartée comme une
régression**, pas comme un gain :

- `useMediaQuery` (`src/hooks/useMediaQuery.ts`) part de `false` puis corrige en `useEffect`.
  Le serveur rendrait donc toujours l'arbre **mobile**.
- Au premier paint desktop, la page afficherait le layout mobile puis basculerait : un flash de
  layout sur **chaque** navigation, sur les 48 routes.
- Le SSR ne connaissant pas le viewport, le HTML servi ne peut pas être correct pour les deux.

Un flash systématique est un coût visuel supérieur au coût CPU épargné.

### Ce que la bifurcation coûte, et ce qui a été fait

Le coût réel n'est pas le DOM inactif (`display: none` ne peint rien) mais les **effets de bord
des composants clients montés dans l'arbre masqué** : canaux realtime, requêtes réseau, listeners
`window`.

`Header` était le pire cas : il ne rend **que** du desktop (enveloppe `hidden md:block`, aucune
branche mobile) et il était pourtant monté sur mobile, où il coûtait pour rien :

- un canal realtime `notifications` + une requête de comptage ;
- `useConversations(user?.id)` = un second canal realtime + un `getConversations` ;
- les listeners `resize` et `scroll` ;
- deux `getBoundingClientRect()` forcés par événement de resize (lecture de layout synchrone).

Correctif appliqué : `Header` gate ces effets sur `isDesktop`. Le rendu, lui, n'est pas conditionné
— on ne touche pas à la bifurcation. Effets sans impact visuel uniquement :

- la mesure initiale de la pastille reste **non conditionnée** (`useLayoutEffect`) : la pastille
  de navigation doit être placée dès le premier paint, sinon elle clignote ;
- le handler `resize` est throttlé en `requestAnimationFrame` (une lecture de layout par frame
  au lieu d'une par événement) ;
- l'état `mounted` était déclaré, écrit, et **jamais lu** : supprimé ;
- `handleScroll` n'était pas appelé au montage : une page rechargée en position scrollée gardait
  la mauvaise ombre. Corrigé.

### Règle pour l'avenir

Un composant monté dans un arbre masqué par CSS doit **désactiver ses effets**, pas son rendu.
Les effets sans impact visuel (realtime, écouteurs, mesures) se conditionnent sur
`useMediaQuery` ; les effets qui pilotent une première peinture (mesures de position) ne se
conditionnent jamais.
## 7. La bande cookie : une seule mesure, `max()`, et un seul paint

La bannière de consentement est un overlay `fixed` au même bord que la bottom-nav. Trois
composants consomment sa hauteur, et leurs formules **doivent** rester cohérentes.

### 7.1 Ce que mesure `--cookie-banner-h`

`<CookieConsentBanner>` publie `--cookie-banner-h = window.innerHeight - panel.top`, c'est-à-dire
la bande **du sommet du panneau jusqu'au bas du viewport**. Le panneau étant déjà remonté de
`--nav-offset` via son `marginBottom`, cette valeur **contient déjà la bottom-nav**.

Conséquence : la nav se pose avec `bottom: var(--cookie-banner-h)` et les pages réservent avec
`max(...)`. **Additionner `--nav-offset` à `--cookie-banner-h` réserve deux fois la nav.**

| Consommateur | Formule | Rôle |
|---|---|---|
| `NavigationSurface.tsx` | `bottom: var(--cookie-banner-h, 0px)` | empile la nav au-dessus du panneau |
| `AppShell.tsx` | `max(--bottom-nav-height, --cookie-banner-h)` | dégage le contenu sous la bande |
| `tokens.css` | `calc(max(--nav-offset, --cookie-banner-h) + --space-4)` | idem pour les pages qui consomment le token |

Le `max()` est donc une obligation, pas un style : c'est la formule d'`AppShell` qui fait
référence.

### 7.2 Un seul saut, au premier paint

Deux causes de saut ont été supprimées :

1. **Le `setTimeout(..., 1000)`** laissait la page se stabiliser avec `--cookie-banner-h:0px`,
   puis levait la nav de ~190 px et reflowait le contenu une seconde plus tard, sous l'œil de
   l'utilisateur — sur les 60 routes. La bannière s'affiche désormais dès le premier effet.
2. **L'effet de publication était passif.** Le navigateur peignait la bannière par-dessus la nav,
   puis levait la nav au paint suivant : deux sauts. La publication passe par un layout effect
   (`useIsomorphicLayoutEffect`), donc la levée est appliquée **dans le commit qui insère le
   panneau** : un seul saut, mesuré à ~158 ms.

Mesure (`/communaute`, 393×852) : `--cookie-banner-h` passe de non-défini à `191px` et la nav de
`top:750` à `top:559` en un seul frame ; à `t=0,5 s` l'état final est déjà en place. Au dépliage
du panneau détaillé, `ResizeObserver` republie `396px` et la nav se repose exactement sur le
sommet du panneau (`nav.bottom === panel.top`).

### 7.3 La valeur dépend de la hauteur du viewport

`ResizeObserver` ne voit que les changements de **largeur** du panneau (sa hauteur est dictée par
son contenu). Or la valeur publiée dépend aussi de `window.innerHeight`, que le repli de la barre
d'URL mobile et le clavier virtuel font varier sans toucher la largeur. D'où les écoutés
`window.resize` et `window.visualViewport.resize`.

### 7.4 Un voile translucide sans verre dépoli ne dépoli rien

`liquid-ios27.css` redéfinit les surfaces du thème iOS 27 comme des **voiles translucides**
(`--lkv-surface: rgba(16,16,16,0.3)`, `--lkv-surface-card: 0.34`, …). C'est le matériau
Liquid Glass, et cela n'a de sens **qu'accompagné d'un `backdrop-filter`**. Un élément qui pose
`--lkv-surface` sans flou n'est pas du verre : c'est un film transparent, et le contenu situé
dessous traverse — le texte devient illisible.

Le panneau de la bannière était dans ce cas. Corrigé par
`backdrop-blur-[var(--glass-blur)] saturate-[var(--glass-saturation)]`, le même traitement que les
`.lkv-glass` et que les boutons déjà présents dans le panneau.

> **Règle** : toute surface translucide qui flotte au-dessus de contenu arbitraire (carte, overlay,
> panneau flottant) porte un `backdrop-filter`. Les aplats de page (`<main>`, `<footer>`) sont
> posés sur la toile marbrée globale et n'en ont pas besoin.
>
> L'audit de contraste ne peut pas détecter ce défaut : il compose la chaîne d'ancêtres sans
>sachant le contenu réellement peint dessous. La sonde runtime qui le détecte consiste à
> parcoursser, pour chaque nœud de texte, la chaîne d'ascendants en cumulant les alphas jusqu'à un
> fond opaque, et à signaler ceux dont le cumul reste < 0,9 sans `backdrop-filter`.
