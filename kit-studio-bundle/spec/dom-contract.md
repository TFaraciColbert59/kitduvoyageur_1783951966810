# Contrat DOM (à conserver à l'identique)

Le banc de parité et les gestes s'appuient sur ces noms. Les renommer casse la parité.

## Identifiants (52)

`#add`, `#app`, `#cats`, `#coach`, `#coachCap`, `#crail`, `#dayKg`, `#dayLbl`, `#dayRange`, `#dcard`, `#deck`, `#dots`, `#dprogI`, `#grabber`, `#hapticLbl`, `#hcKg`, `#hcName`, `#home`, `#homeCard`, `#hud`, `#hudS`, `#hudT`, `#island`, `#islandDelta`, `#islandFlag`, `#islandFlagN`, `#islandKg`, `#islandName`, `#live`, `#modes`, `#orderBtn`, `#pagerBot`, `#pagerTop`, `#pdotsBot`, `#pdotsTop`, `#peek`, `#peekS`, `#peekT`, `#poInv`, `#poName`, `#rail`, `#ringFg`, `#scene`, `#scrim`, `#sheetBot`, `#sheetTop`, `#stage`, `#sub`, `#subBack`, `#subBody`, `#subT`, `#undo`

## Attributs data-* (16)

`data-act`, `data-bl`, `data-cat`, `data-deck`, `data-dk`, `data-i`, `data-id`, `data-inv`, `data-k`, `data-menu`, `data-mod`, `data-mode`, `data-opt`, `data-part`, `data-pg`, `data-swap`

## Racines et classes d'état

- `#app` reçoit `m-custo` (Apparence) et `m-deck` (paquet de cartes).
- Tiroirs : `.sheet.open`, `.sheet.drag`, `.sheet.subbed`, `.sheet-bottom.tall` ; sous-tiroir `.sub.on`.
- Sélecteurs : `.caps.press` (goutte) et `.caps.drag` (glissé), lentille `.lens` pilotée par `--x`, `--sx`, `--sy`.
- Tuiles : `.tile.cur`, `.tile.off`, `.tile.want`, `.tile.lent`, `.tile.lifting`, `.tile .own`.
- `?debug=1` : `window.__ks` expose exactement les clés de la référence (voir `tests/kit-studio/goldens-script.js`).
