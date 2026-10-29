// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetDrawer, closesOnDrag } from '../CarnetDrawer';


/** Événement pointeur daté : jsdom ne construit pas `clientY` tout seul. */
function pointer(type: string, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientY', { value: y });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'target', { value: null, writable: true });
  return event;
}

afterEach(() => cleanup());

describe('CarnetDrawer — coquille', () => {
  it('rend la poignée, le sélecteur des volets et le volet', () => {
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>volet</p></CarnetDrawer>);
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Volets du carnet' })).toBeTruthy();
    /* Aucun autre bouton de fermeture visible : la poignée suffit. */
    expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull();
    expect(screen.getByText('volet')).toBeTruthy();
  });

  it('ne garde que trois volets : statistiques, moments et partage', () => {
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    const labels = screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
    expect(labels).toEqual(['Statistiques', 'Moments', 'Partage']);
    /* Les volets devenus des pages du carrousel ne sont pas des segments. */
    expect(screen.queryByRole('tab', { name: 'Commentaires' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'J’aime' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Gérer' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Carnet' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Parcours' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Étapes' })).toBeNull();
  });

  it('place le sélecteur des volets en haut, hors de l’en-tête et du corps', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>volet</p></CarnetDrawer>,
    );
    const tablist = screen.getByRole('tablist', { name: 'Volets du carnet' });
    /* Le sélecteur 44 px vit sous l'en-tête, dans le chrome qui ne défile pas :
       ni dans le corps, ni dans le pied, ni dans la tête. */
    const select = tablist.closest('.ckp-drawer-select') as HTMLElement;
    expect(select).toBeTruthy();
    expect(select.closest('.ckp-drawer-chrome')).toBeTruthy();
    expect(tablist.closest('.ckp-drawer-head')).toBeNull();
    expect(tablist.closest('.ckp-drawer-body')).toBeNull();
    expect(tablist.closest('.ckp-drawer-foot')).toBeNull();
    /* Le haut ne garde que la poignée — aucun autre bouton, aucune croix. */
    const head = container.querySelector('.ckp-drawer-head') as HTMLElement;
    expect(head.querySelectorAll('button').length).toBe(1);
    expect(head.querySelector('.ckp-grabber')).toBeTruthy();
    expect(head.querySelector('.ckp-drawer-close')).toBeNull();
    expect(head.querySelector('[role="tablist"]')).toBeNull();
    expect(head.textContent).toBe('');
    /* Trois segments, une lentille blanche au pas de la barre. */
    expect(select.style.getPropertyValue('--n')).toBe('3');
    expect(select.querySelector(':scope > .ckp-th')).toBeTruthy();
    /* Chaque segment porte son icône et son libellé visible. */
    expect(screen.getAllByRole('tab').map((tab) => tab.querySelector('.ckp-tab-label')?.textContent)).toEqual([
      'Statistiques',
      'Moments',
      'Partage',
    ]);
  });

  it('nomme ses onglets comme les volets du drawer, sans panneau fantôme', () => {
    render(<CarnetDrawer drawer="share" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.id)).toEqual([
      'carnet-drawer-tab-stats',
      'carnet-drawer-tab-moments',
      'carnet-drawer-tab-share',
    ]);
    /* Aucun `aria-controls` vers un `carnet-page-*` qui n'existe pas ici. */
    for (const tab of tabs) expect(tab.getAttribute('aria-controls')).toBeNull();
    const active = screen.getByRole('tab', { name: 'Partage' });
    expect(active.getAttribute('aria-selected')).toBe('true');
    const lens = active.closest('.ckp-drawer-select')?.querySelector(':scope > .ckp-th') as HTMLElement;
    expect(lens.style.getPropertyValue('--i')).toBe('2');
  });

  it('remonte le changement de volet', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.click(screen.getByRole('tab', { name: 'Partage' }));
    expect(onDrawerChange).toHaveBeenCalledWith('share');
  });

  it('allume la lentille sur le volet Moments — il est devenu un segment', () => {
    const { container } = render(
      <CarnetDrawer drawer="moments" onDrawerChange={() => {}} onClose={() => {}}><p>moments</p></CarnetDrawer>,
    );
    const select = container.querySelector('.ckp-drawer-select') as HTMLElement;
    expect(select.style.getPropertyValue('--n')).toBe('3');
    expect(select.querySelectorAll('[role="tab"]').length).toBe(3);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.getAttribute('aria-selected')).toBe(tab.getAttribute('aria-label') === 'Moments' ? 'true' : 'false');
    }
    const lens = select.querySelector(':scope > .ckp-th') as HTMLElement;
    expect(lens.getAttribute('data-off')).toBeNull();
    expect(lens.style.getPropertyValue('--i')).toBe('1');
    /* Le contenu du volet est bien monté, l'en-tête ne porte aucun titre. */
    expect(screen.getByText('moments')).toBeTruthy();
    expect(container.querySelector('.ckp-drawer-head h1, .ckp-drawer-head h2')).toBeNull();
  });

  it('change de volet au clavier, sans sortir du sélecteur', () => {
    const onDrawerChange = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={onDrawerChange} onClose={() => {}}><p>v</p></CarnetDrawer>);
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Volets du carnet' }), { key: 'ArrowRight' });
    expect(onDrawerChange).toHaveBeenCalledWith('moments');
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Volets du carnet' }), { key: 'End' });
    expect(onDrawerChange).toHaveBeenLastCalledWith('share');
  });

  it('ne peint aucune capsule de sous-volets quand le volet n’en a pas', () => {
    const { container } = render(
      <CarnetDrawer drawer="moments" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    expect(container.querySelector('.ckp-drawer-foot')).toBeNull();
    expect(container.querySelector('.ckp-sub')).toBeNull();
  });

  it('peint les sous-volets dans une capsule de pied, à 12 px des bords', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CarnetDrawer
        drawer="stats"
        onDrawerChange={() => {}}
        onClose={() => {}}
        subNav={{
          label: 'Statistiques du carnet',
          items: [
            { id: 'distance', label: 'Distance', icon: <span data-icon="route" /> },
            { id: 'elevation', label: 'Dénivelé', icon: <span data-icon="mountain" /> },
            { id: 'days', label: 'Jours', icon: <span data-icon="calendar-days" /> },
          ],
          active: 'elevation',
          onChange,
        }}
      >
        <p>v</p>
      </CarnetDrawer>,
    );
    const foot = container.querySelector('.ckp-drawer-foot') as HTMLElement;
    const sub = foot.querySelector('.ckp-sub') as HTMLElement;
    expect(sub).toBeTruthy();
    /* Hors du corps : la capsule ne défile pas avec le contenu. */
    expect(sub.closest('.ckp-drawer-body')).toBeNull();
    expect(sub.style.getPropertyValue('--n')).toBe('3');
    expect(sub.className).toContain('ckp-sub--icons');
    const group = screen.getByRole('group', { name: 'Statistiques du carnet' });
    const buttons = Array.from(group.querySelectorAll('button'));
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Distance', 'Dénivelé', 'Jours']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    const lens = sub.querySelector(':scope > .ckp-th') as HTMLElement;
    expect(lens.style.getPropertyValue('--i')).toBe('1');
    fireEvent.click(buttons[2]);
    expect(onChange).toHaveBeenCalledWith('days');
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

  it('ferme sur Échap et sur la poignée, après la sortie de 180 ms', () => {
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
    vi.advanceTimersByTime(180);
    expect(onClose).toHaveBeenCalledTimes(1);
    /* Un second appui ne relance rien. */
    fireEvent.keyDown(document, { key: 'Escape' });
    vi.advanceTimersByTime(180);
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

  /* 8 — la poignée reste dans le flux de l'en-tête même quand le corps défile. */
  it('garde la poignée dans l’en-tête quand le corps défile', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const body = container.querySelector('.ckp-drawer-body') as HTMLElement;
    body.scrollTop = 120;
    fireEvent.scroll(body);
    const grabber = screen.getByRole('button', { name: 'Fermer le panneau' });
    expect(grabber.classList.contains('ckp-grabber')).toBe(true);
    expect(grabber.closest('.ckp-drawer-head')).toBeTruthy();
  });
});

describe('CarnetDrawer — mobile (lot F)', () => {
  it('verrouille le scroll du fond tant que la feuille est ouverte', () => {
    const { unmount } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    expect(document.documentElement.getAttribute('data-ckp-sheet')).toBe('true');
    unmount();
    expect(document.documentElement.hasAttribute('data-ckp-sheet')).toBe(false);
  });

  it('rend le focus au déclencheur à la fermeture', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'déclencheur';
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    expect(document.activeElement).not.toBe(trigger);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('ferme sur Échap et laisse le focus revenir au déclencheur', () => {
    vi.useFakeTimers();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const { unmount } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    vi.advanceTimersByTime(180);
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(trigger);
    vi.useRealTimers();
    trigger.remove();
  });
});

describe('CarnetDrawer — fermeture par glissement (29 oct. 2026)', () => {
  /* La poignée est le seul repère de fermeture : elle nomme l'action. */
  it('nomme la poignée et ne peint aucun autre bouton de fermeture', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const grabber = screen.getByRole('button', { name: 'Fermer le panneau' });
    expect(grabber.classList.contains('ckp-grabber')).toBe(true);
    expect(container.querySelector('.ckp-drawer-close')).toBeNull();
    /* Alternative clavier : `Échap` écoute le document, un seul bouton en tête. */
    expect(container.querySelectorAll('.ckp-drawer-head button')).toHaveLength(1);
  });

  it('seuil de fermeture : 30 % de la hauteur de la feuille', () => {
    /* 400 px de feuille : la fermeture commence au-delà de 120 px. */
    expect(closesOnDrag(120, 400)).toBe(false);
    expect(closesOnDrag(121, 400)).toBe(true);
    /* Feuille non mesurée : aucun geste ne ferme (jamais de seuil inventé). */
    expect(closesOnDrag(200, 0)).toBe(false);
    expect(closesOnDrag(Number.NaN, 400)).toBe(false);
  });

  it('marque la feuille en glissement pendant le geste', () => {
    const { container } = render(
      <CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={() => {}}><p>v</p></CarnetDrawer>,
    );
    const sheet = container.querySelector('.ckp-card--drawer') as HTMLElement;
    const grabber = container.querySelector('.ckp-grabber') as HTMLElement;
    fireEvent.pointerDown(grabber);
    expect(sheet.getAttribute('data-drag')).toBe('true');
    fireEvent.pointerUp(grabber);
    expect(sheet.getAttribute('data-drag')).toBeNull();
    expect(sheet.getAttribute('data-return')).toBe('true');
  });

  it('ferme sur Échap, sans aucun bouton de fermeture supplémentaire', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<CarnetDrawer drawer="stats" onDrawerChange={() => {}} onClose={onClose}><p>v</p></CarnetDrawer>);
    fireEvent.keyDown(document, { key: 'Escape' });
    vi.advanceTimersByTime(180);
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
