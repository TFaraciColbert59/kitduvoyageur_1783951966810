# Warning React « key » — preuve console, identification et correctif (task 4)

- Date : 2026-09-13
- Repo : LKDV, branche `chantier/itineraire-kits-personnalisation`, HEAD `dc062a9b`
- Serveur : `npm run dev` → http://localhost:4000 (Next.js 15 dev, React 19.0.3)
- Script de capture (jetable, supprimé avant commit) : `scripts/_tmp-key-warning.mjs`
  (Playwright, 4 passes par page : desktop-1440/mobile-390 × authentifié y-demo/anon,
  sur `/hub` et `/hub/itineraire` ; capture `console` warning/error + pile JS du
  `console.error` de React)
- Auth : `y-demo@lekitduvoyageur.fr` + cookie `lkv_active_adventure` (sortie `tour-mont-blanc-refuge`)

## 1. Reproduction (AVANT correctif) — message brut

Le warning se reproduit uniquement sur **`/hub`** (racine du hub), à la fois
authentifié et anonyme, en desktop et en mobile. Il n'apparaît **pas** sur
`/hub/itineraire`. Texte intégral du message React :

```
Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information.

Check the render method of `AppShellDesktop`.  It was passed a child from HubLayout.
```

Pile JS complète du `console.error` React (capturée avant l'interception Next.js),
qui montre le chemin réconciliateur (`warnForMissingKey` → `reconcileChildrenArray`) :

```
Error: key-warning-stack
    at console.error (<anonymous>:8:42)
    at console.error (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/next-devtools/userspace/app/errors/intercept-console-error.js:57:32)
    at eval (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:23764:21)
    at runWithFiberInDEV (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:872:30)
    at warnForMissingKey (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:23763:11)
    at warnOnInvalidKey (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:5722:13)
    at warnOnInvalidKey (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:5743:15)
    at reconcileChildrenArray (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:5803:31)
    at reconcileChildFibersImpl (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:6124:30)
    at eval (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:6229:33)
    at reconcileChildren (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:8783:13)
    at beginWork (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:11129:13)
    at performUnitOfWork (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:15727:22)
    at workLoopConcurrentByScheduler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js:15721:9)
    at performWorkOnRootViaSchedulerTask (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/scheduler/cjs/scheduler.development.js:45:48)
```

Occurrences du warning avant correctif (2 messages identiques) :
`/hub [desktop-1440] auth` et `/hub [mobile-390] auth`.
Warnings/errors console totaux capturés : 42 ; messages contenant « key » : 4
(2 messages React + 2 piles). Aucun warning « key » sur `/hub/itineraire`.

## 2. Identification — fichier:ligne

- Le warning est émis par le réconciliateur React (`warnForMissingKey`), pas par
  `AppShellDesktop` lui-même : il concerne un élément **enfant de la liste**
  passée dans `<main>{children}</main>` — `src/components/shell/AppShellDesktop.tsx:97-99`.
- `returnFiber._debugOwner` = `AppShellDesktop` (le message « Check the render
  method of AppShellDesktop ») et `child._owner` = `HubLayout` (le message « It
  was passed a child from HubLayout »).
- Le seul élément de cette liste créé dans `HubLayout` est l'élément
  `adventureIntelligence` (`<AdventureIntelligenceHub />`), construit à
  `src/app/hub/layout.tsx:45-52` puis injecté dans la liste d'enfants de
  `<AppShellDesktop>` à `src/features/hub/components/HubShell.tsx:292` :

  ```tsx
  {isHubRoot && adventureIntelligence ? adventureIntelligence : null}
  ```

- Confirmation empirique : le warning n'apparaît que sur `/hub` (où
  `isHubRoot` est vrai, donc où cet élément est présent dans la liste) et jamais
  sur `/hub/itineraire` (où le slot vaut `null`). Les 4 autres enfants de la
  liste (`div`, `AdventureSwitcher`, page `{children}`, `NatureSwitcherSheet`)
  sont créés dans `HubShell` et déjà validés par React ; l'élément venu de
  `HubLayout` ne l'était pas.

## 3. Correctif — clé sur l'élément racine venu de HubLayout

Changement unique et minimal (`src/app/hub/layout.tsx`) :

```diff
           adventureIntelligence={
             <AdventureIntelligenceHub
+              key="adventure-intelligence"
               cockpit={intelligence.cockpit}
               sections={intelligence.sections}
               sectionHrefs={intelligence.sectionHrefs}
```

## 4. Vérification (APRÈS correctif)

Même script, mêmes 8 passes (`/hub` et `/hub/itineraire` × desktop/mobile ×
auth/anon) :

```
Messages warnings/errors capturés au total : 38
Messages contenant « key » : 0

## Messages contenant « key » (texte intégral)

_Aucun message console warning/error contenant « key »._
```

- Aucun warning/error « key » sur aucune des pages/passes testées.
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → exit 0 (avertissements préexistants uniquement, 0 erreur).
- `npx vitest run` → 346 suites passées / 4 échouées, uniquement les 4 suites
  préexistantes connues : `a13-backtest-export`, `a14-healthcheck`,
  `a15-rollout`, `phase10-capacity` (2529 tests OK).

Les autres erreurs console constatées (hydratation d'attributs, 404 favicon,
Reduced Motion) sont préexistantes, sans lien avec ce warning, et n'ont pas été
touchées.
