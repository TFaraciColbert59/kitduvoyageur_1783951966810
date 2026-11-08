# Scène atelier — reprise après contrôle, 8 novembre 2026

Branche `chantier/scene-atelier`. Lot initial `4bd0872`, rebasé sur `08993b8` (`origin/main`, incluant le lot caméra `c9104bf`). Le rebase s'est appliqué sans conflit manuel. Aucun changement du checkout `main`, aucune fusion.

## Établi

Le caisson utilise désormais l'encre désaturée du catalogue `m-2c3530`, nettement plus sombre que le mur. Le chant utilise `m-968c81`, distinct du dessus clair. Aucune nouvelle couleur littérale.

L'épaisseur du plateau reste de 12 cm, avec un chanfrein géométrique de 8 mm. Cette petite face inclinée reçoit la clé existante à 30° : arête claire, chant plus sombre, puis caisson sombre. Aucune lumière supplémentaire ; pas de changement de teinte, trame ou sheen du sac.

Le plateau garde ses dimensions 4,6 × 1,8 ; son bord avant est rapproché du sujet (z = 0,24) pour rester visible en vue serrée. Deux emplacements de rangement sont reculés en conséquence. Le test des objets vérifie désormais aussi que leurs boîtes restent entièrement sur le plateau, en plus du contact vertical.

## Rebase et caméra : distinction nécessaire

Les apports de `c9104bf` survivent dans `createScene.ts` :

- `rig.setWorld(... bounds: world.bagModel.getBounds ...)` ;
- les bornes composites incluant les modules ;
- `reducedMotion` transmis à la couche GLB ;
- l'avancement des modules et `attachMoving` dans le maintien de la boucle.

Le décor et la lumière restent dans `workshop.ts`, le mur dans le banc de textures. `camera.ts`, `bag/modelLayer.ts`, `bag/moduleLoader.ts`, `thumbnails.ts` et `bagAnchorsTable.ts` sont identiques à la base `08993b8`.

**Le contrôle réel a révélé un défaut de la caméra c9104bf :** après convergence du zoom, le point visé reste trop haut et le bas du sac est coupé. La cible mêle encore l'ancre du sac procédural et le centre du GLB. Cette reprise ne corrige pas le code caméra, réservé au troisième agent.

La planche est donc explicitement étiquetée **caméra comparative à 78 %** : elle emploie le vrai décor de production, les GLB, les matériaux, les shaders et le PMREM, avec une caméra de preuve recentrée sur les bornes réelles. FOV, orientation et pose sont identiques avant/après pour chaque produit. Le montage sac + M04 tient à 78 % ; le corps seul y occupe 75,83 %. Les 45 L et 15 L seuls ont une hauteur de bornes projetées de 78,00 %.

Les six fichiers `*-camera-production.png` conservent séparément les rendus **sans correction de caméra de preuve**. Ils permettent au troisième agent de reproduire le défaut. La planche comparative ne doit pas être prise pour une validation du cadrage de production actuel.

## Preuves

`preuves/scene-atelier/scene-atelier-avant-apres.png` a été régénérée et regardée :

- 45 L seul, avant/après ;
- 45 L + M04 monté et M01 posé sur le plan, présentation validée par Tony ;
- 15 L seul, avant/après ;
- gros plan tissu, avant/après.

L'« avant » utilise le décor de `08993b8`, et bénéficie donc lui aussi du lot c9104bf. Les couleurs, modèles, matières et caméras de preuve sont communs. Les poses des caméras sont enregistrées dans `avant-webgl.json` et `apres-webgl.json` ; leur égalité a été vérifiée pour les trois vues.

Le nouveau gros plan mesure un contraste passe-haut RMS de **1,793 avec trame / 0,163 sans trame = ×11,01**. L'ancien lot mesurait ×11,38 ; cette valeur historique n'est pas réutilisée comme mesure de la nouvelle capture. La trame de 4,69 mm, le sheen de 0,35, la clé de 30° à 0,8π, le remplissage et RoomEnvironment sont inchangés. La matrice des six lumières du lot initial est conservée et étiquetée comme historique.

Rendu Chromium WebGL/ANGLE/SwiftShader réel, assemblage des PNG par Sharp, aucune synthèse d'image. Le script réveille la scène après chargement GLB et laisse converger la pose avant de capturer.

```sh
node scripts/kit-studio/render-scene-atelier.mjs avant
node scripts/kit-studio/render-scene-atelier.mjs apres
node scripts/kit-studio/assemble-scene-atelier.mjs
```

Les deux gros plans de contrôle permettent de vérifier le tissu indépendamment du cadrage principal. Les halos ambre hérités des zones restent présents ; ils ne sont pas peints sur le mur. L'origine exacte des blocs corail et de l'anneau bleu signalés sur iPhone reste inconnue, faute de kit ou d'URL permettant de les reproduire.

## Vérification après rebase

- 41 fichiers / **473 tests Kit Studio verts**, avec `--maxWorkers=2`.
- Contre-épreuve fraîche : neutralisation temporaire de `onBeforeCompile`, échec attendu du test WebGL (aucun pixel de tissu recoloré). Restauration intégrale de `atlas.ts`, puis **9 tests atlas verts**. Seuils inchangés.
- Typage : `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`.
- ESLint ciblé et contrôle de syntaxe des scripts de preuve.
- Vérification des trois poses de caméras avant/après et de l'occupation projetée.
- Contrôle visuel de la planche avant livraison ; correction du chant après une première capture trop proche du ton du dessus.

La validation du **cadrage de production** demeure à faire lors de la réunion avec le troisième lot. Ni sa caméra, ni les modules, ni les vignettes, ni le tiroir n'ont été modifiés ici.
