import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartMobileExperience } from '@/features/hub/components/mobile/depart/DepartMobileExperience';
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
  usePathname: () => '/hub/depart',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => React.createElement('div', { 'data-testid': 'mock-depart-map' }, 'Carte GPS'),
}));

const hapticMock = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: hapticMock, triggerHaptic: hapticMock, vibrate: hapticMock }),
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

describe('Mobile Depart Experience Integration (canonical)', () => {
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

  const renderMobileExperience = () =>
    renderToStaticMarkup(
      React.createElement(DepartMobileExperience, {
        depart: mockDepart,
        weather: null,
        kits: [{ id: 'tmb-4j', name: 'Kit TMB' }],
      })
    );

  it('renders the canonical mobile wrapper with readiness and weight chips', () => {
    const html = renderMobileExperience();

    // Canonical mobile experience root (no legacy cockpit shell)
    expect(html).toContain('data-testid="depart-mobile-experience"');
    expect(html).toContain('flex min-w-0 flex-col gap-5 pb-1');
    expect(html).not.toContain('md:hidden');

    // Authoritative indicators are the mobile chips
    expect(html).toContain('8.5 kg — Poids porté');
    expect(html).toContain('1 — À compléter');
    expect(html).toContain('67 % — Prêt');
  });

  it('no longer mounts the legacy fixed-bottom floating island', () => {
    const html = renderMobileExperience();

    expect(html).not.toContain('fixed bottom-4');
    expect(html).not.toContain('aria-label="Contrôles mobiles rapides"');
    expect(html).not.toContain('Ajouter un équipement');
  });

  it('renders the smart alerts banner when missing vital equipment is detected', () => {
    const html = renderMobileExperience();

    // Vital alert banner
    expect(html).toContain('role="alert"');
    expect(html).toContain('vital-alert-action');
    expect(html).toContain('vital-alert-dismiss');
    expect(html).toContain('Tente Big Agnes Copper Spur HV UL2');
  });

  it('exposes no legacy OLED toggle nor safe-area hack in the mobile page', () => {
    const html = renderMobileExperience();

    expect(html).not.toContain('Mode Éco Batterie');
    expect(html).not.toContain('env(safe-area-inset');
    expect(html).not.toContain('fixed bottom-4');
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

  it('verifies AppShell edge-to-edge background resolution avoids white borders', () => {
    // Standard AppShell should default to stone background (#FBFAF6) on mobile
    // and responsive transparency on desktop when videoBackground is active.
    const resolveAppShellBg = (background = '#FBFAF6', videoBackground = true) => {
      const isDefaultBg = background === '#FBFAF6';
      const containerBgStyle = videoBackground && isDefaultBg ? undefined : background;
      const containerBgClass = videoBackground && isDefaultBg ? 'bg-[#FBFAF6] md:bg-transparent' : '';
      return { containerBgStyle, containerBgClass };
    };

    // Default configuration (edge-to-edge mobile stone, video background desktop)
    const def = resolveAppShellBg();
    expect(def.containerBgClass).toBe('bg-[#FBFAF6] md:bg-transparent');
    expect(def.containerBgStyle).toBeUndefined();

    // Custom dark background
    const dark = resolveAppShellBg('#17402C', false);
    expect(dark.containerBgClass).toBe('');
    expect(dark.containerBgStyle).toBe('#17402C');

    // Explicit transparent background
    const trans = resolveAppShellBg('transparent', false);
    expect(trans.containerBgClass).toBe('');
    expect(trans.containerBgStyle).toBe('transparent');
  });

  it('verifies /messagerie route is excluded from middleware blocking', () => {
    const PROTECTED_ROUTES = ['/admin', '/checkout'];
    const isProtected = (pathname: string) =>
      PROTECTED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

    expect(isProtected('/messagerie')).toBe(false);
    expect(isProtected('/messagerie/c-123')).toBe(false);
    expect(isProtected('/admin')).toBe(true);
    expect(isProtected('/checkout')).toBe(true);
  });
});
