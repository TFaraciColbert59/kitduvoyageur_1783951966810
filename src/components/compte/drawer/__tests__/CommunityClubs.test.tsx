// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LensPager } from '../LensPager';
import { CommunitySlot } from '../slots/CommunitySlot';

afterEach(() => {
  cleanup();
  delete (navigator as unknown as { share?: unknown }).share;
});

const club = {
  id: 'c1',
  n: 'Club Alpin',
  role: 'Membre actif',
  members: 142,
  joined: true,
  nextEvent: {
    id: 'e1',
    title: 'Néouvielle',
    event_date: '2026-10-24',
    location: 'Néouvielle',
    participants_count: 8,
    max_participants: 12,
  },
  topics: [
    { id: 't1', title: 'Préparer le bivouac', is_pinned: true },
    { id: 't2', title: 'Covoiturage', is_pinned: false },
  ],
  recommendedKits: [{ id: 'k1', name: 'Kit bivouac', items: 7 }],
};

describe('Communauté — clubs', () => {
  it('rend les clubs scrollables et ouvre un drawer club', () => {
    render(<CommunitySlot lens="clubs" clubs={[club]} />);

    const rail = screen.getByTestId('club-rail');
    expect(rail.className).toContain('overflow-x');
    expect(rail.getAttribute('aria-label')).toBe('Clubs');
    expect(screen.getByTestId('club-card').style.flexBasis).toBe('78%');

    fireEvent.click(screen.getByText('Club Alpin'));

    expect(screen.getByText(/Prochains événements/)).toBeTruthy();
  });

  it('présente le club, son rôle, ses membres et son prochain événement', () => {
    render(<CommunitySlot lens="clubs" clubs={[club]} />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le club Club Alpin/ }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const openButton = screen.getByRole('button', { name: /Ouvrir le club Club Alpin/ });
    const describedBy = openButton.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent).toContain('Membre actif');
    expect(within(dialog).getByText('Club Alpin')).toBeTruthy();
    expect(within(dialog).getByText('Membre actif')).toBeTruthy();
    expect(within(dialog).getByText('142')).toBeTruthy();
    expect(within(dialog).getByText('membres actifs')).toBeTruthy();
    expect(within(dialog).getByText('Néouvielle')).toBeTruthy();
    expect(within(dialog).getByText('8 / 12 inscrits')).toBeTruthy();
    expect(within(dialog).getByText('Préparer le bivouac')).toBeTruthy();
    expect(within(dialog).getByText('Épinglé')).toBeTruthy();
    expect(within(dialog).getByText('Kit bivouac')).toBeTruthy();
    expect(within(dialog).getByText('Sécurité')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Quitter' })).toBeTruthy();
  });

  it('accepte les deux formes de compteurs de participants', () => {
    render(
      <CommunitySlot
        lens="clubs"
        clubs={[
          {
            ...club,
            nextEvent: { ...club.nextEvent, participants_count: null, max_participants: null, participants: 5, max: 9 },
          },
        ]}
      />
    );
    fireEvent.click(screen.getByText('Club Alpin'));

    expect(screen.getByText('5 / 9 inscrits')).toBeTruthy();
  });

  it('gère le RSVP et les actions Rejoindre / Partager / Inviter', () => {
    render(<CommunitySlot lens="clubs" clubs={[club]} />);
    fireEvent.click(screen.getByText('Club Alpin'));

    const participate = screen.getByRole('button', { name: 'Je participe' });
    expect(participate.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(participate);
    expect(participate.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Ta réponse');

    const leave = screen.getByRole('button', { name: 'Quitter' });
    fireEvent.click(leave);
    expect(screen.getByRole('button', { name: 'Rejoindre' })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Partager' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeTruthy();
  });

  it('ferme le drawer au clic sur Fermer et avec Échap', () => {
    render(<CommunitySlot lens="clubs" clubs={[club]} />);
    fireEvent.click(screen.getByText('Club Alpin'));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le club' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('Club Alpin'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('affiche les états vides explicites du drawer', () => {
    render(
      <CommunitySlot
        lens="clubs"
        clubs={[{ id: 'c2', n: 'Club sans données', role: 'Membre', members: 3, joined: false }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le club Club sans données/ }));

    expect(screen.getByText('Aucun événement à venir.')).toBeTruthy();
    expect(screen.getByText('Aucun sujet récent.')).toBeTruthy();
    expect(screen.getByText('Aucun kit recommandé.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rejoindre' })).toBeTruthy();
  });

  it('laisse le scroll vertical au rail et ne déclenche pas le swipe du pager', () => {
    const onIndexChange = vi.fn();
    const { container } = render(
      <LensPager index={0} count={3} onIndexChange={onIndexChange}>
        <CommunitySlot lens="clubs" clubs={[club]} />
      </LensPager>
    );

    const rail = screen.getByTestId('club-rail');
    expect(rail.style.touchAction).toContain('pan-y');
    expect(rail.style.touchAction).toContain('pan-x');

    fireEvent.pointerDown(rail, { pointerId: 1, clientX: 220, clientY: 120, button: 0 });
    fireEvent.pointerMove(rail, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(rail, { pointerId: 1, clientX: 120, clientY: 120 });

    const pager = container.querySelector('.lkdv-lens-pager');
    expect(pager?.getAttribute('data-dragging')).toBe('false');
    expect(onIndexChange).not.toHaveBeenCalled();

    const wheel = new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true });
    rail.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('ne fabrique pas de compteurs quand les données manquent', () => {
    render(
      <CommunitySlot
        lens="clubs"
        clubs={[
          {
            id: 'c3',
            n: 'Club sans chiffres',
            role: 'Membre',
            joined: false,
            nextEvent: {
              id: 'e3',
              title: 'Sortie sans inscrits',
              event_date: '2026-11-02',
              participants_count: null,
              max_participants: 12,
            },
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le club Club sans chiffres/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Membres non communiqués')).toBeTruthy();
    expect(within(dialog).queryByText('0')).toBeNull();
    expect(within(dialog).getByText('12 places')).toBeTruthy();
    expect(within(dialog).queryByText('0 / 12 inscrits')).toBeNull();
  });

  it('accorde les libellés au singulier', () => {
    render(
      <CommunitySlot
        lens="clubs"
        clubs={[
          {
            id: 'c4',
            n: 'Club solo',
            role: 'Membre',
            members: 1,
            joined: false,
            nextEvent: {
              id: 'e4',
              title: 'Sortie solo',
              event_date: '2026-11-03',
              participants_count: 1,
              max_participants: 12,
            },
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le club Club solo/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('1')).toBeTruthy();
    expect(within(dialog).getByText('membre actif')).toBeTruthy();
    expect(within(dialog).getByText('1 / 12 inscrit')).toBeTruthy();
  });

  it('distingue une annulation de partage d’une vraie erreur', async () => {
    const share = vi.fn();
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(<CommunitySlot lens="clubs" clubs={[club]} />);
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le club Club Alpin/ }));

    share.mockRejectedValueOnce(Object.assign(new Error('annulé'), { name: 'AbortError' }));
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status').textContent).toBe('');

    share.mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('pas abouti'));
  });

  it('affiche un état vide sans club', () => {
    render(<CommunitySlot lens="clubs" clubs={[]} />);

    expect(screen.getByText('Aucun club.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Découvrir des clubs' });
    expect(link.getAttribute('href')).toBe('/clubs');
    expect(screen.getByTestId('slot-content').getAttribute('data-state')).toBe('empty');
  });
});
