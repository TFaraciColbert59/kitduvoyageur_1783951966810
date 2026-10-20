# Compte iOS 27 v17 — Matière Liquid Glass unifiée & aération du profil mobile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre tous les sélecteurs de la page Compte strictement identiques au matériau de la bottom bar, aérer légèrement bio → stories → posts, sans changer la logique métier.

**Architecture:** Un unique bloc CSS `v17` ajouté à la fin de `COMPTE_V8_APPLE_HIG_CSS` redéfinit les variables de matière (`--bar-glass-*`, `--bar-thumb-*`) puis les applique aux conteneurs concernés avec leur géométrie propre. Le runtime `lensAll()` est étendu aux nouveaux sélecteurs et écrit son filtre réfractif en `!important` pour rester prioritaire sur le CSS.

**Tech Stack:** Next.js 15, React 19, CSS-in-string (`COMPTE_V8_CSS` + `COMPTE_V8_APPLE_HIG_CSS`), runtime DOM `compte-liquid-glass-v8-runtime.js`, Vitest.

**Spec:** Brief utilisateur du 2026-10-20 (capture iPhone `427×839`) + `docs/COMPTE_HANDOFF_V15.md` (invariants et architecture v15).

## Global Constraints

- **Invariant absolu** : zéro modification dans `src/app/compas/**` et `src/features/compas/**`.
- **Aucune couleur littérale nouvelle** hors du bloc `v17` : réutiliser `--ga`, `--gb` et les valeurs de la bottom bar.
- **Ne pas casser** les contrats v12 → v16 : `npx vitest run tests/design/` doit rester vert (326 tests avant ajout).
- **Mobile d'abord** : vérifier à `393×852` (iPhone 16 Pro) et `375×667` (iPhone SE).
- **La bottom bar `.tb.lg` est la référence** : gradient `calc(var(--ga) + .3 / .14 / .22)`, `blur(var(--gb)) saturate(1.9) brightness(1.07)`, `border: 0`, ombres internes + anneau 0.5 px.
- **Aucune régression de layout** : `flex-shrink: 0` du `v16` reste en place ; la card doit toujours défiler.
- **Méthode** : tests design d'abord (red), implémentation minimale (green), commit par tâche.

---

## Mesures de départ (preuve du problème)

Computed styles relevés sur la production `1af9a41d`, viewport `393×852` :

| Élément | Background | Backdrop-filter | Bordure |
|---|---|---|---|
| `.tb` (bottom bar, référence) | `linear-gradient(.486, .325 55%, .404)` | `blur(4px) saturate(1.9) brightness(1.07)` (+ réfraction Chrome) | `0` |
| `.ig-tabs` (Grille/Sorties) | `rgba(255,255,255,.65)` + gradient `.72/.42/.52` | `blur(28px) saturate(1.8) brightness(1.04)` | `1px solid rgba(255,255,255,.8)` |
| `.mctl` / `.map-scale-selector` | idem faux verre | `blur(28px)` | `1px` |
| `.sheet .segc` | idem faux verre | `blur(28px)` | `1px` |

Écarts mesurés du profil : `gap` de `.card-scroll` = `5px`, `.ig-bio` sans marge verticale, `.ig-hl-row` padding `1px 2px 0`, `.ig-grid-wrap` margin-top `0`.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/components/compte/CompteLiquidGlassV8.tsx` | CSS `COMPTE_V8_APPLE_HIG_CSS` | Ajouter le bloc `v17` avant le backtick final (après le bloc `v16`) |
| `src/components/compte/compte-liquid-glass-v8-runtime.js` | `lensAll()` | Étendre la liste des sélecteurs + `setProperty(..., "important")` |
| `tests/design/compte-refonte-v17.spec.ts` | Contrat v17 | Créer |

Aucun autre fichier. Pas de nouveau composant, pas de refactor.

---

### Task 1: Contrat de non-régression v17 (red)

**Files:**
- Create: `tests/design/compte-refonte-v17.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: six assertions qui verrouillent la matière, les lentilles, la géométrie, l'aération, la lentille réfractive et l'invariant `/compas`.

- [ ] **Step 1: Écrire le test complet**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v17 — matière bottom bar unifiée & profil aéré', () => {
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const v17 = source.slice(source.indexOf('Compte iOS 27 v17'));

  it('1. Tous les sélecteurs partagent le verre exact de la bottom bar', () => {
    expect(v17).toMatch(/--bar-glass-bg:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, calc\(var\(--ga\) \+ \.3\)\)/);
    for (const sel of [
      '.ig-tabs-float .ig-tabs',
      '.mctl',
      '.map-scale-selector',
      '.sheet .flow',
      '.sheet .segc',
      '.sheet .reseau-toggle',
      '.sheet .ig-sub',
    ]) {
      expect(v17).toContain(sel);
    }
    expect(v17).toMatch(/background:\s*var\(--bar-glass-bg\)\s*!important/);
    expect(v17).toMatch(/-webkit-backdrop-filter:\s*var\(--bar-glass-blur\)\s*!important/);
    expect(v17).toMatch(/border:\s*0\s*!important/);
  });

  it('2. La lentille sélectionnée reprend celle de la bottom bar', () => {
    expect(v17).toMatch(/--bar-thumb-bg:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, \.62\),\s*rgba\(255, 255, 255, \.26\)\)/);
    expect(v17).toContain('.ig-tabs-float .ig-tabs .ig-th');
    expect(v17).toContain('.sheet .segc .th');
    expect(v17).toContain('.sheet .flow .lens');
    expect(v17).toContain('.sheet .sel-lens');
    expect(v17).toContain('.sheet .ig-sub button[aria-pressed="true"]');
  });

  it('3. Chaque sélecteur garde sa géométrie propre', () => {
    expect(v17).toMatch(/\.sheet \.flow\s*\{[^}]*display:\s*grid\s*!important/);
    expect(v17).toMatch(/\.sheet \.flow\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--n, 4\), minmax\(0, 1fr\)\)/);
    expect(v17).toMatch(/\.sheet \.segc\s*\{[^}]*grid-auto-flow:\s*column/);
    expect(v17).toMatch(/\.sheet \.reseau-toggle\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
    expect(v17).toMatch(/\.sheet \.ig-sub\s*\{[^}]*display:\s*flex/);
    expect(v17).toMatch(/\.sheet \.sh-h \.flow\s*\{[^}]*height:\s*48px\s*!important/);
  });

  it('4. Le profil est légèrement aéré', () => {
    expect(v17).toMatch(/#card\.cs > \.card-scroll\s*\{[^}]*gap:\s*7px\s*!important/);
    expect(v17).toMatch(/#card \.ig-bio\s*\{[^}]*margin:\s*3px 2px 2px\s*!important/);
    expect(v17).toMatch(/#card \.ig-hl-row\s*\{[^}]*padding:\s*2px 2px 1px\s*!important/);
    expect(v17).toMatch(/#card \.ig-grid-wrap\s*\{[^}]*margin-top:\s*3px\s*!important/);
  });

  it('5. La lentille réfractive couvre les nouveaux sélecteurs', () => {
    expect(runtime).toMatch(/#phone \.ig-tabs/);
    expect(runtime).toMatch(/#phone \.map-scale-selector/);
    expect(runtime).toMatch(/#phone \.sheet \.segc/);
    expect(runtime).toMatch(/#phone \.sheet \.flow/);
    expect(runtime).toMatch(/#phone \.sheet \.reseau-toggle/);
    expect(runtime).toMatch(/#phone \.sheet \.ig-sub/);
    expect(runtime).toContain('setProperty("backdrop-filter"');
    expect(runtime).toContain('setProperty("-webkit-backdrop-filter"');
  });

  it('6. Invariant strict : 0 modification dans /compas', () => {
    const status = execSync('git status --porcelain -- src/app/compas src/features/compas', {
      encoding: 'utf8',
    }).trim();
    expect(status).toBe('');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/design/compte-refonte-v17.spec.ts`
Expected: FAIL — `v17` est vide, les six assertions échouent.

- [ ] **Step 3: Commit du contrat rouge**

```bash
git add tests/design/compte-refonte-v17.spec.ts
git commit -m "test(compte): contrat v17 matière bottom bar et aération"
```

---

### Task 2: Matière unifiée, géométrie adaptée et aération (green)

**Files:**
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx` (fin de `COMPTE_V8_APPLE_HIG_CSS`, juste après le bloc `v16`)
- Test: `tests/design/compte-refonte-v17.spec.ts`

**Interfaces:**
- Consumes: tokens `--ga`, `--gb` déjà définis sur `.phone`.
- Produces: variables `--bar-glass-bg`, `--bar-glass-blur`, `--bar-glass-shadow`, `--bar-thumb-bg`, `--bar-thumb-shadow`, utilisées par la Task 3.

- [ ] **Step 1: Insérer le bloc CSS v17**

Juste avant le backtick fermant `COMPTE_V8_APPLE_HIG_CSS` (après le bloc `v16`), insérer :

```css

/* ==========================================================================
   Compte iOS 27 v17 — matière unique « bottom bar » + profil aéré
   ========================================================================== */
.phone {
  --bar-glass-bg: linear-gradient(180deg,
    rgba(255, 255, 255, calc(var(--ga) + .3)),
    rgba(255, 255, 255, calc(var(--ga) + .14)) 55%,
    rgba(255, 255, 255, calc(var(--ga) + .22)));
  --bar-glass-blur: blur(var(--gb)) saturate(1.9) brightness(1.07);
  --bar-glass-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .9),
    inset 0 -1px 1px rgba(255, 255, 255, .45),
    inset 1px 0 1px rgba(255, 255, 255, .28),
    inset -1px 0 1px rgba(255, 255, 255, .28),
    0 0 0 .5px rgba(23, 43, 36, .12),
    0 8px 22px rgba(23, 43, 36, .12);
  --bar-thumb-bg: linear-gradient(180deg, rgba(255, 255, 255, .62), rgba(255, 255, 255, .26));
  --bar-thumb-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 1px rgba(255, 255, 255, .5),
    0 0 0 .5px rgba(23, 43, 36, .07),
    0 2px 8px rgba(23, 43, 36, .08);
}

/* 1 — conteneurs : même verre que .tb.lg */
.phone .ig-tabs-float .ig-tabs,
.phone .mctl,
.phone .map-scale-selector,
.phone .sheet .flow,
.phone .sheet .segc,
.phone .sheet .reseau-toggle,
.phone .sheet .ig-sub {
  background: var(--bar-glass-bg) !important;
  -webkit-backdrop-filter: var(--bar-glass-blur) !important;
  backdrop-filter: var(--bar-glass-blur) !important;
  border: 0 !important;
  box-shadow: var(--bar-glass-shadow) !important;
}

/* 2 — géométrie propre à chaque sélecteur, matière commune */
.phone .sheet .flow {
  display: grid !important;
  grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)) !important;
  height: 34px !important;
  padding: 3px !important;
  margin: 0 0 8px !important;
}
.phone .sheet .sh-h .flow {
  height: 48px !important;
}
.phone .sheet .segc {
  display: grid !important;
  grid-auto-flow: column !important;
  grid-auto-columns: 1fr !important;
  height: 34px !important;
  padding: 3px !important;
  margin: 0 0 8px !important;
}
.phone .sheet .reseau-toggle {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  width: 100% !important;
  max-width: 320px !important;
  height: 34px !important;
  padding: 3px !important;
  margin: 0 auto 8px !important;
}
.phone .sheet .ig-sub {
  display: flex !important;
  height: 30px !important;
  padding: 3px !important;
  gap: 3px !important;
  margin: 0 0 8px !important;
}
.phone .sheet .ig-sub button {
  height: 24px !important;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

/* 3 — lentille sélectionnée identique à .tb .lens */
.phone .ig-tabs-float .ig-tabs .ig-th,
.phone .sheet .segc .th,
.phone .sheet .flow .lens,
.phone .sheet .sel-lens,
.phone .sheet .ig-sub button[aria-pressed="true"],
.phone .sheet .reseau-toggle .active {
  background: var(--bar-thumb-bg) !important;
  box-shadow: var(--bar-thumb-shadow) !important;
}

/* 4 — aération légère : bio ↔ stories ↔ posts */
#card.cs > .card-scroll { gap: 7px !important; }
#card .ig-bio { margin: 3px 2px 2px !important; }
#card .ig-hl-row { padding: 2px 2px 1px !important; }
#card .ig-grid-wrap { margin-top: 3px !important; }
```

- [ ] **Step 2: Lancer le contrat v17**

Run: `npx vitest run tests/design/compte-refonte-v17.spec.ts`
Expected: les tests 1 à 4 PASSENT, le test 5 échoue encore (runtime pas modifié).

- [ ] **Step 3: Vérifier visuellement en preview avant déploiement**

Dans le navigateur Playwright déjà ouvert sur `/compte` :

1. `browser_resize(393, 852)` puis `browser_wait_for(6)`.
2. `browser_evaluate` : injecter le contenu du bloc CSS v17 dans un `<style id="v17-preview">`, puis renvoyer les styles calculés de `.tb`, `.ig-tabs`, `.mctl`, `.map-scale-selector`.
3. Attendu : `backgroundImage` identique pour les quatre (`calc` résolu ≈ `.486/.325/.404`), `border: 0px`, `boxShadow` identique à `.tb`.
4. `browser_take_screenshot({ filename: "v17-preview-393.png" })`.
5. Ouvrir le tiroir via `[data-a="openAccountDrawer"]`, mesurer `.segc` : mêmes `backgroundImage`, `backdropFilter`, `border` et `boxShadow` que `.tb`.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/CompteLiquidGlassV8.tsx tests/design/compte-refonte-v17.spec.ts
git commit -m "feat(compte): matière bottom bar unifiée et profil aéré (v17)"
```

---

### Task 3: Lentille réfractive partagée (green)

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js` (`lensAll`, ~ligne 727)
- Test: `tests/design/compte-refonte-v17.spec.ts`

**Interfaces:**
- Consumes: `lensFilter(w, h, r, bz, sc)` existant, variables `--gb`.
- Produces: filtre `url(#lf...)` appliqué en `!important` sur les sélecteurs v17, pour que la réfraction Chrome reste prioritaire sur le CSS `!important`.

- [ ] **Step 1: Étendre la liste et forcer la priorité**

Remplacer :

```js
document.querySelectorAll("#phone .tb,#phone .ig-handle,#phone .acc,#phone .gbtn,#phone .mctl,#phone .callout").forEach(el => {
```

par :

```js
document.querySelectorAll("#phone .tb,#phone .ig-handle,#phone .acc,#phone .gbtn,#phone .mctl,#phone .callout,#phone .ig-tabs,#phone .map-scale-selector,#phone .sheet .flow,#phone .sheet .segc,#phone .sheet .reseau-toggle,#phone .sheet .ig-sub").forEach(el => {
```

Puis remplacer l'écriture du filtre :

```js
el.style.backdropFilter = `url(#${id}) blur(${(parseFloat(getComputedStyle($("phone")).getPropertyValue("--gb")) * .55 || 3).toFixed(1)}px) saturate(1.9) brightness(1.07)`;
```

par :

```js
const lensValue = `url(#${id}) blur(${(parseFloat(getComputedStyle($("phone")).getPropertyValue("--gb")) * .55 || 3).toFixed(1)}px) saturate(1.9) brightness(1.07)`;
el.style.setProperty("backdrop-filter", lensValue, "important");
el.style.setProperty("-webkit-backdrop-filter", lensValue, "important");
```

- [ ] **Step 2: Vérifier la syntaxe et le contrat**

Run: `node --check src/components/compte/compte-liquid-glass-v8-runtime.js`
Expected: aucune sortie, code 0.

Run: `npx vitest run tests/design/compte-refonte-v17.spec.ts`
Expected: 6/6 PASS.

- [ ] **Step 3: Vérifier la réfraction en preview Chromium**

Sur la page `/compte` (393×852), `browser_evaluate` :

```js
[...document.querySelectorAll('.tb,#card .ig-tabs,.mctl,.map-scale-selector')]
  .map(el => ({ cls: el.className, filter: getComputedStyle(el).backdropFilter }))
```

Attendu : chaque entrée contient `url("...#lf` et `blur(` ; `.tb` et les sélecteurs partagent la même forme de filtre.

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/compte-liquid-glass-v8-runtime.js tests/design/compte-refonte-v17.spec.ts
git commit -m "feat(compte): lentille réfractive partagée sur tous les sélecteurs"
```

---

### Task 4: Validation complète, build et déploiement Vercel

**Files:**
- Aucun fichier modifié (sauf si un test révèle une régression).

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: commit poussé sur `main`, déploiement Vercel READY, preuve visuelle production.

- [ ] **Step 1: Suite design complète**

Run: `npx vitest run tests/design/`
Expected: `32+ fichiers`, `332 tests` PASS (326 + 6 nouveaux).

- [ ] **Step 2: Type-check et build**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`
Expected: code 0, aucune erreur.

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm run build`
Expected: code 0, `337 pages` générées.

- [ ] **Step 3: Invariants**

Run: `npm run verify:invariants`
Expected: code 0.

Run: `git diff --name-only origin/main -- src/app/compas src/features/compas`
Expected: sortie vide.

- [ ] **Step 4: Commit final et push**

```bash
git add src/components/compte/CompteLiquidGlassV8.tsx src/components/compte/compte-liquid-glass-v8-runtime.js tests/design/compte-refonte-v17.spec.ts
git commit -m "feat(compte): v17 verre unifié et espacement du profil mobile"
GIT_ASKPASS=/tmp/git-askpass.sh GIT_TERMINAL_PROMPT=0 git -c credential.helper= push origin main
```

- [ ] **Step 5: Vérifier le déploiement Vercel**

1. `mcp__vercel__list_deployments({ projectId: "prj_AqYb1FBEcyNGTZMVimBJXRDulyXp", teamId: "team_lBmtlHsEp3YQAM4hQCaWovPG", limit: 3 })`.
2. Attendre `state: "READY"` sur le déploiement dont `githubCommitSha` correspond au commit poussé (poll toutes les 60 s, max 10 min).
3. `curl -s -o /dev/null -w "%{http_code}" https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app/compte` → `200`.

- [ ] **Step 6: Preuve visuelle production**

Playwright MCP, viewport `393×852`, `wait_for(6)` :

1. `browser_evaluate` : comparer `.tb`, `.ig-tabs`, `.mctl`, `.map-scale-selector` sur `backgroundImage`, `backdropFilter`, `border`, `boxShadow`; tous doivent être identiques (à la taille près).
2. Ouvrir `[data-a="openAccountDrawer"]`, vérifier `.segc` identique.
3. `browser_take_screenshot({ filename: "v17-prod-393.png" })`.
4. `browser_resize(375, 667)` et vérifier que la grille fait toujours `233 px` avec `scrollHeight > clientHeight` (non-régression v16).
5. Contrôler les espacements : écart bio → stories et stories → grille ≥ 9 px.

- [ ] **Step 7: Rapport**

Consigner dans la réponse : tests, type-check, build, commit, deployment id, URL, mesures et capture. Signaler que `koosmoweb.fr` reste hors périmètre (DNS registrar).

---

## Self-review

- **Couverture du brief** : aération (Task 2 §4), boutons carte + sélecteur grille/sorties (Task 2 §1), sélecteurs de drawers identiques et adaptés (Task 2 §1–3), style bottom bar (Tasks 2–3), déploiement (Task 4). ✅
- **Placeholders** : aucun « TODO » ni « à compléter » ; chaque étape contient le code ou la commande exacte. ✅
- **Cohérence des types** : variables CSS `--bar-glass-*` / `--bar-thumb-*` définies en Task 2 et consommées dans le même bloc ; sélecteurs runtime identiques aux sélecteurs CSS. ✅
- **Risque connu** : `.sheet .sh-h .flow` est explicitement remis à `48px` après la règle `34px` pour ne pas casser l'en-tête de tiroir. ✅
- **Risque connu** : le filtre réfractif ne s'exécute que sur Chrome (`LENS.on`), comme avant ; sur iOS, c'est le gradient/blur CSS qui assure la cohérence. ✅
