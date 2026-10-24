# Fiche carnet — écran fixe et drawers — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer `/carnets/[id]` en écran fixe (aucun scroll de page) où la carte du carnet est la seule surface, avec sept drawers ouverts depuis ses éléments, une barre du haut à la grammaire Communauté, un sélecteur 31 px identique au Compte et une barre basse au pixel.

**Architecture:** La route rend un écran `100dvh` verrouillé : barre 48, carte 406 (`.card-scroll` interne, hauteur animée), barre basse 48. Chaque élément de la carte ouvre un drawer **dans la carte** (poignée + capsule 48 + sous-lens 30). Les sections ne sont plus dans le flux : elles sont des volets.

**Tech Stack:** Next.js 15 (RSC), React 19, TypeScript, CSS global `ckp-`, `CapsuleTabs`, Leaflet (dynamique), Vitest + Testing Library, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-24-fiche-carnet-ecran-fixe-drawers-design.md`

## Global Constraints

- **Écran fixe** : `html`, `body` et la route à `height: 100dvh`, `overflow: hidden`, `overscroll-behavior: none`. `scrollHeight === innerHeight` à 430, 768, 1440.
- **Carte** : 406, radius 24, `linear-gradient(180deg, rgba(255,255,255,.486), rgba(255,255,255,.384))`, `blur(25.2px) saturate(1.8) brightness(1.05)`, ombres Compte. Un seul `.card-scroll` interne.
- **Barre haute** : 48 ; pilule 40 (`600 13/1`, chevron 14) ; 3 `.gbtn` 38 (`plus`, `search`, `bell`).
- **Sélecteur** : 31 px, radius 12, fond `rgba(23,43,36,.06)`, lentille `.ckp-th` `rgba(255,255,255,.86)` radius 10, transition 320 ms `cubic-bezier(.22,1.15,.36,1)`.
- **Capsule de drawer** : 48, `lkdv-capsule`, lentille 74 × 40, 420 ms.
- **Sous-lens** : 30, cellules 26, bas-droite.
- **Barre basse** : 402 à x14, 48, icônes 19, libellés 10/500, lentille 79 × 40, aucun onglet actif (lentille `opacity: 0`).
- **Animations** : hauteur de carte 220 ms `cubic-bezier(.22,1,.36,1)` ; contenu 140 ms ; `prefers-reduced-motion` coupe tout.
- **Données réelles** : `CarnetDetail`, `carnet_likes`, `carnet_comments`, `public_profiles`. Aucun fallback.
- **Worktree isolé** : tout se fait dans `../lkdv-carnet-v4` créé depuis `carnet/align-v3` (le worktree principal est édité par un autre agent).
- Vérifications : `npm test -- --run src/components/carnet src/features/carnet`, build Vercel, script Playwright de mesure, `curl`.

---

## Carte des fichiers

| Fichier | Rôle | État |
|---|---|---|
| `src/components/carnet/profile/CarnetScreen.tsx` | écran fixe : barre, carte, barre basse | créer |
| `src/components/carnet/profile/CarnetTopBar.tsx` | pilule + 3 gbtn Communauté | réécrire |
| `src/components/carnet/profile/CarnetCard.tsx` | identité + stats boutons + actions + médias + sélecteur | réécrire (ex-`CarnetIdentityCard`) |
| `src/components/carnet/profile/CarnetDrawer.tsx` | coquille drawer : poignée, capsule, sous-lens, hauteur animée | créer |
| `src/components/carnet/profile/CarnetMediaTabs.tsx` | sélecteur 31 px (`.ckp-tabs`) | créer |
| `src/components/carnet/profile/panes/CarnetRecitPane.tsx` | volet Récit | créer |
| `src/components/carnet/profile/panes/CarnetEtapesPane.tsx` | volet Étapes | créer |
| `src/components/carnet/profile/panes/CarnetKitPane.tsx` | volet Matériel | créer |
| `src/components/carnet/profile/panes/CarnetNaturePane.tsx` | volet Nature | créer |
| `src/components/carnet/profile/panes/CarnetParcoursPane.tsx` | volet Parcours (carte + GPX) | créer |
| `src/components/carnet/profile/panes/CarnetCommentsPane.tsx` | volet Commentaires | conserver |
| `src/components/carnet/profile/panes/CarnetLikesPane.tsx` | volet J’aime | créer |
| `src/components/carnet/profile/panes/CarnetManagePane.tsx` | volet Gérer | conserver |
| `src/components/carnet/profile/panes/CarnetSharePane.tsx` | volet Partage | conserver |
| `src/components/carnet/profile/CarnetPostDrawer.tsx` | drawer Post d’un moment | créer |
| `src/features/carnet/detail/getCarnetDetail.ts` | ajout des `likers` | modifier |
| `src/features/carnet/detail/types.ts` | `CarnetLiker` | modifier |
| `src/app/carnets/[id]/page.tsx` | rend `CarnetScreen` | modifier |
| `src/styles/carnet-profile.css` | écran fixe, sélecteur, barre, drawers | réécrire les blocs |

---

## Task 1: Écran fixe, worktree isolé, coquille

**Files:**
- Create: `src/components/carnet/profile/CarnetScreen.tsx`
- Modify: `src/styles/carnet-profile.css`
- Modify: `src/app/carnets/[id]/page.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetScreen.test.tsx`

**Interfaces:**
- Produces : `<CarnetScreen detail={CarnetDetail} />` ; classes `.ckp-screen`, `.ckp-screen-header`, `.ckp-screen-body`, `.ckp-screen-bar`.

- [ ] **Step 1: Worktree isolé**

```bash
cd ~/Desktop/lkdv-communaute-feed
git worktree add ../lkdv-carnet-v4 carnet/align-v3
cd ../lkdv-carnet-v4
cp ../lkdv-communaute-feed/.env.local .
ln -s ../lkdv-communaute-feed/node_modules node_modules
```

- [ ] **Step 2: Test d'écran fixe (échoue)**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => ({}) }) }));

import { CarnetScreen } from '../CarnetScreen';
import { DETAIL } from './fixtures';

afterEach(() => cleanup());

describe('CarnetScreen — écran fixe', () => {
  it('rend une seule colonne verrouillée, sans section dans le flux', () => {
    const { container } = render(<CarnetScreen detail={DETAIL} />);
    expect(container.querySelector('.ckp-screen')).toBeTruthy();
    expect(container.querySelector('.ckp-shell')).toBeNull();
    expect(container.querySelector('.ckp-main')).toBeNull();
    expect(container.querySelector('.ckp-column')).toBeTruthy();
  });

  it('monte la barre basse du Compte', () => {
    const { container } = render(<CarnetScreen detail={DETAIL} />);
    expect(container.querySelector('nav.tb')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Lancer, voir l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetScreen.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 4: `CarnetScreen.tsx`**

```tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import ReportSheet from '@/components/social/ReportSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { useCarnetComments } from '@/features/carnet/detail/useCarnetComments';
import { useCarnetEngagement } from '@/features/carnet/detail/useCarnetEngagement';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetTopBar } from './CarnetTopBar';
import { CarnetCard } from './CarnetCard';
import { CarnetDrawer, type CarnetDrawerId } from './CarnetDrawer';
import { CarnetPostDrawer } from './CarnetPostDrawer';
import { CarnetMoreMenu } from './CarnetMoreMenu';
import { CarnetMediaViewer } from './CarnetMediaViewer';
import { downloadGpx } from './downloadGpx';

export interface CarnetScreenProps {
  detail: CarnetDetail;
}

/** Fiche carnet : écran verrouillé, la carte est la seule surface. */
export function CarnetScreen({ detail }: CarnetScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;
  const canWrite = Boolean(user?.id) && !user?.is_anonymous;

  const [drawer, setDrawer] = useState<CarnetDrawerId | null>(null);
  const [postIndex, setPostIndex] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [mediaMode, setMediaMode] = useState<'grid' | 'map'>('grid');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const requireAuth = useCallback(() => {
    toast(user?.id ? 'Créez un compte pour enregistrer ou commenter.' : 'Connectez-vous pour continuer.', 'info');
    router.push(`/connexion?next=/carnets/${detail.id}`);
  }, [detail.id, router, toast, user?.id]);

  const engagement = useCarnetEngagement({ carnetId: detail.id, initial: detail.engagement, userId: currentUserId, onRequireAuth: requireAuth });
  const comments = useCarnetComments({ carnetId: detail.id, user });

  useEffect(() => { void engagement.registerView(); }, [engagement.registerView]);

  const detailView = useMemo(
    () => ({ ...detail, engagement: { ...detail.engagement, liked: engagement.liked, likes: engagement.likes, favorited: engagement.favorited } }),
    [detail, engagement.favorited, engagement.liked, engagement.likes],
  );

  return (
    <div className="ckp-screen">
      <header className="ckp-screen-header">
        <CarnetTopBar title={detail.title} onOpenCarnet={() => setDrawer('carnet')} onMenu={() => setMenuOpen((v) => !v)} menu={
          <CarnetMoreMenu
            open={menuOpen}
            saved={engagement.favorited}
            isOwner={detail.isOwner}
            onSave={() => void engagement.toggleFavorite()}
            onShare={() => setDrawer('share')}
            onCopy={() => { void navigator.clipboard.writeText(`${window.location.origin}/carnets/${detail.id}`); toast('Lien copié.', 'success'); }}
            onReport={() => setReportOpen(true)}
            onManage={() => setDrawer('manage')}
            onClose={() => setMenuOpen(false)}
          />
        } />
      </header>

      <div className="ckp-screen-body">
        {drawer ? (
          <CarnetDrawer detail={detailView} drawer={drawer} onDrawerChange={setDrawer} onClose={() => setDrawer(null)}>
            {/* volets : tâches 5 à 8 */}
          </CarnetDrawer>
        ) : postIndex !== null ? (
          <CarnetPostDrawer
            detail={detailView}
            index={postIndex}
            onIndexChange={setPostIndex}
            onClose={() => setPostIndex(null)}
            comments={comments}
            canWrite={canWrite}
            currentUserId={currentUserId}
            onRequireAuth={requireAuth}
            onOpenViewer={setViewerIndex}
            onShare={() => setDrawer('share')}
          />
        ) : (
          <CarnetCard
            detail={detailView}
            mediaMode={mediaMode}
            onMediaModeChange={setMediaMode}
            onOpenCarnet={() => setDrawer('carnet')}
            onOpenStat={(stat) => setDrawer(stat)}
            onOpenComments={() => setDrawer('comments')}
            onOpenLikes={() => setDrawer('likes')}
            onOpenParcours={() => setDrawer('parcours')}
            onOpenManage={() => setDrawer('manage')}
            onLike={() => void engagement.toggleLike()}
            onOpenAuthor={() => { if (detail.author) router.push(`/profil/${detail.author.id}`); }}
            onOpenPost={setPostIndex}
            onOpenViewer={setViewerIndex}
            onDownloadGpx={() => downloadGpx(detail.title, detail.trace)}
          />
        )}
      </div>

      <AccountBottomBar />

      {viewerIndex !== null ? (
        <CarnetMediaViewer items={detail.photoMoments} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}

      <ReportSheet isOpen={reportOpen} onClose={() => setReportOpen(false)} contentId={detail.id} contentType="carnet" onSubmitReport={async (reason, details) => {
        if (!currentUserId) { requireAuth(); return; }
        const { error } = await createClient().from('comment_reports').insert({ comment_id: detail.id, reporter_id: currentUserId, reason: details ? `${reason} — ${details}` : reason, table_name: 'carnets' });
        toast(error ? 'Le signalement n’a pas pu être envoyé.' : 'Signalement envoyé. Merci.', error ? 'error' : 'success');
        setReportOpen(false);
      }} />
    </div>
  );
}

export default CarnetScreen;
```

- [ ] **Step 5: CSS de l'écran**

```css
html:has(.ckp-screen), body:has(.ckp-screen) { height: 100dvh; overflow: hidden; overscroll-behavior: none; }

.ckp-screen {
  position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100dvh; width: 100%; overflow: hidden;
  color: var(--feed-ink);
  font-family: var(--font-sans, -apple-system, system-ui, sans-serif);
}
.ckp-screen-header { padding: calc(env(safe-area-inset-top, 0px) + 4px) 12px 4px; }
.ckp-screen-body {
  position: relative; display: flex; flex-direction: column; min-height: 0;
  padding: 0 12px; padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px));
}
.ckp-column { width: 100%; max-width: 430px; margin-inline: auto; }
.ckp-shell .tb, .ckp-screen .tb { width: min(calc(100% - 28px), 402px); }
```

- [ ] **Step 6: Page**

```tsx
import CarnetScreen from '@/components/carnet/profile/CarnetScreen';
// …
return (<>{jsonLd}<CarnetScreen detail={detail} /></>);
```

- [ ] **Step 7: Tests + commit**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetScreen.test.tsx`
Expected: PASS.

```bash
git add -A && git commit -m "feat(carnet): ecran fixe verrouille"
```

---

## Task 2: Barre du haut — grammaire Communauté

**Files:**
- Modify: `src/components/carnet/profile/CarnetTopBar.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx`

**Interfaces:**
- Consumes : `plus`, `search`, `bell` du registre d'icônes ; `useAccountUnreadCount` de `@/features/community/feed/useAccountUnreadCount`.
- Produces : `<CarnetTopBar title onOpenCarnet onMenu menu />`.

- [ ] **Step 1: Test (échoue)**

```tsx
it('rend la pilule Communauté et les trois boutons +, recherche, cloche', () => {
  render(<CarnetTopBar title="Tour du Mont-Blanc" onOpenCarnet={() => {}} onMenu={() => {}} />);
  const pill = screen.getByRole('button', { name: /Tour du Mont-Blanc/ });
  expect(pill.className).toContain('ckp-title-pill');
  expect(pill.querySelector('.ckp-title-chevron')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Créer' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Rechercher/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Notifications/ })).toBeTruthy();
});

it('ouvre le drawer Carnet au clic sur la pilule', () => {
  const onOpenCarnet = vi.fn();
  render(<CarnetTopBar title="Tour" onOpenCarnet={onOpenCarnet} onMenu={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Tour/ }));
  expect(onOpenCarnet).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémentation**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAccountUnreadCount } from '@/features/community/feed/useAccountUnreadCount';

export interface CarnetTopBarProps {
  title: string;
  onOpenCarnet: () => void;
  onMenu: () => void;
  menu?: React.ReactNode;
  onCreate?: () => void;
  onSearch?: () => void;
}

/** Barre du haut de la Communauté : pilule 40 + trois `.gbtn` 38. */
export function CarnetTopBar({ title, onOpenCarnet, onMenu, menu = null, onCreate, onSearch }: CarnetTopBarProps) {
  const unread = useAccountUnreadCount(undefined);

  return (
    <div className="ckp-topbar">
      <button type="button" className="ckp-title-pill" onClick={onOpenCarnet} aria-label={`Carnet ${title}`}>
        <b>{title}</b>
        <svg className="ckp-title-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>

      <div className="ckp-top-actions">
        <button type="button" className="gbtn" aria-label="Créer" onClick={onCreate}>
          <Icon name="plus" size={18} aria-hidden="true" />
        </button>
        <button type="button" className="gbtn" aria-label="Rechercher dans la communauté" onClick={onSearch}>
          <Icon name="search" size={17} aria-hidden="true" />
        </button>
        <Link href="/compte?tab=notifications" className="gbtn ckp-notif" aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}>
          <Icon name="bell" size={17} aria-hidden="true" />
          {unread > 0 ? <span className="ckp-notif-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
        <span className="ckp-more-anchor">
          <button type="button" className="gbtn" aria-label="Options du carnet" onClick={onMenu}>
            <Icon name="more-horizontal" size={18} aria-hidden="true" />
          </button>
          {menu}
        </span>
      </div>
    </div>
  );
}

export default CarnetTopBar;
```

- [ ] **Step 4: CSS**

```css
.ckp-title-pill {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 40px; padding: 0 14px;
  border: 0; border-radius: 999px; background: var(--bar-glass-bg);
  -webkit-backdrop-filter: var(--bar-glass-blur); backdrop-filter: var(--bar-glass-blur);
  box-shadow: var(--bar-thumb-shadow); color: var(--feed-ink); cursor: pointer;
}
.ckp-title-pill b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 13px/1 var(--font-sans); }
.ckp-title-chevron { flex: none; opacity: .7; }
.ckp-notif { position: relative; }
.ckp-notif-badge {
  position: absolute; top: -2px; right: -2px; min-width: 16px; height: 16px; padding: 0 4px;
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  background: #e0245e; color: #fff; font: 700 9px/1 var(--font-sans);
}
```

- [ ] **Step 5: Tests + commit**

```bash
git add -A && git commit -m "feat(carnet): barre du haut de la Communaute"
```

---

## Task 3: Carte, statistiques boutons, sélecteur 31 px

**Files:**
- Create: `src/components/carnet/profile/CarnetMediaTabs.tsx`
- Create: `src/components/carnet/profile/CarnetCard.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetCard.test.tsx`

**Interfaces:**
- Produces :
  - `<CarnetCard detail mediaMode onMediaModeChange onOpenCarnet onOpenStat onOpenComments onOpenLikes onOpenParcours onOpenManage onLike onOpenAuthor onOpenPost onOpenViewer onDownloadGpx />`
  - `type CarnetStatDrawer = 'parcours' | 'etapes'`
  - `<CarnetMediaTabs items active onChange ariaLabel />` (`.ckp-tabs`, `.ckp-th`)

- [ ] **Step 1: Test (échoue)**

```tsx
it('rend les statistiques comme des boutons qui ouvrent un drawer', () => {
  const onOpenStat = vi.fn();
  render(<CarnetCard {...baseProps} onOpenStat={onOpenStat} />);
  const distance = screen.getByRole('button', { name: /106,4 km/ });
  fireEvent.click(distance);
  expect(onOpenStat).toHaveBeenCalledWith('parcours');
  fireEvent.click(screen.getByRole('button', { name: /7 jours/i }));
  expect(onOpenStat).toHaveBeenCalledWith('etapes');
});

it('ouvre le drawer Carnet au clic sur la couverture', () => {
  const onOpenCarnet = vi.fn();
  render(<CarnetCard {...baseProps} onOpenCarnet={onOpenCarnet} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
  expect(onOpenCarnet).toHaveBeenCalledOnce();
});

it('ouvre le post du moment au clic sur une tuile', () => {
  const onOpenPost = vi.fn();
  render(<CarnetCard {...baseProps} onOpenPost={onOpenPost} />);
  fireEvent.click(screen.getAllByRole('button', { name: /Moment/ })[0]);
  expect(onOpenPost).toHaveBeenCalledWith(0);
});

it('sélecteur 31 px avec lentille et deux cellules', () => {
  const { container } = render(<CarnetCard {...baseProps} />);
  const tabs = container.querySelector('.ckp-tabs');
  expect(tabs).toBeTruthy();
  expect(tabs?.getAttribute('aria-label')).toBe('Affichage des médias');
  expect(container.querySelector('.ckp-th')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Grille des moments' }).getAttribute('aria-selected')).toBe('true');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `CarnetMediaTabs.tsx`**

```tsx
'use client';

import React from 'react';

export interface CarnetMediaTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface CarnetMediaTabsProps {
  items: CarnetMediaTab[];
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel: string;
}

/** Sélecteur 31 px du Compte (`.ig-tabs` + lentille `.ig-th`). */
export function CarnetMediaTabs({ items, activeIndex, onChange, ariaLabel }: CarnetMediaTabsProps) {
  return (
    <div className="ckp-tabs" role="tablist" aria-label={ariaLabel} style={{ '--n': items.length } as React.CSSProperties}>
      <span className="ckp-th" aria-hidden="true" style={{ '--i': activeIndex } as React.CSSProperties} />
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={index === activeIndex}
          aria-label={item.label}
          onClick={() => onChange(index)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

export default CarnetMediaTabs;
```

- [ ] **Step 4: `CarnetCard.tsx`**

Structure (le détail du code suit le § 2 de la spec) :

```tsx
<section className="ckp-card">
  <div className="ckp-card-scroll">
    <div className="ckp-head">
      <button type="button" className="ckp-cover-btn" onClick={onOpenCarnet} aria-label="Ouvrir le carnet">…</button>
      <div className="ckp-id-stats">
        {detail.stats.map((stat) => (
          <button
            key={stat.key}
            type="button"
            className="ckp-stat"
            onClick={() => onOpenStat(stat.key === 'days' ? 'etapes' : 'parcours')}
            aria-label={`${stat.label} ${stat.value}`}
          >
            <b className="ckp-stat-v">{stat.value}</b>
            <span className="ckp-stat-l">{stat.label}</span>
          </button>
        ))}
      </div>
    </div>

    <p className="ckp-bio-line">{context}</p>
    <button type="button" className="ckp-author-line" onClick={onOpenAuthor} aria-label={detail.author?.name}>…</button>
    <p className="ckp-bio">{detail.description}</p>

    <div className="ckp-actions">
      <Action icon="heart" label="J’aime" count={detail.engagement.likes} onClick={onLike} pressed={detail.engagement.liked} />
      <Action icon="message-square" label="Commenter" count={detail.engagement.comments} onClick={onOpenComments} />
      {detail.isOwner
        ? <Action icon="pencil" label="Gérer" onClick={onOpenManage} />
        : <Action icon="map" label="Parcours" onClick={onOpenParcours} />}
    </div>

    <div className="ckp-media">
      {mediaMode === 'grid'
        ? <CarnetMomentGrid moments={detail.photoMoments} onOpenViewer={() => {}} onOpenPost={onOpenPost} isOwner={detail.isOwner} />
        : <CarnetTraceMap … />}
      <CarnetMediaTabs
        items={[
          { id: 'grid', label: 'Grille des moments', icon: <GridIcon /> },
          { id: 'map', label: 'Carte du parcours', icon: <Icon name="map" size={15} /> },
        ]}
        activeIndex={mediaMode === 'grid' ? 0 : 1}
        onChange={(index) => onMediaModeChange(index === 0 ? 'grid' : 'map')}
        ariaLabel="Affichage des médias"
      />
    </div>
  </div>
</section>
```

`CarnetMomentGrid` change sa signature : `onOpenPost(index)` remplace `onOpenViewer(index)` ; la tuile porte `aria-label={'Moment ' + (index + 1)}`.

- [ ] **Step 5: CSS**

```css
.ckp-card { display: flex; flex-direction: column; min-height: 0; max-height: 100%; border-radius: 24px; overflow: hidden; background: linear-gradient(180deg, rgba(255,255,255,.486), rgba(255,255,255,.384)); backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 1px rgba(255,255,255,.4), 0 0 0 .5px rgba(23,43,36,.12); transition: height 220ms cubic-bezier(.22,1,.36,1); }
.ckp-card-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 10px 14px 14px; scrollbar-width: none; }
.ckp-card-scroll::-webkit-scrollbar { display: none; }
.ckp-stat { border: 0; background: none; cursor: pointer; text-align: center; border-radius: 14px; }
.ckp-stat:active { transform: scale(.95); }
.ckp-tabs { position: absolute; right: 10px; bottom: 10px; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; height: 31px; padding: 2px; border-radius: 12px; background: rgba(23,43,36,.06); box-shadow: inset 0 1px 1px rgba(23,43,36,.06), inset 0 -1px 0 rgba(255,255,255,.65); }
.ckp-tabs button { position: relative; z-index: 1; width: 22px; border: 0; background: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; color: var(--feed-muted); cursor: pointer; transition: color .18s; }
.ckp-tabs button[aria-selected='true'] { color: #17402c; }
.ckp-tabs .ckp-th { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--n, 2)); border-radius: 10px; background: rgba(255,255,255,.86); box-shadow: 0 2px 6px rgba(23,43,36,.1), inset 0 1px 0 #fff; transform: translateX(calc(var(--i, 0) * 100%)); transition: transform .32s cubic-bezier(.22,1.15,.36,1); }
```

- [ ] **Step 6: Tests + commit**

```bash
git add -A && git commit -m "feat(carnet): carte, stats boutons et selecteur 31"
```

---

## Task 4: Coquille de drawer

**Files:**
- Create: `src/components/carnet/profile/CarnetDrawer.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetDrawer.test.tsx`

**Interfaces:**
- Produces :
  - `type CarnetDrawerId = 'carnet' | 'parcours' | 'etapes' | 'comments' | 'likes' | 'share' | 'manage'`
  - `<CarnetDrawer detail drawer onDrawerChange onClose>{children}</CarnetDrawer>`

- [ ] **Step 1: Test (échoue)**

```tsx
it('rend la poignée, la capsule et applique la hauteur de drawer', () => {
  const { container } = render(
    <CarnetDrawer detail={DETAIL} drawer="carnet" onDrawerChange={() => {}} onClose={() => {}}>
      <p>volet</p>
    </CarnetDrawer>,
  );
  expect(container.querySelector('.ckp-card--drawer')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
  expect(screen.getByRole('tablist', { name: 'Volets du carnet' })).toBeTruthy();
});

it('n’expose que les volets disponibles pour un visiteur', () => {
  render(<CarnetDrawer detail={DETAIL} drawer="carnet" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
  expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
});

it('ferme sur Échap', () => {
  const onClose = vi.fn();
  render(<CarnetDrawer detail={DETAIL} drawer="carnet" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -- --run …/CarnetDrawer.test.tsx` → FAIL.

- [ ] **Step 3: Implémentation**

```tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export type CarnetDrawerId = 'carnet' | 'parcours' | 'etapes' | 'comments' | 'likes' | 'share' | 'manage';

export interface CarnetDrawerProps {
  detail: CarnetDetail;
  drawer: CarnetDrawerId;
  onDrawerChange: (id: CarnetDrawerId) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const PANES: { id: CarnetDrawerId; label: string; icon: string }[] = [
  { id: 'carnet', label: 'Carnet', icon: 'book-open' },
  { id: 'parcours', label: 'Parcours', icon: 'map' },
  { id: 'etapes', label: 'Étapes', icon: 'route' },
  { id: 'comments', label: 'Commentaires', icon: 'message-square' },
  { id: 'likes', label: 'J’aime', icon: 'heart' },
  { id: 'share', label: 'Partage', icon: 'send' },
  { id: 'manage', label: 'Gérer', icon: 'pencil' },
];

export function CarnetDrawer({ detail, drawer, onDrawerChange, onClose, children }: CarnetDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const available = PANES.filter((pane) => pane.id !== 'manage' || detail.isOwner);
  const items: CapsuleTabItem[] = available.map((pane) => ({
    id: pane.id,
    label: pane.label,
    icon: <Icon name={pane.icon} size={18} aria-hidden="true" />,
  }));

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section className="ckp-card ckp-card--drawer" ref={ref as React.RefObject<HTMLElement>} tabIndex={-1} role="region" aria-label="Panneau du carnet">
      <button type="button" className="ckp-grabber" onClick={onClose} aria-label="Fermer le panneau"><span aria-hidden="true" /></button>
      <div className="ckp-drawer-tabs">
        <CapsuleTabs
          items={items}
          activeIndex={Math.max(0, available.findIndex((pane) => pane.id === drawer))}
          onIndexChange={(index) => onDrawerChange(available[index].id)}
          ariaLabel="Volets du carnet"
        />
      </div>
      <div className="ckp-card-scroll ckp-drawer-body">{children}</div>
    </section>
  );
}

export default CarnetDrawer;
```

CSS :

```css
.ckp-card--drawer { height: 100%; min-height: 0; animation: ckp-drawer-in 220ms cubic-bezier(.22,1,.36,1) both; }
.ckp-drawer-tabs { padding: 0 14px 6px; }
.ckp-drawer-body { padding: 0 14px 14px; }
@keyframes ckp-drawer-in { from { opacity: .6; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ckp-card--drawer { animation: none; } }
```

- [ ] **Step 4: Tests + commit** — PASS puis `git commit -m "feat(carnet): coquille de drawer"`.

---

## Task 5: Volets Carnet (Récit, Étapes, Matériel, Nature)

**Files:**
- Create: `src/components/carnet/profile/panes/CarnetRecitPane.tsx`, `CarnetEtapesPane.tsx`, `CarnetKitPane.tsx`, `CarnetNaturePane.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetCarnetPanes.test.tsx`

**Interfaces:**
- Consumes : `detail.days`, `detail.kit`, `detail.description`, `craft` existant.
- Produces : quatre composants sans état, chacun rendant `.ckp-pane`.

- [ ] **Step 1: Test (échoue)** — vérifie : Récit affiche la description complète et les stats ; Étapes rend `days.length` `.ckp-day` avec `overnight` ; Matériel rend le poids total formaté et une ligne par item ; Nature rend le bouton « Prendre une photo ».
- [ ] **Step 2: Vérifier l'échec**.
- [ ] **Step 3: Implémenter** — réutiliser le markup de `CarnetStorySection` (Récit/Étapes) et `CarnetKitSection`, `CarnetNatureSection`, découpés en volets sans `.ckp-section`.
- [ ] **Step 4: Brancher dans `CarnetScreen`** :

```tsx
{drawer === 'carnet' ? (
  <>
    {pane === 'recit' && <CarnetRecitPane detail={detailView} />}
    …
  </>
) : null}
```
Le volet actif du drawer `carnet` est mémorisé dans `const [carnetPane, setCarnetPane] = useState<'recit'|'etapes'|'materiel'|'nature'>('recit')` et piloté par un sous-lens 30 (4 cellules).

- [ ] **Step 5: Tests + commit**.

---

## Task 6: Parcours et Étapes depuis les statistiques

**Files:**
- Create: `src/components/carnet/profile/panes/CarnetParcoursPane.tsx`
- Modify: `CarnetScreen.tsx` (mapping des clics de stats)
- Test: `src/components/carnet/profile/__tests__/CarnetStatDrawers.test.tsx`

- [ ] **Step 1: Test (échoue)** — clic sur la stat distance → `aria-label` du drawer = « Parcours » ; clic sur la stat jours → « Étapes ».
- [ ] **Step 2: Vérifier l'échec**.
- [ ] **Step 3: `CarnetParcoursPane`** : carte 1:1 (`CarnetTraceMap`), stats `formatKm`/`formatElevation`, bouton « Télécharger le GPX » désactivé sans trace, état vide.
- [ ] **Step 4: Mapping** :

```tsx
onOpenStat={(stat) => setDrawer(stat === 'etapes' ? 'etapes' : 'parcours')}
```
`CarnetCard` envoie `'parcours'` pour `distance`/`elevation`, `'etapes'` pour `days`.

- [ ] **Step 5: Tests + commit**.

---

## Task 7: Commentaires et J’aime

**Files:**
- Modify: `src/features/carnet/detail/{types,getCarnetDetail}.ts` (ajout `likers`)
- Create: `src/components/carnet/profile/panes/CarnetLikesPane.tsx`
- Test: `src/features/carnet/detail/__tests__/buildCarnetDetail.test.ts` (likers), `…/CarnetLikesPane.test.tsx`

**Interfaces:**
- Produces : `CarnetLiker { id, name, handle, avatarUrl, reaction }`, `CarnetDetail.likers: CarnetLiker[]`.

- [ ] **Step 1: Test builder (échoue)**

```ts
it('conserve les réactions réelles des likers', () => {
  const detail = buildCarnetDetail(input({
    likers: [
      { user_id: 'u1', reaction: 'like', profile: { id: 'u1', full_name: 'Léonie', handle: 'leonie', avatar_url: null, trust_score: 0 } },
      { user_id: 'u2', reaction: 'bravo', profile: { id: 'u2', full_name: 'Rachid', handle: 'rachid', avatar_url: null, trust_score: 0 } },
    ],
  }));
  expect(detail.likers.map((l) => l.reaction)).toEqual(['like', 'bravo']);
  expect(detail.likers[1].name).toBe('Rachid');
});
```

- [ ] **Step 2: Vérifier l'échec**.
- [ ] **Step 3: `getCarnetDetail`** : `select('user_id, reaction, created_at').eq('carnet_id', …).limit(50)` puis `fetchPublicProfilesWith` sur les `user_id` ; passer `likers` au builder qui mappe en `CarnetLiker[]` (nom = `full_name` sinon `handle` sinon « Auteur »).
- [ ] **Step 4: `CarnetLikesPane`** : lignes avatar 32, nom 600 12, `@handle`, badge de réaction ; sous-lens **Tous / Mutuels** (mutuel = `currentUserId` présent) ; état vide « Aucun j’aime pour l’instant. »
- [ ] **Step 5: Tests + commit**.

---

## Task 8: Drawer Post (moment)

**Files:**
- Create: `src/components/carnet/profile/CarnetPostDrawer.tsx`
- Test: `src/components/carnet/profile/__tests__/CarnetPostDrawer.test.tsx`

**Interfaces:**
- Consumes : `detail.photoMoments`, `comments` (`useCarnetComments`), `onOpenViewer`, `onShare`.
- Produces : `<CarnetPostDrawer detail index onIndexChange onClose comments canWrite currentUserId onRequireAuth onOpenViewer onShare />`

- [ ] **Step 1: Test (échoue)**

```tsx
it('affiche le moment, son compteur et navigue', () => {
  const onIndexChange = vi.fn();
  render(<CarnetPostDrawer {...base} index={0} onIndexChange={onIndexChange} />);
  expect(screen.getByRole('img')).toBeTruthy();
  expect(screen.getByText('1/2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Moment suivant' }));
  expect(onIndexChange).toHaveBeenCalledWith(1);
});

it('affiche les commentaires du carnet', () => {
  render(<CarnetPostDrawer {...base} index={0} comments={{ comments: [{ id: 'c1', authorId: 'u1', authorName: 'Léonie', authorAvatar: null, content: 'Superbe', createdAt: '2026-05-06T10:00:00Z' }], loading: false, send: async () => true, remove: async () => true }} />);
  expect(screen.getByText('Superbe')).toBeTruthy();
  expect(screen.getByText('Commentaires du carnet')).toBeTruthy();
});
```

- [ ] **Step 2: Vérifier l'échec**.
- [ ] **Step 3: Implémentation** — structure du § 5.6 de la spec : en-tête auteur (`pmi-author`), photo 1:1 cliquable, navigation ‹ n/N ›, citation, lieu · date, actions (♥ / 💬 / ↗), liste des commentaires + composer (`CarnetCommentsPane` réutilisé), `···` → menu.
- [ ] **Step 4: CSS** — image radius 16, navigation 30 px, en-tête 36, animation de glissement 240 ms.
- [ ] **Step 5: Tests + commit**.

---

## Task 9: Barre basse identique, recette, déploiement

**Files:**
- Modify: `src/components/account/AccountBottomBar.tsx` (valeurs exactes)
- Create: `docs/audit/carnet-2026-10-24/17-recette-ecran-fixe.md`

- [ ] **Step 1: Barre basse** — vérifier sur `/compte` : 402 à x14, 48, icônes 19, libellés 10/500, lentille 79 × 40. Sur la fiche : même composant, `lens` en `opacity: 0`.

```css
.tb { width: min(calc(100% - 28px), 402px); height: 48px; }
.tb a, .tb button { font: 500 10px/1 var(--font-sans); gap: 1px; }
.tb .ic { width: 19px; height: 19px; }
.ckp-screen .tb .lens { opacity: 0; }
```

- [ ] **Step 2: Script de recette Playwright** (dans le worktree, supprimé après usage) :

```js
const checks = await page.evaluate(() => ({
  noPageScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
  cardBox: (() => { const b = document.querySelector('.ckp-card').getBoundingClientRect(); return [Math.round(b.x), Math.round(b.width)]; })(),
  tabs: (() => { const t = document.querySelector('.ckp-tabs'); const s = getComputedStyle(t); return [Math.round(t.getBoundingClientRect().height), s.borderRadius, s.backgroundColor]; })(),
  th: getComputedStyle(document.querySelector('.ckp-th')).transition,
  bar: (() => { const b = document.querySelector('.tb').getBoundingClientRect(); return [Math.round(b.x), Math.round(b.width), Math.round(b.height)]; })(),
  lens: (() => { const l = document.querySelector('.tb .lens'); return getComputedStyle(l).opacity; })(),
}));
```

Attendu : `noPageScroll true`, `cardBox [12, 406]`, `tabs [31, "12px", "rgba(23, 43, 36, 0.06)"]`, `th` contient `0.32s`, `bar [14, 402, 48]`, `lens "0"`.

- [ ] **Step 3: Recette fonctionnelle** : 11 déclencheurs (couverture, 3 stats, 3 anneaux, tuile, pilule, `+`, `⌕`, `🔔`), 7 drawers, `Échap`, poignée, navigation ‹ ›, sous-lens, animations, `prefers-reduced-motion`.

- [ ] **Step 4: Build et déploiement depuis le worktree isolé**

```bash
npx vercel deploy --prod --yes
```

- [ ] **Step 5: Vérification post-déploiement** : `curl -s -o /dev/null -w '%{http_code}'` = 200, script de recette exécuté sur l'URL de production, captures 430 / 768 / 1440.

- [ ] **Step 6: Rapport** `17-recette-ecran-fixe.md` + commit.

---

## Auto-revue

**Couverture de la spec :** écran fixe § 2 → tâche 1 · barre haute § 3 → tâche 2 · correspondance carte→drawers § 4 → tâches 1, 3, 6 · contenus § 5 → tâches 5, 6, 7, 8 · sélecteur § 6 → tâche 3 · barre basse § 7 → tâche 9 · animations § 8 → tâches 3, 4, 8 · contraintes § 9 → tâche 9.

**Écarts assumés :** le `···` reste dans la barre (la Communauté n'en a pas, mais la fiche doit garder partage/signalement/gestion) ; le retour natif du navigateur remplace le bouton retour ; les commentaires restent au niveau du carnet (pas de commentaire par moment en base).

**Cohérence des types :** `CarnetDrawerId`, `CarnetStatDrawer`, `CarnetLiker`, `CarnetDrawerProps` définis une seule fois, consommés sous les mêmes noms.

---

## Task 0: Fondations typographiques et colorimétriques (à faire avant la tâche 1)

**Files:**
- Modify: `src/styles/carnet-profile.css`
- Test: `src/components/carnet/profile/__tests__/CarnetScreen.test.tsx` (assertions de racine)

**Interfaces:**
- Consumes : rien.
- Produces : `.ckp-screen` porteur de la typo et de l'encre de référence.

- [ ] **Step 1: Pourquoi**

L'audit `18-audit-attribut-par-attribut.md` montre 221 écarts, dont **71 viennent de trois héritages** : police de base 17 px au lieu de 14, interlettrage `normal` au lieu de `-0.14px`, encre `#17402c` au lieu de `#172b24`. Tout le reste des écarts de taille et de couleur en découle.

- [ ] **Step 2: Test (échoue)**

```tsx
it('porte la typo et l’encre du Compte sur la racine', () => {
  const { container } = render(<CarnetScreen detail={DETAIL} />);
  const root = container.querySelector('.ckp-screen') as HTMLElement;
  expect(root.className).toContain('ckp-screen');
  expect(root.getAttribute('data-type-scale')).toBe('compte');
});
```

- [ ] **Step 3: Ajouter l'attribut et le CSS**

```tsx
<div className="ckp-screen" data-type-scale="compte">
```

```css
.ckp-screen {
  font: 400 14px/1.25 var(--font-sans, -apple-system, system-ui, sans-serif);
  letter-spacing: -.01em;
  color: #172b24;
  -webkit-font-smoothing: antialiased;
}
/* Les composants partagés gardent leurs propres tailles ; on ne surcharge que
   ce qui héritait de 17 px : libellés de barre, lignes de bio, conteneurs. */
.ckp-screen .ckp-bio-line { font-size: 12px; line-height: 1.3; }
.ckp-screen .ckp-stat-v { font-size: 19px; letter-spacing: -.38px; }
.ckp-screen .ckp-stat-l { font-size: 10.5px; letter-spacing: 0; }
.ckp-screen .ckp-bio { font-size: 12px; line-height: 1.3; }
```

- [ ] **Step 4: Vérifier**

Run: `npm test -- --run src/components/carnet/profile/__tests__/CarnetScreen.test.tsx`
Expected: PASS.

Puis, dans le navigateur, `getComputedStyle(document.querySelector('.ckp-screen')).fontSize` doit valoir `14px` et `letterSpacing` `-0.14px`.

- [ ] **Step 5: Les trois formes mesurées à corriger dans la même passe**

```css
/* 6 — la carte n'a pas de padding : le contenu vit dans .ckp-card-scroll */
.ckp-card { padding: 0; }
.ckp-card-scroll { padding: 8px 12px 56px; display: flex; flex-direction: column; gap: 7px; }

/* 7 — anneau du visuel : base linéaire + anneau conique en ::before */
.ckp-cover-btn { background: linear-gradient(145deg, rgba(255,255,255,.92), rgba(235,242,236,.65)); }
.ckp-cover-btn::before { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(from 140deg, rgba(23,64,44,.62), rgba(150,179,145,.55), rgba(255,255,255,.9), rgba(91,127,85,.5), rgba(23,64,44,.62)); }
.ckp-cover { position: relative; border: 2px solid rgba(255,255,255,.92); }

/* 8 — anneau d'action : dégradé linéaire 145deg */
.ckp-action-btn { background: linear-gradient(145deg, rgba(23,64,44,.55), rgba(91,127,85,.35), rgba(255,255,255,.85)); }

/* 9 — grille de stats : gap 4 */
.ckp-id-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(carnet): fondations typographiques et matieres du Compte"
```
