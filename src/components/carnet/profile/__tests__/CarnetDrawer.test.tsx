// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetDrawer } from '../CarnetDrawer';
import { DETAIL, detail } from './fixtures';

afterEach(() => cleanup());

describe('CarnetDrawer — coquille', () => {
  it('rend la poignée, la capsule et le volet', () => {
    render(<CarnetDrawer detail={DETAIL} drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>volet</p></CarnetDrawer>);
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Volets du carnet' })).toBeTruthy();
    expect(screen.getByText('volet')).toBeTruthy();
  });

  it('ne garde que cinq volets : statistiques, commentaires, j’aime, partage, gérer', () => {
    render(<CarnetDrawer detail={detail({ isOwner: true })} drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    const labels = screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
    expect(labels).toEqual(['Statistiques', 'Commentaires', 'J’aime', 'Partage', 'Gérer']);
    /* Les volets supprimés (carnet, parcours, étapes) ne sont plus dans la capsule. */
    expect(screen.queryByRole('tab', { name: 'Carnet' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Parcours' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Étapes' })).toBeNull();
  });

  it('n’expose pas Gérer à un visiteur', () => {
    render(<CarnetDrawer detail={detail({ isOwner: false })} drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('remonte le changement de volet', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer detail={detail({ isOwner: true })} drawer="stats" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('tab', { name: 'Gérer' }));
    expect(onDrawerChange).toHaveBeenCalledWith('manage');
  });

  it('ferme sur Échap et sur la poignée', () => {
    const onClose = vi.fn();
    render(<CarnetDrawer detail={DETAIL} drawer="stats" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
