import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Task 7 — Retraits hub + cockpit aventure dans l'itinéraire.
 *
 * Markup : le cockpit de la section itinéraire est rendu (wrapper
 * `itinerary-adventure-cockpit`) en mode compact — décisions vides omises,
 * conditions terrain absentes, lien vers l'itinéraire courant filtré.
 * Source guards (style repo) : TripAffiliateSection/TripSuggestionSection
 * démontés des rendus ciblés, NaturePill conditionnée hors itinéraire,
 * cockpit monté en tête du contenu de HubShell.
 */

vi.mock('framer-motion', async () => ({
  ...(await vi.importActual('framer-motion')),
  useReducedMotion: () => false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/hub/itineraire',
  useSearchParams: () => new URLSearchParams(),
}));

import { buildCockpitView } from '@/features/adventure-intelligence/domain/cockpit';
import { AdventureHubSection } from '@/features/adventure-intelligence/ui/AdventureHubSection';
import { ItineraryAdventureCockpit } from '@/features/hub/components/mobile/itinerary/ItineraryAdventureCockpit';

const ROOT = process.cwd();

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

const HUB_SHELL = ['src', 'features', 'hub', 'components', 'HubShell.tsx'] as const;
const SORTIE_MENU = ['src', 'features', 'hub', 'components', 'menu', 'SortieMenu.tsx'] as const;
const SORTIE_MOMENT = [
  'src',
  'features',
  'hub',
  'components',
  'mobile',
  'moments',
  'SortieMoment.tsx',
] as const;
const PLANNER = ['src', 'features', 'trips', 'planner', 'ItineraryPlannerClient.tsx'] as const;
const MOBILE_ITINERARY = [
  'src',
  'features',
  'hub',
  'components',
  'mobile',
  'itinerary',
  'ItineraryMobileExperience.tsx',
] as const;
const COCKPIT_WRAPPER = [
  'src',
  'features',
  'hub',
  'components',
  'mobile',
  'itinerary',
  'ItineraryAdventureCockpit.tsx',
] as const;
const HUB_SECTION_UI = [
  'src',
  'features',
  'adventure-intelligence',
  'ui',
  'AdventureHubSection.tsx',
] as const;
const INTELLIGENCE_HOST = [
  'src',
  'features',
  'adventure-intelligence',
  'ui',
  'AdventureIntelligenceHub.tsx',
] as const;

const COCKPIT_INPUT = {
  plan: {
    id: 'plan-1',
    title: 'Tour du Vercors',
    status: 'active',
    confidence: {
      score: 0.82,
      level: 'high' as const,
      sampleCount: 5,
      method: 'personal',
      reasons: [],
    },
    personalDifficulty: 58,
    etaP50: null,
    etaP90: null,
  },
  prediction: null,
  liveReports: [],
  decisionsRequired: [
    { id: 'decision-1', label: 'Choisir le bivouac de J2', requiresConfirmation: true },
  ],
  recalcReasons: [],
  batteryLevel: 78,
};

const QUICK_LINKS = [
  { id: 'itinerary', label: 'Itinéraire', icon: 'navigation' },
  { id: 'safety', label: 'Sécurité', icon: 'shield-alert' },
];

describe('cockpit aventure — rendu de la section itinéraire', () => {
  it('rend le wrapper testid avec indicateurs, décisions et liens (itinéraire courant filtré)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryAdventureCockpit, {
        cockpit: COCKPIT_INPUT,
        sections: QUICK_LINKS,
        sectionHrefs: { safety: '/hub/itineraire/securite' },
      })
    );

    expect(html).toContain('data-testid="itinerary-adventure-cockpit"');
    expect(html).toContain('data-testid="adventure-intelligence"');
    expect(html).toContain('Cockpit aventure');
    expect(html).toContain('Tour du Vercors');
    expect(html).toContain('58/100');
    expect(html).toContain('Choisir le bivouac de J2');
    expect(html).toContain('Sécurité');
    expect(html).not.toContain('Itinéraire');
    expect(html).not.toContain('terrain-conditions');
  });

  it('mode compact : décisions vides omises ; le mode plein garde l’état vide', () => {
    const emptyInput = { ...COCKPIT_INPUT, decisionsRequired: [] };

    const compact = renderToStaticMarkup(
      React.createElement(ItineraryAdventureCockpit, { cockpit: emptyInput })
    );
    expect(compact).not.toContain('Décisions requises');
    expect(compact).not.toContain('Aucune décision en attente');

    const full = renderToStaticMarkup(
      React.createElement(AdventureHubSection, {
        view: buildCockpitView({ ...emptyInput, offline: false }),
      })
    );
    expect(full).toContain('Cockpit aventure');
    expect(full).toContain('Aucune décision en attente');
  });
});

describe('retraits hub/itinéraire — source guards', () => {
  it('TripAffiliateSection démonté des rendus hub ciblés (plumbing affilié retiré)', () => {
    for (const file of [SORTIE_MENU, SORTIE_MOMENT]) {
      const source = readSource(...file);
      expect(source).not.toMatch(/TripAffiliateSection/);
      expect(source).not.toMatch(/affiliate/i);
    }

    const hubHome = readSource('src', 'app', 'hub', 'page.tsx');
    expect(hubHome).not.toContain('affiliateLinks');
  });

  it('TripSuggestionSection démonté de l’itinéraire (composants conservés)', () => {
    for (const file of [PLANNER, MOBILE_ITINERARY]) {
      const source = readSource(...file);
      expect(source).not.toMatch(/TripSuggestionSection|parseEnrichmentSuggestions/);
    }

    const kept = path.join(
      ROOT,
      'src',
      'features',
      'affiliation',
      'components',
      'TripSuggestionSection.tsx'
    );
    expect(fs.existsSync(kept)).toBe(true);
  });

  it('NaturePill/NatureSwitcherSheet : conditionnés hors section itinéraire, hub inchangé ailleurs', () => {
    const shell = readSource(...HUB_SHELL);

    expect(shell).toMatch(/activeSection === 'itinerary' && adventure\.nature === 'sortie'/);
    expect(shell.match(/\{!isItinerarySection && \(/g) ?? []).toHaveLength(2);
    expect(shell).toContain('<NaturePill');
    expect(shell).toContain('<NatureSwitcherSheet');
  });

  it('HubShell : cockpit itinéraire monté en tête du contenu, root plein conservé', () => {
    const shell = readSource(...HUB_SHELL);
    const cockpitAt = shell.indexOf('isItinerarySection && itineraryAdventureCockpit');
    const childrenAt = shell.indexOf('{children}', cockpitAt);

    expect(cockpitAt).toBeGreaterThan(-1);
    expect(childrenAt).toBeGreaterThan(cockpitAt);
    expect(shell).toContain('{isHubRoot && adventureIntelligence ? adventureIntelligence : null}');
  });
});

describe('cockpit itinéraire — branchement compact', () => {
  it('le wrapper porte le testid et filtre la section courante', () => {
    const wrapper = readSource(...COCKPIT_WRAPPER);
    expect(wrapper).toContain('data-testid="itinerary-adventure-cockpit"');
    expect(wrapper).toContain('compact');
    expect(wrapper).toMatch(/section\.id !== 'itinerary'/);
  });

  it('AdventureHubSection/Hub : support compact réel (décisions vides, pas de terrain)', () => {
    expect(readSource(...HUB_SECTION_UI)).toMatch(/compact\?: boolean/);
    expect(readSource(...INTELLIGENCE_HOST)).toMatch(/terrainEnabled && !compact/);
  });
});
