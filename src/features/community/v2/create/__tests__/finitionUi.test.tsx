// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { ToastProvider } from '@/contexts/ToastContext';
import { CreateSheetV2 } from '../CreateSheetV2';
import { CREATE_KINDS_V2, createDefaultsV2, type CreateKindV2 } from '../engine/createSchemasV2';
import { clearAllDraftsV2, draftStorageKey } from '../engine/useDraftV2';
import { CarnetsPane } from '../../explore/panes/CarnetsPane';
import { fetchEventDetail } from '../../data/communityDetails';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/communaute',
  useSearchParams: () => new URLSearchParams(),
}));

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  is_anonymous: false,
  user_metadata: { full_name: 'Toi' },
} as unknown as User;

beforeEach(() => {
  window.localStorage.clear();
  clearAllDraftsV2(CREATE_KINDS_V2);
});
afterEach(cleanup);

function renderKind(kind: CreateKindV2) {
  return render(
    <ToastProvider>
      <CreateSheetV2 open initialKind={kind} onClose={vi.fn()} user={user} onCreated={vi.fn()} onRequireAuth={vi.fn()} />
    </ToastProvider>,
  );
}

function seedDraft(kind: CreateKindV2, values: Record<string, unknown>, step: number) {
  window.localStorage.setItem(
    draftStorageKey(kind),
    JSON.stringify({ version: 1, kind, updatedAt: Date.now(), values: { ...createDefaultsV2(kind), ...values }, step }),
  );
}

describe('Sortie#20 — chaque étape est un fieldset avec sa legend', () => {
  it('étape 1 : legend d’étape et groupe « Rendez-vous »', async () => {
    renderKind('sortie');
    await waitFor(() => expect(screen.getByTestId('cv2-form-sortie')).toBeTruthy());
    const legends = Array.from(document.querySelectorAll('fieldset > legend')).map((node) => node.textContent);
    expect(legends).toContain('Étape 1 sur 4 : Activité et lieu');
    expect(legends).toContain('Rendez-vous');
  });

  it('étape 2 : « Importer un itinéraire » propose trace, carnet et sortie enregistrée', async () => {
    seedDraft('sortie', {}, 1);
    renderKind('sortie');
    await waitFor(() => expect(screen.getByTestId('cv2-sortie-import')).toBeTruthy());
    const group = screen.getByRole('group', { name: 'Source de l’itinéraire' });
    expect(group.textContent).toContain('Une trace');
    expect(group.textContent).toContain('Un carnet');
    expect(group.textContent).toContain('Une sortie enregistrée');
    const legends = Array.from(document.querySelectorAll('fieldset > legend')).map((node) => node.textContent);
    expect(legends).toContain('Étape 2 sur 4 : Itinéraire');
    expect(legends).toContain('Importer un itinéraire');
  });
});

describe('Carnet#20 — onglets de jours complets', () => {
  it('tablist, tabpanel relié, tabindex itinérant et flèches', async () => {
    seedDraft('carnet', { title: 'Tour', destination: 'Écrins', startDate: '2026-12-01', endDate: '2026-12-03', nbJours: 3 }, 2);
    renderKind('carnet');
    const tablist = await screen.findByRole('tablist', { name: 'Jours du carnet' });
    const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs.length).toBe(3);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    const panel = screen.getByTestId('cv2c-day-panel');
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    // Le « + » n'est pas un enfant du tablist.
    expect(tablist.querySelector('.lkdv-cv2c-day-tab-add')).toBeNull();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    await waitFor(() => expect(tabs[1].getAttribute('aria-selected')).toBe('true'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id);
    fireEvent.keyDown(tablist, { key: 'End' });
    await waitFor(() => expect(tabs[2].getAttribute('aria-selected')).toBe('true'));
    fireEvent.keyDown(tablist, { key: 'Home' });
    await waitFor(() => expect(tabs[0].getAttribute('aria-selected')).toBe('true'));
  });
});

describe('Kit#15 / #12 — commutateurs et check-list', () => {
  it('étape Compléter : unités impériales et mode préparation', async () => {
    seedDraft(
      'kit',
      {
        items: [
          { id: 'a', name: 'Tente', category: 'Abri', weightG: 1380, quantity: 1, productId: null, ownershipId: null, isChecked: false },
        ],
      },
      1,
    );
    renderKind('kit');
    const units = await screen.findByTestId('cv2c-kit-switch-units');
    expect(units.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(units);
    await waitFor(() => expect(units.getAttribute('aria-checked')).toBe('true'));
    expect(document.body.textContent).toContain('lb');
    fireEvent.click(screen.getByTestId('cv2c-kit-switch-prep'));
    const prep = await screen.findByTestId('cv2-kit-prep');
    expect(prep.textContent).toContain('Tente');
    expect(screen.getByRole('checkbox', { name: 'Emporté : Tente' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Emprunté' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('cv2-kit-weather')).toBeTruthy();
  });
});

describe('Club#4 — zone d’activité sur mini-carte', () => {
  it('étape Univers : lieu cherchable et épingle de zone', async () => {
    seedDraft('club', { name: 'Cordée', activities: ['Rando'] }, 1);
    renderKind('club');
    await waitFor(() => expect(screen.getByTestId('cv2-form-club')).toBeTruthy());
    expect(screen.getByLabelText(/Zone d’activité/)).toBeTruthy();
  });
});

describe('Carnets#19 — « Tout voir »', () => {
  const feed = (over: Partial<{ hasMore: boolean }> = {}) => ({
    items: [
      {
        id: 'c1',
        title: 'Tour',
        coverUrl: null,
        author: { id: 'u1', name: 'Camille Roux', initials: 'CR', handle: null, avatarUrl: null },
        likesCount: 0,
        commentsCount: 0,
        travelers: [],
      } as never,
    ],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: over.hasMore ?? false,
    refresh: vi.fn(),
    loadMore: vi.fn(),
    update: vi.fn(),
  });

  const base = {
    sort: 'recent' as const,
    nearState: 'idle' as const,
    nearPointKnown: true,
    online: true,
    likeBusyId: null,
    onLike: vi.fn(),
    onPeek: vi.fn(),
    onCreateCarnet: vi.fn(),
    onDiscover: vi.fn(),
    onRequestGeo: vi.fn(),
  };

  it('pied « Créer un carnet / Tout voir » ; Tout voir déclenche le geste', () => {
    const onSeeAll = vi.fn();
    render(<CarnetsPane {...base} feed={feed({ hasMore: true })} filter="discover" onSeeAll={onSeeAll} />);
    const foot = screen.getByTestId('cv2-pane-foot');
    expect(foot.textContent).toContain('Créer un carnet');
    fireEvent.click(screen.getByRole('button', { name: /Tout voir/ }));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('dans « Découvrir », Tout voir disparaît quand tout est déjà chargé', () => {
    render(<CarnetsPane {...base} feed={feed()} filter="discover" onSeeAll={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Tout voir/ })).toBeNull();
    cleanup();
    render(<CarnetsPane {...base} feed={feed()} filter="mine" onSeeAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Tout voir/ })).toBeTruthy();
  });
});

describe('Sorties#11 — amis inscrits', () => {
  it('distingue les participants que le lecteur suit', async () => {
    const tables: Record<string, unknown[]> = {
      events: [{ description: 'd', current_participants: 2 }],
      event_participants: [
        { user_id: 'u-ami', status: 'confirmed' },
        { user_id: 'u-autre', status: 'confirmed' },
        { user_id: 'viewer', status: 'confirmed' },
      ],
      public_profiles: [
        { id: 'u-ami', full_name: 'Léo Martin', handle: 'leo', avatar_url: null },
        { id: 'u-autre', full_name: 'Zoé Roux', handle: 'zoe', avatar_url: null },
        { id: 'viewer', full_name: 'Toi', handle: 'toi', avatar_url: null },
      ],
      user_follows: [{ following_id: 'u-ami' }],
    };
    const chain = (table: string) => {
      const q: Record<string, unknown> = {};
      const done = () => Promise.resolve({ data: tables[table] ?? [], error: null });
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) q[m] = () => q;
      q.maybeSingle = () => Promise.resolve({ data: (tables[table] ?? [])[0] ?? null, error: null });
      q.then = (resolve: (value: unknown) => unknown) => done().then(resolve);
      return q;
    };
    const client = { from: (table: string) => chain(table), rpc: vi.fn() } as never;
    const result = await fetchEventDetail('e1', client, 'viewer');
    expect(result.data?.friends.map((friend) => friend.name)).toEqual(['Léo Martin']);
    const guest = await fetchEventDetail('e1', client, null);
    expect(guest.data?.friends).toEqual([]);
  });
});
