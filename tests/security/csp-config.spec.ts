import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSP_DIRECTIVES, cspHeader } from '../../csp.config.mjs';

/**
 * CSP appliquée ou seulement rapportée (plan 2.11) : un interrupteur d'environnement,
 * sans autre changement de la politique.
 */
describe('CSP — mode choisi par CSP_MODE', () => {
  it('par défaut : Report-Only (rien n’est bloqué)', () => {
    expect(cspHeader(undefined).key).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeader('').key).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeader('report-only').key).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeader('nimporte quoi').key).toBe('Content-Security-Policy-Report-Only');
  });

  it('CSP_MODE=enforce (casse et espaces tolérés) : en-tête appliqué', () => {
    expect(cspHeader('enforce').key).toBe('Content-Security-Policy');
    expect(cspHeader(' Enforce ').key).toBe('Content-Security-Policy');
  });

  it('la même politique dans les deux modes, avec le rapport vers /api/csp-report', () => {
    const a = cspHeader(undefined);
    const b = cspHeader('enforce');
    expect(a.value).toBe(b.value);
    expect(a.value).toContain('report-uri /api/csp-report');
    expect(a.value.split('; ')).toEqual(CSP_DIRECTIVES);
  });

  it('la politique ne laisse entrer aucun joker global', () => {
    const script = (CSP_DIRECTIVES as string[]).find((d) => d.startsWith('script-src'))!;
    expect(script).not.toMatch(/\s\*(\s|$)/);
    expect(script).not.toContain('http:');
    expect(CSP_DIRECTIVES).toContain("default-src 'self'");
  });

  it('les photos de Wikimedia Commons (Compas v5) : upload.wikimedia.org est nommé dans img-src, et lui seul', () => {
    const img = (CSP_DIRECTIVES as string[]).find((d) => d.startsWith('img-src'))!;
    expect(img.split(' ')).toContain('https://upload.wikimedia.org');
    // Aucun autre hôte de photos ajouté : `https:` était déjà là, rien d'autre que cet hôte n'est nommé.
    const named = img.split(' ').filter((s) => s.startsWith('https://'));
    expect(named).toEqual(['https://upload.wikimedia.org']);
    // Les autres directives n'ont pas bougé pour autant.
    expect((CSP_DIRECTIVES as string[]).find((d) => d.startsWith('connect-src'))).not.toContain('wikimedia');
  });

  it('next.config.mjs passe par cspHeader (pas de seconde copie de la politique)', () => {
    const cfg = readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8');
    expect(cfg).toContain("cspHeader(process.env.CSP_MODE)");
    expect(cfg).not.toContain("script-src 'self'");
  });
});
