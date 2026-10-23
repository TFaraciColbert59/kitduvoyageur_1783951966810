// @vitest-environment jsdom

/*
 * PLAN-100 phase 6, lot 3 : l'écran du Compas (cartes d'étape, carte, règle, tiroir,
 * îlots) et ses petits composants lisent la locale du site (`LocaleProvider`).
 * Le français est inchangé (tests existants) ; ici, l'anglais rendu et ses pluriels.
 * Les textes du moteur (activités, dates, étapes) sont traduits par un autre lot :
 * on ne lit que les textes de l'interface.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { compasData } from './helpers/compasData';
import { resetScreenMocks } from './helpers/screenMocks';

vi.mock('next/navigation', async () => {
  const { router } = await import('./helpers/screenMocks');
  return { useRouter: () => router, usePathname: () => '/compas' };
});
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));
vi.mock('../server/compasActions', async () => ({
  ...(await import('./helpers/screenMocks')).compas,
  compasOpenTripAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);
vi.mock('../server/invitationActions', () => ({
  respondTripInvitationAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('../server/itemHistoryActions', () => ({
  compasItemHistoryAction: vi.fn(() => new Promise(() => undefined)),
}));

import { CompasScreen } from '../components/CompasScreen';
import { CompasSheet } from '../components/CompasSheet';
import { CompasTripPicker } from '../components/CompasTripPicker';
import { TripInvitationsInbox } from '../components/TripInvitations';
import { CompasAccessory } from '../components/CompasAccessory';
import { RiskBars } from '../components/CompasRisks';
import OfficialAlertTexts from '../components/OfficialAlertTexts';
import MeteoalarmNotice from '../components/MeteoalarmNotice';
import { HubGroupLink, memberFacts } from '../components/CompasMembers';
import { DisLe } from '../components/CompasDisLe';
import { ItemHistory } from '../components/CompasItemHistory';
import { DecisionCapsule } from '../components/CompasDecision';
import { STEP_FLOWS, type CompasCtl } from '../components/compasTypes';
import { runOps } from '../components/compasApply';
import { lineStatus } from '../components/CompasCards';
import { METEOALARM_DISCLAIMER_FR } from '../engine/meteoalarmFeeds';
import { assessDanger } from '../engine/danger';
import { useTranslation } from '@/lib/i18n/context';
import type { CompasKitLine } from '../engine/compasModel';
import type { MemberView } from '../engine/crewView';

beforeEach(() => {
  resetScreenMocks();
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const inLocale = (locale: Locale, ui: React.ReactElement) =>
  render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>);

const FRENCH = /[àâéèêëîïôùûç«»]|\b(ton|ta|tes|pour|avec|dans|une|jour|objet|carte)\b/i;

describe('Compas en anglais (lot 3) : écran et cartes d’étape', () => {
  it('Où : en-tête, carte, demande, règle, préremplissage et carte du parcours', () => {
    inLocale('en', <CompasScreen data={compasData()} initialStep="ou" />);
    expect(screen.getByRole('navigation', { name: 'Compas steps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details: Planning' })).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Planning summary' });
    for (const label of ['Activity', 'Route', 'When', 'Preferences', 'Bag'])
      expect(within(card).getByText(label)).toBeTruthy();
    expect(
      within(card).getByRole('form', { name: 'Say it: describe your adventure or a change' })
    ).toBeTruthy();
    expect(
      within(card).getByPlaceholderText('Say it: “3 days, 4 of us, leaving Saturday”')
    ).toBeTruthy();
    expect(within(card).getByRole('slider', { name: 'Outing duration' })).toBeTruthy();
    expect(within(card).getByText('Pre-filled by Compas')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Undo the preparation' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Route map' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Customize the map' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enlarge the map' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shrink the map' })).toBeTruthy();
  });

  it('affichage : réglages et durées en anglais, pluriel des secondes', () => {
    inLocale('en', <CompasScreen data={compasData()} initialStep="ou" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Display: full sun and glass transparency' })
    );
    const pop = screen.getByRole('dialog', { name: 'Display' });
    expect(within(pop).getByRole('switch', { name: 'Full sun mode' })).toBeTruthy();
    expect(within(pop).getByText('Glass transparency')).toBeTruthy();
    expect(within(pop).getByText('Clear')).toBeTruthy();
    expect(within(pop).getByText('Solid')).toBeTruthy();
    const options = within(pop)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['8 seconds', '15 seconds (default)', '30 seconds']);
    expect(pop.textContent ?? '').not.toMatch(FRENCH);
  });

  it('Nous : équipe, budget et enveloppe en anglais', () => {
    inLocale('en', <CompasScreen data={compasData()} initialStep="nous" />);
    expect(screen.getByRole('button', { name: 'Details: Team' })).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Team summary' });
    expect(within(card).getByRole('button', { name: 'See who’s on the trip' })).toBeTruthy();
    expect(within(card).getByText(/^Carrying capacity filled in:/)).toBeTruthy();
    expect(within(card).getAllByText(/planned and spent/).length).toBeGreaterThan(0);
    expect(within(card).getByText(/^Budget cap /)).toBeTruthy();
    expect(within(card).getByRole('button', { name: /The team and their bags/ })).toBeTruthy();
  });

  it('Résa : jours, nuits notées et résumé des réservations, pluriels anglais', () => {
    inLocale('en', <CompasScreen data={compasData()} initialStep="resa" />);
    const card = screen.getByRole('region', { name: 'Bookings summary' });
    expect(within(card).getByText('Day 1')).toBeTruthy();
    expect(within(card).getByText('night to find')).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Night without lodging' })).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Noted: Refuge (not booked)' })).toBeTruthy();
    expect(card.querySelector('.cp-sumline span')?.textContent).toBe(
      '0 bookings · 0 confirmed · 0 pending'
    );
    expect(
      within(card).getByText(/^Affiliate partners: rankings are never influenced/)
    ).toBeTruthy();
  });

  it('Verdict : signaux, axes et niveaux en anglais', () => {
    inLocale('en', <CompasScreen data={compasData()} initialStep="verdict" />);
    const card = screen.getByRole('region', { name: 'Verdict summary' });
    expect(within(card).getByText('Verifiable signals · no score')).toBeTruthy();
    const axes = within(card).getByRole('group', { name: 'Danger by axis' });
    for (const label of ['Physical', 'Technical', 'Circumstantial'])
      expect(within(axes).getByText(label)).toBeTruthy();
    // Les niveaux sont les nôtres ; la note d'un axe vient du moteur (autre lot).
    for (const level of axes.querySelectorAll('.cp-tchip__bd'))
      expect(['All clear', 'Partly clear', 'Caution', 'Blocking', 'Not assessed']).toContain(
        level.textContent
      );
  });

  it('Kit : sac vide, poids et inventaire en anglais (0 → pluriel anglais)', () => {
    inLocale('en', <CompasScreen data={compasData()} initialStep="kit" />);
    const card = screen.getByRole('region', { name: 'Kit summary' });
    expect(within(card).getByText('Bag to put together')).toBeTruthy();
    expect(within(card).getByText('no items planned for this trip')).toBeTruthy();
    expect(within(card).getByText(/^Base weight /)).toBeTruthy();
    expect(within(card).getByText(/^Inventory · 0 items$/)).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'See Tony’s bag' })).toBeTruthy();
  });

  it('français : même rendu qu’avant (0 objet, singulier en français)', () => {
    inLocale('fr', <CompasScreen data={compasData()} initialStep="kit" />);
    const card = screen.getByRole('region', { name: 'Kit' });
    expect(within(card).getByText(/^Inventaire · 0 objet$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Détails : Kit' })).toBeTruthy();
  });
});

describe('Compas en anglais (lot 3) : composants', () => {
  it('tiroir : fermer, retour, taille', () => {
    inLocale(
      'en',
      <CompasSheet
        title="Kit"
        detent="medium"
        onDetent={vi.fn()}
        onClose={vi.fn()}
        onBack={vi.fn()}
      >
        <p>body</p>
      </CompasSheet>
    );
    expect(screen.getByRole('button', { name: 'Close the drawer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand the drawer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy();
  });

  it('choix du voyage : titre, liste, dates localisées et partage', () => {
    inLocale(
      'en',
      <CompasTripPicker
        trips={
          [
            {
              id: 'a',
              title: 'Queyras',
              startDate: '2026-07-04',
              endDate: '2026-07-08',
              role: 'collaborator',
            },
            { id: 'b', title: 'Jura', startDate: null, endDate: null, role: 'owner' },
          ] as never
        }
      />
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Which adventure shall we prepare?'
    );
    const list = screen.getByRole('group', { name: 'My trips' });
    expect(within(list).getByText('Jul 4 → Jul 8 · shared with you')).toBeTruthy();
    expect(within(list).getByText('dates not chosen')).toBeTruthy();
    expect(screen.getByRole('link', { name: /New adventure/ })).toBeTruthy();
  });

  it('invitations : titre par défaut, invitant et réponses', () => {
    inLocale(
      'en',
      <TripInvitationsInbox
        invitations={
          [
            {
              invitationId: 'i1',
              tripId: 't1',
              tripTitle: 'Queyras',
              inviterName: 'Léa',
              destination: null,
              startDate: null,
              endDate: null,
            },
          ] as never
        }
      />
    );
    expect(screen.getByRole('region', { name: 'Trip invitations' })).toBeTruthy();
    expect(screen.getByText('Léa invites you')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
  });

  it('accessoire sans profil : jours et étapes au pluriel anglais', () => {
    const { container } = inLocale(
      'en',
      <CompasAccessory profile={null} gainM={900} distanceKm={22} days={1} stepsCount={2} />
    );
    expect(container.querySelector('.cp-acc')?.getAttribute('aria-label')).toBe('1 day, 2 stages');
  });

  it('risques, texte officiel et Meteoalarm : seul le cadre est traduit', () => {
    inLocale('en', <RiskBars danger={assessDanger({ dayPlans: [], forecasts: [], alerts: [] })} />);
    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Level by risk');
    cleanup();

    inLocale(
      'en',
      <OfficialAlertTexts
        texts={
          [{ lang: 'fr', headline: 'Vent violent', description: null, instruction: null }] as never
        }
      />
    );
    expect(screen.getByText('Official text from the national service')).toBeTruthy();
    // Le texte de l'autorité reste tel quel.
    expect(screen.getByText('Vent violent')).toBeTruthy();
    cleanup();

    const { container } = inLocale('en', <MeteoalarmNotice />);
    expect(container.textContent).toContain(
      'Official alerts from national weather services, relayed by Meteoalarm (EUMETNET).'
    );
    // L'avertissement officiel anglais suit ; sa traduction française n'est pas redite.
    expect(container.textContent).not.toContain(METEOALARM_DISCLAIMER_FR);
    cleanup();

    const fr = inLocale('fr', <MeteoalarmNotice />);
    expect(fr.container.textContent).toContain(METEOALARM_DISCLAIMER_FR);
  });

  it('membres et statut d’objet', () => {
    inLocale('en', <HubGroupLink />);
    expect(screen.getByRole('link', { name: /Manage the group in the Hub/ })).toBeTruthy();
    cleanup();

    function Facts() {
      const { t } = useTranslation();
      return <p>{memberFacts({ pace: null, level: null } as unknown as MemberView, t)}</p>;
    }
    inLocale('en', <Facts />);
    expect(screen.getByText('pace not filled in · level not filled in')).toBeTruthy();
    // Sans traducteur : le français d'avant.
    expect(memberFacts({ pace: null, level: null } as unknown as MemberView)).toBe(
      'allure non renseignée · niveau non renseigné'
    );
    const st = lineStatus({ status: 'missing', purchaseState: null } as unknown as CompasKitLine);
    expect(st.label).toBe('À trouver');
    expect(st.labelKey).toBe('compas.cards.statusMissing');
  });

  it('Dis-le et historique d’un objet', () => {
    const data = compasData();
    const ctl = { data, busy: false, enlarge: vi.fn(), run: vi.fn() } as unknown as CompasCtl;
    inLocale('en', <DisLe ctl={ctl} />);
    expect(screen.getByLabelText('Say it')).toBeTruthy();
    expect(screen.getByPlaceholderText('Say it…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Understand the sentence' })).toBeTruthy();
    cleanup();

    inLocale(
      'en',
      <ItemHistory
        tripId="t"
        data={data}
        line={{ id: 'l1', inventoryItemId: null, shopProductId: null } as unknown as CompasKitLine}
      />
    );
    expect(screen.getByRole('status').textContent).toBe('Reading the history…');
    expect(screen.getByText(/^This item isn’t linked to your inventory/)).toBeTruthy();
  });

  it('prochaine décision : groupe et boutons en anglais', () => {
    const ctl = { data: compasData(), busy: false } as unknown as CompasCtl;
    inLocale(
      'en',
      <DecisionCapsule
        ctl={ctl}
        decision={{ step: 'kit', flow: 'sacs', label: 'X', detail: 'Y' } as never}
        apply={null}
        blocked={false}
        withAccessory={false}
        inert={false}
        onView={vi.fn()}
      />
    );
    expect(screen.getByRole('group', { name: 'Next decision' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View: X' }).textContent).toBe('View');
  });

  it('parcours des tiroirs : une clé par onglet, le français reste le libellé par défaut', () => {
    expect(STEP_FLOWS.ou[0].label).toBe('Activité');
    expect(STEP_FLOWS.ou[0].labelKey).toBe('compas.flowTabs.activite');
    function Tabs() {
      const { t } = useTranslation();
      return <p>{STEP_FLOWS.kit.map((f) => t(f.labelKey)).join(', ')}</p>;
    }
    inLocale('en', <Tabs />);
    expect(screen.getByText('Tips, My kits, Inventory, Find, Pack, All, Bags, Water')).toBeTruthy();
  });

  it('application en série : l’échec partiel est dit dans la langue du contrôleur', async () => {
    const { compasSetPartySizeAction, compasSetBudgetAction } =
      (await import('../server/compasActions')) as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
    compasSetBudgetAction.mockResolvedValueOnce({ success: false });
    const data = compasData();
    let message = '';
    function Run() {
      const { t, locale } = useTranslation();
      React.useEffect(() => {
        const ctl = { data, t, locale } as unknown as CompasCtl;
        void runOps(ctl, [
          { op: 'party', partySize: 3 },
          { op: 'budget', amount: 500 },
        ] as never).then((r) => {
          message = r.error ?? '';
        });
      }, [t, locale]);
      return null;
    }
    inLocale('en', <Run />);
    await vi.waitFor(() => expect(message).toBe('Failed (1 already applied)'));
    expect(compasSetPartySizeAction).toHaveBeenCalled();
  });
});
