# Spécification — moteur 3D et système de matières

Écrit le 7 novembre 2026. Complète le bundle du 5 novembre, qui ne couvre pas ce sujet.

Objectif : qu'un élément modélisé en 3D puisse entrer dans le Kit Studio et recevoir le système de matières complet — trame, relief, matière choisie, couleur choisie — sans retouche manuelle et sans recompilation.

---

## 1. La décision d'architecture, et sa raison

**On garde la géométrie d'un modèle, on jette sa matière.**

Un modèle produit par image-vers-3D (Meshy) arrive avec un atlas de texture où tout est mélangé — tissu, fermetures, sangles, écusson — et un coloris cuit dedans.

Le Studio, lui, laisse choisir **une matière et une couleur séparément**, appliquées à l'exécution. Cuire un coloris obligerait à générer un modèle par combinaison : 5 corps × 5 matières × 8 nuances = **200 modèles**, et supprimerait le changement de couleur en direct, qui est l'intérêt même d'un configurateur.

Donc : les matériaux et les images d'un fichier importé sont **ignorés**. L'apparence vient du code.

Cette décision n'a rien à voir avec le coût des crédits. Elle tient quel que soit le budget.

---

## 2. Les conventions d'UV — le cœur du système

Une trame de tissu doit avoir la **même échelle physique sur tout l'objet**. Un tissu dont le tissage paraît cinq fois plus gros sur le corps que sur une bretelle se voit immédiatement.

La règle : **les coordonnées de texture sont exprimées en mètres.**

Chaque image de matière couvre **100 mm de tissu réel** (`FABRIC_TILE_M = 0.1`). Avec des UV en mètres, la répétition correcte est donc exactement **10** (`FABRIC_REPEAT = 1 / FABRIC_TILE_M`), sans aucun réglage à l'œil.

### 2.1 Comment les UV en mètres sont produites

| Source du maillage | Mécanisme | Fichier |
| --- | --- | --- |
| Générateur paramétrique | `METERS_UV`, passé en `UVGenerator` aux deux `ExtrudeGeometry` | `tools/bag-generator/generate-bag.mjs` |
| Modèle importé (Meshy) | Projection en boîte, atlas d'origine jeté | `tools/bag-generator/import-model.mjs`, fonction `boxProjectUvs` |

`METERS_UV` projette chaque triangle ou quadrilatère sur le plan perpendiculaire à l'axe dominant de sa normale, en mètres. Il existe parce que le générateur par défaut de three n'est en unités du monde que sur les faces avant et arrière : ses « murs latéraux », qui sont ici les **flancs entiers des sacs**, sortaient en 0..1.

Mesure après correction, sur `daypack-22` : les étendues d'UV suivent les dimensions réelles (corps 0,52 pour 0,53 m ; glissière de rabat 0,019 pour une bande fine), là où elles étaient toutes collées autour de 1,0.

### 2.2 Vérification

Les UV sont écrites dans le GLB par `tools/bag-generator/glb-writer.mjs` (attribut `TEXCOORD_0`) et relues par `src/features/kit-studio/scene/bag/loader.ts`. Un test par modèle vérifie que chaque pièce porte un `uv` de la bonne longueur : `src/features/kit-studio/__tests__/loader.test.ts`.

### 2.3 La scène construite par code suit la même convention

`scene/bagBuilder.ts` ne construit que des primitives three (`BoxGeometry`, `CylinderGeometry`,
`CapsuleGeometry`, `TorusGeometry`, `CircleGeometry`), dont les UV sortent normalisées 0..1 : la
tuile s'étirait donc à la taille de la pièce. Mesuré avant correction : 29 mm de tuile sur une
sangle de 0,10 m contre 143 mm sur un corps de 0,50 m, soit **un tissage six fois plus grossier sur
le corps que sur la bretelle**.

Corrigé le 7 novembre (commit `21a4b11`) :

- `scene/uv.ts` expose `uvMeters(geometry)`, qui projette chaque sommet sur le plan perpendiculaire
  à l'axe dominant de sa normale, en mètres. Par sommet et non par triangle, pour rester continu sur
  une surface courbe et correct sur une géométrie indexée.
- **Idempotent** : une géométrie partagée par le `ResourceTracker` repasse par là à chaque
  reconstruction de pièce, et une seconde projection la remettrait à l'échelle une fois de trop.
- `bagBuilder.add()` l'applique aux pièces de rôle `fabric`, les seules qui portent une trame
  photographique.
- `PHOTO_FABRIC_REPEAT` vaut désormais `FABRIC_REPEAT` (10), importé de `bag/fabricMaps.ts` : une
  seule source pour le pas de 100 mm.

Mesure après correction : le rapport grosse pièce / petite pièce passe de 6,2 à **1,31**. Le reste
de l'écart vient des coins arrondis, qui pèsent proportionnellement plus sur une petite pièce.
Six tests le vérifient dans `src/features/kit-studio/__tests__/uv.test.ts`.

**Limite assumée.** Les objets du catalogue (`scene/itemMesh.ts`) partagent leurs géométries par clé
entre objets de tailles différentes — le `ResourceTracker` les réutilise entre la scène et les
vignettes des cartes. Une géométrie partagée n'a pas d'échelle propre, donc elle ne peut pas porter
d'UV en mètres sans casser ce partage. Sur les objets, la trame reste approximative. Y toucher
demanderait de dé-partager les géométries, au prix de la mémoire et des tests de vignettes.

**Non vérifié** : le rendu visuel sur la route réelle, faute des secrets Supabase dans
l'environnement où le correctif a été écrit. La preuve est numérique.

## 3. Les matières

### 3.1 Les fichiers

`public/assets/materials/`, 696 Ko au total, 256 × 256 chacun :

| Fichier | Poids | Rôle |
| --- | --- | --- |
| `cordura-albedo.png` | 39 Ko | carte de détail, niveaux de gris |
| `cordura-normal.png` | 82 Ko | relief, espace tangent |
| `ripstop-albedo.png` / `-normal.png` | 27 / 81 Ko | |
| `xpac-albedo.png` / `-normal.png` | 36 / 96 Ko | |
| `waxed-albedo.png` / `-normal.png` | 40 / 122 Ko | |
| `brushed-pet-albedo.png` / `-normal.png` | 38 / 116 Ko | |

Provenance : relevés de tissu réel (« lot D »), produits à partir de cinq armures — Cordura Classic, Ripstop Grid, X-Pac Diamond, Heritage Canvas, Storm Shield.

### 3.2 La contrainte absolue sur l'albédo

**Les cartes de détail sont neutres et claires.** Elles ne portent aucune couleur : la teinte vient du token, par multiplication `mat.color × mat.map`.

Niveau moyen visé : **235 sur 255**. Ce n'est pas arbitraire. Les textures procédurales d'origine sont de l'encre à faible opacité sur fond blanc, donc proches de 248 ; un albédo PBR autonome sort à 128. Posé tel quel, un albédo à 128 rend **tous les sacs deux fois trop sombres**.

Recette de mise au niveau, appliquée aux cinq : normaliser par la moyenne pour neutraliser le niveau absolu, puis recentrer sur 235 avec une force calculée par tissu pour que le 99,5ᵉ percentile atteigne 255 sans écrêter.

Contrôle : saturation moyenne en HSV **inférieure à 0,02**. Au-delà, la teinte du token est polluée.

### 3.3 Les cartes de relief

Espace tangent, **convention OpenGL (+Y vers le haut)**. Le canal vert vaut `+dy` en espace image, parce que les lignes d'une image descendent alors que la coordonnée V d'OpenGL monte. Aucun `normalScale.y = -1` n'est nécessaire.

**Ne jamais charger une carte de relief en sRGB** : elle porte des vecteurs, pas des couleurs. Le `colorSpace` par défaut d'une `Texture` three convient ; ne pas le forcer.

### 3.4 Les deux bancs de textures

| Scène | Fichier | Interface |
| --- | --- | --- |
| `/kit-studio` | `scene/textures.ts` | `fabric(name)`, `fabricNormal(name)` ; procédural pour `dcf`, `mesh`, `pad`, `web`, `heather`, photographique pour `ripstop`, `cordura`, `xpac`, `waxed` |
| `/hub?studio=1` | `scene/bag/fabricMaps.ts` | `createFabricMapBank(maxAnisotropy)` → `forPreset(id)`, `dispose()` |

Les deux suivent le même principe : **l'image se pose sur la texture dessinée par code une fois chargée**, qui reste donc le repli hors ligne ou si l'asset manque. Rien n'est tenté hors navigateur, pour que les tests et le rendu serveur passent.

Correspondance preset → tissu, dans `fabricMaps.ts` :

```
cordura-matte      → cordura
ballistic-nylon    → cordura      (deux armures toile de nylon lourdes ;
                                   seule la densité les sépare, et elle est
                                   déjà portée par la rugosité du preset)
ripstop-ultralight → ripstop
waxed-canvas       → waxed
recycled-pet       → brushed-pet
```

`dcf` garde son dessin procédural : il n'existe pas de relevé de composite Dyneema, et un polyester à la place serait faux.

### 3.5 Cycle de vie

Un banc de textures naît avec le contexte WebGL et meurt avec lui. Dans `BagScene.tsx`, la création est à côté du `WebGLRenderer` et le `dispose()` dans `cleanupRenderer`. Un test borne le nombre de textures de la banque de `/kit-studio` : `__tests__/scene.lifecycle.test.ts`, plafond 15 (9 tissus + 4 reliefs + panorama + bois).

---

## 4. Faire entrer un élément modélisé

### 4.1 L'outil

```bash
node tools/bag-generator/import-model.mjs \
  --in ~/Downloads/meshy-b45.glb \
  --model-id lkdv-one-45 \
  --label "LKDV ONE 45 L" \
  --height 0.62 \
  --capacity 45 \
  --out ./out
```

Options : `--up y|z` (axe haut du fichier d'entrée), `--yaw <degrés>` (rotation pour mettre la face vers +Z), `--max-tri <n>` (plafond, défaut 40 000).

### 4.2 Ce qu'il fait

1. Lit le GLB sans dépendance (lecteur d'accesseurs intégré, entrelacé géré, accesseurs creux refusés).
2. Fusionne toutes les primitives de toutes les mailles, transformations de nœuds appliquées.
3. Redresse (`--up`), oriente (`--yaw`), met à l'échelle sur la **hauteur réelle du sac** — la seule mesure fiable disponible — puis place l'origine au centre du sol, `y = 0` au fond.
4. Remplace les UV par une projection en boîte en mètres.
5. Écrit le GLB avec `writeGLB`, donc exactement au format que le loader attend.
6. Émet le manifeste et l'entrée d'index au schéma 1.

### 4.3 Garde-fous

- **Refuse** au-delà du plafond de triangles, au lieu de livrer un modèle hors budget. La décimation se fait à l'export amont (Meshy a un réglage de polygones), pas ici.
- **Avertit** si le modèle est plus large et plus profond que haut : un sac à dos ne l'est normalement pas, signe d'un `--up` ou d'un `--yaw` faux.
- **N'annonce rien que le maillage ne porte pas** : `openable: false`, `hasInterior: false`, `badgeAnchors: []`, `attachmentPoints: []`, `slots: []`, une seule pièce `body`. C'est la règle d'honnêteté C-13.

### 4.4 Preuve

`src/features/kit-studio/__tests__/import-model.test.ts` fabrique un GLB avec les défauts typiques d'une sortie image-vers-3D — deux primitives dont une non indexée, transformation de nœud, échelle ×100, cap tourné de 90°, deux matériaux et une image cuits — le passe dans l'importateur, puis le recharge par `loadBagAsset`. L'assertion de cap a été vérifiée discriminante : elle échoue si on retire la correction.

### 4.5 Limite assumée

**Un modèle importé est un objet, pas un assemblage de pièces nommées.** On obtient la silhouette, le volume, la matière et la couleur. On n'obtient pas les insignes sur leurs ancrages, les modules dans leurs slots, ni l'ouverture du rabat : tout cela demande de découper le maillage selon les pièces du manifeste, dans un outil comme Blender.

Le tiroir de personnalisation affiche déjà un état indisponible explicite quand `customizableParts` est vide (contrainte D-07).

### 4.6 Un modèle texturé : la zone tissu

**Décision du 7 novembre 2026, et elle corrige une erreur.** Les modèles Meshy sont désormais
livrés **avec leur texture** : un atlas PBR déplié sur les UV du modèle (`base_color`, `normal`,
`roughness`, `metallic`), dérivé des rendus de référence du lot A.

La raison est simple. Un sac peint d'une couleur unie perd ses boucles noires, ses fermetures,
ses coutures et son écusson : tout disparaît dans la teinte du tissu. Ce n'est pas un défaut
d'éclairage, c'est l'absence de matière. L'atlas les rend.

Cela n'empêche pas le changement de couleur en direct, contrairement à ce qu'on a d'abord cru.
L'atlas sépare déjà les zones : le tissu occupe une plage de teinte étroite, la quincaillerie
est quasi neutre et sombre. Le travail à faire :

1. **Dériver un masque de tissu** par sac, une fois, hors ligne, depuis l'albédo livré : blanc là
   où c'est du tissu, noir ailleurs. Le masque est rangé à côté du GLB et versionné avec lui.
2. **Teinter la seule zone masquée** au rendu, en préservant la variation de luminance de l'atlas
   — la couleur du token multiplie la luminance, elle ne la remplace pas. Les boucles, les
   fermetures et l'écusson gardent leurs couleurs propres.
3. **La matière choisie** (ripstop, Cordura, XPac, toile cirée, PET recyclé) s'applique dans cette
   même zone, par-dessus l'atlas, avec la convention d'UV en mètres du § 2.

Un modèle par sac suffit donc pour toutes les nuances. Ce qui était redouté — 5 corps × 5 matières
× 8 nuances = 200 modèles — n'arrive pas.

**Garde-fou.** Tant que le masque d'un sac n'existe pas, ce sac s'affiche avec son atlas tel quel
et la personnalisation de couleur est annoncée indisponible pour lui, comme pour `customizableParts`
vide. Jamais de teinte appliquée à l'atlas entier : c'est précisément le défaut qu'on corrige.

---

## 5. Ce qui n'existe pas encore

### 5.1 Aucun chemin d'ingestion pour les modules et les objets

`scene/itemMesh.ts` construit **tous** les objets du catalogue par code : 53 objets répartis sur 19 formes (`roll`, `shoe`, `hat`, `jacket`, `sack`, `stove`, `bottle`, `bladder`, `lamp`, `box`, `phone`, `laptop`, `watch`, `map`, `poles`, `knife`, `glasses`, `blanket`, `tube`). Les géométries sont partagées par clé dans le `ResourceTracker`, et réutilisées par la scène **et** par les vignettes des cartes.

Les seuls GLB du dépôt sont les 5 sacs. Importer des maillages de modules demanderait du code neuf : manifeste de module, chargeur d'objets, logique d'accroche, et une migration des vignettes.

### 5.2 Le piège de cohérence visuelle

Si les 20 modules LKDV ONE deviennent des maillages photoréalistes et que les 53 autres objets restent des primitives abstraites, le studio sera **visuellement incohérent** : des modules vrais posés à côté de boîtes schématiques.

Ce n'est pas un problème technique mais une décision de direction artistique. Trois sorties : modules seuls en maillage et l'écart assumé ; tout garder procédural et réserver les maillages aux fiches produit et à la marketplace ; ou remonter les 19 formes, beaucoup plus de travail. **Cette décision appartient à Tony.**

---

## 6. Budgets et dégradation

| Contrainte | Valeur | Vérification |
| --- | --- | --- |
| Triangles par modèle | ≤ 40 000 | `bags.index.json`, champ `valid` ; refus de l'importateur |
| Poids par modèle | ≤ 900 Ko | idem |
| JS de la route `/kit-studio` | ≤ 520 Ko gzip (actuel : 397) | `npm run perf:budget` |
| Mémoire vidéo des matières | 10 cartes en 256², ≈ 3,5 Mo avec mipmaps | — |
| Contexte WebGL | **un seul vivant** | `WebGLArbiter`, ADR-002 |

Cible conseillée pour un modèle importé : **15 000 à 20 000 triangles**, pas 40 000, pour garder de la marge quand plusieurs objets chargent ensemble.

Dégradation, déjà en place et à ne pas casser : une seule tentative de restauration après perte de contexte, puis mode dégradé ; `prefers-reduced-motion` respecté ; repli SVG pour les vignettes ; une matière dont l'image ne charge pas garde son aspect uni, avec la bonne couleur.

---

## 7. Non négociables

1. Pas de coloris cuit **dans la géométrie**. Un modèle importé porte son atlas PBR (§ 4.6) ;
   la couleur choisie teinte la seule zone tissu de cet atlas, et ne touche ni la quincaillerie,
   ni les fermetures, ni l'écusson. Une teinte appliquée au modèle entier est un défaut, pas une
   option.
2. UV en mètres. Toute géométrie neuve respecte la convention, ou documente pourquoi non.
3. Aucune couleur littérale nouvelle dans le code. `rgb(128, 128, 255)` dans `textures.ts` est l'encodage du vecteur (0, 0, 1), pas une couleur de charte, et c'est commenté comme tel.
4. Un manifeste n'annonce que ce que le maillage porte.
5. Les cartes de relief ne sont jamais chargées en sRGB.
6. Un seul contexte WebGL vivant.
7. `three@0.186.0`. **Ne pas suivre l'instruction du bundle de rétrograder en 0.149.0** : le studio livré et la scène du hub sont écrits pour 186.
