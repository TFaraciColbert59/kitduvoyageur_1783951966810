// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileDrawerHost } from '../ProfileDrawerHost';

afterEach(() => cleanup());

const KIT_ID = '11111111-1111-4111-8111-111111111111';

const PAYLOAD = {
  authenticated: true,
  stats: { km: 42, dplus: 1200, outings: 3, nights: 2, massifs: 1, countries: 1 },
  stamps: [],
  reposts: [],
  badges: [],
  kits: [{ id: KIT_ID, n: 'Kit 3 saisons', w: 4200, items: 8 }],
  gearItems: [],
  loans: [
    {
      id: 'l1',
      itemName: 'Sac 45 L',
      counterpart: 'Léa',
      role: 'lender',
      status: 'en_cours',
      loanedAt: '2026-10-01',
      dueDate: '2026-10-28',
      returnedAt: '',
      rating: null,
    },
  ],
  trust: null,
  visibility: { profile: 'public', invited: true },
};

describe('ProfileDrawerHost — viewer transmis aux slots', () => {
  it('un visiteur ne voit aucune action propriétaire dans Kit, Prêts et Vitrine', () => {
    const { rerender } = render(
      <ProfileDrawerHost
        viewer="visitor"
        visibility="public"
        activeSlot="kit"
        payload={PAYLOAD}
      />
    );

    // Kit : le slot résout bien le visiteur et masque ses actions.
    // `slot-content` est la pane de la coquille ; le slot est son enfant.
    const kitSlot = () => screen.getByTestId('slot-content').querySelector('[data-slot="kit"]');
    expect(kitSlot()?.getAttribute('data-viewer')).toBe('visitor');
    expect(screen.queryByRole('group', { name: /Actions du kit/ })).toBeNull();

    // Prêts : aucune action, et le nom du prêteur n'est pas exposé.
    rerender(
      <ProfileDrawerHost
        viewer="visitor"
        visibility="public"
        activeSlot="prets"
        payload={PAYLOAD}
      />
    );
    expect(screen.queryByRole('group', { name: /Actions pour/ })).toBeNull();
    expect(screen.queryByText('Léa')).toBeNull();
    expect(screen.getByText('Sac 45 L')).toBeTruthy();

    // Vitrine : le CTA de republication reste propriétaire.
    rerender(
      <ProfileDrawerHost
        viewer="visitor"
        visibility="public"
        activeSlot="vitrine"
        payload={PAYLOAD}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Republication/ }));
    expect(screen.queryByRole('link', { name: 'Republier une publication' })).toBeNull();
  });

  it('le propriétaire conserve ses actions et son CTA', () => {
    const { rerender } = render(
      <ProfileDrawerHost
        viewer="owner"
        visibility="public"
        activeSlot="kit"
        payload={PAYLOAD}
      />
    );

    expect(
      screen.getByTestId('slot-content').querySelector('[data-slot="kit"]')?.getAttribute('data-viewer')
    ).toBe('owner');
    const actions = screen.getByRole('group', { name: /Actions du kit/ });
    expect(within(actions).getByLabelText(/Partager/)).toBeTruthy();

    rerender(
      <ProfileDrawerHost
        viewer="owner"
        visibility="public"
        activeSlot="vitrine"
        payload={PAYLOAD}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Republication/ }));
    expect(screen.getByRole('link', { name: 'Republier une publication' })).toBeTruthy();
  });

  it('le verrou privé reste prioritaire pour un visiteur sans invitation', () => {
    render(
      <ProfileDrawerHost
        viewer="visitor"
        visibility="prive"
        invited={false}
        activeSlot="kit"
        payload={{ ...PAYLOAD, visibility: { profile: 'prive', invited: false } }}
      />
    );

    expect(screen.queryByTestId('slot-content')).toBeNull();
    expect(screen.getByLabelText('Compte privé')).toBeTruthy();
  });
});
