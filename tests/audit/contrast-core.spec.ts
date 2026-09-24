import { describe, expect, it } from 'vitest';
import {
  aggregateContrastMatrix,
  analyzeDecodedPixels,
  assertAuthenticatedCompte,
  assertRenderedAuditSettings,
  buildMatrixCells,
  classifyContrast,
  collectColorContrastAxeNodes,
  compositeTextColor,
  contrastRatio,
  describeAdminNavigation,
  getAuditBaseUrl,
  getAuditCredentials,
  meetsContrastThreshold,
  mergeAxeContrastEvidence,
  requiredContrastRatio,
  validateStorageState,
} from '../../scripts/audit/contrast_audit_core.mjs';

const now = 1_800_000_000_000;
const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;
const black = { r: 0, g: 0, b: 0 };
const white = { r: 255, g: 255, b: 255 };

function completeCells() {
  return buildMatrixCells().map((cell, index) => ({
    ...cell,
    actualTheme: 'dark',
    actualIntensity: cell.intensity,
    nodes: index === 0 ? [{ id: 'first-pass', status: 'pass' }] : [],
    axe: { violations: [], incomplete: [] },
  }));
}

describe('audit contraste — calcul WCAG', () => {
  it('calcule le ratio noir/blanc à 21:1', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 10);
  });

  it('applique 4.5:1 au texte normal et 3:1 au texte large, bornes incluses', () => {
    expect(requiredContrastRatio(false)).toBe(4.5);
    expect(requiredContrastRatio(true)).toBe(3);
    expect(meetsContrastThreshold(4.5, false)).toBe(true);
    expect(meetsContrastThreshold(4.499, false)).toBe(false);
    expect(meetsContrastThreshold(3, true)).toBe(true);
    expect(meetsContrastThreshold(2.999, true)).toBe(false);
  });

  it('compose le alpha CSS avec le produit des opacités des ancêtres', () => {
    const effective = compositeTextColor({
      color: 'rgba(255, 255, 255, 0.5)',
      ancestorOpacities: [0.5, 1],
      background: black,
    });

    expect(effective.a).toBeCloseTo(0.25, 10);
    expect(effective.r).toBeCloseTo(63.75, 10);
    expect(effective.g).toBeCloseTo(63.75, 10);
    expect(effective.b).toBeCloseTo(63.75, 10);
  });

  it('classe une couleur non analysable unknown et jamais pass', () => {
    expect(classifyContrast({
      color: 'color(not-a-css-color)',
      ancestorOpacities: [1],
      background: white,
      isLarge: false,
      occluded: false,
    })).toMatchObject({ status: 'unknown', ratio: null });
    expect(classifyContrast({
      color: 'rgba(0, 0, 0, 0.5oops)',
      ancestorOpacities: [1],
      background: white,
      isLarge: false,
      occluded: false,
    }).status).toBe('unknown');
  });

  it('classe un texte masqué par une barre fixe comme occluded', () => {
    expect(classifyContrast({
      color: 'rgb(0, 0, 0)',
      ancestorOpacities: [1],
      background: white,
      isLarge: false,
      occluded: true,
    }).status).toBe('occluded');
  });
});

describe('audit contraste — pixels et Axe', () => {
  it('lit tous les pixels visibles du rectangle de ligne', () => {
    const results = analyzeDecodedPixels({
      data: new Uint8Array([
        0, 0, 0,
        255, 255, 255,
      ]),
      info: { width: 2, height: 1, channels: 3 },
      textElements: [{
        id: 'line',
        selector: '#line',
        text: 'Audit',
        color: 'rgb(0, 0, 0)',
        ancestorOpacities: [1],
        isLarge: false,
        occluded: false,
        rects: [{ x: 0, y: 0, width: 2, height: 1 }],
      }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'contrast_fail', ratio: 1 });
    expect(results[0].worstBackground).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('conserve tous les nœuds color-contrast violations et incomplete', () => {
    const axeResults = {
      violations: [
        { id: 'color-contrast', nodes: [{ target: ['#a'] }, { target: ['#b'] }] },
        { id: 'label', nodes: [{ target: ['#ignored'] }] },
      ],
      incomplete: [
        { id: 'color-contrast', nodes: [{ target: ['#c'] }, { target: ['#d'] }] },
      ],
    };

    const nodes = collectColorContrastAxeNodes(axeResults);

    expect(nodes.violations).toHaveLength(2);
    expect(nodes.incomplete).toHaveLength(2);
  });

  it('force unknown un nœud Axe incomplete et ne le compte jamais pass', () => {
    const axeResults = {
      violations: [],
      incomplete: [{
        id: 'color-contrast',
        nodes: [{ target: ['#unstable'], failureSummary: 'background cannot be determined' }],
      }],
    };

    const nodes = mergeAxeContrastEvidence([
      { id: 'measured', selector: '#unstable', status: 'pass', ratio: 21 },
    ], axeResults);
    const aggregate = aggregateContrastMatrix(completeCells().map((cell, index) => index === 0
      ? { ...cell, nodes, axe: collectColorContrastAxeNodes(axeResults) }
      : cell));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].status).toBe('unknown');
    expect(aggregate.totals).toMatchObject({ pass: 0, unknown: 1, contrast_fail: 0 });
  });

  it('conserve occluded lorsqu’Axe signale aussi le même nœud', () => {
    const axeResults = {
      violations: [{ id: 'color-contrast', nodes: [{ target: ['#covered'] }] }],
      incomplete: [],
    };
    const nodes = mergeAxeContrastEvidence([
      { id: 'covered', selector: '#covered', status: 'occluded', ratio: null },
    ], axeResults);

    expect(nodes[0].status).toBe('occluded');
  });
});

describe('audit contraste — matrice pondérée', () => {
  it('construit exactement 60 cellules et rejette une cellule manquante', () => {
    const cells = completeCells();

    expect(cells).toHaveLength(60);
    expect(() => aggregateContrastMatrix(cells.slice(1))).toThrow(/59|60/);
  });

  it('pondère les taux par le nombre de nœuds', () => {
    const cells = completeCells().map((cell, index) => {
      if (index === 0) return cell;
      if (index === 1) {
        return {
          ...cell,
          nodes: [
            { id: 'pass-1', status: 'pass' },
            { id: 'pass-2', status: 'pass' },
            { id: 'pass-3', status: 'pass' },
          ],
        };
      }
      if (index === 2) {
        return { ...cell, nodes: [{ id: 'fail-1', status: 'contrast_fail' }] };
      }
      return cell;
    });

    const aggregate = aggregateContrastMatrix(cells);

    expect(aggregate.totals).toMatchObject({
      pass: 4,
      contrast_fail: 1,
      unknown: 0,
      occluded: 0,
      error: 0,
      nodes: 5,
    });
    expect(aggregate.weightedPassRate).toBe(80);
    expect(aggregate.cells[1].passRate).toBe(100);
    expect(aggregate.cells[2].passRate).toBe(0);
  });
});

describe('audit contraste — configuration et session', () => {
  it('utilise PW_BASE_URL avec le défaut localhost:3000', () => {
    expect(getAuditBaseUrl(env({}))).toBe('http://localhost:3000');
    expect(getAuditBaseUrl(env({ PW_BASE_URL: 'http://127.0.0.1:4028/' }))).toBe('http://127.0.0.1:4028');
  });

  it('exige AUDIT_EMAIL et AUDIT_PASSWORD explicitement', () => {
    expect(getAuditCredentials(env({
      AUDIT_EMAIL: 'audit@example.test',
      AUDIT_PASSWORD: 'secret-value',
    }))).toEqual({ email: 'audit@example.test', password: 'secret-value' });
    expect(() => getAuditCredentials(env({}))).toThrow(/AUDIT_EMAIL/);
    expect(() => getAuditCredentials(env({ AUDIT_EMAIL: 'audit@example.test' }))).toThrow(/AUDIT_PASSWORD/);
  });

  it('refuse un storageState invalide, expiré ou non authentifié', () => {
    const valid = {
      cookies: [{
        name: 'sb-project-auth-token',
        value: JSON.stringify({
          access_token: 'access',
          refresh_token: 'refresh',
          expires_at: now / 1000 + 3600,
        }),
        domain: 'localhost',
        path: '/',
        expires: -1,
      }],
      origins: [{
        origin: 'http://localhost:3000',
        localStorage: [{
          name: 'sb-project-auth-token',
          value: JSON.stringify({
            access_token: 'access',
            refresh_token: 'refresh',
            expires_at: now / 1000 + 3600,
          }),
        }],
      }],
    };

    expect(validateStorageState(valid, now)).toBe(true);
    expect(() => validateStorageState(null, now)).toThrow(/invalide/i);
    expect(() => validateStorageState({ cookies: [], origins: [] }, now)).toThrow(/authentifi/i);
    expect(() => validateStorageState({
      ...valid,
      origins: [{
        origin: 'http://localhost:3000',
        localStorage: [{
          name: 'sb-project-auth-token',
          value: JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: now / 1000 - 1 }),
        }],
      }],
    }, now)).toThrow(/expir/i);
  });

  it('valide URL finale, statut HTTP et sentinelle /compte', () => {
    expect(assertAuthenticatedCompte({
      baseUrl: 'http://localhost:3000',
      finalUrl: 'http://localhost:3000/compte',
      status: 200,
      sentinelVisible: true,
    })).toEqual({ finalPath: '/compte', status: 200 });

    expect(() => assertAuthenticatedCompte({
      baseUrl: 'http://localhost:3000',
      finalUrl: 'http://localhost:3000/connexion',
      status: 200,
      sentinelVisible: false,
    })).toThrow(/\/compte/);
    expect(() => assertAuthenticatedCompte({
      baseUrl: 'http://localhost:3000',
      finalUrl: 'http://localhost:3000/compte',
      status: 401,
      sentinelVisible: true,
    })).toThrow(/HTTP/);
  });

  it('rejette une divergence de thème ou intensité après chargement', () => {
    expect(() => assertRenderedAuditSettings({
      requestedTheme: 'light',
      requestedIntensity: 0.2,
      actualTheme: 'dark',
      actualIntensity: 0.2,
    })).toThrow(/thème/i);
    expect(() => assertRenderedAuditSettings({
      requestedTheme: 'dark',
      requestedIntensity: 0.85,
      actualTheme: 'dark',
      actualIntensity: 0.5,
    })).toThrow(/intensit/i);
  });

  it('enregistre explicitement la redirection admin par manque de rôle', () => {
    expect(describeAdminNavigation({
      finalUrl: 'http://localhost:3000/',
      status: 200,
    })).toEqual({ redirected: true, reason: 'missing_admin_role', finalPath: '/' });
  });
});
