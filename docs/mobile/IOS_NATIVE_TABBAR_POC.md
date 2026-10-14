# POC — Bottom bar iOS native (UITabBar Liquid Glass système)

> Branche : `feature/ios-native-liquid-glass-tabbar` (jamais de commit direct sur `main`).
> Statut : implémenté, tests pont verts, **compilation Xcode NON encore effectuée
> (environnement Windows sans Xcode)** — recette Mac ci-dessous (§6).
> Références : `docs/design-system/BOTTOM_BAR_ARCHITECTURE.md` (§3, §5),
> `docs/design-system/PHASE2_FINAL.md` (§2, §7 dette native).

## 1. Décision d'architecture (vérifiée sans SDK, à confirmer sur Mac)

- **Conteneur unique, pas 5 WebViews** : `NativeTabBarContainerViewController`
  embarque l'UNIQUE `CAPBridgeViewController` en enfant (même instance, bridge
  intact) + une vraie `UITabBar` UIKit en overlay bas. Aucun écran Next.js
  migré vers Swift, aucune WebView dupliquée.
- **Liquid Glass système, pas imité** : `UITabBarAppearance().configureWithDefaultBackground()`,
  aucun `UIVisualEffectView` arbitraire, aucune capture, aucun CSS-imitated glass.
  Sur iOS 26+, le matériau/morphing est celui d'iOS ; sur iOS antérieur, flou
  standard (repli automatique, deployment target **15.0 conservé**).
- **Minimisation au scroll VOLONTAIREMENT désactivée** (barre fixe) : le nom exact
  de l'API (`tabBarMinimizeBehavior` ou équivalent) diverge selon WWDC26/278 et
  doit être vérifié dans le SDK installé + test scroll WKWebView réel (§6.3).
  La vérité du matériau prime sur la minimisation pour ce POC.

## 2. Fichiers (créés / modifiés — POC uniquement)

| Fichier | Rôle |
|---|---|
| `ios/App/App/NativeTabBar/NativeTabBarContainer.swift` *(créé)* | Conteneur + vraie `UITabBar` (5 onglets, SF Symbols, clavier, safe areas) |
| `ios/App/App/NativeTabBar/NativeTabBarPlugin.swift` *(créé)* | Plugin Capacitor `NativeTabBar` (`setEnabled`/`setSelectedTab`/`setVisible`/`getState`, événement `tabSelected`, allowlist fermée) |
| `ios/App/App/SceneDelegate.swift` *(modifié)* | Racine = conteneur (bridge injecté, jamais recréé) |
| `ios/App/App.xcodeproj/project.pbxproj` *(modifié)* | Les 2 fichiers Swift dans la cible `App` (groupe `NativeTabBar`) |
| `src/lib/native/tabBar.ts` *(créé)* | Pont TS : allowlist 5 ids/hrefs, `tabIdForPathname` (registre), no-nav routes, flag runtime, enveloppe plugin no-op hors iOS |
| `src/lib/native/index.ts` *(modifié)* | Export `tabBar` (1 ligne) |
| `src/components/mobile-nav/navigation/NativeTabBarBridge.tsx` *(créé)* | Pont bidirectionnel : tap→`router.push`, route→tab, `setVisible`, style de masquage scopé, cleanup |
| `src/components/mobile-nav/MobileNavWrapper.tsx` *(modifié)* | Monte le pont sur toutes les routes (y compris no-nav pour `setVisible(false)`) |
| `src/components/mobile-nav/NavigationBar.tsx` *(modifié)* | Commentaire POC ; `NATIVE_TABBAR_ENABLED = false` inchangé |
| `src/lib/native/__tests__/tabBar.test.ts` *(créé)* | 6 tests du contrat fermé route↔tab |
| `docs/mobile/IOS_NATIVE_TABBAR_POC.md` *(ce fichier)* | Rapport + recette + rollback |

Services métier, Supabase, points, routes et design web : **intacts**.
`AppShell` (`--bottom-nav-height`), `contentInset: 'never'`, bannière cookies
(`max()`), `MobileNavWrapper` no-nav : **inchangés en comportement** — la
réservation web est conservée telle quelle sous la barre native (même hauteur
utile), d'où l'absence de double padding / CTA recouvert à vérifier sur
appareil (§6.4).

## 3. Pont bidirectionnel (sûr, fermé)

- **Allowlist stricte** : `adventures`→`/hub`, `community`→`/communaute`,
  `explorer`→`/explorer`, `messages`→`/messagerie`, `me`→`/compte`. Tout autre
  identifiant/URL est rejeté côté Swift (`NATIVE_TABBAR_UNKNOWN_TAB`) comme
  côté TS (`null`, jamais de `window.location`, jamais de rechargement).
- **Natif → web** : `tabSelected({id})` → `router.push(href)` (push ignoré si
  déjà sur l'href : pas de boucle). État connecté préservé (même WebView).
- **Web → natif** : chaque `pathname` → `setSelectedTab(tabIdForPathname())`.
  Deep link `lkdv://`, URL directe, retour et réouverture d'app sont couverts
  (le pathname change dans tous les cas). `setVisible(false)` sur
  `/connexion`, `/inscription`, `/checkout*`, `/communaute/publier` (miroir
  `MobileNavWrapper`) + événements `lkdv-toggle-bottom-bar`.
- **Nettoyage** : `remove()` du listener + `setEnabled(false)` + retrait du
  `<style>` et du dataset à la destruction.
- **Clavier** : masquage natif automatique (`keyboardWillShow/Hide`) ; la
  réservation web (`Keyboard.resize: body`) est inchangée.

## 4. Repli web / flag (OFF par défaut)

- `NATIVE_TABBAR_ENABLED = false` (build inchangé).
- Activation test (iOS natif uniquement) : `localStorage["lkdv:native-tabbar"]="1"`
  ou `?native-tabbar=1`. Tout le reste (Safari, PWA, Android, iOS flag OFF) :
  le pont est no-op, aucun style injecté, barre web strictement identique.
- Flag ON seulement : `html[data-native-tabbar="true"] nav.lkv-nav-surface
  .lkv-material-bar{display:none}` — la rangée d'onglets web disparaît (pas de
  double barre), **plateaux secondaires, overlays et réservation conservés**.
- **Rollback instantané** : retirer le flag (ou rester dessus) → barre web
  intégrale, application web 100 % fonctionnelle. Aucun déploiement global sans
  validation iPhone réel.

## 5. Vérifications effectuées ici (Windows, sans Xcode)

| Vérification | Résultat |
|---|---|
| `npx vitest run src/lib/native/__tests__/tabBar.test.ts` | ✅ 6/6 (contrat fermé, registre, no-nav) |
| `npx tsc --noEmit` (fichiers POC) | ✅ 0 erreur sur `tabBar.ts`, `NativeTabBarBridge.tsx`, `MobileNavWrapper.tsx`, `NavigationBar.tsx` (erreurs pré-existantes ailleurs, arbre de travail sale non lié au POC) |
| `npx eslint` (fichiers POC) | ✅ 0 erreur (warnings `no-empty` identiques au style existant `catch {}`) |
| Compilation Xcode / simulateur / iPhone | ❌ IMPOSSIBLE ici — à faire sur Mac (§6) |

## 6. Recette Mac (obligatoire avant tout déploiement)

### 6.1 Environnement — consigner les versions utilisées

```bash
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
xcrun simctl list runtimes
```

### 6.2 Sync + ouverture (URL HTTPS déployée RÉELLE, jamais une URL de doc)

```bash
CAPACITOR_SERVER_URL="https://DOMAINE_DEPLOYE_LKDV" npx cap sync ios
npx cap open ios
```

> Remplacer `DOMAINE_DEPLOYE_LKDV` par l'URL HTTPS effectivement déployée.
> Ne pas modifier la signature iOS sans nécessité (deployment target 15.0 conservé).

### 6.3 Vérifications SDK (BOTTOM_BAR_ARCHITECTURE.md §5)

- [ ] `UITabBar`/`UITabBarController` + `configureWithDefaultBackground()` donnent le
      matériau Liquid Glass sur iOS 26+ (comparer avec une TabView native minimale).
- [ ] Nom exact de l'API de minimisation (divergence WWDC26/278 : `barMinimizationBehavior`
      vs `navigationBarMinimization.minimizationBehavior`) — grep des headers UIKit
      installés. **Ne pas activer avant test scroll WKWebView concluant.**
- [ ] `UITabBarController.sidebar` / `prominentTabIdentifier` : disponibilité réelle.
- [ ] `overlaysWebView` + `contentInset: 'never'` + barre native : pas de double
      inset, pas de contenu masqué.
- [ ] Build sans erreur avec les 2 fichiers Swift (vérifier le groupe `NativeTabBar`
      dans la cible `App` après `cap sync`, qui peut réécrire le projet).

### 6.4 Recette fonctionnelle (coche § « critères de succès » de la spec)

- [ ] Compilation Xcode sans erreur (consigner Xcode/SDK/simulateur).
- [ ] Vraie barre Liquid Glass visible sur iPhone iOS 26+ (comparaison TabView minimale).
- [ ] Exactement 5 onglets : Hub, Communauté, Explorer, Messages, Compte.
- [ ] Chaque tap change de page sans recharger la WebView, session conservée.
- [ ] Après navigation in-page, le bon onglet reste sélectionné.
- [ ] Retour, deep link `lkdv://`, URL directe, réouverture : OK.
- [ ] Pas de double barre, rien masqué par le home indicator.
- [ ] Clavier ouvert/fermé, portrait, carte, fil Communauté, Compas, messagerie : OK.
- [ ] Web/PWA/Android + iOS flag OFF : navigation strictement inchangée.
- [ ] Au moins 1 test pont (fait : 6 vitest) + capture/vidéo sur vrai iPhone.
- [ ] Activation test : Safari iOS → `localStorage["lkdv:native-tabbar"]="1"` puis
      relance, ou ouverture avec `?native-tabbar=1`.

### 6.5 Pages à tester en priorité (contenu défilable, carte, messagerie)

`/hub`, `/communaute` (fil + onglets), `/explorer` + `/pays`, `/carte-interactive`,
`/compas`, `/messagerie` (liste + conversation + clavier), `/compte`,
`/connexion` (native masquée), `/checkout` (native masquée),
`/communaute/publier` (native masquée), scroll long + bannière cookies visible.

## 7. Rollback

1. **Immédiat (runtime)** : retirer `lkdv:native-tabbar` du localStorage / l'URL —
   la barre web reprend instantanément, sans redéploiement.
2. **Branche** : rester sur `main` (le POC vit uniquement sur
   `feature/ios-native-liquid-glass-tabbar`). Suppression éventuelle :
   `git branch -D feature/ios-native-liquid-glass-tabbar`.
3. **Natif** : `SceneDelegate.swift` d'origine = `rootViewController = bridgeVC`
   (3 lignes) ; supprimer `ios/App/App/NativeTabBar/` + entrées `.pbxproj`.
4. **Web** : supprimer `NativeTabBarBridge` de `MobileNavWrapper` (3 blocs),
   `src/lib/native/tabBar.ts`, le test et ce doc — la barre web n'a jamais été
   modifiée en comportement.

## 8. Limites connues du POC (non-objectifs assumés)

Barre fixe (pas de minimisation au scroll) · pas de badges temps réel natifs ·
pas de vibration personnalisée au tap (haptics web existants conservés) ·
plateau secondaire toujours web (volontaire) · hauteur native supposée ≈
`--nav-offset` (à mesurer sur appareil et ajuster si écart constaté).
