// @vitest-environment jsdom

/*
 * 10.2 : « Ouvrir dans l'itinéraire » mène à `/compas/itineraire?trip=<id>` depuis le tiroir Parcours (bouton)
 * et depuis l'éditeur de tracé (lien). Le test exerce les deux entrées sans modifier le Compas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import { RouteEditor } from '../components/RouteEditor';
import { ParcoursFlow } from '../components/CompasOuFlows';
import type { CompasCtl } from '../components/compasTypes';
import type { CompasData } from '../server/getCompasData';
import { compasData } from './helpers/compasData';
import { router } from './helpers/screenMocks';

vi.mock('next/navigation', async () => {
  const { router: r } = await import('./helpers/screenMocks');
  return { useRouter: () => r, usePathname: () => '/compas' };
});
vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas);
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);

beforeEach(() => {
  router.push.mockClear();
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function ctlOf(d: CompasData): CompasCtl {
  return {
    data: d,
    lines: d.model.kit.lines,
    busy: false,
    open: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  } as unknown as CompasCtl;
}

const published = { revisionNo: 4 } as unknown as NonNullable<CompasData['publishedRoute']>;

describe('10.2 « Ouvrir dans l’itinéraire »', () => {
  it('tiroir Parcours : le bouton ouvre /compas/itineraire?trip=<id du voyage>', () => {
    const d = compasData({}, { publishedRoute: published });
    render(
      <LocaleProvider initialLocale="fr">
        <ParcoursFlow ctl={ctlOf(d)} />
      </LocaleProvider>
    );
    const button = screen.getByTestId('compas-open-itinerary');
    expect(button.textContent).toMatch(/Ouvrir dans l’itinéraire/);
    expect(button.textContent).toMatch(/Version publiée 4/);
    fireEvent.click(button);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/compas/itineraire?trip=${encodeURIComponent(d.model.tripId)}`);
  });

  it('sans version publiée, le bouton reste là et le dit', () => {
    const d = compasData({}, { publishedRoute: null });
    render(
      <LocaleProvider initialLocale="fr">
        <ParcoursFlow ctl={ctlOf(d)} />
      </LocaleProvider>
    );
    expect(screen.getByTestId('compas-open-itinerary').textContent).toMatch(/page dédiée/);
  });

  it('éditeur de tracé : le lien (version publiée) pointe vers la même adresse', () => {
    const d = compasData({}, { publishedRoute: published });
    render(
      <LocaleProvider initialLocale="fr">
        <RouteEditor ctl={ctlOf(d)} onBack={vi.fn()} />
      </LocaleProvider>
    );
    const link = screen.getByTestId('compas-editor-open-itinerary');
    expect(link.getAttribute('href')).toBe(`/compas/itineraire?trip=${encodeURIComponent(d.model.tripId)}`);
  });
});
