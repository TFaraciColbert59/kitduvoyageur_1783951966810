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
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
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

  it('place la capsule d’onglets en bas à droite, hors de l’en-tête', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>volet</p></CarnetDrawer>,
    );
    const tablist = screen.getByRole('tablist', { name: 'Volets du carnet' });
    /* La capsule vit dans le pied de la feuille, pas sous la poignée. */
    expect(tablist.closest('.ckp-drawer-foot')).toBeTruthy();
    expect(tablist.closest('.ckp-drawer-head')).toBeNull();
    /* Le haut ne garde que la poignée et la croix. */
    const head = container.querySelector('.ckp-drawer-head') as HTMLElement;
    expect(head.querySelectorAll('button').length).toBe(2);
    expect(head.querySelector('.ckp-grabber')).toBeTruthy();
    expect(head.querySelector('.ckp-drawer-close')).toBeTruthy();
    expect(head.querySelector('[role="tablist"]')).toBeNull();
    /* Même capsule que la carte : largeur au pas de 41,5 px + 5, lentille blanche. */
    const capsule = tablist.closest('.ckp-capsule') as HTMLElement;
    expect(capsule.style.getPropertyValue('--n')).toBe('2');
    expect(capsule.querySelector(':scope > .ckp-th')).toBeTruthy();
  });

  it('nomme ses onglets comme les volets du drawer, sans panneau fantôme', () => {
    render(<CarnetDrawer drawer="share" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.id)).toEqual(['carnet-drawer-tab-stats', 'carnet-drawer-tab-share']);
    /* Aucun `aria-controls` vers un `carnet-page-*` qui n'existe pas ici. */
    for (const tab of tabs) expect(tab.getAttribute('aria-controls')).toBeNull();
    const active = screen.getByRole('tab', { name: 'Partage' });
    expect(active.getAttribute('aria-selected')).toBe('true');
    const lens = active.closest('.ckp-capsule')?.querySelector('.ckp-th') as HTMLElement;
    expect(lens.style.getPropertyValue('--i')).toBe('1');
  });

  it('remonte le changement de volet', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('tab', { name: 'Partage' }));
    expect(onDrawerChange).toHaveBeenCalledWith('share');
  });

  it('change de volet au clavier, sans sortir de la capsule', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Volets du carnet' }), { key: 'ArrowRight' });
    expect(onDrawerChange).toHaveBeenCalledWith('share');
  });

  it('garde le focus sur la capsule quand le parent rend un onClose neuf', () => {
    const { rerender } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const share = screen.getByRole('tab', { name: 'Partage' });
    share.focus();
    fireEvent.click(share);
    rerender(<CarnetDrawer drawer="share" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Partage' }));
  });

  it('ferme sur Échap et sur la poignée', () => {
    const onClose = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
