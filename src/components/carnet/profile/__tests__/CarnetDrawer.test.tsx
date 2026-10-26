// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetDrawer } from '../CarnetDrawer';

afterEach(() => cleanup());

describe('CarnetDrawer — coquille', () => {
  it('rend la poignée, la capsule et le volet', () => {
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>volet</p></CarnetDrawer>);
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Volets du carnet' })).toBeTruthy();
    expect(screen.getByText('volet')).toBeTruthy();
  });

  it('ne garde que deux volets : statistiques et partage', () => {
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    const labels = screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
    expect(labels).toEqual(['Statistiques', 'Partage']);
    /* Les volets devenus des pages du carrousel quittent la capsule. */
    expect(screen.queryByRole('tab', { name: 'Commentaires' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'J’aime' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Carnet' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Parcours' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Étapes' })).toBeNull();
  });

  it('remonte le changement de volet', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('tab', { name: 'Partage' }));
    expect(onDrawerChange).toHaveBeenCalledWith('share');
  });

  it('ferme sur Échap et sur la poignée', () => {
    const onClose = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
