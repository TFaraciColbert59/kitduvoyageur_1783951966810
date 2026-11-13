// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LocalLegendsPanel } from '../LocalLegendsPanel';
import { SEGMENT, makeLocalLegendResult } from './fixtures';

afterEach(cleanup);

describe('LocalLegendsPanel', () => {
  it('affiche le titulaire, son seuil et la fenêtre glissante', () => {
    render(<LocalLegendsPanel result={makeLocalLegendResult()} segment={SEGMENT} />);

    expect(screen.getByRole('heading', { name: 'Local Legend' })).toBeTruthy();
    expect(screen.getAllByText('Camille Martin').length).toBeGreaterThan(0);
    expect(screen.getByText('Titulaire actuel')).toBeTruthy();
    expect(screen.getAllByText(/7 passages/).length).toBeGreaterThan(0);
    expect(screen.getByText('90 jours')).toBeTruthy();
    expect(screen.getByText(/Seuil : 3 passages valides sur 90 jours/)).toBeTruthy();
  });

  it('affiche tous les titulaires en cas d’égalité', () => {
    const base = makeLocalLegendResult();
    const second = { ...base.tiedLegends[0], userId: 'u-2', displayName: 'Nils Bernard' };
    render(
      <LocalLegendsPanel
        result={makeLocalLegendResult({
          tiedLegends: [base.tiedLegends[0], second],
          legend: base.tiedLegends[0],
          rankings: [base.tiedLegends[0], second],
        })}
        segment={SEGMENT}
      />
    );

    expect(screen.getByText('Titre partagé')).toBeTruthy();
    expect(screen.getByText('Camille Martin · Nils Bernard')).toBeTruthy();
    expect(screen.getByText(/2 voyageurs sont ex æquo au rang 1/)).toBeTruthy();
  });

  it('masque la mention sur un segment signalé', () => {
    render(
      <LocalLegendsPanel
        result={makeLocalLegendResult({
          shouldDisplayMention: false,
          legend: null,
          tiedLegends: [],
          rankings: [],
          viewerStanding: null,
        })}
        segment={{ ...SEGMENT, isHazardous: true }}
      />
    );

    expect(screen.getByText('Mention non affichée')).toBeTruthy();
    expect(screen.getByText(/segment est signalé comme dangereux/)).toBeTruthy();
  });

  it('explique l’absence de titulaire sous le seuil', () => {
    render(
      <LocalLegendsPanel
        result={makeLocalLegendResult({
          shouldDisplayMention: false,
          legend: null,
          tiedLegends: [],
          rankings: [],
          viewerStanding: null,
        })}
        segment={SEGMENT}
      />
    );

    expect(screen.getByText(/Aucun voyageur n’atteint 3 passages/)).toBeTruthy();
  });
});
