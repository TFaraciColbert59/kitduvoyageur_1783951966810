# Fiche carnet — alignement Compte/Communauté — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner `/carnets/[id]` sur les valeurs mesurées de `/compte` (colonne 406, carte 24, cercles 44, grille dans la carte) et remplacer ses modales plein écran par le drawer-carte du Compte (poignée, capsule 48 icônes, sous-capsule 30).

**Architecture:** La carte d'identité devient une surface unique : fermée, elle porte l'identité, les actions rapides et la grille ; ouverte, elle porte le drawer (poignée + capsule de volets + contenu). Aucun `OverlaySheet` pour commentaires / partage / parcours / gestion. Les sections restent empilées sous la carte, sans sélecteur.

**Tech Stack:** Next.js 15 (RSC), React 19, TypeScript, CSS global scopé `ckp-`, `CapsuleTabs`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-fiche-carnet-alignement-design.md`
**Comparatif mesuré :** `docs/audit/carnet-2026-10-24/13-comparatif-compte-communaute.md`

## Global Constraints

- **Tokens** (mesurés sur `/compte`, 430 × 932) : gouttière **12**, carte **406** / **r 24** / padding **14**, couverture **66** / **r 18**, stats **19/700 ls -0.38** + libellé **10,5/500 `#56665d` sans majuscules**, cellule stat **101 × 39 r 14**, bio **12/1.3 `#56665d`**, action **cercle 44 + libellé 9/500** (bloc 72 × 56), wrap grille **r 22**, tuile **134 r 2** gap 2, capsule **378 × 48** lentille **74 × 40** icônes seules, poignée **18** barre **40 × 4**, sous-capsule **30**, barre basse **402** à **14**.
- **Carte = plafond typographique 19 px.** Aucun texte de carte au-dessus.
- **Un seul sélecteur : la capsule du drawer.** Aucune capsule de sections.
- **Aucun voile sombre, aucun titre, aucune croix** dans le drawer : fermeture par poignée, re-clic, `Échap`.
- **Couleurs inchangées** : `#17402c`, `#56665d`, `#e0245e`, `#a33227`, `#3d7a52`. Verre inchangé.
- **Aucune donnée inventée** : `CarnetDetail` reste la seule source.
- **Périmètre** : `/carnets/[id]` uniquement. `/compte`, `/communaute`, `/carnets` intacts.
- Vérifications : `npm test -- --run src/components/carnet src/features/carnet`, build Vercel, captures 430 / 768 / 1440.

---

## Carte des fichiers

| Fichier | Rôle | État |
|---|---|---|
| `src/components/carnet/profile/CarnetCardDrawer.tsx` | carte-drawer : poignée, capsule, conteneur | créer |
| `src/components/carnet/profile/CarnetSubCapsule.tsx` | sous-sélecteur 30, 2 cellules | créer |
| `src/components/carnet/profile/CarnetMomentGrid.tsx` | grille 3 col dans la carte | créer |
| `src/components/carnet/profile/panes/CarnetCommentsPane.tsx` | volet commentaires + tri | créer |
| `src/components/carnet/profile/panes/CarnetSharePane.tsx` | volet partage | créer |
| `src/components/carnet/profile/panes/CarnetParcoursPane.tsx` | volet carte + GPX | créer |
| `src/components/carnet/profile/panes/CarnetManagePane.tsx` | volet gestion (owner) | créer |
| `src/components/carnet/profile/CarnetIdentityCard.tsx` | identité + actions 44 + grille | réécrire |
| `src/components/carnet/profile/CarnetProfileView.tsx` | état `pane`, câblage | réécrire |
| `src/styles/carnet-profile.css` | tokens et styles | réécrire les blocs concernés |
| `CarnetSectionTabs.tsx`, `CarnetMediaBlock.tsx`, `CarnetCommentsSheet.tsx`, `CarnetShareSheet.tsx`, `CarnetManageSheet.tsx`, `CarnetMapSheet.tsx` | supprimés | supprimer |

---

## Task 1: Coquille et tokens — colonne 12, carte 24, en-tête 56

**Files:**
- Modify: `src/styles/carnet-profile.css`
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx` (classes de coquille)
- Test: `src/components/carnet/profile/__tests__/CarnetShell.test.tsx`

**Interfaces:**
- Produces : `.ckp-shell` (colonne 12), `.ckp-card` (r 24), `.ckp-topbar` (40 de contenu), `.ckp-shell .tb` (402).

- [ ] **Step 1: Écrire le test de coquille (il échoue)**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarnetProfileView } from '../CarnetProfileView';

afterEach(() => cleanup());

describe('CarnetProfileView — coquille Compte', () => {
  it('utilise la colonne de la fiche, pas celle du fil', () => {
    const { container } = render(<CarnetProfileView detail={DETAIL} />);
    expect(container.querySelector('.lkdv-feed-column')).toBeNull();
    expect(container.querySelector('.ckp-shell')).toBeTruthy();
    expect(container.querySelector('.ckp-column')).toBeTruthy();
  });

  it('rend la barre basse du Compte, sans onglet actif', () => {
    const { container } = render(<CarnetProfileView detail={DETAIL} />);
    const nav = container.querySelector('nav.tb');
    expect(nav).toBeTruthy();
    expect(nav?.querySelector('a[aria-current="page"]')).toBeNull();
  });
});
```

> `DETAIL` est la fabrique de test déjà utilisée par `CarnetIdentityCard.test.tsx` : la déplacer dans `src/components/carnet/profile/__tests__/fixtures.ts` et l'importer dans les deux fichiers.

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetShell.test.tsx`
Expected: FAIL — `.ckp-column` absent.

- [ ] **Step 3: Ajouter les classes de coquille dans la vue**

```tsx
<div className="ckp-shell lkdv-account-glass">
  <h1 className="sr-only">{detail.title}</h1>
  <div className="ckp-column">
    <header className="ckp-header">{/* top bar */}</header>
    <main className="ckp-main">{/* carte + sections */}</main>
  </div>
  <AccountBottomBar />
</div>
```

`.ckp-header` remplace `lkdv-feed-header` : même sticky, padding `calc(safe + 8px) 2px 8px`, mais largeur 100 % de la colonne 12.

- [ ] **Step 4: Écrire les valeurs dans la feuille**

```css
/* --- Coquille : gouttière 12 du Compte (carte à x=12 sur 430) ------------- */

.ckp-shell { position: relative; min-height: 100dvh; width: 100%; color: var(--feed-ink); font-family: var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-column { width: 100%; max-width: 520px; margin-inline: auto; padding: 0 12px calc(78px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
.ckp-header { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; padding: calc(env(safe-area-inset-top, 0px) + 8px) 0 8px; }
.ckp-main { display: flex; flex-direction: column; gap: 10px; padding-top: 2px; }

/* Barre basse : 402 à x=14, comme le Compte (et non 410 à x=10). */
.ckp-shell .tb { width: min(calc(100% - 28px), 500px); }

.ckp-card {
  position: relative; border-radius: 24px; padding: 14px;
  background: rgba(255, 255, 255, .62);
  -webkit-backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
  backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .95), 0 0 0 .5px rgba(23, 43, 36, .10), 0 10px 26px rgba(23, 43, 36, .12);
  color: var(--feed-ink);
}
```

Retirer des règles devenues fausses : `.ckp-main` gap 10 padding-top 8 (remplacé), toute règle `border-radius: 28px` sur `.ckp-card`, `.ckp-section` et `.ckp-empty` → **24px**.

- [ ] **Step 5: Lancer le test, vérifier le vert**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetShell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Mesurer au navigateur**

```bash
npx playwright screenshot --viewport-size=430,932 "http://localhost:4000/carnets/<id>" /tmp/ckp-align-430.png
```

Dans la console du navigateur :

```js
const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.width)]; };
({ column: r('.ckp-column'), card: r('.ckp-card'), tb: r('.tb'), radius: getComputedStyle(document.querySelector('.ckp-card')).borderRadius });
```

Attendu : `card [12, 406]`, `tb [14, 402]`, `radius 24px`.

- [ ] **Step 7: Commit**

```bash
git add src/styles/carnet-profile.css src/components/carnet/profile
git commit -m "feat(carnet): coquille du Compte, colonne 12 et carte 24"
```

---

## Task 2: Carte d'identité v2 — stats 19/700, actions 44, bio 12

**Files:**
- Modify: `src/components/carnet/profile/CarnetIdentityCard.tsx`
- Modify: `src/styles/carnet-profile.css`
- Test: `src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`

**Interfaces:**
- Consumes : `CarnetDetail`.
- Produces : `<CarnetIdentityCard detail onOpenViewer onOpenAuthor onLike onOpenComments onOpenParcours onOpenManage onSave onExpandDescription />` — **plus de `activeSection` / `onSectionChange` / capsule**.

- [ ] **Step 1: Mettre à jour les tests (ils échouent)**

Remplacer dans `CarnetIdentityCard.test.tsx` :

```tsx
it('affiche les trois statistiques réelles avec la typo du Compte', () => {
  const { container } = renderCard();
  const values = [...container.querySelectorAll('.ckp-stat-v')].map((n) => n.textContent);
  expect(values).toEqual(['106,4 km', '2 002 m', '7']);
  expect(container.querySelectorAll('.ckp-stat')).toHaveLength(3);
});

it('rend trois actions rapides de 44 px avec libellés', () => {
  const onLike = vi.fn();
  const onOpenComments = vi.fn();
  renderCard({ onLike, onOpenComments });
  const actions = screen.getAllByRole('button', { name: /j’aime|commentaires|enregistrer/i });
  expect(actions).toHaveLength(3);
  expect(actions[0].className).toContain('ckp-action-btn');
  fireEvent.click(actions[0]);
  expect(onLike).toHaveBeenCalledOnce();
  fireEvent.click(actions[1]);
  expect(onOpenComments).toHaveBeenCalledOnce();
});

it('n’a plus de capsule de sections', () => {
  renderCard();
  expect(screen.queryByRole('tablist')).toBeNull();
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`
Expected: FAIL — `ckp-action-btn` absent, `tablist` encore présent.

- [ ] **Step 3: Réécrire la carte**

```tsx
'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetIdentityCardProps {
  detail: CarnetDetail;
  onOpenViewer: () => void;
  onOpenAuthor: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onOpenParcours: () => void;
  onOpenManage: () => void;
  onSave: () => void;
  onExpandDescription: () => void;
}

function Action({
  icon,
  label,
  onClick,
  pressed,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button type="button" className="ckp-action" onClick={onClick} aria-pressed={pressed}>
      <span className="ckp-action-btn">
        <Icon name={icon} size={20} aria-hidden="true" />
      </span>
      <span className="ckp-action-lbl">{label}</span>
    </button>
  );
}

export function CarnetIdentityCard({
  detail,
  onOpenViewer,
  onOpenAuthor,
  onLike,
  onOpenComments,
  onOpenParcours,
  onOpenManage,
  onSave,
  onExpandDescription,
}: CarnetIdentityCardProps) {
  const likesLabel = detail.engagement.likes > 1 ? `${detail.engagement.likes} j’aime` : '1 j’aime';
  const commentsLabel =
    detail.engagement.comments > 1 ? `${detail.engagement.comments} commentaires` : '1 commentaire';
  const showMore = Boolean(detail.description && detail.description.length > 160);

  return (
    <section className="ckp-card" aria-label="Identité du carnet">
      <div className="ckp-head">
        <div className="ckp-cover-wrap">
          {detail.coverImage ? (
            <button type="button" className="ckp-cover-btn" onClick={onOpenViewer} aria-label="Agrandir la couverture">
              {/* eslint-disable-next-line @next/next/no-img-element -- couverture distante */}
              <img className="ckp-cover" src={detail.coverImage} alt={detail.coverImageAlt ?? ''} />
            </button>
          ) : (
            <div className="ckp-cover ckp-cover--empty" aria-label="Sans couverture">
              <b aria-hidden="true">{(detail.destination ?? detail.title).charAt(0).toUpperCase()}</b>
            </div>
          )}
        </div>

        <div className="ckp-id-stats">
          {detail.stats.map((stat) => (
            <div className="ckp-stat" key={stat.key}>
              <b className="ckp-stat-v">{stat.value}</b>
              <span className="ckp-stat-l">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="ckp-title">{detail.title}</h2>
      <p className="ckp-meta">
        {[detail.destination, detail.dateRange].filter(Boolean).join(' · ')}
      </p>

      <button type="button" className="pmi-author ckp-author" onClick={onOpenAuthor}>
        {detail.author?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar distant
          <img className="pmi-author-av" src={detail.author.avatarUrl} alt="" />
        ) : (
          <span className="pmi-author-av pmi-author-initial" aria-hidden="true">
            {(detail.author?.name ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="pmi-author-txt">
          <b>{detail.author?.name ?? 'Auteur non renseigné'}</b>
          <small>{detail.author?.handle ? `@${detail.author.handle}` : 'Auteur du carnet'}</small>
        </span>
        {detail.author && detail.author.trustScore > 0 ? (
          <span className="ckp-trust">{detail.author.trustScore}</span>
        ) : null}
        {detail.verified ? <span className="ckp-badge">Vérifié</span> : null}
      </button>

      {detail.description ? (
        <>
          <p className="ckp-bio">{detail.description}</p>
          {showMore ? (
            <button type="button" className="ckp-desc-more" onClick={onExpandDescription}>
              Lire la suite
            </button>
          ) : null}
        </>
      ) : null}

      <div className="ckp-actions">
        <Action icon="heart" label={likesLabel} onClick={onLike} pressed={detail.engagement.liked} />
        <Action icon="message-square" label={commentsLabel} onClick={onOpenComments} />
        {detail.isOwner ? (
          <Action icon="pencil" label="Gérer" onClick={onOpenManage} />
        ) : (
          <Action icon="map" label="Parcours" onClick={onOpenParcours} />
        )}
      </div>

      <div className="ckp-actions-2">
        <Action
          icon="bookmark"
          label={detail.engagement.favorited ? 'Enregistré' : 'Enregistrer'}
          onClick={onSave}
          pressed={detail.engagement.favorited}
        />
      </div>
    </section>
  );
}

export default CarnetIdentityCard;
```

> La 4e action (Enregistrer) est volontairement hors de la rangée de trois : le Compte affiche **trois** cercles. Elle reste accessible dans le menu `···`. **Variante retenue** : trois cercles seulement — ♥, 💬, puis Gérer (owner) ou Parcours ; Enregistrer reste dans la top bar et le menu. Supprimer le bloc `.ckp-actions-2` et la prop `onSave` si cette variante est gardée.

- [ ] **Step 4: Styles**

```css
.ckp-head { display: flex; align-items: center; gap: 14px; }
.ckp-cover-wrap { flex: none; }
.ckp-cover-btn { border: 0; padding: 0; background: none; cursor: zoom-in; display: block; }
.ckp-cover { width: 66px; height: 66px; border-radius: 18px; object-fit: cover; display: block; box-shadow: inset 0 0 0 .5px rgba(23, 43, 36, .12); }
.ckp-cover--empty { display: grid; place-items: center; background: linear-gradient(160deg, #17402c, #3d7a52); color: #fff; }

.ckp-id-stats { display: flex; gap: 2px; flex: 1; min-width: 0; }
.ckp-stat { min-width: 0; min-height: 39px; padding: 0 6px; display: flex; flex-direction: column; justify-content: center; border-radius: 14px; }
.ckp-stat-v { font: 700 19px/1.05 var(--font-sans, -apple-system, system-ui, sans-serif); letter-spacing: -.38px; font-variant-numeric: tabular-nums; }
.ckp-stat-l { margin-top: 2px; color: var(--feed-muted); font: 500 10.5px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }

.ckp-title { margin: 12px 0 0; font: 700 19px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); letter-spacing: -.02em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ckp-meta { margin: 4px 0 0; color: var(--feed-muted); font: 500 11px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-author { margin-top: 10px; }
.ckp-author .pmi-author-av { width: 28px; height: 28px; }
.ckp-bio { margin: 10px 0 0; font: 400 12px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); color: var(--feed-muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ckp-badge { display: inline-flex; align-items: center; gap: 3px; flex: none; height: 18px; padding: 0 6px; border-radius: 999px; background: rgba(61, 122, 82, .12); color: #2f6b45; font: 700 9.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif); }

.ckp-actions { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; }
.ckp-action { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 72px; padding: 0; border: 0; background: none; cursor: pointer; }
.ckp-action-btn { position: relative; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 999px; background: rgba(255, 255, 255, .5); -webkit-backdrop-filter: blur(4px) saturate(1.9) brightness(1.07); backdrop-filter: blur(4px) saturate(1.9) brightness(1.07); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 0 0 .5px rgba(23, 43, 36, .10); color: var(--feed-ink); }
.ckp-action-btn::after { content: ''; position: absolute; inset: -2px; }
.ckp-action:active .ckp-action-btn { transform: scale(.94); }
.ckp-action-lbl { font: 500 9px/1.1 var(--font-sans, -apple-system, system-ui, sans-serif); color: var(--feed-ink); text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ckp-action[aria-pressed='true'] .ckp-action-btn { color: var(--feed-like); }
```

Supprimer `.ckp-pill` (plus utilisé dans la carte), `.ckp-stats`, `.ckp-stat-v` (ancien), `.ckp-title-row`, `.ckp-sub`, `.ckp-dates`, `.ckp-tabs`.

- [ ] **Step 5: Lancer les tests**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetIdentityCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/carnet/profile src/styles/carnet-profile.css
git commit -m "feat(carnet): carte d'identite alignee sur le Compte"
```

---

## Task 3: Grille de moments dans la carte

**Files:**
- Create: `src/components/carnet/profile/CarnetMomentGrid.tsx`
- Modify: `src/components/carnet/profile/CarnetIdentityCard.tsx` (rend la grille)
- Modify: `src/styles/carnet-profile.css`
- Test: `src/components/carnet/profile/__tests__/CarnetMomentGrid.test.tsx`

**Interfaces:**
- Consumes : `CarnetDetail['photoMoments']`.
- Produces : `<CarnetMomentGrid moments onOpenViewer isOwner />`.

- [ ] **Step 1: Test (échoue)**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetMomentGrid } from '../CarnetMomentGrid';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

const m = (i: number): CarnetMomentItem => ({ id: `m${i}`, dayNumber: 1, time: null, caption: null, authorName: null, place: null, imageUrl: `https://cdn.test/${i}.jpg` });

describe('CarnetMomentGrid — grille dans la carte', () => {
  it('affiche jusqu’à 9 tuiles et résume le reste', () => {
    const { container } = render(<CarnetMomentGrid moments={Array.from({ length: 12 }, (_, i) => m(i))} onOpenViewer={() => {}} isOwner={false} />);
    expect(container.querySelectorAll('.ckp-tile')).toHaveLength(9);
    expect(container.querySelector('.ckp-tile-more')?.textContent).toBe('+3');
    expect(container.querySelector('.ckp-grid-wrap')).toBeTruthy();
  });

  it('ouvre le viewer sur la bonne image', () => {
    const onOpenViewer = vi.fn();
    const { container } = render(<CarnetMomentGrid moments={[m(0), m(1)]} onOpenViewer={onOpenViewer} isOwner={false} />);
    fireEvent.click(container.querySelectorAll('.ckp-tile')[1]);
    expect(onOpenViewer).toHaveBeenCalledWith(1);
  });

  it('affiche l’état vide honnête', () => {
    render(<CarnetMomentGrid moments={[]} onOpenViewer={() => {}} isOwner={false} />);
    expect(screen.getByText('Aucun moment pour l’instant.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetMomentGrid.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

```tsx
'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';

export interface CarnetMomentGridProps {
  moments: CarnetMomentItem[];
  onOpenViewer: (index: number) => void;
  isOwner: boolean;
}

const MAX_TILES = 9;

/** Grille 3 colonnes du Compte, dans la carte : wrap r22, tuiles r2, gap 2. */
export function CarnetMomentGrid({ moments, onOpenViewer, isOwner }: CarnetMomentGridProps) {
  if (moments.length === 0) {
    return (
      <div className="ckp-grid-empty">
        <Icon name="image-plus" size={20} aria-hidden="true" />
        <b>Aucun moment pour l’instant.</b>
        <p>{isOwner ? 'Ajoutez un moment depuis votre carnet.' : 'L’auteur n’a pas encore ajouté de photo.'}</p>
      </div>
    );
  }

  const visible = moments.slice(0, MAX_TILES);
  const hidden = moments.length - visible.length;

  return (
    <div className="ckp-grid-wrap">
      {visible.map((moment, index) => (
        <button key={moment.id} type="button" className="ckp-tile" onClick={() => onOpenViewer(index)} aria-label={`Photo ${index + 1}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- image distante */}
          <img src={moment.imageUrl ?? ''} alt="" loading={index < 3 ? 'eager' : 'lazy'} />
          {index === MAX_TILES - 1 && hidden > 0 ? <span className="ckp-tile-more">+{hidden}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default CarnetMomentGrid;
```

```css
.ckp-grid-wrap { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; margin-top: 12px; border-radius: 22px; overflow: hidden; }
.ckp-tile { position: relative; aspect-ratio: 1 / 1; width: 100%; padding: 0; border: 0; overflow: hidden; background: #dfe8dc; cursor: pointer; border-radius: 2px; display: block; }
.ckp-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ckp-tile-more { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(10, 20, 14, .5); color: #fff; font: 700 17px/1 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-grid-empty { display: grid; place-items: center; gap: 6px; margin-top: 12px; padding: 22px 18px; border-radius: 22px; background: rgba(255, 255, 255, .35); text-align: center; color: var(--feed-muted); }
.ckp-grid-empty b { color: var(--feed-ink); font: 700 13px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-grid-empty p { margin: 0; max-width: 250px; font: 500 11.5px/1.4 var(--font-sans, -apple-system, system-ui, sans-serif); }
```

- [ ] **Step 4: Brancher dans la carte**

Après les actions : `<CarnetMomentGrid moments={detail.photoMoments} onOpenViewer={onOpenViewer} isOwner={detail.isOwner} />` et ajouter `onOpenViewer: (index: number) => void` aux props.

- [ ] **Step 5: Tests + commit**

Run: `npm test -- --run src/components/carnet/profile/__tests__`
Expected: PASS.

```bash
git add src/components/carnet/profile src/styles/carnet-profile.css
git commit -m "feat(carnet): grille de moments dans la carte"
```

---

## Task 4: Carte-drawer — poignée, capsule 48, sous-capsule 30

**Files:**
- Create: `src/components/carnet/profile/CarnetCardDrawer.tsx`
- Create: `src/components/carnet/profile/CarnetSubCapsule.tsx`
- Modify: `src/styles/carnet-profile.css`
- Test: `src/components/carnet/profile/__tests__/CarnetCardDrawer.test.tsx`

**Interfaces:**
- Produces :
  - `type CarnetPaneId = 'comments' | 'share' | 'parcours' | 'manage'`
  - `<CarnetCardDrawer detail pane onPaneChange onClose>{children}</CarnetCardDrawer>`
  - `<CarnetSubCapsule items active onChange ariaLabel />` avec `items: { id: string; label: string }[]`

- [ ] **Step 1: Test (échoue)**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCardDrawer } from '../CarnetCardDrawer';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import { DETAIL } from './fixtures';

afterEach(() => cleanup());

describe('CarnetCardDrawer — drawer-carte du Compte', () => {
  it('rend la poignée et la capsule des volets, sans titre ni croix', () => {
    render(
      <CarnetCardDrawer detail={DETAIL} pane="comments" onPaneChange={() => {}} onClose={() => {}}>
        <p>contenu</p>
      </CarnetCardDrawer>,
    );
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Volets du carnet' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Commentaires' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: /fermer la fenêtre/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Commentaires' })).toBeNull();
  });

  it('n’expose pas le volet Gérer à un visiteur', () => {
    render(
      <CarnetCardDrawer detail={{ ...DETAIL, isOwner: false }} pane="comments" onPaneChange={() => {}} onClose={() => {}}>
        <p>contenu</p>
      </CarnetCardDrawer>,
    );
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
  });

  it('remonte le changement de volet', () => {
    const onPaneChange = vi.fn();
    render(
      <CarnetCardDrawer detail={{ ...DETAIL, isOwner: true }} pane="comments" onPaneChange={onPaneChange} onClose={() => {}}>
        <p>contenu</p>
      </CarnetCardDrawer>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Gérer' }));
    expect(onPaneChange).toHaveBeenCalledWith('manage');
  });

  it('ferme au clic sur la poignée et sur Échap', () => {
    const onClose = vi.fn();
    render(
      <CarnetCardDrawer detail={DETAIL} pane="comments" onPaneChange={() => {}} onClose={onClose}>
        <p>contenu</p>
      </CarnetCardDrawer>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('CarnetSubCapsule — sous-sélecteur 30', () => {
  it('marque la cellule active et délègue', () => {
    const onChange = vi.fn();
    render(
      <CarnetSubCapsule
        items={[{ id: 'recent', label: 'Récents' }, { id: 'old', label: 'Anciens' }]}
        active="recent"
        onChange={onChange}
        ariaLabel="Tri des commentaires"
      />,
    );
    expect(screen.getByRole('button', { name: 'Récents' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Anciens' }));
    expect(onChange).toHaveBeenCalledWith('old');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetCardDrawer.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: `CarnetCardDrawer.tsx`**

```tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export type CarnetPaneId = 'comments' | 'share' | 'parcours' | 'manage';

export interface CarnetCardDrawerProps {
  detail: CarnetDetail;
  pane: CarnetPaneId;
  onPaneChange: (pane: CarnetPaneId) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const ICONS: Record<CarnetPaneId, string> = {
  comments: 'message-square',
  share: 'send',
  parcours: 'map',
  manage: 'pencil',
};

const LABELS: Record<CarnetPaneId, string> = {
  comments: 'Commentaires',
  share: 'Partage',
  parcours: 'Parcours',
  manage: 'Gérer',
};

/**
 * Carte-drawer du Compte : la carte devient la surface du panneau.
 * Poignée 18 px, capsule 48 en tête (icônes seules), aucun voile, aucun titre.
 */
export function CarnetCardDrawer({ detail, pane, onPaneChange, onClose, children }: CarnetCardDrawerProps) {
  const cardRef = useRef<HTMLElement | null>(null);

  const panes: CarnetPaneId[] = detail.isOwner
    ? ['comments', 'share', 'parcours', 'manage']
    : ['comments', 'share', 'parcours'];

  const items: CapsuleTabItem[] = panes.map((id) => ({
    id,
    label: LABELS[id],
    icon: <Icon name={ICONS[id]} size={18} aria-hidden="true" />,
  }));

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section
      className="ckp-card ckp-card--drawer"
      ref={cardRef as React.RefObject<HTMLElement>}
      tabIndex={-1}
      aria-label={`${LABELS[pane]} du carnet`}
      role="region"
    >
      <button type="button" className="ckp-grabber" onClick={onClose} aria-label="Fermer le panneau">
        <span aria-hidden="true" />
      </button>

      <CapsuleTabs
        items={items}
        activeIndex={Math.max(0, panes.indexOf(pane))}
        onIndexChange={(index) => onPaneChange(panes[index])}
        ariaLabel="Volets du carnet"
      />

      <div className="ckp-drawer-body">{children}</div>
    </section>
  );
}

export default CarnetCardDrawer;
```

- [ ] **Step 4: `CarnetSubCapsule.tsx`**

```tsx
'use client';

import React from 'react';

export interface CarnetSubCapsuleItem {
  id: string;
  label: string;
}

export interface CarnetSubCapsuleProps {
  items: CarnetSubCapsuleItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/** Sous-sélecteur 30 px du Compte (`ig-tabs-float`), cellules de 30 × 26. */
export function CarnetSubCapsule({ items, active, onChange, ariaLabel }: CarnetSubCapsuleProps) {
  return (
    <div className="ckp-sub" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === active}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default CarnetSubCapsule;
```

- [ ] **Step 5: Styles**

```css
.ckp-card--drawer { display: flex; flex-direction: column; gap: 10px; min-height: 360px; outline: none; }
.ckp-grabber { display: grid; place-items: center; width: 100%; height: 18px; padding: 0; border: 0; background: none; cursor: pointer; }
.ckp-grabber span { width: 40px; height: 4px; border-radius: 999px; background: rgba(23, 43, 36, .35); }
.ckp-grabber::after { content: ''; position: absolute; inset: 0; }
.ckp-drawer-body { min-height: 0; }

.ckp-sub { position: absolute; right: 10px; bottom: 10px; display: inline-flex; align-items: center; height: 30px; padding: 2px; border-radius: 999px; background: rgba(255, 255, 255, .34); -webkit-backdrop-filter: var(--bar-glass-blur); backdrop-filter: var(--bar-glass-blur); box-shadow: inset 0 0 0 .5px rgba(23, 43, 36, .08), 0 6px 16px rgba(23, 43, 36, .12); }
.ckp-sub button { position: relative; height: 26px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: var(--feed-muted); font: 600 10px/1 var(--font-sans, -apple-system, system-ui, sans-serif); cursor: pointer; }
.ckp-sub button[aria-pressed='true'] { background: #fff; color: var(--feed-ink); box-shadow: 0 1px 3px rgba(23, 43, 36, .14); }
.ckp-sub button::after { content: ''; position: absolute; inset: -7px -4px; }
```

> `.ckp-card--drawer` doit être `position: relative` (déjà porté par `.ckp-card`) pour ancrer `.ckp-sub`.

- [ ] **Step 6: Tests + commit**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetCardDrawer.test.tsx`
Expected: PASS (5 tests).

```bash
git add src/components/carnet/profile src/styles/carnet-profile.css
git commit -m "feat(carnet): carte-drawer avec poignee, capsule et sous-capsule"
```

---

## Task 5: Volets commentaires, partage, parcours, gestion

**Files:**
- Create: `src/components/carnet/profile/panes/CarnetCommentsPane.tsx`
- Create: `src/components/carnet/profile/panes/CarnetSharePane.tsx`
- Create: `src/components/carnet/profile/panes/CarnetParcoursPane.tsx`
- Create: `src/components/carnet/profile/panes/CarnetManagePane.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetCommentsPane.test.tsx`

**Interfaces:**
- Consumes : `CarnetComment`, `useCarnetComments`, `CarnetCardDrawer`, `CarnetSubCapsule`, `CarnetTraceMap`, `formatKm`, `formatElevation`.
- Produces : quatre composants de volet ; aucun `OverlaySheet`.

- [ ] **Step 1: Test du volet commentaires (échoue)**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCommentsPane } from '../panes/CarnetCommentsPane';

afterEach(() => cleanup());

const COMMENTS = [
  { id: 'c1', authorId: 'u1', authorName: 'Léonie', authorAvatar: null, content: 'Superbe', createdAt: '2026-05-06T10:00:00Z' },
  { id: 'c2', authorId: 'u2', authorName: 'Rachid', authorAvatar: null, content: 'Merci', createdAt: '2026-05-07T10:00:00Z' },
];

describe('CarnetCommentsPane', () => {
  it('trie du plus récent au plus ancien par défaut', () => {
    const { container } = render(
      <CarnetCommentsPane comments={COMMENTS} loading={false} canWrite currentUserId="u1" onSend={async () => true} onRemove={async () => true} onRequireAuth={() => {}} />,
    );
    const names = [...container.querySelectorAll('.ckp-comment-name')].map((n) => n.textContent);
    expect(names).toEqual(['Rachid', 'Léonie']);
    expect(screen.getByRole('group', { name: 'Tri des commentaires' })).toBeTruthy();
  });

  it('bascule le tri en anciens', () => {
    const { container } = render(
      <CarnetCommentsPane comments={COMMENTS} loading={false} canWrite currentUserId="u1" onSend={async () => true} onRemove={async () => true} onRequireAuth={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Anciens' }));
    const names = [...container.querySelectorAll('.ckp-comment-name')].map((n) => n.textContent);
    expect(names).toEqual(['Léonie', 'Rachid']);
  });

  it('affiche l’état vide du Compte', () => {
    render(
      <CarnetCommentsPane comments={[]} loading={false} canWrite currentUserId={null} onSend={async () => true} onRemove={async () => true} onRequireAuth={() => {}} />,
    );
    expect(screen.getByText('Sois le premier à répondre.')).toBeTruthy();
  });

  it('affiche le composer et envoie', async () => {
    const onSend = vi.fn(async () => true);
    render(
      <CarnetCommentsPane comments={[]} loading={false} canWrite currentUserId="u1" onSend={onSend} onRemove={async () => true} onRequireAuth={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Ajouter un commentaire'), { target: { value: 'Bravo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le commentaire' }));
    expect(onSend).toHaveBeenCalledWith('Bravo');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetCommentsPane.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: `CarnetCommentsPane.tsx`**

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';

export interface CarnetCommentsPaneProps {
  comments: CarnetComment[];
  loading: boolean;
  canWrite: boolean;
  currentUserId: string | null;
  onSend: (content: string) => Promise<boolean>;
  onRemove: (commentId: string) => Promise<boolean>;
  onRequireAuth: () => void;
}

const SORTS = [
  { id: 'recent', label: 'Récents' },
  { id: 'old', label: 'Anciens' },
];

export function CarnetCommentsPane({
  comments,
  loading,
  canWrite,
  currentUserId,
  onSend,
  onRemove,
  onRequireAuth,
}: CarnetCommentsPaneProps) {
  const [sort, setSort] = useState('recent');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const list = [...comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sort === 'recent' ? list.reverse() : list;
  }, [comments, sort]);

  const submit = async () => {
    if (!canWrite) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    if (await onSend(draft)) setDraft('');
    setBusy(false);
  };

  return (
    <div className="ckp-pane">
      {loading ? (
        <p className="ckp-pane-empty">Chargement…</p>
      ) : sorted.length === 0 ? (
        <div className="ckp-pane-empty">
          <b>Sois le premier à répondre.</b>
          <p>Aucun commentaire pour l’instant.</p>
        </div>
      ) : (
        <div className="ckp-pane-list">
          {sorted.map((comment) => (
            <div className="ckp-comment" key={comment.id}>
              {comment.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar distant
                <img className="ckp-avatar" src={comment.authorAvatar} alt="" />
              ) : (
                <span className="ckp-avatar ckp-avatar--initial" aria-hidden="true">
                  {comment.authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="ckp-comment-body">
                <span className="ckp-comment-name">{comment.authorName}</span>
                <span className="ckp-comment-time">
                  {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <p className="ckp-comment-text">{comment.content}</p>
              </div>
              {currentUserId && comment.authorId === currentUserId ? (
                <button type="button" className="ckp-link" onClick={() => void onRemove(comment.id)} aria-label="Supprimer mon commentaire">
                  <Icon name="trash2" size={15} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="ckp-composer">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={canWrite ? 'Ajouter un commentaire…' : 'Connectez-vous pour commenter'}
          aria-label="Ajouter un commentaire"
        />
        <button type="button" className="ckp-send" onClick={() => void submit()} disabled={busy || !draft.trim()} aria-label="Envoyer le commentaire">
          <Icon name="send" size={16} aria-hidden="true" />
        </button>
      </div>

      {sorted.length > 0 ? (
        <CarnetSubCapsule items={SORTS} active={sort} onChange={setSort} ariaLabel="Tri des commentaires" />
      ) : null}
    </div>
  );
}

export default CarnetCommentsPane;
```

- [ ] **Step 4: Les trois autres volets**

`CarnetSharePane.tsx` — même contenu que l'ancienne `CarnetShareSheet` **sans** `OverlaySheet` : bouton « Copier le lien » (`.ckp-pill ckp-pill--primary`), « Partager… » si `navigator.share`, liste `ckp-share-row` des 4 destinations, URL en `ckp-bio`.

`CarnetParcoursPane.tsx` — `CarnetTraceMap` dans `.ckp-map-wrap` (aspect 1:1, r 18), ligne stats `formatKm` / `formatElevation`, bouton GPX `disabled` sans trace, état vide « Aucune trace GPS. » + « Ce carnet n'a pas de trace enregistrée. ».

`CarnetManagePane.tsx` — 3 lignes `.ckp-row` : visibilité (bascule), exporter le JSON, copier le lien ; puis `.ckp-row--danger` supprimer avec confirmation **en place** (deux boutons Annuler / Supprimer, pas de sheet).

Styles communs :

```css
.ckp-pane { position: relative; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.ckp-pane-list { display: flex; flex-direction: column; max-height: 46dvh; overflow-y: auto; overscroll-behavior: contain; }
.ckp-pane-empty { display: grid; place-items: center; gap: 4px; padding: 26px 14px; text-align: center; color: var(--feed-muted); }
.ckp-pane-empty b { color: var(--feed-ink); font: 700 15px/1.2 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-pane-empty p { margin: 0; font: 500 11.5px/1.4 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-row { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 2px; border: 0; background: none; text-align: left; width: 100%; cursor: pointer; color: inherit; border-top: .5px solid rgba(23, 43, 36, .08); }
.ckp-row:first-child { border-top: 0; }
.ckp-row b { display: block; font: 600 13px/1.25 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-row small { display: block; color: var(--feed-muted); font: 500 10.5px/1.3 var(--font-sans, -apple-system, system-ui, sans-serif); }
.ckp-row--danger b { color: #a33227; }
.ckp-share-row { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 2px; border-top: .5px solid rgba(23, 43, 36, .08); text-decoration: none; color: var(--feed-ink); font: 600 12.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif); }
```

> Le composeur de commentaires garde la pilule 36 + envoi 34 : c'est la composition mesurée dans le panneau du post Communauté (`input` 36, `send` 34).

- [ ] **Step 5: Tests + commit**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetCommentsPane.test.tsx`
Expected: PASS (4 tests).

```bash
git add src/components/carnet/profile src/styles/carnet-profile.css
git commit -m "feat(carnet): quatre volets dans la carte-drawer"
```

---

## Task 6: Câblage, suppression des modales et des sections à onglets

**Files:**
- Modify: `src/components/carnet/profile/CarnetProfileView.tsx`
- Delete: `CarnetSectionTabs.tsx`, `CarnetMediaBlock.tsx`, `CarnetCommentsSheet.tsx`, `CarnetShareSheet.tsx`, `CarnetManageSheet.tsx`, `CarnetMapSheet.tsx`
- Delete: tests correspondants (`CarnetSectionTabs.test.tsx`, `CarnetMediaBlock.test.tsx`)
- Modify: `src/styles/carnet-profile.css`

**Interfaces:**
- Produces : `CarnetProfileView` sans `CapsuleTabs` de sections, avec `pane: CarnetPaneId | null`.

- [ ] **Step 1: Réécrire la vue**

```tsx
const [pane, setPane] = useState<CarnetPaneId | null>(null);

// Déclencheurs
onOpenComments={() => setPane('comments')}
onOpenParcours={() => setPane('parcours')}
onOpenManage={() => setPane('manage')}
// menu ··· : Partager → setPane('share') ; Gérer → setPane('manage') ; Signaler → ReportSheet
// top bar : Enregistrer → toggleFavorite (pas de drawer)

<main className="ckp-main">
  {pane ? (
    <CarnetCardDrawer detail={detailView} pane={pane} onPaneChange={setPane} onClose={() => setPane(null)}>
      {pane === 'comments' ? (
        <CarnetCommentsPane
          comments={comments.comments}
          loading={comments.loading}
          canWrite={canWrite}
          currentUserId={currentUserId}
          onSend={comments.send}
          onRemove={comments.remove}
          onRequireAuth={requireAuth}
        />
      ) : null}
      {pane === 'share' ? (
        <CarnetSharePane url={shareUrl} title={detail.title} onCopied={() => toast('Lien copié.', 'success')} />
      ) : null}
      {pane === 'parcours' ? (
        <CarnetParcoursPane detail={detail} onDownloadGpx={() => downloadGpx(detail.title, detail.trace)} />
      ) : null}
      {pane === 'manage' ? (
        <CarnetManagePane detail={detail} url={shareUrl} onExport={exportJson} onDeleted={() => router.push('/carnets')} />
      ) : null}
    </CarnetCardDrawer>
  ) : (
    <CarnetIdentityCard
      detail={detailView}
      onOpenViewer={() => setViewerIndex(0)}
      onOpenAuthor={() => detail.author && router.push(`/profil/${detail.author.id}`)}
      onLike={() => void engagement.toggleLike()}
      onOpenComments={() => setPane('comments')}
      onOpenParcours={() => setPane('parcours')}
      onOpenManage={() => setPane('manage')}
      onSave={() => void engagement.toggleFavorite()}
      onExpandDescription={() => document.getElementById('ckp-recit')?.scrollIntoView({ behavior: 'smooth' })}
    />
  )}

  <CarnetStorySection detail={detailView} />
  <CarnetKitSection detail={detailView} />
  <CarnetNatureSection canWrite={canWrite} onRequireAuth={requireAuth} />
  <CarnetCommentsPreview ... onOpenAll={() => setPane('comments')} />
</main>
```

- [ ] **Step 2: Supprimer les fichiers**

```bash
git rm src/components/carnet/profile/CarnetSectionTabs.tsx \
  src/components/carnet/profile/CarnetMediaBlock.tsx \
  src/components/carnet/profile/CarnetCommentsSheet.tsx \
  src/components/carnet/profile/CarnetShareSheet.tsx \
  src/components/carnet/profile/CarnetManageSheet.tsx \
  src/components/carnet/profile/CarnetMapSheet.tsx \
  src/components/carnet/profile/__tests__/CarnetSectionTabs.test.tsx \
  src/components/carnet/profile/__tests__/CarnetMediaBlock.test.tsx
```

- [ ] **Step 3: Vérifier qu'aucun `OverlaySheet` ne reste pour ces usages**

```bash
grep -rn "OverlaySheet" src/components/carnet || echo "aucun"
grep -rn "CarnetSectionTabs\|CarnetMediaBlock\|CarnetCommentsSheet\|CarnetShareSheet\|CarnetManageSheet\|CarnetMapSheet" src || echo "aucune référence"
```

Attendu : `aucun` / `aucune référence`.

- [ ] **Step 4: Tests + type-check**

```bash
npm test -- --run src/components/carnet src/features/carnet
NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.json
```

Expected: PASS, aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/carnet src/styles/carnet-profile.css
git commit -m "feat(carnet): drawers en place et suppression des modales"
```

---

## Task 7: Recette mesurée, build et production

**Files:**
- Create: `docs/audit/carnet-2026-10-24/14-recette-alignement.md`

- [ ] **Step 1: Tableau de conformité mesuré**

Pour chaque token du § 2 de la spec, mesurer dans la console du navigateur et consigner :

```js
const m = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
({
  cardX: document.querySelector('.ckp-card').getBoundingClientRect().x,
  cardW: document.querySelector('.ckp-card').getBoundingClientRect().width,
  cardR: m('.ckp-card', 'borderRadius'),
  cover: [document.querySelector('.ckp-cover').getBoundingClientRect().width, m('.ckp-cover', 'borderRadius')],
  statV: m('.ckp-stat-v', 'fontSize') + ' / ' + m('.ckp-stat-v', 'fontWeight'),
  statL: m('.ckp-stat-l', 'fontSize') + ' / ' + m('.ckp-stat-l', 'textTransform'),
  action: document.querySelector('.ckp-action-btn').getBoundingClientRect().width,
  tile: [document.querySelector('.ckp-tile').getBoundingClientRect().width, m('.ckp-tile', 'borderRadius')],
  tbW: document.querySelector('.tb').getBoundingClientRect().width,
});
```

Attendu : `cardX 12`, `cardW 406`, `cardR 24px`, `cover [66, 18px]`, `statV "19px / 700"`, `statL "10.5px / none"`, `action 44`, `tile [134, 2px]`, `tbW 402`.

- [ ] **Step 2: Captures**

```bash
npx playwright screenshot --viewport-size=430,932 --full-page "http://localhost:4000/carnets/<id>" /tmp/ckp-align-closed-430.png
```

Ouvrir le drawer (clic sur 💬), capturer `/tmp/ckp-align-drawer-430.png`. Refaire en 768 et 1440. `read_image` sur chaque.

- [ ] **Step 3: Recette drawer**

| # | Test | Attendu |
|---|---|---|
| 1 | Clic 💬 | La carte devient le drawer, poignée + capsule, aucun voile |
| 2 | Clic sur « Partage » | Le volet change, le contenu aussi |
| 3 | Clic sur « Gérer » (owner) | Volet gestion, bascule de visibilité réelle |
| 4 | `Échap` | Retour à la carte d'identité, focus rendu au déclencheur |
| 5 | Clic sur la poignée | Idem |
| 6 | Sous-capsule Récents/Anciens | Ordre inversé, sans rechargement |
| 7 | Visiteur | Pas de volet « Gérer », 3 volets |
| 8 | 768 / 1440 | Carte 406 centrée, drawer de même largeur |

- [ ] **Step 4: Déployer et vérifier**

```bash
git worktree add --detach /tmp/lkdv-align HEAD && cp .vercel/project.json /tmp/lkdv-align/.vercel/
cd /tmp/lkdv-align && npx vercel deploy --prod --yes
curl -s -o /dev/null -w '%{http_code}\n' "https://<deployment>/carnets/<id>"
```

Attendu : `EXIT:0`, `200`, captures de production identiques aux locales.

- [ ] **Step 5: Rapport et commit**

Écrire `14-recette-alignement.md` : tableau de conformité, captures, écarts résiduels. Puis :

```bash
git add docs/audit/carnet-2026-10-24/14-recette-alignement.md
git commit -m "docs(carnet): recette de l'alignement Compte/Communaute"
```

---

## Auto-revue

**Couverture de la spec :** tokens § 2 → tâches 1, 2, 3, 4 · carte fermée § 3 → tâches 2, 3 · drawer § 4 → tâches 4, 5 · volets § 5 → tâche 5 · correspondance des composants § 5 → tâche 6 · états et a11y § 6 → tâches 4, 5, 7 · suppressions § 7 → tâche 6 · preuve § 9 → tâche 7.

**Écarts assumés, écrits noir sur blanc :** la quatrième action (Enregistrer) est abandonnée au profit des trois cercles du Compte ; le parcours devient un volet et non plus un mode de la grille ; la capsule de sections disparaît ; le signalement reste `ReportSheet`.

**Cohérence des types :** `CarnetPaneId`, `CarnetSubCapsuleItem`, `CarnetCommentsPaneProps` sont définis une seule fois et consommés sous les mêmes noms en tâches 4, 5 et 6.
