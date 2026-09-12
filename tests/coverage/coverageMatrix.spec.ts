import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildCoverageMatrix,
  type CoverageTarget,
} from '../../scripts/coverage/generate_matrix';
import { PUBLICATION_FLAG_ID } from '../../scripts/coverage/publishPlan';

const ROOT = path.resolve(__dirname, '..', '..');

function loadTargets(): CoverageTarget[] {
  const raw = JSON.parse(
    readFileSync(path.join(ROOT, 'docs', 'coverage', 'targets.json'), 'utf8')
  ) as { targets: CoverageTarget[] };
  return raw.targets;
}

function loadCoverage() {
  const raw = JSON.parse(
    readFileSync(path.join(ROOT, 'docs', 'coverage', 'coverage-input.json'), 'utf8')
  ) as { coverage: [] };
  return raw.coverage;
}

describe('Phase 4 — matrice de couverture honnête', () => {
  it('liste les 8 cibles documentaires en not_covered', () => {
    const matrix = buildCoverageMatrix({
      targets: loadTargets(),
      coverage: loadCoverage(),
      flags: { [PUBLICATION_FLAG_ID]: false },
      generatedAt: '2026-09-12T00:00:00.000Z',
    });

    expect(matrix).toContain('INSUFFICIENT_DATA');
    expect(matrix).toContain('désactivé');
    expect(matrix).toContain('| France |');
    expect(matrix).toContain('| Islande |');
    expect(matrix).toContain('| Maroc |');
    expect(matrix).toContain('| Italie |');
    expect(matrix).toContain('| Népal |');
    expect(matrix).toContain('| Madère |');
    expect(matrix).toContain('| Jura |');
    expect(matrix).toContain('| Kumano Kodo |');
    expect(matrix).not.toMatch(/\|\s*covered\s*\|/);
  });

  it('affiche les métriques réelles quand un dataset existe', () => {
    const matrix = buildCoverageMatrix({
      targets: loadTargets().slice(0, 1),
      coverage: [
        {
          countryIsoA2: 'FR',
          regionCode: '',
          status: 'experimental',
          datasetKey: 'osm-test',
          version: 'v1',
          validGeometries: 10,
          sourcedPois: 4,
          sampledRoutes: 3,
          licenseCode: 'ODbL-1.0',
          pipelineVersion: 'phase4-1.0.0',
          importedAt: '2026-09-01T00:00:00.000Z',
          publishedAt: null,
        },
      ],
      flags: { [PUBLICATION_FLAG_ID]: false },
      generatedAt: '2026-09-12T00:00:00.000Z',
    });

    expect(matrix).toContain('experimental');
    expect(matrix).toContain('osm-test');
    expect(matrix).toContain('ODbL-1.0');
    expect(matrix).toContain('| 10 |');
  });

  it('signale un drapeau activé sans jamais déclarer de couverture', () => {
    const matrix = buildCoverageMatrix({
      targets: loadTargets(),
      coverage: [],
      flags: { [PUBLICATION_FLAG_ID]: true },
      generatedAt: '2026-09-12T00:00:00.000Z',
    });
    expect(matrix).toContain('ACTIVÉ');
    expect(matrix).toContain('Régions `covered` dans les données : 0');
  });
});
