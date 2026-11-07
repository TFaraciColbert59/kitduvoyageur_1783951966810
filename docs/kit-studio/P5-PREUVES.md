# P5 — Preuves du banc de parité Kit Studio

Date des mesures : 7 novembre 2026, 13 h 43 → 14 h 35 (Europe/Paris).
Dépôt : `kitduvoyageur_1783951966810` · branche `chantier/kit-studio-finition` (inchangée) · aucun commit, aucun push.
Environnement : Node 26.8.2, npm 11.19.1, Playwright 1.63.0, `three@0.186.0`, esbuild 0.27.2.
Machine sous charge parallèle (l'autre coéquipier travaille sur `src/`, `src/` n'a pas été touché par cette phase).

Objet de la phase : installer le banc de parité du 7 novembre depuis `kit-studio-bundle/`, l'adapter à three 0.186
(le bundle lit `node_modules/three/build/three.min.js`, supprimé depuis r150), et faire passer les trois portes
de la référence contre elle-même :

1. valeurs du moteur égales aux goldens ;
2. textes égaux entre les deux exécutions ;
3. images : ≤ 1 % de pixels différents (`KS_MAX_DIFF`, seuil du bundle, non modifié).

---

## 1. Installation

Commandes exécutées (copie **sans écraser l'existant** : `--ignore-existing`) :

```bash
mkdir -p tests/kit-studio docs/kit-studio/reference
rsync -a --ignore-existing kit-studio-bundle/tests/kit-studio/ tests/kit-studio/
rsync -a --ignore-existing kit-studio-bundle/reference/kit-studio.html docs/kit-studio/reference/kit-studio.html
rsync -a --ignore-existing kit-studio-bundle/playwright.kit-studio.config.ts playwright.kit-studio.config.ts
```

Fichiers installés (SHA-256, identiques au bundle sauf `parity.spec.ts` adapté) :

```
5cfceb15…c678be  tests/kit-studio/goldens-script.js
1314eaee…476b    tests/kit-studio/goldens.json
dd71aa3d…56aa    tests/kit-studio/parity.spec.ts        (adapté, voir §2)
4dc2f7d3…c41c    tests/kit-studio/reference-texts.json
12326660…f1c    tests/kit-studio/scenario.json
400f1969…6a    playwright.kit-studio.config.ts          (non modifié, sha identique au bundle)
00260a80…944   docs/kit-studio/reference/kit-studio.html (identifié au bundle)
```

Le bundle n'a pas été modifié (contrôle : mêmes SHA-256 dans `kit-studio-bundle/`). `package.json` n'a pas été
modifié (`git diff -- package.json` vide). `test-results/` et `playwright-report/` sont ignorés par git
(`.gitignore` lignes 90-91).

Remarque : `tests/kit-studio/reference-texts.json` est installé mais **n'est lu par aucun test** (`parity.spec.ts`
compare les textes entre les deux exécutions en direct via `S.texts` de `scenario.json`). Constat, pas de correction.

---

## 2. Adaptation three 0.186

### 2.1 Pourquoi

`parity.spec.ts` intercepte le script CDN de la maquette
(`https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js`) et répond avec
`node_modules/three/build/three.min.js`. Or three a supprimé le bundle UMD `build/three.min.js` à partir de r150 :
le dépôt est en `three@0.186.0` et ne livre plus que `three.module.js` / `three.core.js` (vérifié :
`ls node_modules/three/build/` → `three.cjs`, `three.core.js`, `three.module.js`, `three.tsl.js`, `three.webgpu.js`,
`three.webgpu.nodes.js`). La maquette attend un script classique exposant `window.THREE`.

### 2.2 Solution

- `scripts/kit-studio/build-three-iife.mjs` (nouveau, reproductible) : esbuild (présent dans `node_modules` via
  Next/Vite, non ajouté aux dépendances) bundle `three/build/three.module.js` en IIFE
  `--global-name=THREE` → `test-results/kit-studio/three.iife.js` (ignoré par git). Le script contrôle le
  bundle hors navigateur (évaluation `vm` sans DOM) : `THREE` global, `REVISION`, 6 exports critiques.
- `tests/kit-studio/parity.spec.ts` : lit ce bundle au lieu de `three.min.js` (lignes 14-29), et le reconstruit
  automatiquement s'il manque (Playwright efface `test-results/` au début de chaque run, donc le fichier est
  régénéré à chaque exécution — c'est la preuve que la reconstruction fonctionne : elle a eu lieu à chaque run).
  La route `**/three.min.js` injecte ce bundle dans la page, flags de lancement inchangés
  (`--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist --enable-unsafe-swiftshader`).

Sortie brute de la construction :

```
$ node scripts/kit-studio/build-three-iife.mjs
[three-iife] entrée   : node_modules/three/build/three.module.js
[three-iife] sortie   : test-results/kit-studio/three.iife.js (743043 octets, minify=true)
[three-iife] global   : THREE.REVISION=186 (entête=inconnue)
[three-iife] exports  : 444 clés, contrôlées: WebGLRenderer, Scene, PerspectiveCamera, Vector3, Color, MathUtils — OK
[three-iife] esbuild  : 0.27.2
```

### 2.3 Preuve navigateur (THREE global + WebGL)

Sonde Playwright avec la même configuration de contexte que le banc (390 × 844, DPR 2, mêmes flags Chromium,
route d'injection du bundle, `localStorage` de `scenario.json`) : la page de référence expose `THREE` en global,
crée son contexte WebGL2 et rend la scène (sac, ombres, textures, HUD « Tour du Mont-Blanc »). Sortie brute :

```json
{
  "info": {
    "threeType": "object",
    "threeRevision": "186",
    "threeExports": 444,
    "ksKeys": 49,
    "failMessage": null,
    "canvas": { "tag": "CANVAS", "width": 780, "height": 1688 },
    "webgl2": true,
    "rendererVendor": "WebKit",
    "rendererRenderer": "WebKit WebGL",
    "hudT": "Tour du Mont-Blanc"
  },
  "errors": []
}
```

Capture du rendu : `docs/kit-studio/captures/P5-banc-reference-three-186.png` (780 × 1688). À noter que
`ksKeys: 49` = l'API `window.__ks` complète est exposée par la maquette (`?debug=1`), et `failMessage: null`
signifie que le garde `if(!window.THREE){fail();return;}` de la maquette n'a pas été déclenché.

Adaptations `three` dans `parity.spec.ts` (commentaires inclus) :

```ts
// lignes 14-29
const THREE_IIFE = path.join(OUT, 'three.iife.js');
if (!fs.existsSync(THREE_IIFE)) {
  execFileSync(process.execPath, [path.resolve('scripts/kit-studio/build-three-iife.mjs')], { stdio: 'inherit' });
}
const THREE = fs.readFileSync(THREE_IIFE, 'utf8');
```

### 2.4 Limites connues de la maquette sous three 0.186 (constat, pas de correction)

La maquette est écrite pour three 0.149 et emploie des API supprimées depuis :

| Ligne de `reference/kit-studio.html` | API de three 0.149 | État en 0.186 |
| --- | --- | --- |
| 476 | `T.ColorManagement.legacyMode = false` | `legacyMode` supprimé (r150+) ; affectation sans effet |
| 803 | `renderer.outputEncoding = T.sRGBEncoding` | `outputEncoding`/`sRGBEncoding` supprimés (r152+) ; sans effet, `outputColorSpace` par défaut = sRGB |
| 831, 846, 856, 857 | `texture.encoding = T.sRGBEncoding` | `encoding` remplacé par `colorSpace` ; sans effet, textures traitées comme linéaires (rendu légèrement plus sombre que r149) |

Ces trois écarts sont **sans influence sur les portes de cette phase** (référence contre elle-même) : ils sont
identiques des deux côtés. Ils pourraient produire un écart de couleur systématique en passe « application contre
référence » si l'application, elle, règle correctement `colorSpace`/`outputColorSpace` — **non mesuré** à ce stade
(dépend de P1/P3).

---

## 3. Les trois portes — référence contre elle-même

Commande exacte :

```bash
KS_APP_URL=reference npx playwright test -c playwright.kit-studio.config.ts
```

Chromium : pas de téléchargement nécessaire. Playwright 1.63.0 utilise Chrome Headless Shell déjà présent dans
`~/Library/Caches/ms-playwright` (`chromium_headless_shell-1243`) ; les trois runs ci-dessous ont lancé Chromium
sans `npx playwright install`. (Le Chromium « headed » 1243 n'est pas installé ; il ne serait requis que pour un run
avec `headless: false`, que la config du bundle n'utilise pas. `npx playwright install chromium` n'a donc pas été
lancé : aucune preuve de téléchargement.)

### 3.1 Run 1 — sans adaptation de déterminisme : portes passées

Sortie brute (Playwright liste, 1 worker ; `:87`/`:123` = numéros de ligne du fichier avant l'adaptation de
déterminisme du §3.4) :

```
[three-iife] entrée   : node_modules/three/build/three.module.js
[three-iife] sortie   : test-results/kit-studio/three.iife.js (743043 octets, minify=true)
[three-iife] global   : THREE.REVISION=186 (entête=inconnue)
[three-iife] exports  : 444 clés, contrôlées: WebGLRenderer, Scene, PerspectiveCamera, Vector3, Color, MathUtils — OK
[three-iife] esbuild  : 0.27.2

Running 2 tests using 1 worker

(node:83859) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created.)
  ✓  1 tests/kit-studio/parity.spec.ts:87:1 › moteur : valeurs de référence identiques (5.1s)
  ✓  2 tests/kit-studio/parity.spec.ts:123:1 › scénario : textes et images identiques (3.5m)

  2 passed (3.7m)
```

`test-results/kit-studio/ecarts.tsv` du run 1 (brut) :

```
01-accueil	0.00 %
02-zone-principal	0.88 %
03-bilan	0.00 %
04-bilan-pret	0.00 %
05-remplir-carte	0.14 %
06-retour	0.00 %
07-inventaire	0.00 %
08-recherche	0.00 %
09-fiche-objet	0.07 %
10-menu-objet	0.04 %
11-apparence	0.48 %
12-modules	0.00 %
13-ajout-modules	0.00 %
14-corps-bloque	0.00 %
15-corps-28	0.00 %
16-commande	0.00 %
17-precommande	0.00 %
18-confirmation	0.00 %
19-inventaire-one	0.01 %
```

Les trois portes passent : moteur (`expect(got).toEqual(GOLD)` — aucune sortie quand c'est égal), textes
(`expect(A.out[i].t).toEqual(R.out[i].t)` par étape — aucune sortie quand c'est égal), images : maximum
**0,88 %** (02-zone-principal) < 1 %.

### 3.2 Run 2 (répétition du run 1) — échec : la porte image est instable

Sortie brute (extrait) :

```
  ✓  1 tests/kit-studio/parity.spec.ts:87:1 › moteur : valeurs de référence identiques (4.9s)
  ✘  2 tests/kit-studio/parity.spec.ts:123:1 › scénario : textes et images identiques (3.6m)

  1) tests/kit-studio/parity.spec.ts:123:1 › scénario : textes et images identiques › 02-zone-principal

    Error: 02-zone-principal : pixels différents

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 0.01
    Received:    0.021969558877141814

      132 |       const r = diffRatio(R.out[i].png, A.out[i].png, id);
      133 |       report.push(`${id}\t${(r * 100).toFixed(2)} %`);
    > 134 |       expect.soft(r, id + ' : pixels différents').toBeLessThanOrEqual(MAX_DIFF);
          |                                                    ^
    Error Context: test-results/parity-scénario-textes-et-images-identiques/error-context.md
    at /Users/fr168256/Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/tests/kit-studio/parity.spec.ts:134:51

  1 failed
    tests/kit-studio/parity.spec.ts:123:1 › scénario : textes et images identiques ─────────────────
  1 passed (3.7m)
```

`ecarts.tsv` du run 2 (brut) :

```
01-accueil	0.64 %
02-zone-principal	2.20 %
03-bilan	0.08 %
04-bilan-pret	0.80 %
05-remplir-carte	0.24 %
06-retour	0.86 %
07-inventaire	0.00 %
08-recherche	0.07 %
09-fiche-objet	0.36 %
10-menu-objet	0.40 %
11-apparence	0.45 %
12-modules	0.00 %
13-ajout-modules	0.00 %
14-corps-bloque	0.00 %
15-corps-28	0.00 %
16-commande	0.00 %
17-precommande	0.00 %
18-confirmation	0.00 %
19-inventaire-one	0.23 %
```

Les portes 1 et 2 passent encore ; la porte 3 échoue **sur un rendu identique par ailleurs** : c'est du bruit, pas
un écart de contenu. Le seuil n'a pas été touché ; la cause a été cherchée.

### 3.3 Diagnostic du bruit (mesures ponctuelles)

1. **État du moteur identique** : rejouer l'étape 02 deux fois en dumpant tout `window.__ks.S` au moment de la
   capture donne des valeurs **strictement égales** ; l'écart de 2,20 % ne vient donc pas de l'état applicatif.
2. **La page est déterministe à timing fixe** : deux captures de la même page à 200 ms et 1,5 s d'écart → 0,000 % ;
   deux chargements indépendants avec 3 s fixes → 0,000 %.
3. **Le bruit vient des animations d'ambiance dépendantes de l'horloge** : la maquette anime en continu des
   grandeurs en `Math.sin(tNow × …)` — flottement des objets (`reference/kit-studio.html` ligne 1043), halo
   (1049-1051), intensité émissive (1069) — avec un pas de temps plafonné `dt=min(0.05, …)` (ligne 1056). Sous
   charge CPU (l'autre coéquipier compile/teste en parallèle, load average 2,6-6,2 pendant les runs), le nombre de
   frames et le `dt` plafonné diffèrent entre les deux exécutions ; la phase des sinus au moment de la capture
   diffère, d'où quelques milliers de pixels sur les objets 3D.
4. **La maquette honore déjà `prefers-reduced-motion`** : elle coupe le flottement et accélère les amortis
   (`RM` lignes 483, 1043, 1058-1065). Mesure sur les étapes 01/02 rejouées deux fois, sous la même charge :

| réglage | 01-accueil | 02-zone-principal | durée |
| --- | --- | --- | --- |
| `no-preference` (défaut du bundle) | 0,150 % | **2,255 %** | 28 s |
| `reduce` | 0,000 % | 0,004 % | 28 s |

### 3.4 Adaptation de déterminisme (sans toucher au seuil)

`tests/kit-studio/parity.spec.ts` active `prefers-reduced-motion: reduce` dans les contextes de test
(`MOTION`, ligne 43 ; `browser.newContext({ reducedMotion: MOTION })` lignes 97 et 119). Ce n'est pas un seuil :
c'est une entrée standard de la maquette, qui prévoit explicitement ce mode. `KS_MOTION=full` rétablit le
comportement d'origine du bundle. La porte image reste à 1 %, les portes 1 et 2 sont inchangées.

### 3.5 Run 3 — avec l'adaptation de déterminisme : les trois portes passent

Commande identique. Sortie brute complète :

```
[three-iife] entrée   : node_modules/three/build/three.module.js
[three-iife] sortie   : test-results/kit-studio/three.iife.js (743043 octets, minify=true)
[three-iife] global   : THREE.REVISION=186 (entête=inconnue)
[three-iife] exports  : 444 clés, contrôlées: WebGLRenderer, Scene, PerspectiveCamera, Vector3, Color, MathUtils — OK
[three-iife] esbuild  : 0.27.2

Running 2 tests using 1 worker

(node:86784) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created.)
  ✓  1 tests/kit-studio/parity.spec.ts:95:1 › moteur : valeurs de référence identiques (4.8s)
  ✓  2 tests/kit-studio/parity.spec.ts:131:1 › scénario : textes et images identiques (3.3m)

  2 passed (3.4m)
```

`test-results/kit-studio/ecarts.tsv` du run 3 (brut) :

```
01-accueil	0.00 %
02-zone-principal	0.48 %
03-bilan	0.55 %
04-bilan-pret	0.43 %
05-remplir-carte	0.04 %
06-retour	0.45 %
07-inventaire	0.00 %
08-recherche	0.00 %
09-fiche-objet	0.12 %
10-menu-objet	0.13 %
11-apparence	0.87 %
12-modules	0.00 %
13-ajout-modules	0.00 %
14-corps-bloque	0.00 %
15-corps-28	0.00 %
16-commande	0.00 %
17-precommande	0.00 %
18-confirmation	0.00 %
19-inventaire-one	0.00 %
```

Maximum : **0,87 %** (11-apparence) < 1 %. Les trois portes passent. Les numéros de ligne `:95`/`:131` de cette
sortie correspondent au fichier au moment du run ; seuls des commentaires ont été précisés après (aucun changement
de comportement).

Résidu : sous charge CPU, le run complet garde 0,45-0,87 % sur 8 étapes (pulsations sin restantes : halo ligne
1051, `Math.sin(tNow*4)` d'émissivité ligne 1069, non coupées par `reduced-motion`). Sur machine au repos, la
validation du 5 novembre donnait 0,00-0,01 % (`kit-studio-bundle/historique/VALIDATION.txt`). **Non mesuré** :
un run sur machine au repos avec three 0.186 (l'outil P1 tournait pendant toutes les mesures de cette phase).

### 3.6 Goldens

Aucun golden n'a été régénéré : `tests/kit-studio/goldens.json` est bit-identique au bundle
(SHA `1314eaee…476b`), et la porte 1 passe dans les trois runs. Aucun seuil n'a été modifié (`KS_MAX_DIFF`
non défini → 0,01).

---

## 4. Ce qui reste à rejouer contre l'application (après P1/P3)

Commande exacte :

```bash
KS_APP_URL=http://localhost:4000 npx playwright test -c playwright.kit-studio.config.ts
```

La config du bundle (`playwright.kit-studio.config.ts`, non modifiée) lance `npm run dev` comme `webServer`
si `KS_APP_URL` commence par `http://localhost`, attend `KS_APP_URL`, `reuseExistingServer: true` : soit laisser
le dev server tourner sur `:4000`, soit laisser Playwright le démarrer.

État constaté le 7 novembre (lecture seule de `src/`, non modifié) :

- la route livrée est `/kit-studio` (`src/app/kit-studio/page.tsx`) ; **aucune route ni redirection
  `/materiel/studio`** dans `src/` ni `next.config.mjs` (vérifié par grep). Or `parity.spec.ts` construit l'URL
  application `${KS_APP_URL}/materiel/studio?debug=1`. En l'état, la passe application échouerait sur `page.goto`
  ou sur `waitForFunction(window.__ks)` (30 s) ;
- `window.__ks` n'existe nulle part dans `src/` (grep `__ks` : aucun résultat). L'application n'a donc pas, à ce
  jour, la passerelle de debug que la maquette expose en `?debug=1` (49 clés, dont `S`, `kit`, `totals`, `cog`,
  `readiness`, `optList`, `applyOpt`, `loadKit`, `autopack`, `confirmOrder`…).

À fournir par P1/P3 avant de rejouer : la route `/materiel/studio` (ou redirection conservant `?debug=1`) et la
passerelle `window.__ks` en mode debug (contrat de la maquette : `tests/kit-studio/goldens-script.js` et
`kit-studio-bundle/spec/dom-contract.md`). Sinon, la seule alternative est de changer la constante `APP` du banc —
ce n'est pas fait ici (le contrat du bundle est `/materiel/studio`).

Ce qu'il faudra vérifier à ce moment-là :

1. `moteur` : `got` (valeurs lues dans l'application) égal à `goldens.json`. **Attention** : P1 (données réelles)
   et P3 (unification) changeront des valeurs figées par les goldens ; si un golden casse pour une raison
   légitime, le régénérer **et écrire pourquoi** (règle de la phase P5 du bundle), sans jamais forcer un seuil.
2. `scénario` textes : mêmes sélecteurs, mêmes textes que la référence pour les 19 étapes (la vraie donnée peut
   légitimement les changer → alors régénérer la référence textuelle et documenter).
3. `scénario` images : relire `test-results/kit-studio/ecarts.tsv` et comparer au bruit de fond mesuré ici
   (0,00-0,88 % sur cette machine sous charge ; 0,00-0,01 % au repos le 5 novembre). Ne pas interpréter un écart
   < 1 % comme une preuve de fidélité parfaite, ni un échec isolé comme un défaut applicatif sans vérifier la
   charge machine.
4. Vérifier aussi `erreurs de la référence` et `erreurs de l'application` : la porte exige zéro `pageerror` des
   deux côtés.

---

## 5. Risques et points ouverts

1. **Porte image instable sous charge CPU** (mesuré : 0,88 % puis 2,20 % sans adaptation ; 0,87 % avec
   `reduced-motion`). Cause identifiée (animations `tNow`, `dt` plafonné). Mitigation appliquée : `reducedMotion:
   'reduce'` (opt-out `KS_MOTION=full`). Risque résiduel : un run application contre référence sous forte charge
   peut dépasser 1 % pour des raisons de phase d'animation, indépendamment de l'application. Rejouer au repos.
2. **La passe application est bloquée par P1/P3** : route `/materiel/studio` absente et `window.__ks` absent de
   `src/` à ce jour (constat §4). Sans ces deux éléments, le banc ne peut pas comparer l'application.
3. **Goldens à régénérer après P1/P3** (parité pixel et vraie donnée tirent en sens inverse — avertissement du
   bundle) : à faire avec justification, jamais en forçant un seuil.
4. **Pipeline couleur de la maquette dégradé en three 0.186** (`outputEncoding`, `texture.encoding`,
   `ColorManagement.legacyMode` ignorés) : sans effet référence contre elle-même, mais **non mesuré** pour
   application contre référence ; si la passe application est rejetée pour des écarts de couleur diffus, regarder
   ce point en premier.
5. **Chromium** : seul le headless shell 1243 est présent ; un run `headless: false` nécessiterait
   `npx playwright install chromium` (non lancé, non nécessaire au banc).
6. `reference-texts.json` installé mais inutilisé par `parity.spec.ts` (§1) — aucun impact sur les portes.
7. Les artefacts (`test-results/kit-studio/*`, `playwright-report/kit-studio/index.html`) sont ignorés par git et
   effacés/regénérés à chaque run ; `three.iife.js` est reconstruit automatiquement.

---

## 6. Fichiers de cette phase (git)

```
?? docs/kit-studio/reference/kit-studio.html          (copie du bundle)
?? docs/kit-studio/captures/P5-banc-reference-three-186.png
?? docs/kit-studio/P5-PREUVES.md                      (ce fichier)
?? playwright.kit-studio.config.ts                    (copie du bundle, inchangé)
?? scripts/kit-studio/build-three-iife.mjs           (nouveau)
?? tests/kit-studio/                                 (copie du bundle + parity.spec.ts adapté)
```

`git status` complet au moment du rapport : **uniquement les fichiers ci-dessus** (`?? docs/kit-studio/P5-PREUVES.md`,
`?? docs/kit-studio/captures/P5-banc-reference-three-186.png`, `?? docs/kit-studio/reference/`,
`?? playwright.kit-studio.config.ts`, `?? scripts/kit-studio/`, `?? tests/kit-studio/`). L'autre coéquipier (P1) a
commité son travail entre-temps (`35a343a feat(kit-studio): P1 — couche de données réelle branchée`,
`4377b70 fix(kit-studio): P1 — pas de démonstration sur le chemin de production`) ; aucune de ces modifications
n'est de cette phase. Ni `src/`, ni `package.json`, ni `kit-studio-bundle/`, ni `docs/kit-studio/RAPPORT-CHANTIER.md`,
ni `supabase/` n'ont été modifiés par P5.
