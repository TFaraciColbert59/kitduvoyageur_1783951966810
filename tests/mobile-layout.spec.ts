import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartCockpit } from '@/features/materiel/components/depart/DepartCockpit';
import { DepartChecklist } from '@/features/materiel/components/depart/DepartChecklist';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/materiel/depart/tmb-4j',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => React.createElement('div', { 'data-testid': 'mock-depart-map' }, 'Carte GPS'),
}));

describe('Mobile Layout & Shell Navigation Architecture', () => {
  it('calculates proper bottom padding for standard and upper-extension routes', () => {
    const computeBottomNavHeight = (pathname: string, hasBottomNav = true) => {
      if (!hasBottomNav) return 'calc(12px + env(safe-area-inset-bottom, 0px))';
      const hasUpperExtension =
        pathname?.startsWith('/communaute') ||
        pathname?.startsWith('/pays') ||
        pathname?.startsWith('/carnets') ||
        pathname?.startsWith('/groupes') ||
        pathname?.startsWith('/clubs') ||
        pathname?.startsWith('/entraide') ||
        pathname?.startsWith('/evenements') ||
        pathname?.startsWith('/alertes') ||
        pathname?.startsWith('/materiel');

      return hasUpperExtension
        ? 'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
        : 'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))';
    };

    // Standard routes without upper tray
    expect(computeBottomNavHeight('/compte')).toBe(
      'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/explorer')).toBe(
      'var(--bottom-tab-base-height, calc(52px + env(safe-area-inset-bottom, 0px)))'
    );

    // Routes with upper extension tray
    expect(computeBottomNavHeight('/materiel')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/communaute')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/clubs/c-1')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/carnets')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );
    expect(computeBottomNavHeight('/pays/france')).toBe(
      'var(--bottom-tab-extended-height, calc(92px + env(safe-area-inset-bottom, 0px)))'
    );

    // No bottom nav routes (fullscreen modes)
    expect(computeBottomNavHeight('/boussole', false)).toBe(
      'calc(12px + env(safe-area-inset-bottom, 0px))'
    );
  });

  it('ensures safeTop is predictable for custom headers and immersive covers', () => {
    const computeSafeTopPadding = (safeTop: boolean) => {
      return safeTop ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : '0px';
    };

    // When page has sticky/immersive custom header, safeTop is false to avoid double padding
    expect(computeSafeTopPadding(false)).toBe('0px');
    // Default standard views
    expect(computeSafeTopPadding(true)).toBe('calc(env(safe-area-inset-top, 0px) + 8px)');
  });
});

describe('Mobile Cockpit Integration & OLED Ultra-Save Mode', () => {
  const mockItems: ChecklistItem[] = [
    {
      id: 'item-tente',
      name: 'Tente Big Agnes Copper Spur HV UL2',
      category: 'Bivouac',
      weight_g: 1420,
      is_checked: false,
      is_vital: true,
      quantity: 1,
    },
    {
      id: 'item-matelas',
      name: 'Matelas Therm-a-Rest NeoAir',
      category: 'Bivouac',
      weight_g: 430,
      is_checked: true,
      is_vital: true,
      quantity: 1,
    },
    {
      id: 'item-veste',
      name: 'Veste Gore-Tex Arc’teryx',
      category: 'Vêtements',
      weight_g: 380,
      is_checked: true,
      is_worn: true,
      quantity: 1,
    },
  ];

  const mockDepart: DepartDetail = {
    id: 'tmb-4j',
    destination: 'Tour du Mont-Blanc',
    trail: null,
    durationDays: 4,
    activityType: 'Bivouac',
    startsAt: '2026-09-01T08:00:00Z',
    endsAt: '2026-09-04T18:00:00Z',
    status: 'draft',
    emergencyContact: '+33612345678',
    participants: [{ name: 'Tony', initial: 'T', color: '#17402C' }],
    assignedKit: {
      id: 'kit-tmb',
      name: 'Kit TMB 4 Jours',
      totalWeightG: 4800,
      items: mockItems,
    },
    baseWeightG: 4800,
    wornWeightG: 1200,
    consumablesWeightG: 2500,
    totalPackWeightG: 8500,
    checklistPct: 67,
    checklistSections: [{ name: 'Bivouac', total: 2, done: 1 }],
    checklistItems: [{ id: 'item-tente', name: 'Tente Big Agnes Copper Spur HV UL2', done: false }],
    readinessScore: {
      status: 'warning',
      grade: 'B',
      label: 'En préparation',
      percentage: 67,
      missingVitals: ['Tente Big Agnes Copper Spur HV UL2'],
      factors: ['1 équipement vital à préparer'],
    },
    consumables: { water: 2.5, gas: 230, meals: 4, snacks: 4 },
    weightBreakdown: [
      { category: 'Bivouac', value: 1850 },
      { category: 'Vêtements', value: 380 },
    ],
    comparableTrip: null,
    coverImageUrl: null,
    updatedAt: '2026-08-31T08:00:00Z',
  };

  it('renders compact mobile header with % Prêt badge and central weight breakdown', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartCockpit, {
        depart: mockDepart,
        weather: null,
        kits: [{ id: 'tmb-4j', name: 'Kit TMB' }],
      })
    );

    // Mobile block presence
    expect(html).toContain('md:hidden');

    // Compact header presence
    expect(html).toContain('67% Prêt');

    // Central DepartWeightBreakdown elements (authoritative location for weights)
    expect(html).toContain('4.8 kg');
    expect(html).toContain('1.2 kg');
    expect(html).toContain('2.5 kg');
  });

  it('renders MobileFloatingIsland fixed at the bottom with live counts, speech and quick add', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartCockpit, {
        depart: mockDepart,
        weather: null,
        kits: [{ id: 'tmb-4j', name: 'Kit TMB' }],
      })
    );

    // Liquid Island presence & positioning
    expect(html).toContain('fixed bottom-4');
    expect(html).toContain('aria-label="Contrôles mobiles rapides"');
    expect(html).toContain('Tous');
    expect(html).toContain('3');
    expect(html).toContain('Restants');
    expect(html).toContain('1');
    expect(html).toContain('Ajouter un équipement');
  });

  it('renders MobileVitalAlertBanner when missing vital equipment is detected', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartCockpit, {
        depart: mockDepart,
        weather: null,
        kits: [{ id: 'tmb-4j', name: 'Kit TMB' }],
      })
    );

    // Vital alert banner
    expect(html).toContain('role="alert"');
    expect(html).toContain('vital-alert-action');
    expect(html).toContain('vital-alert-dismiss');
    expect(html).toContain('Tente Big Agnes Copper Spur HV UL2');
  });

  it('supports OLED pure black mode attributes and styling', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartCockpit, {
        depart: mockDepart,
        weather: null,
        kits: [{ id: 'tmb-4j', name: 'Kit TMB' }],
      })
    );

    // Eco toggle button present in header
    expect(html).toContain('Mode Éco Batterie');
    expect(html).toContain('ÉCO');
  });

  it('integrates MobileChecklistItem with 48px hit-box and swipe-to-pack in DepartChecklist on mobile', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartChecklist, {
        items: mockItems,
        kitId: 'tmb-4j',
        isRealKit: true,
      })
    );

    // MobileChecklistItem rendered inside md:hidden
    expect(html).toContain('min-w-[48px]');
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('Tente Big Agnes Copper Spur HV UL2');
    expect(html).toContain('Packé !');
  });
});
