// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { CompasScreen } from '../components/CompasScreen';
import { STOVE, TENT, TRIP, U1, U2, baseTrip, compasData, compasInput, item } from './helpers/compasData';
import { compas, refresh, resetScreenMocks } from './helpers/screenMocks';
import { assessDanger, type OfficialAlert } from '../engine/danger';
import type { DayForecast } from '../engine/weather';
import type { CompasData } from '../server/getCompasData';
import type { CompasInput } from '../engine/compasModel';

/*
 * Écarts avec la maquette (PLAN-100 5.5), côté écran : heure de passage à chaque
 * étape, barres de risque, îlot de la prochaine décision. L'écran, les cartes, les
 * tiroirs et le moteur sont les vrais ; seules les frontières réseau sont simulées
 * (`helpers/screenMocks.ts`).
 */

vi.mock('next/navigation', async () => {
  const { router } = await import('./helpers/screenMocks');
  return { useRouter: () => router, usePathname: () => '/compas' };
});
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));
vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas);
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);

beforeEach(() => {
  resetScreenMocks();
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const stepsNav = () => screen.getByRole('navigation', { name: 'Étapes du Compas' });

/** Règles A/AA d'axe-core ; le contraste se mesure dans le navigateur (tests/a11y), jsdom n'a pas de couleurs. */
async function scan(root: Element): Promise<string[]> {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });
  return res.violations.map(
    (v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`
  );
}

/** Ouvre le tiroir « Préparer » sur un de ses parcours. */
async function openOu(flow: RegExp): Promise<HTMLElement> {
  fireEvent.click(within(stepsNav()).getByRole('button', { name: /Où/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Détails : Préparer' }));
  const sheet = await screen.findByRole('dialog', { name: 'Préparer' });
  fireEvent.click(within(sheet).getByRole('button', { name: flow }));
  return sheet;
}

/* =============================================================================
   1. Heure de passage à chaque étape (onglet « Quand »)
   ============================================================================= */

describe('Quand : heure de passage à chaque étape', () => {
  /** Les deux jours du jeu d'essai, avec ou sans heure de départ notée sur la première étape de chaque jour. */
  const withStart = (day1: string | null, day2: string | null = null): Partial<CompasInput> => ({
    steps: compasInput().steps.map((st) => ({ ...st, startTime: st.dayNumber === 1 ? day1 : day2 })),
  });
  const region = (sheet: HTMLElement) =>
    within(sheet).getByRole('region', { name: 'Heure de passage à chaque étape' });
  const row = (sheet: HTMLElement, title: string) =>
    within(region(sheet)).getByText(title, { selector: 'b' }).closest('li') as HTMLElement;

  it('un départ noté donne une heure estimée ; sans départ : « non renseigné » et ce qui manque', async () => {
    render(<CompasScreen data={compasData(withStart('07:30:00'))} />);
    const sheet = await openOu(/Quand/);
    const day1 = row(sheet, 'Gavarnie');
    expect(within(day1).getByText('13:10')).toBeTruthy();
    expect(day1.textContent).toContain('Départ 07:30 (noté)');
    expect(day1.textContent).toContain('5 h 42 depuis le départ');
    const day2 = row(sheet, 'Refuge');
    expect(day2.textContent).toContain('non renseigné');
    expect(day2.textContent).toContain('Manque : heure de départ');
    expect(day2.textContent).not.toContain('vers');
  });

  it('aucune heure par défaut : sans départ noté, aucune étape n’affiche d’heure', async () => {
    render(<CompasScreen data={compasData(withStart(null))} />);
    const sheet = await openOu(/Quand/);
    expect(within(region(sheet)).getAllByText('non renseigné')).toHaveLength(2);
    expect(region(sheet).textContent).not.toMatch(/vers \d/);
    expect(region(sheet).querySelectorAll('.cp-pass__v b')).toHaveLength(0);
  });

  it('la simulation (« Si tu pars à ») calcule les jours sans départ noté, sans rien enregistrer', async () => {
    render(<CompasScreen data={compasData(withStart('07:30'))} />);
    const sheet = await openOu(/Quand/);
    const input = within(sheet).getByLabelText(/Si tu pars à/) as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: '06:00' } });
    const day2 = row(sheet, 'Refuge');
    expect(within(day2).getByText('11:45')).toBeTruthy();
    expect(day2.textContent).toContain('Départ 06:00 (simulation)');
    // Le jour qui a un départ noté garde le sien.
    expect(row(sheet, 'Gavarnie').textContent).toContain('Départ 07:30 (noté)');
    // Rien n'est écrit : la simulation reste sur l'écran.
    expect(compas.compasSetDatesAction).not.toHaveBeenCalled();
    expect(compas.compasSetPreferencesAction).not.toHaveBeenCalled();
  });

  it('un passage après le coucher du soleil est dit en texte', async () => {
    render(<CompasScreen data={compasData(withStart('14:00'))} />);
    const sheet = await openOu(/Quand/);
    expect(row(sheet, 'Gavarnie').textContent).toMatch(/après le coucher du soleil \(\d{2}:\d{2}\)/);
  });

  it('activité sans allure connue : pas d’heure, pas de champ de simulation, la raison est écrite', async () => {
    const data = compasData(withStart('07:30'));
    data.model = { ...data.model, activity: 'roadtrip' };
    render(<CompasScreen data={data} />);
    const sheet = await openOu(/Quand/);
    expect(within(sheet).queryByLabelText(/Si tu pars à/)).toBeNull();
    const day1 = row(sheet, 'Gavarnie');
    expect(day1.textContent).toContain('non renseigné');
    expect(day1.textContent).toContain('pas d’allure connue pour cette activité');
  });

  it('axe-core : zéro violation WCAG A/AA sur le tiroir Quand avec les heures de passage', async () => {
    render(<CompasScreen data={compasData(withStart('07:30'))} />);
    const sheet = await openOu(/Quand/);
    expect(region(sheet)).toBeTruthy();
    expect(await scan(sheet)).toEqual([]);
  });
});

/* =============================================================================
   2. Risques : barres par axe, sources datées
   ============================================================================= */

describe('Verdict · Risques : barres par axe', () => {
  const forecast = (over: Partial<DayForecast> = {}): DayForecast => ({
    date: '2026-10-12',
    tMin: 4,
    tMax: 18,
    precipPct: 20,
    precipMm: 1,
    gustMax: 30,
    code: 1,
    sunrise: '07:40',
    sunset: '19:00',
    hours: [],
    ...over,
  });
  const alert = (level: OfficialAlert['level']): OfficialAlert => ({
    id: 'it-1',
    source: 'Météo-France via Meteoalarm',
    hazard: 'orages',
    level,
    area: 'Hautes-Pyrénées',
    onset: null,
    expires: null,
    sent: '2026-10-11T08:00:00+02:00',
    fetchedAt: '2026-10-11T09:00:00Z',
  });
  /** Le voyage d'essai avec un danger évalué par le vrai moteur sur ses deux jours. */
  const withDanger = (gust: number, alerts: OfficialAlert[] = []): CompasData => {
    const data = compasData();
    data.danger = assessDanger({
      dayPlans: data.model.route.dayPlans,
      forecasts: [
        { day: 1, date: '2026-10-12', forecast: forecast({ gustMax: gust }) },
        { day: 2, date: '2026-10-13', forecast: forecast({ date: '2026-10-13' }) },
      ],
      alerts,
      alertsStatus: 'lues',
    });
    return data;
  };
  const openRisques = async (data: CompasData): Promise<HTMLElement> => {
    render(<CompasScreen data={data} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Verdict/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Détails : Verdict' }));
    return screen.findByRole('dialog', { name: 'Verdict' });
  };
  const risks = (sheet: HTMLElement) => within(sheet).getByRole('region', { name: 'Niveau par risque' });

  it('une barre par axe, avec son niveau écrit, son nombre de segments, sa source et sa date', async () => {
    const sheet = await openRisques(withDanger(70));
    const region = risks(sheet);
    const rows = within(region).getAllByRole('img');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Physique : niveau faible, 1 segment sur 3',
      // Aucune cotation du terrain n'existe : l'axe le dit, il ne rassure pas.
      'Technique : niveau faible, 1 segment sur 3, évalué en partie',
      'Conjoncturel : niveau modéré, 2 segments sur 3',
    ]);
    const conj = region.querySelectorAll('li')[2];
    expect(conj.textContent).toContain('modéré');
    expect(conj.textContent).toContain('Source : MET Norway · 12 oct. 2026');
    expect(conj.textContent).not.toContain('13 oct.');
    expect(conj.querySelectorAll('.cp-gauge i[data-on="1"]')).toHaveLength(2);
    expect(conj.querySelectorAll('.cp-gauge i')).toHaveLength(3);
    const technique = region.querySelectorAll('li')[1];
    expect(technique.textContent).toContain('faible · en partie');
    expect(technique.textContent).toContain('Non vérifié : cotation du terrain');
  });

  it('un axe sans donnée est « non évalué » : trois segments vides, aucune source, jamais « faible »', async () => {
    const sheet = await openRisques(compasData());
    const region = risks(sheet);
    const rows = within(region).getAllByRole('img');
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.getAttribute('aria-label')).toMatch(/niveau non évalué, aucun segment plein/);
    expect(region.textContent).not.toContain('faible');
    expect(region.querySelectorAll('.cp-gauge[data-level="non_evalue"]')).toHaveLength(3);
    expect(region.querySelectorAll('.cp-gauge i[data-on="1"]')).toHaveLength(0);
    expect(region.textContent).not.toContain('Source :');
    // La raison est écrite, pas seulement dessinée.
    expect(region.textContent).toContain('Cotation et pente du terrain non disponibles');
  });

  it('pas de score : aucune note globale ni « sur 100 » dans l’onglet', async () => {
    const sheet = await openRisques(withDanger(95, [alert('rouge')]));
    expect(sheet.textContent).not.toMatch(/\/\s*100|sur 100|\bscore\b/i);
    const rows = within(risks(sheet)).getAllByRole('img');
    expect(rows[2].getAttribute('aria-label')).toBe('Conjoncturel : niveau élevé, 3 segments sur 3');
  });

  it('alerte officielle : la barre cite le service national et le jour d’émission, l’avertissement Meteoalarm reste là', async () => {
    const data = withDanger(30, [alert('rouge')]);
    data.model = {
      ...data.model,
      verdict: {
        level: 'bloque',
        reasons: data.danger.signals
          .filter((x) => x.severity !== 'info')
          .map((x) => ({ label: x.label, severity: x.severity, source: x.source })),
      },
    };
    const sheet = await openRisques(data);
    const conj = risks(sheet).querySelectorAll('li')[2];
    expect(conj.textContent).toContain('Source : Météo-France via Meteoalarm · 11 oct. 2026');
    expect(within(sheet).getByTestId('meteoalarm-notice')).toBeTruthy();
  });

  it('axe-core : zéro violation WCAG A/AA sur l’onglet Risques (niveaux évalués et non évalués)', async () => {
    const sheet = await openRisques(withDanger(70));
    expect(await scan(sheet)).toEqual([]);
    cleanup();
    const empty = await openRisques(compasData());
    expect(await scan(empty)).toEqual([]);
  });
});

/* =============================================================================
   3. Îlot de la prochaine décision : « Voir » et, quand c'est sûr, « Appliquer »
   ============================================================================= */

describe('Îlot de la prochaine décision', () => {
  /** Deux objets communs sans porteur, rien de vital : la prochaine décision est « Répartir le matériel commun ». */
  const sacs = (patch: Partial<CompasData> = {}): CompasData =>
    compasData(
      {
        items: [
          item({ id: TENT, name: 'Tente 2P', ownership: 'shared', weightGrams: 1720, isPacked: true }),
          item({ id: STOVE, name: 'Réchaud', ownership: 'shared', weightGrams: 400, isPacked: true }),
        ],
      },
      patch
    );
  const capsule = () => screen.getByRole('group', { name: 'Prochaine décision' });
  const buttons = () => within(capsule()).getAllByRole('button').map((b) => b.textContent);

  it('décision calculable : « Voir » et « Appliquer », avec ce qui sera fait écrit dans la capsule', () => {
    render(<CompasScreen data={sacs()} />);
    expect(within(capsule()).getByText('Répartir le matériel commun')).toBeTruthy();
    expect(buttons()).toEqual(['Voir', 'Appliquer']);
    // Tony (14 kg max) prend la tente ; Léa (12 kg max) le réchaud : charge rapportée à la capacité.
    expect(capsule().textContent).toContain('Proposé : Tony : 1 objet, 1,7 kg · Léa : 1 objet, 400 g');
  });

  it('« Appliquer » confie chaque objet par l’action existante, annonce, et « Annuler » les remet sans porteur', async () => {
    render(<CompasScreen data={sacs()} />);
    fireEvent.click(within(capsule()).getByRole('button', { name: /^Appliquer/ }));
    await waitFor(() => expect(compas.compasSetCarrierAction).toHaveBeenCalledTimes(2));
    expect(compas.compasSetCarrierAction).toHaveBeenNthCalledWith(1, {
      tripId: TRIP, tripSlug: 'trek-3-vallees', itemId: TENT, carrierId: U1, shared: true,
    });
    expect(compas.compasSetCarrierAction).toHaveBeenNthCalledWith(2, {
      tripId: TRIP, tripSlug: 'trek-3-vallees', itemId: STOVE, carrierId: U2, shared: true,
    });
    expect(await screen.findByText('Matériel commun réparti · 2 objets')).toBeTruthy();
    expect(refresh).toHaveBeenCalled();

    compas.compasSetCarrierAction.mockClear();
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(compas.compasSetCarrierAction).toHaveBeenCalledTimes(2));
    expect(compas.compasSetCarrierAction).toHaveBeenNthCalledWith(1, {
      tripId: TRIP, tripSlug: 'trek-3-vallees', itemId: TENT, carrierId: null, shared: true,
    });
    expect(compas.compasSetCarrierAction).toHaveBeenNthCalledWith(2, {
      tripId: TRIP, tripSlug: 'trek-3-vallees', itemId: STOVE, carrierId: null, shared: true,
    });
  });

  it('un échec au milieu ne laisse rien à moitié : ce qui était confié est remis, l’erreur est dite, pas d’« Annuler »', async () => {
    compas.compasSetCarrierAction
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'Cette personne ne fait pas partie du voyage.' });
    render(<CompasScreen data={sacs()} />);
    fireEvent.click(within(capsule()).getByRole('button', { name: /^Appliquer/ }));
    expect(await screen.findByText('Cette personne ne fait pas partie du voyage.')).toBeTruthy();
    // 2 appels d'écriture, puis la remise du premier objet sans porteur.
    expect(compas.compasSetCarrierAction).toHaveBeenCalledTimes(3);
    expect(compas.compasSetCarrierAction).toHaveBeenLastCalledWith({
      tripId: TRIP, tripSlug: 'trek-3-vallees', itemId: TENT, carrierId: null, shared: true,
    });
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
  });

  it('décision qui demande un choix (dates) : « Voir » seulement, qui ouvre l’étape', async () => {
    render(<CompasScreen data={compasData({ trip: { ...baseTrip, startDate: null, endDate: null } })} />);
    expect(within(capsule()).getByText('Choisir les dates')).toBeTruthy();
    expect(buttons()).toEqual(['Voir']);
    fireEvent.click(within(capsule()).getByRole('button', { name: 'Voir : Choisir les dates' }));
    expect(await screen.findByRole('dialog', { name: 'Préparer' })).toBeTruthy();
  });

  it('décision qui engage de l’argent (réservations en attente) : « Voir » seulement', () => {
    const data = compasData();
    data.model = {
      ...data.model,
      nextDecision: { step: 'resa', flow: 'choix', label: 'Confirmer les réservations', detail: '1 en attente' },
    };
    render(<CompasScreen data={data} />);
    expect(buttons()).toEqual(['Voir']);
  });

  it('objet vital à trouver (choix de produit) : « Voir » seulement', () => {
    render(
      <CompasScreen
        data={compasData({ items: [item({ id: TENT, name: 'Sac de couchage', isVital: true })] })}
      />
    );
    expect(within(capsule()).getByText('Trouver : sac de couchage')).toBeTruthy();
    expect(buttons()).toEqual(['Voir']);
  });

  it('lecture seule : même décision calculable, pas d’« Appliquer »', () => {
    render(<CompasScreen data={sacs({ canEdit: false })} />);
    expect(buttons()).toEqual(['Voir']);
  });

  it('aucune décision : pas de capsule', () => {
    render(<CompasScreen data={compasData()} />);
    expect(screen.queryByRole('group', { name: 'Prochaine décision' })).toBeNull();
  });

  it('toucher le texte vaut « Voir » ; le bouton « Voir » est au clavier', async () => {
    render(<CompasScreen data={sacs()} />);
    fireEvent.click(within(capsule()).getByText('Répartir le matériel commun'));
    expect(await screen.findByRole('dialog', { name: 'Kit' })).toBeTruthy();
    expect(compas.compasSetCarrierAction).not.toHaveBeenCalled();
  });

  it('annonce polie, sans piège au clavier : tabulable, retirée de l’ordre quand un tiroir s’ouvre', async () => {
    render(<CompasScreen data={sacs()} />);
    expect(capsule().getAttribute('aria-live')).toBe('polite');
    expect(capsule().hasAttribute('inert')).toBe(false);
    for (const b of within(capsule()).getAllByRole('button')) expect(b.getAttribute('tabindex')).toBeNull();
    fireEvent.click(within(capsule()).getByRole('button', { name: /^Voir/ }));
    await screen.findByRole('dialog', { name: 'Kit' });
    expect(capsule().hasAttribute('inert')).toBe(true);
    // Le tiroir se ferme (Échap) : l'îlot revient dans l'ordre de tabulation.
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Kit' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kit' })).toBeNull());
    expect(capsule().hasAttribute('inert')).toBe(false);
  });

  it('au-dessus de l’accessoire quand le profil d’altitude est affiché', () => {
    render(<CompasScreen data={sacs()} />);
    expect(capsule().getAttribute('data-acc')).toBe('1');
  });

  it('axe-core : zéro violation WCAG A/AA sur la capsule, avec et sans « Appliquer »', async () => {
    const { container } = render(<CompasScreen data={sacs()} />);
    expect(await scan(capsule())).toEqual([]);
    expect(await scan(container)).toEqual([]);
    cleanup();
    const view = render(<CompasScreen data={sacs({ canEdit: false })} />);
    expect(await scan(view.container)).toEqual([]);
  });
});
