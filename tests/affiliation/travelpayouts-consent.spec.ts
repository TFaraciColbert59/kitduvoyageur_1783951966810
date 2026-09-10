import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import TravelpayoutsDrive from '@/components/TravelpayoutsDrive';

/**
 * Z7 — Verrou : le traceur Travelpayouts Drive ne doit JAMAIS être rendu
 * sans consentement explicite (même règle que Rocket/GA).
 * En rendu serveur (pas de window/localStorage), useCookieConsent() renvoie
 * null → le composant doit retourner null et son HTML ne rien contenir.
 */

describe('Travelpayouts Drive — garde de consentement (Z7)', () => {
  it('Z7-TPD.1 : sans consentement, aucun tag tpembars dans le HTML', () => {
    const html = renderToStaticMarkup(React.createElement(TravelpayoutsDrive));
    expect(html).toBe('');
    expect(html).not.toContain('tpembars');
    expect(html).not.toContain('NTYxMTY5');
  });

  it('Z7-TPD.2 : aucun tag tpembars inconditionnel dans layout.tsx', () => {
    const layout = readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(layout).not.toContain('tpembars');
    expect(layout).not.toContain('NTcxMjgw');
  });
});