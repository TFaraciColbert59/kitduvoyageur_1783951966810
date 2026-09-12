import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartEquipeSection } from '@/features/materiel/components/depart/DepartEquipeSection';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

vi.mock('framer-motion', async () => ({
  ...(await vi.importActual('framer-motion')),
  useReducedMotion: () => false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/hub/depart',
  useSearchParams: () => new URLSearchParams(),
}));

const hapticMock = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: hapticMock, triggerHaptic: hapticMock, vibrate: hapticMock }),
}));

const depart = {
  id: 'tmb-4j',
  destination: 'Tour du Mont-Blanc — 4j Bivouac',
  status: 'draft',
  readinessScore: { percentage: 67 },
  baseWeightG: 4800,
  wornWeightG: 1200,
  consumablesWeightG: 2500,
  totalPackWeightG: 7300,
  assignedKit: { id: 'kit-tmb', name: 'Kit Tour du Mont-Blanc', totalWeightG: 4800, items: [] },
  weightBreakdown: [],
  checklistPct: 67,
  checklistSections: [],
  checklistItems: [],
  durationDays: 4,
  consumables: { water: 3, gas: 100 },
  trail: null,
  participants: [
    { name: 'Vous', initial: 'V', color: 'var(--lkv-primary)' },
    { name: 'Camille', initial: 'C', color: 'var(--lkv-forest-600)' },
  ],
  emergencyContact: '+33 6 12 34 56 78',
  comparableTrip: null,
  updatedAt: '2026-09-12T08:00:00Z',
} as unknown as DepartDetail;

const html = renderToStaticMarkup(
  React.createElement(DepartEquipeSection, { depart, onOpenSheet: () => {} })
);

describe('DepartEquipeSection (équipe + accès fiche officielle)', () => {
  it('rend une unique section racine en verre aux classes canoniques', () => {
    expect(html.match(/<section/g) ?? []).toHaveLength(1);
    expect(html).toContain('glass rounded-[1.75rem] p-4');
    expect(html).toContain('aria-label="Équipe"');
  });

  it('expose l’eyebrow « Équipe » et les participants', () => {
    expect(html).toContain('>Équipe</p>');
    expect(html).toContain('Vous');
    expect(html).toContain('Camille');
    expect(html).toContain('id="participants-heading"');
  });

  it('expose le bouton « Fiche officielle » relié au dialog', () => {
    expect(html).toContain('Fiche officielle');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it('déclenche l’ouverture de la fiche avec retour haptique au clic', () => {
    hapticMock.mockClear();
    const onOpenSheet = vi.fn();
    const rendered = DepartEquipeSection({ depart, onOpenSheet });

    const findSheetButton = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'button' && node.props?.['aria-haspopup'] === 'dialog') return node;
      const kids = React.Children.toArray(node.props?.children);
      for (const kid of kids) {
        const found = findSheetButton(kid);
        if (found) return found;
      }
      return null;
    };

    const button = findSheetButton(rendered);
    expect(button).not.toBeNull();
    button.props.onClick();
    expect(hapticMock).toHaveBeenCalledWith('light');
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
  });

  it('reste sur le vocabulaire DS autorisé (markup rendu)', () => {
    const forbidden = /(?<!lkv-)(?:rose|sand|forest)-\d{2,3}|bg-white\/(60|90)|dark:/;
    expect(html).not.toMatch(forbidden);
  });
});

describe('DepartureSheetModal (migration GlassDrawer)', () => {
  const src = readFileSync(
    'src/features/materiel/components/depart/DepartureSheetModal.tsx',
    'utf8'
  );

  it('utilise le conteneur GlassDrawer au lieu d’un fixed inset-0 z-50 maison', () => {
    expect(src).toContain('GlassDrawer');
    expect(src).not.toContain('fixed inset-0 z-50');
  });

  it('préserve l’ancre #departure-sheet-title sur le Dialog.Title sans dupliquer le titre', () => {
    expect(src).toContain('title="Fiche officielle"');
    expect(src).toContain('titleId="departure-sheet-title"');
    expect(src.match(/departure-sheet-title/g) ?? []).toHaveLength(1);
  });
});
