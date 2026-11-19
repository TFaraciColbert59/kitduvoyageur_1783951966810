// @vitest-environment jsdom
/**
 * Lot L2 — briques additives de la lentille « Suivre » de la fiche carnet v2.
 *
 * Les trois composants lisent la fiche déjà chargée : les tests partent de la
 * fixture réelle `buildEcrinsDetail()` et ne simulent aucune requête.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  CarnetBeats,
  CarnetEveningSummary,
  CarnetProgression,
} from '../CarnetSuivi';
import { buildEcrinsDetail } from '@/features/carnet/detail/fixtures/ecrinsDetail';

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    React.createElement('img', { src, alt, className }),
}));

afterEach(() => cleanup());

/** Un jour civil de référence, à midi local : aucune ambiguïté d'heure. */
const on = (isoDate: string) => new Date(`${isoDate}T12:00:00`);

/** `textContent` normalisé (les espaces fines de fr-FR varient selon ICU). */
const textOf = (element: HTMLElement) => (element.textContent ?? '').replace(/\s/g, ' ');

describe('CarnetProgression', () => {
  it('affiche « Départ dans N j » et une barre à 0 avant le départ', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(<CarnetProgression detail={detail} now={on('2026-07-10')} />);

    expect(textOf(container)).toContain('Départ dans 3 j');
    const bar = screen.getByRole('progressbar', { name: 'Progression du voyage' });
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(textOf(container)).toContain('0 / 72,4 km');
  });

  it('affiche « Jour J/Total » et les km faits sur les km prévus en route', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(<CarnetProgression detail={detail} now={on('2026-07-15')} />);

    expect(textOf(container)).toContain('Jour 3/4');
    expect(textOf(container)).toContain('35,4 / 72,4 km');
    const bar = screen.getByRole('progressbar', { name: 'Progression du voyage' });
    expect(bar.getAttribute('aria-valuenow')).toBe('49');
    expect(bar.getAttribute('aria-valuetext')).toContain('Jour 3 sur 4');
    expect(bar.getAttribute('aria-valuetext')).toContain('kilomètres sur');
  });

  it('affiche « Rentré · N jours » et une barre pleine après la date de fin', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(<CarnetProgression detail={detail} now={on('2026-08-01')} />);

    expect(textOf(container)).toContain('Rentré · 4 jours');
    expect(textOf(container)).toContain('72,4 km');
    expect(textOf(container)).not.toContain('72,4 / 72,4');
    const bar = screen.getByRole('progressbar', { name: 'Progression du voyage' });
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('ne rend rien sans date de départ : aucun statut inventé', () => {
    const detail = buildEcrinsDetail();
    detail.startDate = null;
    const { container } = render(<CarnetProgression detail={detail} now={on('2026-07-15')} />);
    expect(container.firstChild).toBeNull();
  });

  it('retombe sur les jours quand aucune distance n’est renseignée', () => {
    const detail = buildEcrinsDetail();
    detail.summary.distanceKm = null;
    detail.distanceKm = null;
    detail.days.forEach((day) => {
      day.distanceKm = null;
    });
    detail.etapes.forEach((etape) => {
      etape.distanceKm = null;
    });

    const { container } = render(<CarnetProgression detail={detail} now={on('2026-07-15')} />);
    const bar = screen.getByRole('progressbar', { name: 'Progression du voyage' });
    /* Jour 3 sur 4 : deux jours terminés sur quatre. */
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(textOf(container)).not.toMatch(/\d km/);
  });
});

describe('CarnetBeats', () => {
  it('rend un trait par moment groupé par jour, avec le résumé accessible', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(<CarnetBeats detail={detail} />);

    const chart = screen.getByRole('img', {
      name: 'Battements du voyage : 4 jours, 28 moments',
    });
    expect(chart).toBeTruthy();
    expect(container.querySelectorAll('.lkdv-suivi-beat:not(.is-empty)')).toHaveLength(28);
    expect(container.querySelectorAll('.lkdv-suivi-beats-day')).toHaveLength(4);
  });

  it('marque le jour actif et expose chaque jour au clavier quand on peut choisir', () => {
    const detail = buildEcrinsDetail();
    const onSelectDay = vi.fn();
    render(<CarnetBeats detail={detail} activeDay={3} onSelectDay={onSelectDay} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    const jour3 = screen.getByRole('button', { name: 'Jour 3, 7 moments' });
    expect(jour3.getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Jour 2, 7 moments' }).getAttribute('aria-current')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Jour 2, 7 moments' }));
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });

  it('garde un trait court pour un jour sans moment', () => {
    const detail = buildEcrinsDetail();
    detail.days[1].moments = [];
    const { container } = render(<CarnetBeats detail={detail} />);

    screen.getByRole('img', { name: 'Battements du voyage : 4 jours, 21 moments' });
    expect(container.querySelectorAll('.lkdv-suivi-beat.is-empty')).toHaveLength(1);
  });

  it('garde des hauteurs déterministes d’un rendu à l’autre', () => {
    const detail = buildEcrinsDetail();
    const first = render(<CarnetBeats detail={detail} />);
    const heightsOf = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('.lkdv-suivi-beat')).map((bar) =>
        bar.getAttribute('style'),
      );
    const firstHeights = heightsOf(first.container);
    expect(firstHeights.length).toBeGreaterThan(0);
    expect(new Set(firstHeights).size).toBeGreaterThan(1);
    first.unmount();

    const second = render(<CarnetBeats detail={detail} />);
    expect(heightsOf(second.container)).toEqual(firstHeights);
  });

  it('ne rend rien sans jour ni moment', () => {
    const detail = buildEcrinsDetail();
    detail.days = [];
    detail.moments = [];
    const { container } = render(<CarnetBeats detail={detail} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('CarnetEveningSummary', () => {
  it('résume le dernier jour terminé : chiffres, nuit et photo phare', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(
      <CarnetEveningSummary detail={detail} now={on('2026-07-16')} />,
    );

    screen.getByRole('heading', { name: 'J3' });
    expect(textOf(container)).toContain('22 km');
    expect(textOf(container)).toMatch(/\+1\s340 m/);
    expect(textOf(container)).toContain('7 moments');
    expect(textOf(container)).toContain('Bivouac au Lac de la Muzelle');
    expect(textOf(container)).toContain('Bivouac');
    expect(textOf(container)).toMatch(/2\s105 m/);
    /* Photo phare : le premier moment photo du jour. */
    screen.getByRole('img', { name: 'Arête de la Muzelle' });
  });

  it('ouvre le jour résumé quand on fournit onOpenDay', () => {
    const detail = buildEcrinsDetail();
    const onOpenDay = vi.fn();
    render(<CarnetEveningSummary detail={detail} now={on('2026-07-16')} onOpenDay={onOpenDay} />);

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le jour 3/ }));
    expect(onOpenDay).toHaveBeenCalledWith(3);
  });

  it('résume le dernier jour du carnet une fois rentré (sans nuit inventée)', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(
      <CarnetEveningSummary detail={detail} now={on('2026-11-11')} />,
    );

    screen.getByRole('heading', { name: 'J4' });
    expect(textOf(container)).toContain('15 km');
    expect(textOf(container)).toMatch(/\+860 m/);
    screen.getByRole('img', { name: 'Lac de la Muzelle' });
  });

  it('ne rend rien avant le premier jour terminé', () => {
    const detail = buildEcrinsDetail();
    const { container } = render(
      <CarnetEveningSummary detail={detail} now={on('2026-07-13')} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien quand le dernier jour terminé n’a aucun moment', () => {
    const detail = buildEcrinsDetail();
    detail.days[2].moments = [];
    const { container } = render(
      <CarnetEveningSummary detail={detail} now={on('2026-07-16')} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien sans aucune date : le dernier jour terminé est inconnu', () => {
    const detail = buildEcrinsDetail();
    detail.startDate = null;
    detail.endDate = null;
    detail.days.forEach((day) => {
      day.date = null;
    });
    const { container } = render(
      <CarnetEveningSummary detail={detail} now={on('2026-11-11')} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('carnet-suivi.css — garde-fous du fichier de style', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/carnet-suivi.css'), 'utf8');
  /* Les commentaires expliquent la règle ; ce sont les déclarations qui la tiennent. */
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('n’écrit aucune couleur littérale', () => {
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\brgba?\(/);
  });

  it('n’utilise que des jetons existants', () => {
    const allowed = new Set([
      '--label',
      '--label2',
      '--sep',
      '--fill',
      '--tint',
      '--accent',
      '--warn',
      '--warn-bg',
      '--drawer-card-bg',
    ]);
    const tokens = [...declarations.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]);
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      const known =
        allowed.has(token) ||
        token.startsWith('--lkdv-suivi-') ||
        token.startsWith('--lkv-') ||
        token.startsWith('--font-') ||
        token.startsWith('--motion-');
      expect(known, `jeton non prévu : ${token}`).toBe(true);
    }
  });

  it('tient les cibles de 44 px et le mouvement réduit', () => {
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('prefers-reduced-motion: no-preference');
  });
});
