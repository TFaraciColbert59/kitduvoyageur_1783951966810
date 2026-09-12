import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartMobileExperience } from '@/features/hub/components/mobile/depart/DepartMobileExperience';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';
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

vi.mock('next/dynamic', () => ({
  default: () => () => React.createElement('div', { 'data-testid': 'mock-depart-map' }, 'Carte GPS'),
}));

const hapticMock = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: hapticMock, triggerHaptic: hapticMock, vibrate: hapticMock }),
}));

const VIEW_PATH = 'src/features/hub/components/mobile/depart/DepartMobileExperience.tsx';
const FORBIDDEN = /(?<!lkv-)(?:rose|sand|forest)-\d{2,3}|bg-white\/(60|90)|dark:/;

const kitItems: ChecklistItem[] = [
  {
    id: 'item-tente',
    name: 'Tente 1P Ultralight',
    category: 'Bivouac',
    weight_g: 850,
    is_checked: false,
    is_vital: true,
    quantity: 1,
  },
  {
    id: 'item-matelas',
    name: 'Matelas gonflable R4',
    category: 'Couchage',
    weight_g: 410,
    is_checked: true,
    is_vital: true,
    quantity: 1,
  },
];

const depart = {
  id: 'tmb-4j',
  destination: 'Tour du Mont-Blanc — 4j Bivouac',
  trail: {
    id: '375',
    name: 'Boucle Val de Sambre et Maroilles',
    lat: 50.12,
    lng: 3.94,
    distance_km: 24,
  },
  durationDays: 4,
  activityType: 'Bivouac',
  startsAt: '2026-09-20T08:00:00Z',
  endsAt: '2026-09-24T18:00:00Z',
  status: 'draft',
  emergencyContact: '+33 6 12 34 56 78',
  participants: [{ name: 'Vous', initial: 'V', color: 'var(--lkv-primary)' }],
  assignedKit: { id: 'kit-tmb', name: 'Kit TMB 4 Jours', totalWeightG: 4800, items: kitItems },
  baseWeightG: 4800,
  wornWeightG: 1200,
  consumablesWeightG: 2500,
  totalPackWeightG: 8500,
  checklistPct: 50,
  checklistSections: [{ name: 'Bivouac', total: 1, done: 0 }],
  checklistItems: [{ id: 'item-tente', name: 'Tente 1P Ultralight', done: false }],
  readinessScore: {
    status: 'warning',
    grade: 'B',
    label: 'En préparation',
    percentage: 50,
    missingVitals: ['Tente 1P Ultralight'],
    factors: ['1 équipement vital à préparer'],
  },
  consumables: { water: 2.5, gas: 230, meals: 4, snacks: 4 },
  weightBreakdown: [{ category: 'Bivouac', value: 850 }],
  comparableTrip: null,
  coverImageUrl: null,
  updatedAt: '2026-09-12T08:00:00Z',
} as unknown as DepartDetail;

const weather: WeatherForecast = {
  cells: [{ hour: '09:00', tempC: 14, precipPct: 10, weathercode: 1 }],
  days: [
    {
      date: '2026-09-20',
      day: 'Dim',
      tempMinC: 8,
      tempMaxC: 18,
      precipPct: 20,
      weathercode: 2,
    },
  ],
  current: { tempC: 15, weathercode: 1, precipPct: 10 },
  location: { latitude: 45.9, longitude: 6.87, label: 'Chamonix' },
};

const html = renderToStaticMarkup(
  React.createElement(DepartMobileExperience, {
    depart,
    weather,
    kits: [{ id: 'tmb-4j', name: 'Kit TMB' }],
  })
);

describe('DepartMobileExperience (assemblage canonique mobile)', () => {
  it('expose la racine canonique mobile sans shell dupliqué ni safe-area', () => {
    expect(html).toContain('data-testid="depart-mobile-experience"');
    expect(html).toContain('class="flex min-w-0 flex-col gap-5 pb-1"');
    expect(html).not.toContain('max-w-[1680px]');
    expect(html).not.toContain('env(safe-area-inset');
    expect(html).not.toContain('sticky top-0');
    expect(html).not.toContain('md:hidden');
  });

  it('assemble les surfaces canoniques (hero, terrain, équipement, équipe)', () => {
    expect(html).toContain('>Départ</p>');
    expect(html).toContain('Ouvrir la fiche de départ');
    expect(html).toContain('>Terrain</p>');
    expect(html).toContain('aria-label="Équipement"');
    expect(html).toContain('Gérer le matériel');
    expect(html).toContain('>Équipe</p>');
    expect(html).toContain('Fiche officielle');
  });

  it('expose les rails et les chips avec aria-label', () => {
    expect(html).toContain('Prochains articles');
    expect(html).toContain('Poids par catégorie');
    expect(html).toContain('aria-label="8.5 kg — Poids porté"');
    expect(html).toContain('aria-label="1 — À compléter"');
    expect(html).toContain('aria-label="50 % — Prêt"');
    expect(html).toContain('h-[8.5rem] w-[10.5rem] shrink-0 snap-start');
    expect(html).toContain('Tente 1P Ultralight');
    expect(html).toContain('850 g');
  });

  it('dérive l’identité de la seule destination (pas du nom de tracé)', () => {
    expect(html).toContain('Tour du Mont-Blanc');
    expect(html).not.toContain('Boucle Val de Sambre et Maroilles');
    const src = readFileSync(VIEW_PATH, 'utf8');
    expect(src).toMatch(/resolveDepartIdentity\(\{\s*destination:\s*depart\.destination\s*\}\)/);
    expect(src).not.toContain('trailName');
  });

  it('branche les alertes provisoires et leur action vers la checklist', () => {
    expect(html).toContain('role="alert"');
    expect(html).toContain('vital-alert-action');
    expect(html).toContain('Tente 1P Ultralight');
    const src = readFileSync(VIEW_PATH, 'utf8');
    expect(src).toContain('generateSmartPrompts');
    expect(src).toContain('dismissedAlertIds');
    expect(src).toContain("getElementById('depart-checklist-heading')");
    expect(src).toContain('scrollIntoView');
  });

  it('rend une carte unique via DepartTerrainSection', () => {
    expect(html.match(/data-testid="mock-depart-map"/g)).toHaveLength(1);
  });

  it('laisse les drawers fermés au render (contenu legacy non monté)', () => {
    expect(html).not.toContain('Checklist du sac');
    expect(html).not.toContain('Parc matériel');
  });

  it('reste sur le vocabulaire DS autorisé (lookbehind tokens lkv)', () => {
    expect(html).not.toMatch(FORBIDDEN);
  });
});
