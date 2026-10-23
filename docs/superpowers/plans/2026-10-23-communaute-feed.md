# Communauté — fil Instagram LKDV : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer le hub à six espaces par un fil vertical de posts carrés, avec la coquille,
les actions de post, le drawer de création et la barre basse de la page Compte.

**Architecture:** une coquille plein écran (fond global + colonne 430–520 px + barre basse fixe),
une barre supérieure `auteur + +`, un rail de stories, un fil de `community_posts` paginé par 10,
un post carré avec les actions du post modal Compte, une feuille de commentaires et un drawer de
création à 5 lignes. Les primitives du Compte (`.pmi-author`, `.pmi-post-actions`, `.pmi-post-btn`,
`.pmi-options-menu`, `.tb`, `.gbtn`) sont extraites dans un fichier partagé ; la page ne réimporte
pas le runtime du Compte.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind, Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-communaute-feed-design.md`

## Global Constraints

- Aucune nouvelle couleur : uniquement `--lkv-*`, `--bar-glass-*`, `--bar-thumb-shadow`, `#17402C`,
  `#56665D`, `#E0245E`, `#3D7A52` (valeurs du Compte).
- Aucun import de `CompteLiquidGlassV8.tsx` ni du runtime `compte-liquid-glass-v8-runtime.js`.
- Aucune migration Supabase.
- Aucun nouveau package.
- La barre globale `NavigationBar` est masquée sur `/communaute` ; une seule barre basse.
- Les routes `/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide` ne sont plus liées depuis
  la Communauté ; elles ne sont pas supprimées (D2).
- Les stories, le viewer, les archives, les vues et le compositeur existants sont conservés.
- `prefers-reduced-motion` respecté ; cibles 44 px ; `aria-label` sur chaque bouton.
- Chaque tâche se termine par un test et un commit. Aucune tâche ne commence avant que la
  précédente soit verte.

---

## Structure des fichiers

```
src/styles/account-glass.css                 (nouveau : jetons + .pmi-* + .tb + .gbtn)
src/components/account/
  AccountAuthorPill.tsx                      (nouveau)
  AccountRoundButton.tsx                     (nouveau)
  AccountActionPill.tsx                      (nouveau)
  AccountMoreMenu.tsx                        (nouveau)
  AccountBottomBar.tsx                       (nouveau)
  AccountCreateSheet.tsx                     (nouveau)
src/features/community/feed/
  useCommunityFeed.ts                        (nouveau)
  usePostInteractions.ts                     (nouveau)
  usePostComments.ts                         (nouveau)
  CommunityFeedShell.tsx                     (nouveau)
  CommunityFeedTopBar.tsx                    (nouveau)
  CommunityFeed.tsx                          (nouveau)
  CommunityFeedPost.tsx                      (nouveau)
  CommunityCommentsSheet.tsx                 (nouveau)
src/app/communaute/page.tsx                  (réécrit)
src/components/communaute/CommunityStoriesBar.tsx (modifié : heading optionnel, picker exposé)
src/components/mobile-nav/MobileNavWrapper.tsx (modifié : /communaute sans barre globale)
```

**Supprimés en fin de chantier :** `CommunityGrid.tsx`, `CommunityContentDrawer.tsx`,
`CommunityHeroCard.tsx`, `CommunityContextDrawer.tsx`, `MobileCommunityHub.tsx`,
`MobileCommunityHeader.tsx`, `src/features/community/useCommunityTotals.ts`, les blocs CSS
`.lkdv-hero*`, `.lkdv-community-grid*`, `.lkdv-content-drawer*`, `.lkdv-community-view-lens`.

---

### Task 1: Figer la baseline

**Files:**
- Create: `docs/communaute/feed-baseline/` (captures)
- Modify: aucun `src/`

**Interfaces:**
- Consumes: rien.
- Produces: commit de référence + captures 430/1440.

- [ ] **Step 1: Vérifier la branche et le statut**

```bash
git status --short | grep -E "communaute|community" || echo "clean"
git log --oneline -1
```

- [ ] **Step 2: Capturer l'état actuel**

```bash
mkdir -p docs/communaute/feed-baseline
node - <<'NODE'
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 430, height: 932 } });
  await p.goto('http://localhost:4000/communaute', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);
  await p.screenshot({ path: 'docs/communaute/feed-baseline/avant-430.png' });
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto('http://localhost:4000/communaute', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'docs/communaute/feed-baseline/avant-1440.png' });
  await b.close();
})();
NODE
```

- [ ] **Step 3: Commit**

```bash
git add docs/communaute/feed-baseline
git commit -m "docs(communaute): baseline avant fil Instagram"
```

---

### Task 2: Extraire les jetons et primitives du Compte

**Files:**
- Create: `src/styles/account-glass.css`
- Modify: `src/app/layout.tsx` (import)
- Test: `tests/design/account-glass.spec.ts`

**Interfaces:**
- Produces: classes `.pmi-author`, `.pmi-author-av`, `.pmi-post-actions`, `.pmi-post-btn`,
  `.pmi-options-menu`, `.tb`, `.gbtn`, jetons `--bar-glass-bg`, `--bar-glass-blur`,
  `--bar-glass-shadow`, `--bar-thumb-shadow`.

- [ ] **Step 1: Écrire le test de présence**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/account-glass.css', 'utf8');

describe('account glass contract', () => {
  it('porte les valeurs exactes du Compte', () => {
    expect(css).toContain('.pmi-author');
    expect(css).toContain('width: 28px');
    expect(css).toContain('.pmi-post-actions');
    expect(css).toContain('bottom: 12px');
    expect(css).toContain('.pmi-post-btn');
    expect(css).toContain('width: 34px');
    expect(css).toContain('.tb');
    expect(css).toContain('height: 48px');
    expect(css).toContain('--bar-glass-bg');
  });
});
```

- [ ] **Step 2: Lancer le test (échec)**

`npx vitest run tests/design/account-glass.spec.ts` → FAIL (fichier absent).

- [ ] **Step 3: Créer le fichier**

Copier **à l'identique** depuis `CompteLiquidGlassV8.tsx` :

- `.pmi-author` (`:3275`), `.pmi-author-av` (`:3276`), `.pmi-author b` (`:3277`) ;
- `.pmi-post-actions` (`:3279`), `.pmi-post-btn` (`:3280-3282`) ;
- `.pmi-options-menu` (`:2426-2458`) ;
- `.gbtn` 38 px : `width/height 38px`, radius 50 %, `background: rgba(255,255,255,.5)`,
  `backdrop-filter: blur(4px) saturate(1.9) brightness(1.07)`,
  `box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 2px 8px rgba(23,43,36,.08)` ;
- `.tb` : hauteur `48px`, `padding:2px`, radius `999px`, `display:grid`, 5 colonnes égales,
  fond `--bar-glass-bg`, blur `--bar-glass-blur`, ombre `--bar-glass-shadow`,
  `position: fixed; left:10px; right:10px; bottom:10px` ;
- `.tb button` : `44px`, radius `999px`, flex column, gap `2px`, `font: 600 10px var(--sf)`,
  couleur `#56665D`, actif `#17402C` ;
- `.tb .lens` : `40px`, radius `999px`, dégradé blanc, ombre, `transform .42s
  cubic-bezier(.32,.72,0,1)` ;
- les variables `--bar-glass-bg` (`linear-gradient(180deg, rgba(255,255,255,.485),
  rgba(255,255,255,.325) 55%, rgba(255,255,255,.405))`), `--bar-glass-blur`
  (`blur(7.2px) saturate(1.9) brightness(1.07)`), `--bar-glass-shadow` (les 7 couches du Compte),
  `--bar-thumb-shadow`. Les définir sur `.lkdv-account-glass`, classe ajoutée à la coquille
  Communauté.

Ajouter `@import` ou import dans `src/app/layout.tsx` **avant** `community-social.css`.

- [ ] **Step 4: Vérifier**

`npx vitest run tests/design/account-glass.spec.ts` → PASS.
`npm run type-check` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/styles/account-glass.css src/app/layout.tsx tests/design/account-glass.spec.ts
git commit -m "feat(design): extraire les primitives verre du Compte"
```

---

### Task 3: `AccountAuthorPill`

**Files:**
- Create: `src/components/account/AccountAuthorPill.tsx`
- Test: `src/components/account/__tests__/AccountAuthorPill.test.tsx`

**Interfaces:**
- Produces: `<AccountAuthorPill name avatarUrl handle href />` → `<a class="pmi-author">…</a>`.

- [ ] **Step 1: Test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountAuthorPill } from '../AccountAuthorPill';

describe('AccountAuthorPill', () => {
  it('affiche avatar, nom et handle', () => {
    render(<AccountAuthorPill name="Tony Faraci" handle="tony_frc" href="/compte" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/compte');
    expect(screen.getByText('Tony Faraci')).toBeVisible();
    expect(screen.getByText('@tony_frc')).toBeVisible();
  });
});
```

- [ ] **Step 2: Implémenter**

```tsx
export function AccountAuthorPill({ name, handle, avatarUrl, href = '/compte' }: Props) {
  return (
    <a className="pmi-author" href={href} aria-label={`${name}, ouvrir mon compte`}>
      {avatarUrl ? <img className="pmi-author-av" src={avatarUrl} alt="" /> : <span className="pmi-author-av pmi-author-initial">{name.charAt(0)}</span>}
      <span className="pmi-author-txt"><b>{name}</b><small>@{handle}</small></span>
    </a>
  );
}
```

- [ ] **Step 3: Vérifier + commit**

`npx vitest run src/components/account/__tests__/AccountAuthorPill.test.tsx` → PASS.

```bash
git add src/components/account/AccountAuthorPill.tsx src/components/account/__tests__/AccountAuthorPill.test.tsx
git commit -m "feat(account): pastille auteur partagee"
```

---

### Task 4: `AccountRoundButton`

**Files:**
- Create: `src/components/account/AccountRoundButton.tsx`
- Test: `src/components/account/__tests__/AccountRoundButton.test.tsx`

**Interfaces:**
- Produces: `<AccountRoundButton label onClick>{icon}</AccountRoundButton>` → `<button class="gbtn">`.

- [ ] **Step 1: Test** — rend un bouton 38 px, `aria-label`, clic appelé.
- [ ] **Step 2: Implémenter** — `button type="button" className="gbtn"` + icône 18 px.
- [ ] **Step 3: Vérifier + commit** — test PASS, `tsc` 0.

---

### Task 5: `AccountBottomBar` — les 5 onglets du Compte

**Files:**
- Create: `src/components/account/AccountBottomBar.tsx`
- Test: `src/components/account/__tests__/AccountBottomBar.test.tsx`
- Modify: `src/components/mobile-nav/MobileNavWrapper.tsx`

**Interfaces:**
- Produces: `<AccountBottomBar />` **sans prop** : les 5 onglets sont fixes, comme le Compte.
- `ACCOUNT_TABS = [Explorer /explorer, Compas /compas, Matériel /materiel, Hub /hub, Compte /compte]`.
- Consumes: classes `.tb`, `.lens` de Task 2.

- [ ] **Step 1: Test**

```tsx
it('rend les 5 onglets du Compte, sans actif sur la Communauté', () => {
  render(<AccountBottomBar />);
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(5);
  expect(links.map((l) => l.textContent)).toEqual(['Explorer', 'Compas', 'Matériel', 'Hub', 'Compte']);
  expect(screen.getByRole('link', { name: 'Compte' })).toHaveAttribute('href', '/compte');
  expect(document.querySelector('.lens')?.getAttribute('aria-hidden')).toBe('true');
});
```

- [ ] **Step 2: Implémenter**

```tsx
const ACCOUNT_TABS = [
  { id: 'explorer', label: 'Explorer', href: '/explorer', icon: <Icon name="globe" size={19} /> },
  { id: 'compas', label: 'Compas', href: '/compas', icon: <Icon name="compass" size={19} /> },
  { id: 'materiel', label: 'Matériel', href: '/materiel', icon: <Icon name="backpack" size={19} /> },
  { id: 'hub', label: 'Hub', href: '/hub', icon: <Icon name="tent" size={19} /> },
  { id: 'compte', label: 'Compte', href: '/compte', icon: <Icon name="user" size={19} /> },
];

<nav className="tb" aria-label="Navigation principale">
  <span className="lens" aria-hidden="true" style={{ opacity: 0 }} />
  {ACCOUNT_TABS.map((item) => (
    <a key={item.id} href={item.href}>{item.icon}<span>{item.label}</span></a>
  ))}
</nav>
```

Les icônes doivent être **les mêmes que le Compte** : globe, boussole, sac, hub, utilisateur
(chemins du runtime `TABS`, pas un équivalent approximatif).

- [ ] **Step 3: Masquer la barre globale sur `/communaute`**

Dans `MobileNavWrapper`, ajouter `pathname === '/communaute'` à `isNoNavRoute` (la page rend
`AccountBottomBar`).

- [ ] **Step 4: Vérifier + commit**

`npx vitest run src/components/account/__tests__/AccountBottomBar.test.tsx` → PASS.
Capture 430 : une seule barre, 5 onglets Compte, aucun actif.

---

### Task 6: `AccountActionPill` + `AccountMoreMenu`

**Files:**
- Create: `src/components/account/AccountActionPill.tsx`, `AccountMoreMenu.tsx`
- Test: `src/components/account/__tests__/AccountActionPill.test.tsx`

**Interfaces:**
- Produces:
  - `<AccountActionPill liked onLike onComment onShare />` → `.pmi-post-actions` 3 × 34.
  - `<AccountMoreMenu open onSave onRepublish onCopy onReport />` → `.pmi-options-menu`.

- [ ] **Step 1: Test** — 3 boutons, `aria-pressed` sur like, menu 4 lignes.
- [ ] **Step 2: Implémenter** — mêmes classes, icônes 18 px, like `#E0245E`.
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 7: `AccountCreateSheet`

**Files:**
- Create: `src/components/account/AccountCreateSheet.tsx`
- Test: `src/components/account/__tests__/AccountCreateSheet.test.tsx`

**Interfaces:**
- Produces: `<AccountCreateSheet open onOpenChange onStory />`, **exactement 5 lignes**.

- [ ] **Step 1: Test** — 5 liens (`/carnets/nouveau`, `/voyages`, `/materiel`, `/clubs/nouveau`)
  + bouton story ; **aucun** lien `/communaute/publier`.
- [ ] **Step 2: Implémenter** — `Sheet hideTitle`, lignes verre, icônes, badges.
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 8: `useCommunityFeed`

**Files:**
- Create: `src/features/community/feed/useCommunityFeed.ts`
- Test: `src/features/community/feed/__tests__/useCommunityFeed.test.tsx`

**Interfaces:**
- Produces: `{ posts, loading, loadingMore, hasMore, error, loadMore, refresh }`.
- Query: `community_posts` `range(offset, offset+9)`, auteurs `public_profiles`, likes/saves.

- [ ] **Step 1: Test** — page 0 = 10, loadMore ajoute sans doublon, `hasMore=false` à la fin,
  erreur → `error`.
- [ ] **Step 2: Implémenter** — `useEffect` initial, `loadMore` avec `.range`, `AbortController`
  ou `requestId` pour éviter les races.
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 9: `usePostInteractions`

**Files:**
- Create: `src/features/community/feed/usePostInteractions.ts`
- Test: `src/features/community/feed/__tests__/usePostInteractions.test.tsx`

**Interfaces:**
- Produces: `{ liked, saved, counts, toggleLike, toggleSave, share, report }`.

- [ ] **Step 1: Test** — like appelle `toggle_community_post_like` ; save fait upsert/delete ;
  share copie le permalien ; report insère dans `comment_reports`.
- [ ] **Step 2: Implémenter** — reprendre la logique de `CommunityPostCard` (`:340-580`), sans UI.
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 10: `usePostComments` + `CommunityCommentsSheet`

**Files:**
- Create: `src/features/community/feed/usePostComments.ts`, `CommunityCommentsSheet.tsx`
- Test: `src/features/community/feed/__tests__/CommunityCommentsSheet.test.tsx`

**Interfaces:**
- Produces: `{ comments, loading, hasMore, loadMore, send, reply, like, edit, remove, report }`.
- Sheet: extrait du post (auteur + mini média), liste, composer.

- [ ] **Step 1: Test** — vide, chargement, envoi, réponse, erreur, non connecté.
- [ ] **Step 2: Implémenter** — reprendre `loadComments` / `handleSendComment` / `handleLikeComment`
  de `CommunityPostCard` (`:206-678`).
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 11: `CommunityFeedPost`

**Files:**
- Create: `src/features/community/feed/CommunityFeedPost.tsx`
- Test: `src/features/community/feed/__tests__/CommunityFeedPost.test.tsx`

**Interfaces:**
- Consumes: `post`, `onOpenComments`, `onOpenMenu`, `usePostInteractions`.
- Produces: un `article` carré avec `.pmi-media`, `.pmi-author`, `.pmi-post-actions`.

- [ ] **Step 1: Test**

```tsx
it('rend un carré, les 3 actions et le menu', () => {
  render(<CommunityFeedPost post={POST} onOpenComments={vi.fn()} />);
  expect(screen.getByRole('article')).toHaveClass('lkdv-feed-post');
  expect(screen.getByRole('button', { name: "J'aime" })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Commenter' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Partager' })).toBeVisible();
});
```

- [ ] **Step 2: Implémenter** — média `SmartImage`/`CommunityVideo`, tap like, double-tap,
  capsule, menu. **Aucune légende** sur les posts image. Si le post n'a pas d'image : carte verre
  `rgba(255,255,255,.62)` + blur 25 px, texte `#17402C` 15/1.4, padding `18px 18px 64px`,
  `height:auto`, `max-height:100cqw` (jamais plus haut que le carré), `min-height:120px`,
  `overflow:hidden` + dégradé de fin si le texte est plafonné.
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 12: `CommunityFeedShell`, `CommunityFeedTopBar`, `CommunityFeed`

**Files:**
- Create: `src/features/community/feed/CommunityFeedShell.tsx`, `CommunityFeedTopBar.tsx`, `CommunityFeed.tsx`
- Test: `src/features/community/feed/__tests__/CommunityFeed.test.tsx`

**Interfaces:**
- `CommunityFeedShell`: fond + colonne + `bottomBar` slot + `header` slot + children.
- `CommunityFeedTopBar`: `AccountAuthorPill` + `AccountRoundButton` + `onCreate`.
- `CommunityFeed`: `useCommunityFeed`, `CommunityFeedPost`, « Charger plus », états.

- [ ] **Step 1: Test** — top bar, stories, posts, empty, loading.
- [ ] **Step 2: Implémenter** — colonne max 520, padding bas barre.
- [ ] **Step 3: Vérifier + commit** — test PASS.

---

### Task 13: Brancher la page + stories + création + barre

**Files:**
- Modify: `src/app/communaute/page.tsx`, `src/components/communaute/CommunityStoriesBar.tsx`
- Test: `tests/e2e/communaute-feed.spec.ts`

**Interfaces:**
- `CommunityStoriesBar` : prop `heading?: boolean`, `pickerRef`/`onReady` pour ouvrir le file input.
- `page.tsx` : `FeedShell` + `TopBar` + `StoriesBar` + `Feed` + `AccountBottomBar` + `CreateSheet`.

- [ ] **Step 1: Test e2e** — 430 : auteur, +, stories, 10 posts carrés, **barre 5 onglets Compte** ;
  le + ouvre le drawer **5 lignes** ; le menu `···` a 4 lignes ; le commentaire ouvre la feuille ;
  un post texte ne dépasse pas la hauteur du carré.
- [ ] **Step 2: Implémenter** — `useAuth`, `useRouter` pour `?post=`/`?comment=`, pas de `?tab=`.
- [ ] **Step 3: Vérifier + commit** — e2e PASS, capture 430/1440.

---

### Task 14: Nettoyage

**Files:**
- Delete: les 7 composants listés + `useCommunityTotals.ts` + CSS mort + imports.
- Delete (routes) : `src/app/communaute/decouvrir/`, `reels/`, `publier/`, `post/`.
- Modify: `next.config.mjs` (redirects), `tests/design/community-social-contract.spec.ts`,
  `tests/visual/community-social.spec.ts`.

- [ ] **Step 1: `grep` des imports morts**

```bash
grep -rn "CommunityGrid\|CommunityContentDrawer\|CommunityHeroCard\|CommunityContextDrawer\|MobileCommunityHub\|MobileCommunityHeader\|useCommunityTotals" src tests
```

- [ ] **Step 2: Supprimer les fichiers et les blocs CSS**

```bash
git rm src/components/communaute/CommunityGrid.tsx \
  src/components/communaute/CommunityContentDrawer.tsx \
  src/components/communaute/shell/CommunityHeroCard.tsx \
  src/components/communaute/shell/CommunityContextDrawer.tsx \
  src/components/communaute/MobileCommunityHub.tsx \
  src/components/communaute/MobileCommunityHeader.tsx \
  src/features/community/useCommunityTotals.ts
```

Supprimer aussi les blocs CSS `.lkdv-hero*`, `.lkdv-community-grid*`, `.lkdv-content-drawer*`,
`.lkdv-community-view-lens`.

- [ ] **Step 3: Supprimer les anciennes pages Communauté + redirects**

```bash
git rm -r src/app/communaute/decouvrir src/app/communaute/reels \
  src/app/communaute/publier src/app/communaute/post
```

Dans `next.config.mjs`, ajouter :

```js
async redirects() {
  return [
    { source: '/communaute/decouvrir', destination: '/communaute', permanent: true },
    { source: '/communaute/reels', destination: '/communaute', permanent: true },
    { source: '/communaute/publier', destination: '/communaute', permanent: true },
    { source: '/communaute/post/:id', destination: '/communaute?post=:id', permanent: true },
  ];
}
```

Mettre à jour les liens entrants (`grep -rn "/communaute/decouvrir\|/communaute/reels\|/communaute/publier\|/communaute/post" src`)
vers `/communaute` ou `/communaute?post=`.

**Ne pas supprimer** `/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide` : 26 liens
internes (Compte, Pays, Carnets, Clubs, notifications) en dépendent. Les retirer seulement des
liens Communauté.

- [ ] **Step 4: Mettre à jour les tests** — contrat : top bar/stories/feed/post/actions ; visuel :
  430/768/1440, carré, 3 actions, barre, drawer.
- [ ] **Step 5: Vérifier + commit** — `tsc` 0, 41/41 + visuels verts.

---

### Task 15: Liens profonds du fil

**Files:**
- Modify: `src/features/community/feed/CommunityFeed.tsx`
- Test: `tests/e2e/communaute-feed.spec.ts`

**Interfaces:**
- `/communaute?post=<id>` scrolle jusqu'au post ; `?comment=<id>` ouvre la feuille et met le
  commentaire en évidence.
- `/communaute/post/<id>` **redirige** vers `/communaute?post=<id>` (redirect de Task 14).

- [ ] **Step 1: Test** — deep link ouvre la feuille, commentaire ciblé ; l'ancienne URL redirige.
- [ ] **Step 2: Implémenter** — `useEffect` scroll/focus dans `CommunityFeed`.
- [ ] **Step 3: Vérifier + commit** — e2e PASS.

---

### Task 16: A11y, perf, captures, rapport

**Files:**
- Create: `docs/communaute/RAPPORT-FEED.md`
- Test: `tests/a11y/communaute-feed.spec.ts`

- [ ] **Step 1: Lancer**

```bash
npm run type-check
npm test
npx playwright test tests/visual/community-social.spec.ts --config=playwright.visual.config.ts
npm run test:a11y
npm run build
```

- [ ] **Step 2: Mesurer** — First Load JS, LCP/INP/CLS, nombre de requêtes au premier écran
  (doit passer de 5+ à 2 : posts + stories).
- [ ] **Step 3: Captures** — 390/430/768/1440, clair/sombre, feed, menu, comments, create.
- [ ] **Step 4: Rédiger `RAPPORT-FEED.md`** — livré, preuves, restes, dettes.
- [ ] **Step 5: Commit**

```bash
git add docs/communaute/RAPPORT-FEED.md docs/communaute/feed-after tests/a11y
git commit -m "docs(communaute): rapport du fil Instagram"
```

---

## Auto-contrôle du plan

- [ ] Chaque section du spec a une tâche.
- [ ] Chaque tâche a un test, une commande et un commit.
- [ ] Les valeurs du Compte sont copiées, pas réinventées.
- [ ] Aucun import du runtime Compte.
- [ ] Aucune migration.
- [ ] Les décisions D1–D7 sont explicites dans le spec ; le plan prend les défauts.
- [ ] Le nettoyage supprime bien les 7 composants et le CSS mort.
- [ ] Le plan ne réintroduit pas de héro, de grille, de filtres ou de drawers de contenu.
