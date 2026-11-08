# Scène atelier — 8 novembre 2026

Branche : `chantier/scene-atelier`. Base : `2a97ca6cb07eda6570679385d9519205f4de2960`.
Worktree : `/Users/fr168256/.codex/worktrees/scene-atelier/lkdv-kit-studio`.
Aucune fusion, publication ni modification du checkout `main`.

## Décor livré

- Mur sans motif ni horizon : gradient vertical entre `LOOK_METAL` et `WOOD_TINT`, couleurs déjà déclarées. Le dessin du ciel, du soleil, des nuages, des crêtes, des sapins et de la prairie est supprimé.
- Établi mat (`roughness: 0.94`), grain fin déterministe, plateau de 12 cm et caisson continu. Profondeur ramenée à 1,8 unité de scène pour montrer le chant avant avec la caméra existante.
- Ombre de contact sur le plan : cœur dense, décroissance progressive et transparente ; dimensions liées à l'encombrement du modèle actif. La couleur vient de `INK`. Elle reste visible quand le budget de la scène coupe les ombres dynamiques.
- Clé de 30° au-dessus de l'horizon, azimut 10°, à `0.8π` avec PMREM ; remplissage doux à l'opposé, hémisphère neutre atténué. `RoomEnvironment` conservé. Choix comparé sur six rendus : élévations 25/30/35° × azimuts 10/35°, puissance constante.
- Les objets de « Sur toi » reposent sur l'établi : leur élévation est calculée d'après le bas de leur géométrie et leur échelle. Les ancres qui orientent la caméra ne changent pas. Aucun changement des formules d'animation.

## Objets signalés sur iPhone

Les objets du catalogue sont construits dans `scene/itemMesh.ts`, puis positionnés par `scene/objects.ts` et `scene/layout.ts`. La disposition héritée `WORN_OFFSETS` les répartissait verticalement autour d'un personnage implicite. La capture supplémentaire `avant-objets.png` reproduit effectivement une casquette et un anneau suspendus ; `apres-objets.png` montre la correction sur le plan.

Les cylindres peuvent être les formes `roll` du duvet, de la tente ou du matelas ; le dôme peut être la casquette (`hat`). Les anneaux existent dans les formes de frontale, lunettes et montre. Ce sont des correspondances de géométrie, **pas une identification certaine des captures de Tony**.

Aucun couple de blocs corail ni anneau bleu identiques aux captures signalées n'a été reproduit dans cette base. Les GLB 15/45 ne contiennent que le corps et l'écusson, sans accessoires de décor. Aucune nouvelle couleur de décor n'est introduite. Le catalogue possède déjà une brique `m-a8443a` pour la trousse de secours ; elle n'a pas été modifiée. L'origine exacte des trois formes signalées reste non établie ; Tony ne dispose pas de l'URL ou du kit correspondant.

## Preuves reproductibles

Depuis ce worktree :

```sh
node scripts/kit-studio/render-scene-atelier.mjs avant
node scripts/kit-studio/render-scene-atelier.mjs apres --matrix
node scripts/kit-studio/assemble-scene-atelier.mjs
```

Le rendu appelle `createKitScene` de production, avec un vrai `WebGLRenderer`, les GLB et textures livrés, les shaders et le PMREM réels. Chromium utilise ANGLE/SwiftShader : WebGL logiciel réel, aucune synthèse d'image. Les PNG sont assemblés avec Sharp, sans retouche du rendu.

Le script charge les sources du décor de la base Git pour « avant » ; les modèles, matériaux et caméras sont communs. Pour les gros plans seulement, une caméra de preuve vise une plage textile du sac. La caméra de production n'est pas modifiée.

La planche est `preuves/scene-atelier/scene-atelier-avant-apres.png` ; la matrice est `scene-atelier-matrice-lumiere.png`. Les captures et les journaux WebGL restent dans le même dossier.

**Présentation validée par Tony :** 45 L seul, 45 L avec M04 fixé sur l'unique ancre façade et M01 posé sur le plan, 15 L seul ; chacun avant/après. Aucun second ancrage n'a été inventé.

## Vérification

- Suite Kit Studio : `npx vitest run src/features/kit-studio/__tests__ --maxWorkers=2` : **473 tests verts** (41 fichiers), dont le test WebGL atlas et le nouveau test du contact géométrique des objets. Le test des objets échouait avant correction : bas à −0,6656 au lieu de −0,8.
- Contre-épreuve : neutralisation temporaire de `onBeforeCompile` dans le worktree, puis exécution du test WebGL. Échec attendu : zéro pixel de tissu changé, contre un minimum attendu de 53 441. Source restaurée intégralement, puis neuf tests atlas verts. Aucun seuil de test n'est modifié.
- Une relance simultanée aux captures WebGL a eu deux échecs (classification pixel vide et modèle encore en chargement). La relance finale limitée à deux workers passe intégralement ; aucun seuil ni délai de test n’a été changé.
- Typage du projet : `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`.
- ESLint ciblé sur les fichiers TypeScript modifiés, et `git diff --check`.

Les fichiers d'apparence du sac (dont `atlas.ts`), les cartes de trame, le sheen, les ancres et modules, les vignettes, les chiffres, la caméra et ses animations sont inchangés. La petite taille du sac dans le cadrage de référence appartient au lot caméra en parallèle.

## Lecture de la planche

La planche et la matrice ont été ouvertes et regardées avant livraison. Le gros plan montre les mailles et leurs reliefs avec un remplissage qui conserve le détail du côté sombre. Sur la plage textile fixe de 210 × 400 pixels, le contraste passe-haut RMS vaut **1,923 avec trame contre 0,169 sans trame**, soit **×11,38** (avant : 2,038 contre 0,514, soit ×3,96). Il s'agit d'une mesure de gros plan, pas d'une garantie de lisibilité au cadrage miniature.

Le sac touche son ombre, le chant avant et le caisson sont visibles, M01 repose sur le plan. Une capture « Sur toi » initiale coupait des objets : leurs positions ont été corrigées et la capture a été refaite. Les petits halos ambre sont les repères de zones hérités, conservés avec le système d'ancres ; ils ne sont pas peints dans le mur.
