# Inventaire exact de la maquette actuelle (numérotation de `reference/Kit_Studio_actuel.html`)

## Données
| Constante | Ligne | Contenu |
|---|---|---|
| `BAGS` | 535 | `b42` (Corps 42 L, 1 180 g, capacités par zone) et `b28` (Corps 28 L, 900 g) |
| `CW` | 539 | Coloris : `foret`, `sauge`, `pierre`, `nuit` (body, pocket, trim, accent) |
| `PNAME` | 548 | Noms de pièces : all, body, lid, front, sides, hip, harness, webbing |
| `PART_W` | 575 | Poids relatif des pièces |
| `ONE` | 581 | Châssis (189 €, 4 points), corps (b28 119 €, b42 149 €), 6 modules : lid, front, sides, tool, hipp, flask |
| `MODS`, `CWIDS` | 593-594 | Dérivés |
| `OWN`, `ORDER` | 606-607 | Pièces possédées / à commander (Map) |
| `CATN` | 647 | Catégories de personnalisation : shape, mod, col, mat, fin, acc |
| `INV` | 662 | **39 objets** (`I(id, nom, famille, type, forme, volume, poids g, litres, couleur, zones, options)`), 6 familles (Vêtements, Eau & cuisine, Lumière & énergie, Sécurité & soin, Abri & couchage, Orientation & outils) ; compter par script, ne pas se fier à un chiffre écrit |
| `KITS` | 718 | Kits : `tmb` (Tour du Mont-Blanc, 6 jours), `vercors` (Week-end Vercors, 2 jours), `cabine` (Cabine 7 kg, 4 jours) ; `packed`, `slots`, `ctx` |
| `ZONES`, `ZNAME` | 739, 751 | 8 zones : worn, bag, lid, main, front, sides, hip, back (angles caméra) |
| `TEX` | 860 | Textures procédurales (matières) |

## Fonctions clés (à porter dans `domain/` ou `scene/`)
- Calcul : `totals`, `capOf`, `room`, `cog`/`cogState`, `blockers`, `effG`, `bagWeight`, `partW`, `toOrder`, `orderTotal`, `pieces`, `pieceState`, `ptsCap`/`ptsUsed`, `relocate`, `autopack`, `swap…`, `unpack/pack`.
- Scène : `initBag`, `rebuildAll`, `rebuildParts`, `itemMesh`, `rbox`, `ghostMat`, `updateCamera` (l. 1009), `frame` (l. 1056), `damp`.
- Gestes : `canvas` pointer handlers (l. 1346-1407 : orbit, tilt, pull, exit, lift, pinch), `railEl` (l. 1426-1449), `glassSeg` (capsules à lentille), `sheetDrag`.
- UI : `renderRail`, `renderCats`, `renderCRail`, `buildBilanInto`, `openItemInto`, `openBag`, `openOrder`, `startDeck`, `openMenu`, `hud`, `peek`, `showUndo`, `startCoach`.

## Comportements à garder à l'identique
Haptique anti-rebond 40 ms ; déplacement d'un objet vers une zone avec avertissement si la zone est pleine (`room`) et zone alternative proposée ; équilibre « trop loin du dos » ; blocages (veste manquante, trousse périmée, prêt en cours) avec gain de « Prêt à N % » ; rangement automatique ; essai d'une option (appui long) puis garder ou annuler ; mode **Contenu** (objets) et mode **Apparence** (pièces, coloris, modules, accessoires) ; prix en euros et poids en grammes (`g`, `kg` avec virgule française, espace insécable avant `%` et `:`).
