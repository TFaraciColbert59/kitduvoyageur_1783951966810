import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartSacSection } from '@/features/materiel/components/depart/DepartSacSection';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

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

const kitItems: ChecklistItem[] = [
  {
    id: 'item-tente',
    name: 'Tente 1P Ultralight',
    category: 'Bivouac',
    weight_g: 850,
    is_checked: true,
    is_vital: true,
  },
  {
    id: 'item-matelas',
    name: 'Matelas gonflable R4',
    category: 'Couchage',
    weight_g: 410,
    is_checked: false,
    is_vital: true,
  },
  {
    id: 'item-veste',
    name: 'Veste imperméable 3L',
    category: 'Vêtements',
    weight_g: 280,
    is_checked: true,
    is_vital: true,
  },
];

const depart = {
  id: 'tmb-4j',
  destination: 'Tour du Mont-Blanc — 4j Bivouac',
  status: 'draft',
  readinessScore: { percentage: 67 },
  baseWeightG: 4800,
  wornWeightG: 1200,
  consumablesWeightG: 2500,
  totalPackWeightG: 7300,
  assignedKit: { id: 'kit-tmb', name: 'Kit Tour du Mont-Blanc', totalWeightG: 4800, items: kitItems },
  weightBreakdown: [
    { category: 'Bivouac', value: 1850 },
    { category: 'Couchage', value: 1330 },
    { category: 'Vêtements', value: 620 },
  ],
  checklistPct: 67,
  checklistSections: [],
  checklistItems: [],
  durationDays: 4,
  consumables: { water: 3, gas: 100 },
  trail: null,
  participants: [{ name: 'Vous', initial: 'V', color: 'var(--lkv-primary)' }],
  emergencyContact: null,
  comparableTrip: null,
  updatedAt: '2026-09-12T08:00:00Z',
} as unknown as DepartDetail;

const html = renderToStaticMarkup(
  React.createElement(DepartSacSection, { depart, kitItems, isRealKit: true })
);

describe('DepartSacSection (surface Sac unifiée : poids + checklist)', () => {
  it('rend un unique section racine en verre aux classes canoniques', () => {
    expect(html.match(/<section/g) ?? []).toHaveLength(1);
    expect(html).toContain('glass rounded-[1.75rem] p-4 space-y-4');
    expect(html).toContain('aria-label="Sac"');
  });

  it('expose les deux sous-titres « Analyse du poids » et « Checklist »', () => {
    expect(html).toContain('Analyse du poids');
    expect(html).toContain('Checklist du Sac en Direct');
    expect(html).toContain('id="depart-checklist-heading"');
  });

  it('affiche l’eyebrow Sac, le pourcentage et la jauge glass-progress', () => {
    expect(html).toContain('>Sac</p>');
    expect(html).toContain('67 % prêt');
    expect(html).toContain('glass-progress');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="67"');
    expect(html).toContain('width:67%');
  });

  it('sépare poids et checklist par un filet border-subtle', () => {
    expect(html).toContain('border-t border-[var(--lkv-border-subtle)]');
  });

  it('transmet les consommables à DepartChecklist (intégration Vivres & Eau)', () => {
    expect(html).toContain('Eau potable (3 L)');
    expect(html).toContain('Cartouche de gaz (100 g)');
  });

  it('reste sur le vocabulaire DS autorisé (lookbehind tokens lkv)', () => {
    const forbidden = /(?<!lkv-)(?:rose|sand|forest)-\d{2,3}|bg-white\/(60|90)|dark:/;
    expect(html).not.toMatch(forbidden);
  });
});
