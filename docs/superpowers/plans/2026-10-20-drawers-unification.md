# Drawers Compte iOS 27 v18 — surface unique, navigation unique, sans « Fermer »

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les trois drawers du Compte (Abonnés, Profil/Empreinte, Compte & Activité) partagent la surface de la card principale, la même barre de navigation que la bottom bar, et n'ont plus de bouton « Fermer » en pied.

**Architecture:** Un bloc CSS `v18` en fin de `COMPTE_V8_APPLE_HIG_CSS` aligne `.sheet` sur la surface exacte de `#card.cs` et normalise les trois navigateurs (`.flow`, `.segc`, `.reseau-toggle`) sur le gabarit de `.tb`. Le runtime `renderSheet()` sort le flow de l'en-tête vers une rangée `.sheet-nav`, et ne rend le pied `.sh-f` que pour les workflows (Précédent/Suivant) — jamais pour un simple « Fermer ».

**Tech Stack:** Next.js 15, React 19, CSS-in-string (`COMPTE_V8_APPLE_HIG_CSS`), runtime DOM `compte-liquid-glass-v8-runtime.js`, Vitest.

**Spec:** Brief utilisateur du 2026-10-20 (captures des trois drawers) + `docs/COMPTE_HANDOFF_V15.md`. Les captures montrent : Abonnés = `.reseau-toggle` 2 icônes ; Profil = `.flow` 5 icônes dans l'en-tête ; Compte & Activité = `.segc` 3 icônes.

## Global Constraints

- **Invariant absolu** : zéro modification dans `src/app/compas/**` et `src/features/compas/**`.
- **Aucune couleur littérale nouvelle hors du Stone documenté** : la base de la feuille utilise `#F5F2EC` (Stone, `DESIGN_SYSTEM.md` §2) car `--lkv-surface-paper` résout à `rgba(255,255,255,0.06)` dans ce scope ; le reste réutilise `--bar-glass-bg`, `--bar-glass-blur`, `--bar-glass-shadow`, `--bar-thumb-bg`, `--bar-thumb-shadow`.
- **La card `#card.cs` est la référence de surface** : gradient `rgba(255,255,255,.486) → .384`, `blur(25.2px) saturate(1.8) brightness(1.05)`, `border: 0`, ombre `inset 0 1px 0 .95, inset 0 -1px 1px .4, inset 0 0 16px .12, 0 0 0 .5px rgba(23,43,36,.12), 0 10px 30px rgba(23,43,36,.14)`.
- **La bottom bar `.tb` est la référence de navigation** : hauteur 48 px, padding 2 px, rayon 999 px, icônes 19 px, thumb `rgba(255,255,255,.62) → .26`, matériau `--bar-glass-*`.
- **Ne pas casser** v12 → v17 : `npx vitest run tests/design/` reste vert (332 tests avant ajout).
- **Mobile d'abord** : 393×852 et 375×667.
- **Aucune régression de contenu** : seuls la forme, la surface et le pied changent ; les données, les handlers et les routes restent identiques.

---

## Mesures de départ (production `5d711116`, 393×852)

| Élément | Background | Bordure | Rayon |
|---|---|---|---|
| `#card.cs` (référence) | `linear-gradient(.486, .384)` + `blur(25.2px) saturate(1.8) brightness(1.05)` | `0` | `24px` |
| `.sheet` (drawer) | `linear-gradient(.886, .824 46%, .867)` + `blur(25.2px) saturate(1.85)` | `1px solid rgba(255,255,255,.8)` | `24px` / `28px 28px 0 0` |
| `.flow` (Profil) | matériau v17 | `0` | `9999px` — **hauteur 48**, dans `.sh-h` |
| `.segc` (Compte) | matériau v17 | `0` | `9999px` — **hauteur 34** |
| `.reseau-toggle` (Abonnés) | matériau v17 | `0` | `9999px` — **hauteur 34**, `max-width: 320px` |
| `.sh-f` (pied) | `rgba(255,255,255,.5)` | `1px` | `999px` — contient « Fermer » |

Écarts : surface plus opaque et plus verte que la card ; trois hauteurs de sélecteur (48/34/34) et trois largeurs ; flow dans l'en-tête alors que les autres sont dans le contenu ; pied « Fermer » qui consomme 44 px.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/components/compte/CompteLiquidGlassV8.tsx` | CSS `COMPTE_V8_APPLE_HIG_CSS` | Ajouter le bloc `v18` après le bloc `v17` |
| `src/components/compte/compte-liquid-glass-v8-runtime.js` | `renderSheet()` | Sortir le flow de l'en-tête, ajouter `.sheet-nav`, supprimer le pied non-workflow |
| `tests/design/compte-refonte-v18.spec.ts` | Contrat v18 | Créer |

Aucun autre fichier. Pas de nouveau composant.

---

### Task 1: Contrat de non-régression v18 (red)

**Files:**
- Create: `tests/design/compte-refonte-v18.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: cinq assertions qui verrouillent la surface, le gabarit des trois navigateurs, la nouvelle structure d'en-tête, l'absence de « Fermer » et l'invariant `/compas`.

- [ ] **Step 1: Écrire le test complet**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v18 — drawers : surface card, navigation unique, sans Fermer', () => {
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const start = source.indexOf('Compte iOS 27 v18');
  const v18 = source.slice(start, source.indexOf('`;', start));

  it('1. La feuille reprend la surface exacte de la card', () => {
    expect(start).toBeGreaterThan(-1);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*background-color:\s*#F5F2EC\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*background-image:\s*linear-gradient\(180deg,\s*rgba\(255, 255, 255, \.486\),\s*rgba\(255, 255, 255, \.384\)\)/);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*blur\(25\.2px\) saturate\(1\.8\) brightness\(1\.05\)/);
    expect(v18).toMatch(/\.phone \.sheet\s*\{[^}]*border:\s*0\s*!important/);
    expect(v18).toMatch(/0 10px 30px rgba\(23, 43, 36, \.14\)/);
  });

  it('2. Les trois navigateurs de drawer ont le gabarit de la bottom bar', () => {
    for (const sel of ['.sheet .flow', '.sheet .segc', '.sheet .reseau-toggle']) {
      expect(v18).toContain(sel);
    }
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?height:\s*48px\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?padding:\s*2px\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?width:\s*100%\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow,[\s\S]*?background:\s*var\(--bar-glass-bg\)\s*!important/);
    expect(v18).toMatch(/\.phone \.sheet \.flow button,[\s\S]*?height:\s*44px\s*!important/);
  });

  it('3. Le flow est sorti de l’en-tête vers une rangée dédiée', () => {
    expect(runtime).toContain('<div class="sheet-nav">');
    expect(runtime).not.toContain('class="grab${nF > 1 ? " tt" : ""}"');
    expect(runtime).toMatch(/<div class="sh-h" data-drag>\$\{x_\}<h3>/);
  });

  it('4. Aucun bouton Fermer en pied de drawer', () => {
    expect(runtime).not.toMatch(/data-a="close">Fermer</);
    expect(runtime).toMatch(/const footerHtml = isWorkflow\s*\?\s*`/);
    expect(runtime).toMatch(/\$\{footerHtml \? `<div class="sh-f">\$\{footerHtml\}<\/div>` : ""\}/);
  });

  it('5. Invariant strict : 0 modification dans /compas', () => {
    let committed = '';
    try {
      committed = execSync('git diff --name-only origin/main -- src/app/compas src/features/compas', {
        encoding: 'utf8',
      }).trim();
    } catch {
      committed = '';
    }
    expect(committed).toBe('');
    expect(
      execSync('git status --porcelain -- src/app/compas src/features/compas', { encoding: 'utf8' }).trim(),
    ).toBe('');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/design/compte-refonte-v18.spec.ts`
Expected: FAIL — `v18` absent (`start === -1`), puis tests 2–4 rouges.

- [ ] **Step 3: Commit du contrat rouge**

```bash
git add tests/design/compte-refonte-v18.spec.ts
git commit -m "test(compte): contrat v18 drawers surface et navigation uniques"
```

---

### Task 2: Surface de la card et navigateur unique (CSS v18)

**Files:**
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx` (fin de `COMPTE_V8_APPLE_HIG_CSS`, après le bloc `v17`)
- Test: `tests/design/compte-refonte-v18.spec.ts`

**Interfaces:**
- Consumes: Stone `#F5F2EC`, tokens `--bar-glass-*` et `--bar-thumb-*` définis par le bloc v17.
- Produces: les classes `.sheet`, `.sheet .flow`, `.sheet .segc`, `.sheet .reseau-toggle`, `.sheet .sheet-nav` attendues par la Task 3.

- [ ] **Step 1: Insérer le bloc CSS v18**

Juste avant le backtick fermant `COMPTE_V8_APPLE_HIG_CSS` (après le bloc `v17`), insérer :

```css
/* ==========================================================================
   Compte iOS 27 v18 — drawers : même surface que la card, même barre que la
   bottom bar, aucun bouton Fermer en pied.
   ========================================================================== */

/* 1 — la feuille reprend la matière composite de #card.cs */
.phone .sheet {
  background-color: #F5F2EC !important; /* Stone documenté ; --lkv-surface-paper résout à rgba(255,255,255,.06) ici */
  background-image: linear-gradient(180deg, rgba(255, 255, 255, .486), rgba(255, 255, 255, .384)) !important;
  -webkit-backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05) !important;
  backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05) !important;
  border: 0 !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .95),
    inset 0 -1px 1px rgba(255, 255, 255, .4),
    inset 0 0 16px rgba(255, 255, 255, .12),
    0 0 0 .5px rgba(23, 43, 36, .12),
    0 10px 30px rgba(23, 43, 36, .14) !important;
}

/* 2 — un seul gabarit de navigation, celui de .tb */
.phone .sheet .sheet-nav {
  margin: 0 0 10px !important;
}
.phone .sheet .flow,
.phone .sheet .segc,
.phone .sheet .reseau-toggle {
  width: 100% !important;
  max-width: none !important;
  height: 48px !important;
  padding: 2px !important;
  margin: 0 0 10px !important;
  border-radius: 999px !important;
  display: grid !important;
  gap: 0 !important;
  background: var(--bar-glass-bg) !important;
  -webkit-backdrop-filter: var(--bar-glass-blur) !important;
  backdrop-filter: var(--bar-glass-blur) !important;
  border: 0 !important;
  box-shadow: var(--bar-glass-shadow) !important;
}
.phone .sheet .flow {
  grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)) !important;
}
.phone .sheet .segc {
  grid-auto-flow: column !important;
  grid-auto-columns: 1fr !important;
}
.phone .sheet .reseau-toggle {
  grid-template-columns: 1fr 1fr !important;
}

/* 3 — cellules identiques : icônes 19 px, cible 44 px, fond transparent */
.phone .sheet .flow button,
.phone .sheet .segc button,
.phone .sheet .reseau-toggle button {
  min-width: 0 !important;
  height: 44px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}
.phone .sheet .flow button .ic,
.phone .sheet .segc button .ic,
.phone .sheet .reseau-toggle button .ic {
  width: 19px !important;
  height: 19px !important;
}

/* 4 — même lentille sélectionnée que .tb .lens */
.phone .sheet .sel-lens,
.phone .sheet .segc .th {
  background: var(--bar-thumb-bg) !important;
  box-shadow: var(--bar-thumb-shadow) !important;
}
```

- [ ] **Step 2: Lancer les tests 1 et 2**

Run: `npx vitest run tests/design/compte-refonte-v18.spec.ts -t "1." -t "2."`
Expected: PASS.

- [ ] **Step 3: Vérifier la non-régression v15→v17**

Run: `npx vitest run tests/design/compte-refonte-v15.spec.ts tests/design/compte-refonte-v16.spec.ts tests/design/compte-refonte-v17.spec.ts`
Expected: PASS (les tests v17 peuvent nécessiter un ajustement uniquement si le bloc v18 modifie leurs sélecteurs — ce n'est pas le cas).

- [ ] **Step 4: Commit**

```bash
git add src/components/compte/CompteLiquidGlassV8.tsx tests/design/compte-refonte-v18.spec.ts
git commit -m "feat(compte): drawers v18 surface card et navigation unique"
```

---

### Task 3: En-tête, rangée de navigation et pied sans « Fermer » (runtime)

**Files:**
- Modify: `src/components/compte/compte-liquid-glass-v8-runtime.js` (`renderSheet`, ~1490-1505)
- Test: `tests/design/compte-refonte-v18.spec.ts`

**Interfaces:**
- Consumes: `flow` (markup existant, `nF > 1`), `x_` (bouton fermer d'en-tête), `d_`, `footerHtml`.
- Produces: une feuille dont l'en-tête est toujours `X + h3`, suivie de `.sheet-nav` si workflow ; un pied `.sh-f` rendu seulement si `footerHtml` est non vide.

- [ ] **Step 1: Supprimer le pied non-workflow**

Remplacer :

```js
const footerHtml = isWorkflow
  ? `<button class="mbtn soft" data-a="fprev" ...>Précédent</button>...`
  : `<div style="flex:1"></div><button class="mbtn soft" style="height:36px;padding:0 24px" data-a="close">Fermer</button>`;
```

par :

```js
const footerHtml = isWorkflow
  ? `<button class="mbtn soft" data-a="fprev" ...>Précédent</button>...`
  : "";
```

(Conserver à l'identique la branche workflow : Précédent / Suivant / Terminer.)

- [ ] **Step 2: Sortir le flow de l'en-tête**

Remplacer le bloc `$("sheet").innerHTML = ...` par :

```js
$("sheet").innerHTML = `<div class="grab" data-drag aria-hidden="true"><span></span></div>
  <div class="sh-h" data-drag>${x_}<h3>${Dd.title}</h3>${d_}</div>
  ${flow ? `<div class="sheet-nav">${flow}</div>` : ""}
  <div class="peekline">${Dd.peek}</div>
  <div class="sh-b">${T.head || ""}${pages > 1 ? listHead(lab, sh.page, pages) : ""}${T.rows.slice(sh.page * per, sh.page * per + per).join("")}</div>
  ${footerHtml ? `<div class="sh-f">${footerHtml}</div>` : ""}`;
```

Le `flow` reste construit plus haut ; seule sa position change. Supprimer la classe `tt` du grabber et le `<b class="sht">` du titre, devenus inutiles.

- [ ] **Step 3: Lancer le contrat v18 et la suite design**

Run: `npx vitest run tests/design/compte-refonte-v18.spec.ts`
Expected: 5/5 PASS.

Run: `npx vitest run tests/design/`
Expected: 337/337 PASS (332 + 5).

- [ ] **Step 4: Vérifier la syntaxe et le type-check**

Run: `node --check src/components/compte/compte-liquid-glass-v8-runtime.js`
Expected: code 0.

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`
Expected: code 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/compte/compte-liquid-glass-v8-runtime.js tests/design/compte-refonte-v18.spec.ts
git commit -m "feat(compte): drawer v18 header, nav row et suppression du Fermer"
```

---

### Task 4: Vérification visuelle des trois drawers et déploiement

**Files:**
- Aucun fichier modifié (sauf correction d'un écart visuel constaté).

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: preuve visuelle des trois drawers, déploiement Vercel READY.

- [ ] **Step 1: Build et invariants**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm run build`
Expected: code 0, 337 pages.

Run: `npm run verify:invariants`
Expected: code 0.

- [ ] **Step 2: Push et déploiement**

```bash
GIT_ASKPASS=/tmp/git-askpass.sh GIT_TERMINAL_PROMPT=0 git -c credential.helper= push origin main
```

Puis `mcp__vercel__list_deployments({ projectId: "prj_AqYb1FBEcyNGTZMVimBJXRDulyXp", teamId: "team_lBmtlHsEp3YQAM4hQCaWovPG", limit: 3 })`, attendre `READY` sur le commit poussé (poll 60 s, max 10 min).

- [ ] **Step 3: Contrôle visuel des trois drawers (393×852)**

Pour chacun — Abonnés (`1080 abonnés`), Profil/Empreinte (avatar), Compte & Activité (`[data-a="openAccountDrawer"]`) :

1. `browser_evaluate` : relever `background-image`, `background-color`, `backdrop-filter`, `border`, `box-shadow`, `border-radius` de `#sheet`.
2. Vérifier l'égalité stricte entre les trois feuilles et la card `#card.cs` (à la couleur de base près).
3. Relever `.flow`, `.segc`, `.reseau-toggle` : `height: 48px`, `width` = largeur de la feuille, `padding: 2px`, même `background`, `border: 0`, même `box-shadow`.
4. Vérifier l'absence de `.sh-f` et de tout texte « Fermer » dans les trois drawers.
5. `browser_take_screenshot` pour chacun : `v18-drawer-abonnes.png`, `v18-drawer-profil.png`, `v18-drawer-compte.png`.

- [ ] **Step 4: Contrôle 375×667**

`browser_resize(375, 667)` sur le drawer Compte & Activité : vérifier que le contenu gagne les 44 px du pied supprimé (première carte visible plus haut) et que le sélecteur reste 48 px.

- [ ] **Step 5: Rapport**

Consigner : tests, build, déploiement, captures, mesures. Signaler tout écart résiduel (ex. `.segc` texte de Profil qui reste un filtre, `.ig-sub` secondaire non concerné).

---

## Self-review

- **Couverture du brief** : fond identique à la card (Task 2 §1), sélecteur identique à la bottom bar pour les trois drawers (Task 2 §2–4), suppression des « Fermer » (Task 3 §1), espace récupéré (Task 4 §4). ✅
- **Placeholders** : aucun « TODO » ; chaque étape contient le code ou la commande exacte. ✅
- **Cohérence** : variables `--bar-*` déjà définies en v17 ; `.sheet-nav` défini en CSS (Task 2) et produit par le runtime (Task 3) ; le test v18 vérifie les deux. ✅
- **Risques connus** : le `.segc` texte du drawer Profil (Privée/Communauté/Publique) reste un filtre de contenu et passera à 48 px — assumé, même gabarit ; `.ig-sub` reste secondaire à 30 px, hors des trois drawers cités. ✅
- **Surface** : la base `#F5F2EC` garantit le même rendu quel que soit le contenu derrière ; si le rendu est trop clair, ajuster l'alpha du gradient, pas la couleur de base. ✅
