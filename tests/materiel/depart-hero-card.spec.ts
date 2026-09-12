import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartHeroCard } from '@/features/materiel/components/depart/hero/DepartHeroCard';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const hapticMock = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: hapticMock, triggerHaptic: hapticMock, vibrate: hapticMock }),
}));

const depart = {
  id: 'none', destination: 'GR 128 Flandres', status: 'draft',
  readinessScore: {
    status: 'warning',
    grade: 'C',
    label: 'À finaliser',
    percentage: 64,
    missingVitals: [],
    factors: [],
  },
  baseWeightG: 4100, consumablesWeightG: 8900, totalPackWeightG: 13900,
  assignedKit: { id: 'k', name: 'Kit de départ', totalWeightG: 4100, items: [] },
  weightBreakdown: [], checklistPct: 64, checklistSections: [], checklistItems: [],
  durationDays: 4, consumables: {}, trail: null, participants: [], emergencyContact: null,
  startsAt: new Date('2026-09-20T08:00:00Z').toISOString(),
} as unknown as DepartDetail;

describe('DepartHeroCard', () => {
  const html = renderToStaticMarkup(
    React.createElement(DepartHeroCard, {
      depart,
      identity: { title: 'GR 128 Flandres', subtitle: null, fromTrail: true },
      isOnline: true,
      onOpenSheet: () => {},
      onShare: () => {},
    })
  );
  it('affiche identité, statut et CTA canoniques', () => {
    expect(html).toContain('GR 128 Flandres');
    expect(html).toContain('Ouvrir la fiche');
    expect(html).toContain('Partager');
    expect(html).toContain('Prêt');
    expect(html).toContain('64');
  });
  it('respecte le design system (aucune classe interdite)', () => {
    const classAttrs = Array.from(html.matchAll(/class="([^"]*)"/g)).map((m) => m[1]).join(' ');
    for (const forbidden of ['rose-', 'sand-', 'forest-', 'bg-white/60', 'bg-white/90', 'dark:']) {
      expect(classAttrs).not.toContain(forbidden);
    }
  });
});

describe('DepartHeroCard — sélecteur de kit', () => {
  const renderSelector = (assignedKit: { id: string; name: string }) =>
    renderToStaticMarkup(
      React.createElement(DepartHeroCard, {
        depart: {
          ...depart,
          assignedKit: { ...assignedKit, totalWeightG: 4100, items: [] },
        } as unknown as DepartDetail,
        identity: { title: 'Boucle Val de Sambre et Maroilles', subtitle: null, fromTrail: true },
        kits: [
          { id: 'tmb-4j', name: 'Tour du Mont-Blanc — 4j Bivouac' },
          { id: 'other', name: 'Kit hiver' },
        ],
        isOnline: true,
        onOpenSheet: () => {},
        onShare: () => {},
      })
    );

  it('A — option correspondante : libellé remplacé par le nom du kit assigné', () => {
    const html = renderSelector({ id: 'tmb-4j', name: 'Kit de départ' });
    expect(html).toContain('<option value="tmb-4j" selected="">Kit de départ</option>');
    expect(html).not.toContain('Tour du Mont-Blanc — 4j Bivouac');
  });

  it('B — id sans option correspondante : option courante prépendée et sélectionnée', () => {
    const html = renderSelector({ id: 'none', name: 'Kit de départ' });
    expect(html).toMatch(/<option value="none" selected[^>]*>Kit de départ/);
    expect(html).not.toMatch(/<option value="tmb-4j" selected/);
    expect(html).toContain('Tour du Mont-Blanc — 4j Bivouac');
  });
});
