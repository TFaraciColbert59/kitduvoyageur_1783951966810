// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClubCrest, crestInitial } from '../ClubCrest';

afterEach(cleanup);

describe('ClubCrest', () => {
  it('est décoratif (aria-hidden) et expose une graine stable', () => {
    render(<ClubCrest name="Les Écrins" activity="rando" seed="club-42" size={44} />);
    const crest = screen.getByTestId('club-crest');
    expect(crest.getAttribute('aria-hidden')).toBe('true');
    expect(crest.getAttribute('focusable')).toBe('false');
    expect(crest.getAttribute('width')).toBe('44');
    expect(crest.getAttribute('height')).toBe('51');
  });

  it('dérive la même graine en même blason (déterministe)', () => {
    const firstRender = render(
      <ClubCrest name="Vercors Alpin" activity="escalade" seed="club-7" />,
    );
    const first = firstRender.container.innerHTML;
    firstRender.unmount();
    const secondRender = render(
      <ClubCrest name="Vercors Alpin" activity="escalade" seed="club-7" />,
    );
    expect(secondRender.container.innerHTML).toBe(first);
  });

  it('varie le motif selon le nom et la teinte selon l’activité (maquette), uniquement en jetons', () => {
    const tones = new Set<string>();
    const patterns = new Set<string>();
    const activities = ['rando', 'ski', 'velo', 'escalade', 'trail'];
    for (let index = 0; index < 12; index += 1) {
      const { container, unmount } = render(
        <ClubCrest name={`Club ${index}`} activity={activities[index % activities.length]} seed={`seed-${index}`} />,
      );
      const crest = container.querySelector('[data-testid="club-crest"]');
      expect(crest).toBeTruthy();
      tones.add(crest!.getAttribute('data-tone') ?? '');
      patterns.add(crest!.querySelector('.lkdv-crest-pattern')?.getAttribute('d') ?? '');
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      unmount();
    }
    expect(tones.size).toBe(5);
    expect(patterns.size).toBeGreaterThan(1);
  });

  it('ne dépend pas de la graine : même nom et même activité, même blason', () => {
    const first = render(<ClubCrest name="Trail des Aravis" activity="trail" seed="a" />);
    const html = first.container.innerHTML;
    first.unmount();
    const second = render(<ClubCrest name="Trail des Aravis" activity="trail" seed="b" />);
    expect(second.container.innerHTML).toBe(html);
  });

  it('choisit l’icône d’activité à partir du libellé', () => {
    const cases: Array<[string, string]> = [
      ['Ski de randonnée', 'ski'],
      ['Vélo gravel', 'velo'],
      ['Escalade', 'escalade'],
      ['Trail', 'trail'],
      ['Randonnée', 'rando'],
    ];
    for (const [activity, expected] of cases) {
      const { unmount } = render(<ClubCrest name="Test" activity={activity} seed="s" />);
      expect(screen.getByTestId('club-crest').getAttribute('data-activity')).toBe(expected);
      unmount();
    }
  });

  it('prend l’initiale du nom en retirant les articles français', () => {
    expect(crestInitial('Les Écrins')).toBe('É');
    expect(crestInitial("L'Atelier des Cimes")).toBe('A');
    expect(crestInitial('la cordée')).toBe('C');
    expect(crestInitial('')).toBe('?');
    expect(crestInitial(null)).toBe('?');
  });

  it('respecte les trois tailles canoniques 28 / 44 / 72', () => {
    const { unmount } = render(<ClubCrest name="A" seed="a" size={28} />);
    expect(screen.getByTestId('club-crest').getAttribute('width')).toBe('28');
    expect(screen.getByTestId('club-crest').getAttribute('height')).toBe('32');
    unmount();
    render(<ClubCrest name="A" seed="a" size={72} />);
    expect(screen.getByTestId('club-crest').getAttribute('width')).toBe('72');
    expect(screen.getByTestId('club-crest').getAttribute('height')).toBe('83');
  });

  it('ne contient aucune couleur littérale dans son source', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/community/v2/shared/ClubCrest.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source.toLowerCase()).not.toMatch(/\b(fill|stroke|color)\s*[:=]\s*["'](white|black|red|green)/);
  });
});
