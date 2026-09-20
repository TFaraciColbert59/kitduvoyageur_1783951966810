import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href?: string }) =>
    React.createElement('a', { href }, children),
}));

vi.mock('@/features/trips/actions/renameTrip', () => ({ renameTrip: vi.fn() }));

// Sheet passe par un portail Radix (rendu vide en SSR) : on le remplace
// par un conteneur neutre pour tester le contenu réel du formulaire.
vi.mock('@/components/ui/Sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'sheet' }, children),
}));

import { renameTrip } from '@/features/trips/actions/renameTrip';
import {
  RenameTripForm,
  RenameTripModal,
  submitRenameTrip,
} from '@/features/trips/components/RenameTripModal';

const ROOT = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const mockedRename = vi.mocked(renameTrip);

describe('RenameTripModal — formulaire et action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pré-remplit le champ avec le titre courant', () => {
    const html = renderToStaticMarkup(
      React.createElement(RenameTripModal, {
        open: true,
        onOpenChange: vi.fn(),
        tripId: 'trip-1',
        currentTitle: 'Tour du Mont-Blanc',
      })
    );

    expect(html).toContain('Nom de l’activité');
    expect(html).toContain('value="Tour du Mont-Blanc"');
    expect(html).toContain('Enregistrer');
  });

  it('affiche l’erreur renvoyée sous le champ', () => {
    const html = renderToStaticMarkup(
      React.createElement(RenameTripForm, {
        value: 'ab',
        error: 'Le titre doit comporter au moins 3 caractères',
        onChange: vi.fn(),
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
      })
    );

    expect(html).toContain('Le titre doit comporter au moins 3 caractères');
  });

  it('soumet le titre normalisé à l’action de renommage mockée', async () => {
    mockedRename.mockResolvedValue({ ok: true });

    const result = await submitRenameTrip('trip-1', '  Nouveau nom  ');

    expect(result).toEqual({ ok: true });
    expect(mockedRename).toHaveBeenCalledTimes(1);
    expect(mockedRename).toHaveBeenCalledWith('trip-1', 'Nouveau nom');
  });

  it('propage l’échec de l’action', async () => {
    mockedRename.mockResolvedValue({ ok: false, error: 'Session requise' });

    await expect(submitRenameTrip('trip-1', 'Nouveau nom')).resolves.toEqual({
      ok: false,
      error: 'Session requise',
    });
  });

  it('source : la modale soumet via startTransition, ferme et signale le succès', () => {
    const src = read('src/features/trips/components/RenameTripModal.tsx');

    expect(src).toContain("'use client'");
    expect(src).toContain('startTransition');
    expect(src).toMatch(/await submitRenameTrip\(tripId, clean\)/);
    expect(src).toContain('onOpenChange(false)');
    expect(src).toContain('onRenamed?.(clean)');
    expect(src).toContain('LkvInput');
    expect(src).toContain('Sheet');
  });

  it('source : crayons branchés sur le hero mobile et l’en-tête desktop', () => {
    const hero = read('src/features/hub/components/mobile/itinerary/ItineraryHero.tsx');
    const mobile = read('src/features/hub/components/mobile/itinerary/ItineraryMobileExperience.tsx');
    const desktop = read('src/features/trips/planner/ItineraryPlannerClient.tsx');

    expect(hero).toContain('onRename');
    expect(hero).toMatch(/Pencil/);
    // Cible tactile 44px HIG/repo : crayon hero et déclencheur desktop.
    expect(hero).toMatch(/glass-circle-btn h-11 w-11/);
    expect(desktop).toContain('!h-11');
    expect(mobile).toContain('<RenameTripModal');
    expect(desktop).toContain('<RenameTripModal');
    expect(desktop).toMatch(/Icon name="pencil"/);
  });
});
