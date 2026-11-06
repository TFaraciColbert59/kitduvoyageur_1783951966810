# Revue indépendante — Kit Studio v2 (T22)

`npx tsc -p tsconfig.kit-studio.json` : 0 erreur (vérifié).

## BLOQUANTS

- `src/features/kit-studio/ui/KitStudioClient.tsx:122` — `<CardsSlot />` monté sans aucune prop : `projectZone`, `highlightZone` et `onAdd` (`cards/CardsView.tsx:32-36`) ne sont jamais fournis ; la carte « Ajouter » (`cardsData.ts:88`) est un bouton mort, le vol carte→sac et l'éclairage de zone ne partent jamais, et `zone` reste figé à `'bag'` — exposer la `KitScene` (ref/contexte) depuis `SceneView` et passer les quatre props.
- `src/features/kit-studio/scene/thumbnails.ts:562` — `disposeThumbnailEngine()` n'a aucun appelant : le singleton garde son contexte WebGL, son canvas 512², ses géométries/textures partagées et ses Blob URLs après la sortie de /kit-studio — l'appeler dans le cleanup de `scene/SceneView.tsx:38-44` (et non au démontage d'une carte).

## IMPORTANTS

- `src/features/kit-studio/ui/SheetHost.tsx:94` (idem `:120`) — `apply(n as KitState)` sur l'union `KitState | ItemIntent | BilanIntent` : aucune garde runtime, une intention non traitée est écrite comme état et persistée — `switch` exhaustif sur `n.type` + garde `isKitState` (`'version' in n`) avant `apply`.
- `src/features/kit-studio/services/kitRepository.ts:65` — un état stocké incomplet (record `packed` exigeant toutes les zones, `schema.ts:51`) ou `day > days` (`schema.ts:76`) est rejeté et `load()` rend `null` : retour silencieux à l'état initial, sans log ni migration — `z.partialRecord` sur `packed`, clamper `day`, et tracer le rejet.
- `src/features/kit-studio/domain/totals.ts:151` — `buy`/`rent` sont en euros flottants quand `orderTotalCents` (`order.ts:26`) est en centimes et `formatEuro` (`format.ts:28`) attend des centimes : la conversion `*100` est répétée à la main (`BilanSheet.tsx:202`, `ItemSheet.tsx:83`, `BagSheet.tsx:63`, `cardsData.ts:121`), un oubli vaut ×100 — exposer `buyCents`/`rentCents` et convertir une seule fois.
- `src/features/kit-studio/ui/sheets/DeckSheet.tsx:72` — `window.setTimeout(…, 240)` non annulé au démontage : après une sortie (Échap), `onDeck(decide(…))` s'applique encore et écrase le deck — stocker l'id et le `clearTimeout` dans un cleanup.
- `src/features/kit-studio/scene/SceneView.tsx:36` — un `ResizeObserver` + `window.resize` en plus de ceux de `createScene.ts:347` : `applyViewport()` tourne trois fois par redimensionnement — garder le seul observateur interne à la scène.
- `src/features/kit-studio/ui/cards/CardsView.tsx:91` — `timers.current.push()` sans purge : la liste grandit à chaque refus/atterrissage pendant toute la session — filtrer après exécution ou ne garder que le dernier id par clé.

## MINEURS

- `src/features/kit-studio/ui/kit-studio.css:365-368` — second `.ks-caps button::after { inset: -10px 0 }` qui écrase `left: 50%` de la règle 335 : la cible 44 px est décalée de 22 px vers la gauche et chevauche le bouton voisin ; avec `Capsule.tsx:26` (`bw = 38` au-delà de 4 items) elle repasse sous 44 px — supprimer la règle 365 et forcer 44 px de large.
- `src/features/kit-studio/ui/Drawer/Grab.tsx:66-75` — `Grabber` 140 × 30 px : cible sous 44 px de haut, contrairement à `.ks-grab` qui s'étend par `::after` — ajouter la même extension.
- `src/features/kit-studio/scene/thumbnails.ts:394-401` — `cleanup()` dispose les matériaux deux fois (tableau `mats` puis `traverse`) — supprimer la boucle `mats`, le `traverse` suffit.
- `src/features/kit-studio/ui/Thumb.tsx:23-24` — `registerThumbBuilders()` est rappelé à chaque montage de carte — garde d'idempotence au niveau module.
- `src/features/kit-studio/store/kitStore.ts:144` — `toggleModule` renvoie `reason: 'points'` aussi quand rien ne change (module déjà dans l'état visé) — distinguer `'points'` de `'noop'`.
- `src/features/kit-studio/ui/sheets/OrderSheet.tsx:97-99` — état local `own` doublé avec la prop contrôlée `page` : les deux divergent dès que l'appelant pilote la page — `useState(page ?? 0)` ou suppression du state local.
- `src/features/kit-studio/domain/balance.ts:34` — `cog()` divise par `M` sans garde : `M = 0` (sac sans pièce pesée) donne `NaN`, propagé dans le SVG `BalanceChart` — `M || 1` ou retour `{0,0,0}`.
- `docs/kit-studio/A11Y-CHECKLIST.md:14` — périmé : déclare que cartes, bilan, fiche, commande et deck n'existent pas alors qu'ils sont livrés (T18b/T19) et que `pillLabel` n'est pas branché — repasser la checklist sur l'arbre courant.
