import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';

// Définition rigoureuse des 9 surfaces souveraines du module Voyage
export const VOYAGE_SURFACES: Record<string, string[]> = {
  '[slug]': [
    'src/app/voyages/[slug]/page.tsx',
    'src/app/voyages/[slug]/TripDetailClient.tsx',
    'src/features/trips/components/TripHero.tsx',
    'src/features/trips/components/TripPhaseController.tsx',
    'src/features/trips/components/TripOfflineBar.tsx',
  ],
  liste: [
    'src/app/voyages/page.tsx',
    'src/app/voyages/VoyagesClient.tsx',
    'src/features/trips/components/TripCard.tsx',
  ],
  nouveau: [
    'src/app/voyages/nouveau/page.tsx',
    'src/features/trips/wizard/TripWizard.tsx',
  ],
  itineraire: [
    'src/app/voyages/[slug]/itineraire/page.tsx',
    'src/features/trips/planner/ItineraryPlannerClient.tsx',
  ],
  kit: [
    'src/app/voyages/[slug]/kit/page.tsx',
    'src/features/trips/components/TripKitView.tsx',
  ],
  export: [
    'src/app/voyages/[slug]/export/page.tsx',
  ],
  'phase-1-prepare': [
    'src/features/trips/components/TripPhasePrepareView.tsx',
  ],
  'phase-2-live': [
    'src/features/trips/components/TripLiveCockpitView.tsx',
  ],
  'phase-3-recount': [
    'src/features/trips/components/TripPhaseRecountView.tsx',
  ],
};

const COLD_CLASS_REGEX = /\b(?:bg|text|border|ring|stroke|fill)-(?:zinc|gray|slate|amber|emerald|blue|red|orange)-\d+\b/g;
const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const ALLOWED_HEX = new Set(['#ffffff', '#fff', '#000000', '#000']);
const ROUNDED_REGEX = /\brounded-\[\d+px\]/g;
const SHADOW_REGEX = /\bshadow-\[[^\]]+\]/g;
const DIALOG_REGEX = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;

describe('GARDE-FOU EXÉCUTABLE X-D70 — NEUF SURFACES VOYAGE', () => {
  for (const [surfaceName, files] of Object.entries(VOYAGE_SURFACES)) {
    describe(`Surface : ${surfaceName}`, () => {
      it(`[${surfaceName}] 0 classe froide (zinc, gray, slate, amber, emerald, blue, red, orange)`, () => {
        const violations: string[] = [];
        for (const file of files) {
          if (!existsSync(file)) continue;
          const content = readFileSync(file, 'utf8');
          const matches = content.match(COLD_CLASS_REGEX);
          if (matches) {
            for (const m of matches) violations.push(`${file}: ${m}`);
          }
        }
        expect(violations, `Violations classes froides dans ${surfaceName}`).toEqual([]);
      });

      it(`[${surfaceName}] 0 hexadécimal brut hors tokens (hors blanc/noir pur)`, () => {
        const violations: string[] = [];
        for (const file of files) {
          if (!existsSync(file)) continue;
          const content = readFileSync(file, 'utf8');
          const matches = content.match(HEX_REGEX);
          if (matches) {
            for (const h of matches) {
              if (!ALLOWED_HEX.has(h.toLowerCase())) {
                violations.push(`${file}: ${h}`);
              }
            }
          }
        }
        expect(violations, `Violations hexadécimales dans ${surfaceName}`).toEqual([]);
      });

      it(`[${surfaceName}] 0 rayon arbitraire rounded-[Npx]`, () => {
        const violations: string[] = [];
        for (const file of files) {
          if (!existsSync(file)) continue;
          const content = readFileSync(file, 'utf8');
          const matches = content.match(ROUNDED_REGEX);
          if (matches) {
            for (const r of matches) violations.push(`${file}: ${r}`);
          }
        }
        expect(violations, `Violations rounded-[Npx] dans ${surfaceName}`).toEqual([]);
      });

      it(`[${surfaceName}] 0 ombre littérale shadow-[...]`, () => {
        const violations: string[] = [];
        for (const file of files) {
          if (!existsSync(file)) continue;
          const content = readFileSync(file, 'utf8');
          const matches = content.match(SHADOW_REGEX);
          if (matches) {
            for (const s of matches) violations.push(`${file}: ${s}`);
          }
        }
        expect(violations, `Violations shadow-[...] dans ${surfaceName}`).toEqual([]);
      });

      it(`[${surfaceName}] 0 dialogue natif (alert, confirm, prompt)`, () => {
        const violations: string[] = [];
        for (const file of files) {
          if (!existsSync(file)) continue;
          const content = readFileSync(file, 'utf8');
          const matches = content.match(DIALOG_REGEX);
          if (matches) {
            for (const d of matches) violations.push(`${file}: ${d}`);
          }
        }
        expect(violations, `Violations dialogues natifs dans ${surfaceName}`).toEqual([]);
      });
    });
  }
});
