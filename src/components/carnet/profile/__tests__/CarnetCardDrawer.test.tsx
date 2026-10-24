// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCardDrawer } from '../CarnetCardDrawer';
import { CarnetSubCapsule } from '../CarnetSubCapsule';
import { DETAIL, detail } from './fixtures';

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
    expect(screen.queryByRole('heading', { name: 'Commentaires' })).toBeNull();
    expect(screen.getByText('contenu')).toBeTruthy();
  });

  it('n’expose pas le volet Gérer à un visiteur', () => {
    render(
      <CarnetCardDrawer detail={detail({ isOwner: false })} pane="comments" onPaneChange={() => {}} onClose={() => {}}>
        <p>contenu</p>
      </CarnetCardDrawer>,
    );
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('expose trois volets au propriétaire et remonte le changement', () => {
    const onPaneChange = vi.fn();
    render(
      <CarnetCardDrawer detail={detail({ isOwner: true })} pane="comments" onPaneChange={onPaneChange} onClose={() => {}}>
        <p>contenu</p>
      </CarnetCardDrawer>,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
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
        items={[
          { id: 'recent', label: 'Récents' },
          { id: 'old', label: 'Anciens' },
        ]}
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
