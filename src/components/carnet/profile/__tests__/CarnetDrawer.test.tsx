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

  it('ferme sur Échap et sur la poignée, après la sortie de 160 ms', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    /* La feuille joue son fondu de sortie avant de disparaître. */
    const sheet = container.querySelector('.ckp-card--drawer') as HTMLElement;
    expect(sheet.getAttribute('data-closing')).toBe('true');
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(160);
    expect(onClose).toHaveBeenCalledTimes(1);
    /* Un second appui ne relance rien. */
    fireEvent.keyDown(document, { key: 'Escape' });
    vi.advanceTimersByTime(160);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('CarnetDrawer — finitions du lot A', () => {
  /* 1 — la poignée s'épaissit au toucher, sans changer de comportement. */
  it('marque la poignée pressée puis la relâche', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const grabber = container.querySelector('.ckp-grabber') as HTMLElement;
    expect(grabber.getAttribute('data-press')).toBeNull();
    fireEvent.pointerDown(grabber);
    expect(grabber.getAttribute('data-press')).toBe('true');
    fireEvent.pointerUp(grabber);
    expect(grabber.getAttribute('data-press')).toBeNull();
  });

  /* 4 — le voile de coupe s'allume au-delà de 8 px de défilement, pas avant. */
  it('allume le voile de coupe à 8 px de défilement', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const body = container.querySelector('.ckp-drawer-body') as HTMLElement;
    const cut = container.querySelector('.ckp-drawer-cut') as HTMLElement;
    expect(cut.getAttribute('data-on')).toBeNull();
    body.scrollTop = 4;
    fireEvent.scroll(body);
    expect(cut.getAttribute('data-on')).toBeNull();
    body.scrollTop = 12;
    fireEvent.scroll(body);
    expect(cut.getAttribute('data-on')).toBe('true');
    body.scrollTop = 0;
    fireEvent.scroll(body);
    expect(cut.getAttribute('data-on')).toBeNull();
  });

  /* 5 / 7 — la feuille porte la zone tactile et le voile gradué de la page. */
  it('pose la zone tactile de 12 px et le scrim de la page', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const grip = container.querySelector('.ckp-drawer-grip') as HTMLElement;
    expect(grip).toBeTruthy();
    expect(grip.getAttribute('aria-hidden')).toBe('true');
    expect(grip.parentElement?.classList.contains('ckp-card--drawer')).toBe(true);
    const scrim = container.querySelector('.ckp-scrim') as HTMLElement;
    expect(scrim).toBeTruthy();
    expect(scrim.getAttribute('aria-hidden')).toBe('true');
    /* Le voile est un frère de la feuille, jamais un enfant : il reste dessous. */
    expect(scrim.nextElementSibling?.classList.contains('ckp-card--drawer')).toBe(true);
  });

  /* 8 — la croix reste dans le flux de l'en-tête même quand le corps défile. */
  it('garde la croix de 36 px quand le corps défile', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const body = container.querySelector('.ckp-drawer-body') as HTMLElement;
    body.scrollTop = 120;
    fireEvent.scroll(body);
    const close = screen.getByRole('button', { name: 'Fermer' });
    expect(close.classList.contains('ckp-drawer-close')).toBe(true);
    expect(close.closest('.ckp-drawer-head')).toBeTruthy();
  });
});
