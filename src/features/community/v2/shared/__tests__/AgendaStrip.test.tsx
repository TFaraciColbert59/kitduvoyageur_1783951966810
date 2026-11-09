// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateFull } from '../format';
import { AgendaStrip } from '../AgendaStrip';

afterEach(cleanup);

const FROM = '2026-11-08';

describe('AgendaStrip', () => {
  it('affiche 14 jours à partir du premier jour demandé', () => {
    render(<AgendaStrip counts={{}} value={null} onChange={() => {}} fromIso={FROM} />);
    const days = screen.getAllByRole('button');
    expect(days).toHaveLength(14);
    expect(days[0]?.getAttribute('data-iso')).toBe('2026-11-08');
    expect(days[13]?.getAttribute('data-iso')).toBe('2026-11-21');
    expect(screen.getByRole('group', { name: 'Agenda des prochains jours' })).toBeTruthy();
  });

  it('donne une date complète en français et le nombre de sorties dans le libellé', () => {
    render(
      <AgendaStrip counts={{ '2026-11-08': 0, '2026-11-14': 3, '2026-11-15': 1 }} value={null} onChange={() => {}} fromIso={FROM} />,
    );
    expect(
      screen.getByRole('button', {
        name: `${formatDateFull('2026-11-08T12:00:00+01:00')} · aucune sortie`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: `${formatDateFull('2026-11-14T12:00:00+01:00')} · 3 sorties`,
      }),
    ).toBeTruthy();
    const single = screen.getByRole('button', {
      name: `${formatDateFull('2026-11-15T12:00:00+01:00')} · 1 sortie`,
    });
    expect(single).toBeTruthy();
  });

  it('affiche un point par sortie, plafonné à trois', () => {
    const { container } = render(
      <AgendaStrip
        counts={{ '2026-11-08': 1, '2026-11-14': 5, '2026-11-15': 2 }}
        value={null}
        onChange={() => {}}
        fromIso={FROM}
      />,
    );
    const days = container.querySelectorAll('.lkdv-cv2-agenda-day');
    expect(days[0]?.querySelectorAll('.lkdv-cv2-agenda-dots u')).toHaveLength(1);
    expect(days[6]?.querySelectorAll('.lkdv-cv2-agenda-dots u')).toHaveLength(3);
    expect(days[7]?.querySelectorAll('.lkdv-cv2-agenda-dots u')).toHaveLength(2);
    expect(days[1]?.querySelectorAll('.lkdv-cv2-agenda-dots u')).toHaveLength(0);
  });

  it('marque aujourd’hui, les week-ends et le jour actif', () => {
    const { container } = render(
      <AgendaStrip counts={{}} value="2026-11-14" onChange={() => {}} fromIso={FROM} />,
    );
    const days = container.querySelectorAll('.lkdv-cv2-agenda-day');
    // is-today = premier jour de la bande.
    expect(days[0]?.classList.contains('is-today')).toBe(true);
    // 14 novembre 2026 = samedi, 16 = lundi.
    expect(days[6]?.classList.contains('is-weekend')).toBe(true);
    expect(days[8]?.classList.contains('is-weekend')).toBe(false);
    expect(days[6]?.classList.contains('is-active')).toBe(true);
    expect(days[6]?.getAttribute('aria-pressed')).toBe('true');
    expect(days[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('touche un jour pour filtrer', () => {
    const onChange = vi.fn();
    render(<AgendaStrip counts={{}} value={null} onChange={onChange} fromIso={FROM} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: `${formatDateFull('2026-11-14T12:00:00+01:00')} · aucune sortie`,
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('2026-11-14');
  });

  it('re-touche le jour actif pour retirer le filtre', () => {
    const onChange = vi.fn();
    render(<AgendaStrip counts={{}} value="2026-11-14" onChange={onChange} fromIso={FROM} />);
    const active = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('data-iso') === '2026-11-14');
    expect(active).toBeTruthy();
    fireEvent.click(active!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('accepte une bande plus courte et des compteurs absents', () => {
    render(<AgendaStrip counts={null} value={null} onChange={() => {}} fromIso={FROM} days={7} />);
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(document.querySelectorAll('.lkdv-cv2-agenda-dots u')).toHaveLength(0);
  });

  it('ne contient aucune couleur littérale', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/community/v2/shared/AgendaStrip.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
