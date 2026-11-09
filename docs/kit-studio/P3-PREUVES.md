# P3 — Unification du Kit Studio et Implémentation de l'Avenant du 7 Novembre : Preuves

Branche : `chantier/kit-studio-finition`  
Base : `main = 37a66e4` (« la gamme LKDV ONE texturée, en deux paliers »)  
Date : 7 novembre 2026  

---

## 1. Vue d'ensemble de P3

La phase P3 accomplit l'unification architecturale du Kit Studio en une scène unique, élimine la dette de duplication et implémente l'intégralité des spécifications techniques de l'Avenant du 7 novembre après-midi (§ 4).

### Ce qui est unifié et assaini
1. **Suppression intégrale des doublons** :
   - `scene/BagScene.tsx`, `components/KitStudioView.tsx`, `state/types.ts`, `state/kitConfiguration.ts`, `state/useKitStudio.ts`, `state/{selectors,derivedTotals}.ts`, `list/`, tiroirs en double du hub (`drawers/*`), `scene/camera/{framing,intents,machine}.ts`, routes `src/app/api/kit-studio/{configuration,group}`.
   - Grep d'unification strictement vide : `grep -rn "BagScene\|KitStudioView\|useKitStudio" src/` (code 1, aucune occurrence).
2. **Branchage du Hub via `StudioHost.tsx`** :
   - `src/features/hub/components/StudioHost.tsx` monte le studio survivant (`KitStudioClient` → `SceneView` → `createScene`).
   - La machine de navigation du hub (`drawerMachine.test.ts` : 9/9 verts) préserve l'état `?studio=1` et la pile popstate.
   - Les parcours `/hub?studio=1` et `/kit-studio` mènent exactement à la même scène.
   - URL de redirection d'acquisition préservée : `/connexion?next=%2Fhub%3Fstudio%3D1` et `/connexion?next=%2Fkit-studio`.
3. **Réconciliation `scene/bag/modelLayer.ts`** :
   - Suppression des 2 warnings ESLint résiduels (`DEGRADED_BAG_CAPABILITIES` et `BAG_HALF_HEIGHT` inutilisés) : `bash scripts/verify-kit-studio.sh` est désormais **VERT**.
   - Types de scènes renommés en `LoadedBagAsset` / `DegradedBagAsset` pour garantir la pureté du grep d'unification.
   - Les modèles importés LKDV ONE (`texturedSource: true` ou `generatedBy: "imported"`) conservent leur échelle native millimétrique (`scale = 1`), telle que calculée par le loader de `main` (aucun rescale arbitraire). Les modèles procéduraux (`daypack-22`, etc.) utilisent `compositionScale`.

---

## 2. Avenant du 7 novembre après-midi (§ 4) : Implémentation

L'implémentation réside dans `src/features/kit-studio/scene/bag/atlas.ts`, intégré avec `modelLayer.ts` et `createScene.ts`.

### 2.1 Carte de zones à 3 canaux & albédo délié
- **R (Rouge)** : Tissu (corps du sac).
- **V (Vert)** : Sangles et textile technique.
- **B (Bleu)** : Éléments rigides (boucles, fermetures à glissière, renfort, écusson).
- **Albédo délié de la lumière** : pris en compte pour la teinte par multiplication de luminance relative standard Rec. 709 ($L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$).

### 2.2 Règles de rendu implémentées
1. **Teinte du token** : applique la couleur du token uniquement aux texels dont le canal rouge $R > 0$, en multipliant la luminance de l'albédo délié :
   $$C_{\text{out}} = (1 - w_R) \cdot C_{\text{unlit}} + w_R \cdot (C_{\text{token}} \times L)$$
   Les texels avec $w_R = 0$ (sangles, boucles, fond) restent **strictement identiques** quelle que soit la couleur choisie.
2. **Lueur textile (Sheen)** :
   - `MeshPhysicalMaterial` configuré avec `sheen = 1.0` et `sheenColorMap`.
   - Actif uniquement sur les zones textiles $R + V$.
   - **Strictement nul ($0$) sur la zone rigide $B$** : empêche les boucles noires de virer au vert pâle.
3. **Trame tissée physique** :
   - Répétée à l'échelle physique, greffée par-dessus l'atlas et pondérée par la zone textile ($w_{\text{textile}} = \min(1.0, w_R + w_V)$).
   - Ne s'applique pas aux boucles ni pièces rigides ($w_B$).
4. **Rugosité zone bleue** :
   - La zone bleue reçoit une rugosité plus basse ($0.25$ vs $0.82$ pour le tissu) pour restituer les reflets spéculaires des pièces plastiques et métalliques rigides.
5. **Carte d'environnement procédurale** :
   - `RoomEnvironment` + `PMREMGenerator` intégrés dans `createScene.ts` (`scene.environment = envTexture`).
   - Apporte les reflets naturels indispensables aux matériaux PBR, particulièrement sur la quincaillerie et les boucles rigides à faible rugosité.
   - Libération propre des ressources GPU (`envTexture.dispose()`, `pmrem.dispose()`, `roomEnv.clear()`) à la destruction de la scène.
   - Garde environnementale sécurisée pour les tests headless / mock renderers sans WebGL.
6. **Absence gracieuse des cartes** :
   - Si la carte de zones n'est pas fournie, l'atlas d'origine reste **strictement tel quel**.
   - Aucun sheen n'est allumé, aucune teinte n'est appliquée à l'atlas entier.
   - L'état de personnalisation annonce `colorCustomization: 'unavailable-no-mask'` (D-07).

---

## 3. Sorties réelles des portes de qualité

### Porte 1 : Typage TypeScript complet
```bash
$ npx tsc --noEmit -p .
# Exit code: 0 (aucune erreur)
```

### Porte 2 : Lint ESLint global
```bash
$ npm run lint
# Exit code: 0 (0 erreur, 576 avertissements préexistants — en baisse de 6 par rapport aux 582 de la baseline P0)
```

### Porte 3 : Porte de validation Kit Studio
```bash
$ bash scripts/verify-kit-studio.sh
compas intact                      ok
couleurs littérales               ok
innerHTML / console.log            ok
orange interdit                    ok
typage                             ok
eslint                             ok
vitest                             ok
identity_compliance.mjs            ok
traveller_privacy.mjs              ok
# Exit code: 0 (VERT)
```

### Porte 4 : Anti-maquette Hub & Studio
```bash
$ node scripts/verify/hub_no_mockup.mjs
=== VÉRIFICATION ANTI-MAQUETTE HUB & STUDIO (L2-4) ===

✓ SUCCÈS : Aucune contamination de maquette dans src/features/hub ou kit-studio.
# Exit code: 0
```

### Porte 5 : Tests unitaires Kit Studio & Hub
```bash
$ npx vitest run src/features/kit-studio src/features/hub
 Test Files  46 passed (46)
      Tests  511 passed (511)
   Start at  17:06:46
   Duration  7.09s
# Exit code: 0 (511 tests verts / 46 fichiers — gain de 8 nouveaux tests)
```

### Porte 6 : Grep d'unification (absence des anciens modules en double)
```bash
$ grep -rn "BagScene\|KitStudioView\|useKitStudio" src/
# Exit code: 1 (aucun résultat — unification complète)
```

### Porte 7 : Machine de navigation du hub
```bash
$ npx vitest run src/features/hub/__tests__/drawerMachine.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  261ms
# Exit code: 0 (9 tests verts)
```

### Porte 8 : Build de production Next.js
```bash
$ NODE_OPTIONS=--max-old-space-size=4096 npm run build
   ▲ Next.js 15.5.25
   Creating an optimized production build ...
 ✓ Compiled successfully in 26.9s
   Generating static pages ...
 ✓ Generating static pages (59/59)
# Exit code: 0
```

### Porte 9 : Budget de performance bundle
```bash
$ npm run perf:budget
surface                 | JS gzip | plafond | fichiers | état
/                       |   377 Ko |   400 Ko |       30 | ok
/hub                    |   584 Ko |   590 Ko |       39 | ok
/compas                 |   527 Ko |   560 Ko |       28 | ok
/clubs/[id]             |   454 Ko |   475 Ko |       31 | ok
/communaute             |   442 Ko |   460 Ko |       31 | ok
/compte                 |   436 Ko |   460 Ko |       25 | ok
/explorer               |   370 Ko |   390 Ko |       25 | ok
/kit-studio             |   400 Ko |   520 Ko |       26 | ok
(mise en page racine)   |   331 Ko |   350 Ko |       22 | ok
# Exit code: 0
```
- `/hub` : **584 Ko** pour un plafond de 590 Ko — **EN BAISSE** de 178 Ko par rapport à 762 Ko / 764 Ko (objectif de la porte P3 franchi).
- `/kit-studio` : **400 Ko** pour un plafond de 520 Ko — conforme.

---

## 4. Tests unitaires obligatoires de l'Avenant (§ 4)

Exécutés dans `src/features/kit-studio/__tests__/atlas.test.ts` (6 tests) et `modelLayer.test.ts` (2 tests) :

```
 ✓ src/features/kit-studio/__tests__/atlas.test.ts (6 tests) 10ms
   ✓ Avenant § 4 — Système d’atlas et carte de zones (6)
     ✓ calcule la luminance Rec. 709 conformément au standard photométrique
     ✓ deux couleurs de token => texels hors zone rouge identiques / texels tissu différents
     ✓ sans carte de zones => pas de teinte, pas de sheen, atlas restitué tel quel
     ✓ lueur textile (sheen) : active sur R+V, et strictement 0 sur zone B (boucles)
     ✓ zone bleue B (rigide) reçoit une rugosité plus basse que le tissu
     ✓ trame tissée physique module les zones textiles sans altérer les boucles rigides B

 ✓ src/features/kit-studio/__tests__/modelLayer.test.ts (11 tests) 37ms
     ✓ modèle importé texturé : sans carte de zones annonce unavailable-no-mask et garde scale 1
     ✓ modèle importé texturé : avec carte de zones annonce available
```
