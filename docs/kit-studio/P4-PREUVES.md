# P4 — Fermer la dette de la revue indépendante T22 : preuves

Branche `chantier/kit-studio-finition`, arbre au commit `b34d114` (« réconciliation rebase main »), 7 novembre 2026.
Les correctifs de code P4 sont dans le commit de sécurisation `dbe4aac` (WIP P3 + P4, arbre propre à la reprise) ; ce document est le commit path-scoped de P4. Aucun `npm run build` n'a été lancé (laissé au Lead pour P6), aucune branche changée, aucun push.

Références : `docs/kit-studio/REVIEW.md` (T22), `kit-studio-bundle/CHANTIER-AUTONOME.md` §P4, `CLAUDE.md` §4 (cibles tactiles ≥ 44 px), `docs/kit-studio/P1-PREUVES.md` (état d'entrée).

## Vue d'ensemble (9 items)

| # | Item REVIEW | État à la reprise | Action P4 |
| --- | --- | --- | --- |
| 1 | `domain/totals.ts:151` buy/rent en euros, 4 `×100` manuels | ouvert | **corrigé** : `buyCents`/`rentCents` + `toCents()`, 4 sites convertis |
| 2 | `domain/balance.ts:34` `cog()` sans garde M=0 → NaN | déjà conforme (T23) | vérifié, verrouillé par test |
| 3 | `ui/kit-studio.css:365-368` cible capsules décalée / < 44 px | déjà conforme (T23) | vérifié, verrouillé par test |
| 4 | `scene/thumbnails.ts:394-401` dispose des matériaux deux fois | déjà conforme (T23) | vérifié, verrouillé par test |
| 5 | `ui/Thumb.tsx:23-24` `registerThumbBuilders()` à chaque montage | ouvert (module de builders idempotent, pas l'appel) | **corrigé** : garde module dans `Thumb.tsx` |
| 6 | `store/kitStore.ts:144` `reason: 'points'` même sans changement | ouvert | **corrigé** : `'noop'` distinct de `'points'` |
| 7 | `ui/sheets/OrderSheet.tsx:97-99` état local `own` doublé avec `page` | ouvert | **corrigé** : hook page contrôlée/non contrôlée |
| 8 | `ui/Drawer/Grab.tsx:66-75` `Grabber` 140 × 30, cible < 44 px de haut | déjà conforme (T23) | vérifié, verrouillé par test |
| 9 | `docs/kit-studio/A11Y-CHECKLIST.md:14` checklist périmée | partiellement périmé | **corrigé** : repassée sur l'arbre courant |

Les items 2, 3, 4 et 8 étaient **déjà conformes dans l'arbre de base** (fermés par T23 mais encore listés dans REVIEW.md / CHANTIER) : ils n'ont pas été « re-corrigés » ; ils sont vérifiés ci-dessous et verrouillés par un test de non-régression, pour que la dette ne puisse plus se rouvrir sans test rouge.

Tests de non-régression : `src/features/kit-studio/__tests__/p4.debt.test.tsx` (24 tests) et `src/features/kit-studio/__tests__/p4.thumb.test.tsx` (1 test). Aucun test existant n'a été affaibli ni modifié pour P4.

---

## 1. `domain/totals.ts` — centimes exposés, plus de conversion manuelle

**Constat T22** : `buy`/`rent` en euros flottants alors que `orderTotalCents` (`domain/order.ts:26`) et `formatEuro` (`domain/format.ts:28`) travaillent en centimes ; la conversion `×100` était répétée à la main en 4 points, un oubli valant ×100 sur un prix affiché.

**Correctif**
- `src/features/kit-studio/domain/totals.ts:20` : `toCents()` — seule conversion euros → centimes du domaine (`Math.round(eur * 100)`), documentée.
- `src/features/kit-studio/domain/totals.ts:45,47,183` : `Totals` expose `buyCents` / `rentCents`, calculés une seule fois dans `totals()` (`buyCents: toCents(buy)`, `rentCents: toCents(rent)`). `buy`/`rent` restent exposés pour compatibilité et pour les tests de valeurs.
- Les 4 sites d'affichage ne multiplient plus à la main :
  - `ui/sheets/BilanSheet.tsx:199-203` : `t.buyCents` / `t.rentCents` passés directement à `formatEuro`.
  - `ui/sheets/ItemSheet.tsx:84-85,213` : `toCents(ex.eur ?? 0)`, `toCents(ex.day ?? 0)`, `toCents(price)` et `toCents(price / it.trips)`.
  - `ui/sheets/BagSheet.tsx:64,110` : `toCents(pieceInfo(key).eur)`, `toCents(M.eur)`.
  - `ui/cards/cardsData.ts:123` : `formatEuro(toCents(M.eur))`.
- Vérification grep : plus aucun `eur * 100`, `day * 100`, `price * 100`, `M.eur * 100`, `t.buy * 100`, `t.rent * 100` hors `domain/totals.ts:21` (`toCents`) et `domain/order.ts:24` (`cents` privé préexistant, fichier P3, non modifié).

**Test ajouté** (`p4.debt.test.tsx`) :
- « totals() expose buyCents/rentCents : une seule conversion, arrondie une fois » — achat 149 € → 14 900 c, location 25 €/j × 6 j = 150 € → 15 000 c ; état vide → 0/0 (jamais NaN).
- « toCents est la seule conversion euros → centimes (arrondi au centime) » — 149 → 14900, 24,999 → 2500, 0 → 0.
- « BilanSheet affiche 149 €, pas 14 900 € » — rend la feuille Bilan avec une pièce à acheter (149 €) et une à louer (25 €/j) : le texte contient `À acheter : 149 €` / `À louer : 150 € pour 6 jours`, jamais `14 900` ni `15 000`.
- « ItemSheet affiche le prix de l'objet planifié, pas ×100 » — notes de fiche : `Boutique LKDV · 149 €`, `Location entre membres · 25 € par jour`.
- « ItemSheet page Histoire : prix d'achat en euros converti une fois » — `149 €`, jamais `14 900`.
- « BagSheet affiche le prix d'une pièce à commander, pas ×100 » — `À commander · 149 €`, jamais `14 900`.
- « cardsData affiche le supplément d'un module en euros, pas ×100 » — pour chaque carte d'option payante, `sub === '+<formatEuro(toCents(mod.eur))>'` (un `M.eur * 100` produirait « +18 900 € »).

---

## 2. `domain/balance.ts:34` — `cog()` jamais NaN (déjà conforme, verrouillé)

**État dans l'arbre** : `src/features/kit-studio/domain/balance.ts:34-35` contient déjà la garde `if (!(M > 0)) return { x: 0, y: 0, z: 0 };` (fermée par T23). Non modifié en P4.

**Test ajouté** (`p4.debt.test.tsx`) :
- « reste fini sur tous les kits et tous les jours » : `cog()` fini (x, y, z) pour `tmb` (6 j), `vercors` (2 j) et `cabine`.
- « sac sans pièce pesée (masse nulle) : retour {0,0,0}, jamais NaN » : le catalogue livré ne peut pas produire `M = 0` (tous les corps pèsent ≥ 900 g), la précondition de la revue est donc **simulée** en neutralisant `bagWeight` (`vi.doMock`) sur un état sans aucun objet rangé ; le test échoue sans la garde (0/0 = NaN) et passe avec elle. Ce contournement est documenté dans le test.
- « BalanceChart (SVG) ne reçoit jamais NaN, même pour un centre de gravité nul » : rendu statique du SVG avec `{x:0,y:0,z:0}` puis avec le `cog` réel du kit TMB ; la sortie ne contient jamais `NaN`.

---

## 3. `ui/kit-studio.css:365-368` — cible tactile des capsules ≥ 44 px (déjà conforme, verrouillé)

**État dans l'arbre** : la seconde règle fautive `.ks-caps button::after { inset: -10px 0 }` n'existe plus. La règle unique (`src/features/kit-studio/ui/kit-studio.css:344-353`) est centrée (`left: 50%` + `transform: translate(-50%, -50%)`) et dimensionnée `width: max(44px, var(--bw, 44px)); height: 44px`. `Drawer/Capsule.tsx:26` réduit le visuel à 38 px au-delà de 4 éléments : `max(44, 38) = 44`. Non modifié en P4.

**Test ajouté** (`p4.debt.test.tsx`) :
- « une seule règle ::after, centrée, et elle n'écrase plus left: 50% (pas d'inset -10px 0) » : exactement 1 règle `.ks-caps button::after`, contenant `left: 50%`, `translate(-50%, -50%)`, `width: max(44px, var(--bw, 44px))`, `height: 44px` ; aucune occurrence de `inset: -10px 0` dans le fichier.
- « 5 éléments (--bw = 38 px) : la largeur de cible reste max(44, 38) = 44 px » : vérifie que `Capsule.tsx` passe bien `--bw` à 38 px au-delà de 4 éléments et que le plancher CSS est 44 px.
- **Limite documentée, pas de test truqué** : jsdom ne calcule aucune géométrie (`clientWidth = 0`, pas de moteur CSS), une mesure de layout réelle n'y est pas fiable. Le test verrouille donc la règle qui garantit les 44 px ; la mesure pixel réelle reste couverte par le banc Playwright WebKit existant (`tests/e2e-kit-studio/kit-studio.spec.ts`), hors portes unitaires.

---

## 4. `scene/thumbnails.ts:394-401` — un seul dispose par matériau (déjà conforme, verrouillé)

**État dans l'arbre** : `cleanup(object)` (`src/features/kit-studio/scene/thumbnails.ts:390-398`) ne fait plus que `object.traverse(...)` : une géométrie non partagée est disposée, chaque matériau privé est disposé une fois ; aucune boucle `mats` parallèle. Non modifié en P4.

**Test ajouté** (`p4.debt.test.tsx`) :
- « un seul dispose par matériau après le rendu (traverse suffit, pas de boucle mats) » : moteur de vignettes réel (`createThumbnailEngine`) avec faux renderer ; le constructeur crée 2 maillages et 2 matériaux privés ; un compteur écoute l'événement `dispose` de three sur chaque matériau. Après rendu : **1 dispose par matériau** (`[1, 1]`). Une double libération (boucle + traverse) compterait 2 et ferait échouer le test.

---

## 5. `ui/Thumb.tsx:23-24` — `registerThumbBuilders()` idempotent (corrigé)

**Constat T22** : `registerThumbBuilders()` était rappelé à **chaque montage de carte**.

**Correctif** : `src/features/kit-studio/ui/Thumb.tsx:19-36` — garde d'idempotence au niveau module (`let buildersRegistered = false`), posée **avant** le second import dynamique ; `sharedEngine()` n'enregistre les constructeurs qu'une fois par session, quel que soit le nombre de cartes montées. (Le module `scene/thumbBuilders.ts` garde sa propre garde d'idempotence.)

**Tests ajoutés** :
- `p4.debt.test.tsx` : « deux appels n'enregistrent chaque constructeur qu'une fois (garde de module) » — `scene/thumbBuilders` importé avec `registerBuilder` espionné : 3 appels de `registerThumbBuilders()` → exactement 2 enregistrements (`i` puis `b`).
- `p4.thumb.test.tsx` : « deux montages successifs de carte : un seul registerThumbBuilders » — composant `Thumb` réel avec moteur et enregistreur mockés : 2 montages successifs → 2 demandes de moteur mais **1 seul** `registerThumbBuilders()`. (Deux cartes montées simultanément demandent deux imports dynamiques concurrents du module mocké ; le second ne se résout pas dans Vitest — limite de l'outil, pas du composant — d'où le rejeu séquentiel du scénario « à chaque montage ».)

---

## 6. `store/kitStore.ts:144` — `'noop'` distinct de `'points'` (corrigé)

**Constat T22** : `toggleModule` renvoyait `reason: 'points'` même quand rien ne changeait (module déjà dans l'état visé).

**Correctif** : `src/features/kit-studio/store/kitStore.ts:201-209` — le domaine renvoie le **même état** pour deux causes (déjà dans l'état visé, ou points insuffisants) ; le store les distingue avec `modOn(cur, m) === on` : `'noop'` sinon `'points'`. Le succès renvoie `{ ok: true }` sans `reason`. Import `modOn` ajouté depuis `domain/parts` (lecture seule).

**Tests ajoutés** (`p4.debt.test.tsx`) :
- « module déjà dans l'état visé : reason « noop », pas « points » » — état inchangé (même référence), `canUndo` reste faux (aucune sauvegarde ni entrée d'annulation).
- « points d'attache insuffisants : reason « points » » — même montage que les tests de feuilles (corps b28 saturé, module refusé).
- « module disponible : bascule effective, pas de reason » — désactivation puis réactivation d'un module actif : `{ ok: true }` et état effectivement modifié.

---

## 7. `ui/sheets/OrderSheet.tsx:97-99` — plus de doublon état local / prop `page` (corrigé)

**Constat T22** : état local `own` doublé avec la prop contrôlée `page` ; les deux divergent dès que l'appelant pilote la page.

**Correctif** : `src/features/kit-studio/ui/sheets/OrderSheet.tsx:62-77,114` — hook exporté `useControlledPage(page, onPageChange)` : la prop `page` pilote si elle est fournie (l'état local n'est alors ni lu ni écrit), sinon l'état local porte la page et est initialisé depuis `page ?? 0`. `OrderSheet` l'utilise (`const [p, setPage] = useControlledPage(page, onPageChange)`); comportement conservé (mêmes pages, mêmes libellés, même `onPageChange`).

**Tests ajoutés** (`p4.debt.test.tsx`) :
- « non contrôlé : l'état local porte la page et notifie l'appelant » — 0 → 2, `onPageChange(2)`.
- « contrôlé : la prop pilote toujours la page, l'état local ne diverge pas » — page=1, `setPage(0)` → la page affichée reste 1 (l'ancien doublon retombait sur l'état local), `onPageChange(0)` appelé, puis `page=2` suit, puis retour en non contrôlé sans revenir à 0.
- « OrderSheet passe la page contrôlée au Pager » — rendu avec `page={1}` : le `Pager` reçoit bien `scrollTo({ left: 1 × largeur })`, preuve que c'est la prop qui pilote.

---

## 8. `ui/Drawer/Grab.tsx:66-75` — cible du `Grabber` ≥ 44 px (déjà conforme, verrouillé)

**État dans l'arbre** : `Grabber` (bouton flottant 140 × 30 px) possède déjà l'extension tactile `::after` : `src/features/kit-studio/ui/kit-studio.css:178-186` (`height: 44px`, `top: 50%`, `translateY(-50%)`, pleine largeur du bouton), comme `.ks-grab`. Non modifié en P4.

**Test ajouté** (`p4.debt.test.tsx`) :
- « le bouton visuel fait 30 px de haut mais son ::after étend la cible à 44 px » : `.ks-grabber` a `height: 30px`, `.ks-grabber::after` a `height: 44px` centré (`top: 50%`, `translateY(-50%)`), valeur numérique ≥ 44, et `Drawer/Grab.tsx` porte bien `className="ks-grabber"`.

---

## 9. `docs/kit-studio/A11Y-CHECKLIST.md:14` — checklist repassée sur l'arbre courant (corrigé)

**Constat T22** : la checklist déclarait périmés les constats « cartes, bilan, fiche, commande et deck n'existent pas » et « `pillLabel` n'est pas branché ».

**Correctif** : `docs/kit-studio/A11Y-CHECKLIST.md` réécrit sur l'arbre `b34d114` :
- pages livrées et montées : cartes (`ui/cards/CardsView.tsx:58` via `ui/KitStudioClient.tsx:212`), Bilan, Fiche, Sac, Commande, deck via `ui/SheetHost.tsx:64-152` ;
- `pillLabel()` (`ui/strings.ts:43`) est branché sur la pilule (`ui/KitStudioClient.tsx:177`) ;
- `S.a11y.bag3d` est consommé par le canvas `role="img"` de `scene/SceneView.tsx:49` ;
- cibles tactiles : capsules 44 px même à 5 éléments (`ui/kit-studio.css:344-353`), `Grabber` 44 px (`ui/kit-studio.css:178-186`), poignée 44 px (`ui/kit-studio.css:282-286`) ;
- toutes les références `fichier:ligne` renumérotées sur l'arbre courant ; les points non vérifiés (contraste AA mesuré, ordre de focus dépendant de l'intégration) restent explicitement non cochés, avec la note.

**Tests ajoutés** (`p4.debt.test.tsx`, bloc P4.9) :
- « les constats périmés de la revue ne sont plus écrits » ;
- « pillLabel et le libellé 3D sont déclarés branchés » ;
- « toutes les références fichier:ligne pointent vers un fichier existant et une ligne réelle » (garde-fou anti-dérive : chaque référence doit exister et rester dans le fichier).

---

## Portes — sorties réelles

### Tests de non-régression P4

```
$ npx vitest run src/features/kit-studio/__tests__/p4.debt.test.tsx src/features/kit-studio/__tests__/p4.thumb.test.tsx
 ✓ src/features/kit-studio/__tests__/p4.thumb.test.tsx (1 test)
 ✓ src/features/kit-studio/__tests__/p4.debt.test.tsx (24 tests)

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

Détail des 25 tests (sortie verbose, extrait) : chaque point ci-dessus est coché par au moins un test nommé `P4.<n> — …` (P4.1 ×7, P4.2 ×3, P4.3 ×2, P4.4 ×1, P4.5 ×2, P4.6 ×3, P4.7 ×3, P4.8 ×1, P4.9 ×3).

### Suite kit-studio + hub (complète)

```
$ npx vitest run src/features/kit-studio src/features/hub
 Test Files  45 passed (45)
      Tests  503 passed (503)
```

Aucun test rouge. Aucun test existant affaibli ou supprimé par P4 (P4 n'ajoute que les 2 fichiers de test ci-dessus ; les suppressions de tests observées dans la branche sont celles de P3, hors périmètre P4).

### Typage

```
$ NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit -p .
TSC_EXIT=0
```

### Lint

```
$ npm run lint
LINT_EXIT=0
WARNINGS=578
ERRORS=0
```

582 warnings préexistants au départ de P0 ; 578 à cette étape (les suppressions P3 en retirent, P4 n'en ajoute aucun). Vérifié fichier par fichier : `domain/totals.ts`, `store/kitStore.ts`, `ui/Thumb.tsx`, `ui/sheets/OrderSheet.tsx`, `ui/sheets/BilanSheet.tsx`, `ui/sheets/ItemSheet.tsx`, `ui/sheets/BagSheet.tsx`, `ui/cards/cardsData.ts`, `p4.debt.test.tsx`, `p4.thumb.test.tsx` → **0 warning**.

### Porte `scripts/verify-kit-studio.sh`

```
$ bash scripts/verify-kit-studio.sh
GATE_EXIT=1
compas intact                      ok
couleurs littérales               ok
innerHTML / console.log            ok
orange interdit                    ok
typage                             ok
eslint                             ÉCHEC

/Users/.../src/features/kit-studio/scene/bag/modelLayer.ts
  23:3   warning  'DEGRADED_BAG_CAPABILITIES' is defined but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
  27:10  warning  'BAG_HALF_HEIGHT' is defined but never used. Allowed unused vars must match /^_/u            @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)

ESLint found too many warnings (maximum: 0).
vitest                             ok
identity_compliance.mjs            ok
traveller_privacy.mjs              ok
```

**Analyse honnête** : le rouge préexistant de P0 (innerHTML de `scene/BagScene.tsx` + 6 warnings) a disparu grâce à P3 (BagScene, KitStudioView et leurs warnings supprimés). La porte reste rouge **uniquement** pour 2 warnings ESLint de `src/features/kit-studio/scene/bag/modelLayer.ts`, **fichier de P3 en cours**, hors périmètre P4 : il n'est pas modifié ici (`git status` propre, fichier non touché par P4). Aucun fichier P4 ne produit de warning. La porte est à rejouer après la fin de P3 puis en P6 ; attendu : `eslint ok` et `GATE_EXIT=0` une fois ces 2 variables utilisées ou retirées par P3.

---

## Fichiers touchés par P4 (path-scoped)

Code (déjà dans le commit de sécurisation `dbe4aac`, arbre propre à la reprise — pas re-commité pour éviter de mêler P3/P4) :
- `src/features/kit-studio/domain/totals.ts`
- `src/features/kit-studio/store/kitStore.ts`
- `src/features/kit-studio/ui/Thumb.tsx`
- `src/features/kit-studio/ui/sheets/OrderSheet.tsx`
- `src/features/kit-studio/ui/sheets/BilanSheet.tsx`
- `src/features/kit-studio/ui/sheets/ItemSheet.tsx`
- `src/features/kit-studio/ui/sheets/BagSheet.tsx`
- `src/features/kit-studio/ui/cards/cardsData.ts`
- `src/features/kit-studio/__tests__/p4.debt.test.tsx` (nouveau)
- `src/features/kit-studio/__tests__/p4.thumb.test.tsx` (nouveau)
- `docs/kit-studio/A11Y-CHECKLIST.md`

Ce document : `docs/kit-studio/P4-PREUVES.md`.

Aucun fichier P1 (`server/`, `services/`, `ui/KitStudioClient.tsx`, `ui/Studio*.tsx`, `store/partOption.ts`, `src/app/kit-studio/`), P3 (`scene/` hors `scene/thumbnails.ts` — non modifié en P4, `components/`, `state/`, `hub/`, `src/app/api/kit-studio/`, `domain/{bagModel,catalog,parts,state,attach,order,packing}.ts`, `public/assets/bags/`) ni P5 (`tests/kit-studio/`, `docs/kit-studio/reference/`, `playwright.kit-studio.config.ts`, `scripts/kit-studio/`) n'a été modifié. `package.json`, `.env.example`, `tsconfig.json`, `kit-studio-bundle/` et `docs/kit-studio/RAPPORT-CHANTIER.md` non touchés.

## Risques / écarts restants (pour le Lead)

1. **Porte bloquée par P3** : voir ci-dessus — 2 warnings `scene/bag/modelLayer.ts` (P3). Rien de P4 à corriger. À rejouer après P3 / en P6.
2. **`domain/order.ts:24`** garde son `cents()` privé (fichier P3, non modifié) : la conversion euros → centimes est donc encore écrite deux fois dans le domaine (`order.ts` privé, `totals.ts` public). La dette T22 visait les 4 conversions manuelles d'affichage, toutes supprimées ; une unification `order.ts` → `toCents` reste possible en P3/P6 si le périmètre le permet.
3. **`BagSheet`** porte le même motif `own`/`page` que `OrderSheet` (`ui/sheets/BagSheet.tsx:90-96`) : non listé dans REVIEW T22, non corrigé en P4 (périmètre respecté). Le hook `useControlledPage` est exporté et prêt à l'y brancher si le Lead le souhaite.
4. **Mesure tactile réelle** : jsdom ne fournit pas de layout ; les preuves d'accessibilité tactile sont des tests de règles CSS + le banc Playwright WebKit existant. Une mesure device reste non faite (iPhone physique indisponible, déjà consigné dans les preuves antérieures).
5. **`cog()` M=0** : la précondition de la revue n'est pas atteignable avec le catalogue livré (corps ≥ 900 g) ; la garde est testée en simulant `bagWeight = 0` (mock documenté dans le test). Si le modèle de données autorise un jour un corps à 0 g, la garde couvre déjà le cas.
6. **Aucun `npm run build`** lancé par P4 (consigne : machine 8 Go, build réservé à P6) ; aucun `perf:budget` non plus (hors portes P4).
