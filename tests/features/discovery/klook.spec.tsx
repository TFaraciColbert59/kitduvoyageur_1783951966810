import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('@/features/discovery/providers/klook/klookData', () => ({
  KLOOK_LINKS: {
    FR: { url: 'https://klook.tp.st/FRABC', title: 'Activités à Paris' },
  },
}));

import { validateKlookUrl, KLOOK_BRAND_FALLBACK_URL } from '@/features/discovery/providers/klook/klookLinks';
import { getKlookBlock } from '@/features/discovery/providers/klook/klookAdapter';
import { KlookCtaBlock } from '@/features/discovery/components/KlookCtaBlock';
import type { KlookBlock } from '@/features/discovery/providers/klook/klookTypes';

const baseBlock: KlookBlock = {
  provider: 'klook',
  countryCode: 'IS',
  destination: 'Islande',
  title: 'Activités à Islande',
  description: 'Description éditoriale.',
  ctaLabel: 'Voir les activités sur Klook',
  url: 'https://www.klook.com/',
  isAffiliate: false,
  rel: 'noopener',
};

describe('Validation des liens Klook (allowlist stricte)', () => {
  it('accepte Klook officiel et le domaine court Travelpayouts (HTTPS)', () => {
    expect(validateKlookUrl('https://www.klook.com/')?.host).toBe('www.klook.com');
    expect(validateKlookUrl('https://klook.tp.st/ABC')?.isAffiliate).toBe(true);
    expect(validateKlookUrl('https://tp.media/r?marker=1')?.isAffiliate).toBe(true);
  });

  it('rejette http, javascript:, data: et URL arbitraires', () => {
    for (const bad of [
      'http://www.klook.com/',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'https://evil.example/klook',
      'https://klook.com.evil.example/',
      'https://user:pass@www.klook.com/',
      'klook.com',
      '',
    ]) {
      expect(validateKlookUrl(bad)).toBeNull();
    }
  });

  it('expose la racine Klook comme repli officiel valide', () => {
    const fallback = validateKlookUrl(KLOOK_BRAND_FALLBACK_URL);
    expect(fallback?.url).toContain('klook.com');
    expect(fallback?.isAffiliate).toBe(false);
  });
});

describe('getKlookBlock (mode sans product feed)', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it('utilise le lien par pays quand configuré (affilié)', () => {
    const block = getKlookBlock({ countryCode: 'FR', destination: 'France' });
    expect(block?.url).toBe('https://klook.tp.st/FRABC');
    expect(block?.isAffiliate).toBe(true);
    expect(block?.rel).toBe('sponsored noopener');
    expect(block?.title).toBe('Activités à Paris');
  });

  it('replie sur la racine officielle Klook (non affilié) sans config', () => {
    const block = getKlookBlock({ countryCode: 'IS', destination: 'Islande' });
    expect(block?.url).toContain('www.klook.com');
    expect(block?.isAffiliate).toBe(false);
    expect(block?.rel).toBe('noopener');
    expect(block?.title).toBe('Activités à Islande');
  });

  it('utilise KLOOK_AFFILIATE_URL (env) comme lien global affilié', () => {
    vi.stubEnv('KLOOK_AFFILIATE_URL', 'https://klook.tp.st/GLOBAL');
    const block = getKlookBlock({ countryCode: 'JP', destination: 'Japon' });
    expect(block?.url).toBe('https://klook.tp.st/GLOBAL');
    expect(block?.isAffiliate).toBe(true);
  });

  it('refuse toute config invalide sans repli silencieux', () => {
    vi.stubEnv('KLOOK_AFFILIATE_URL', 'http://klook.com/');
    expect(getKlookBlock({ countryCode: 'JP', destination: 'Japon' })).toBeNull();
  });

  it('refuse un code pays invalide', () => {
    expect(getKlookBlock({ countryCode: '../etc', destination: 'X' })).toBeNull();
  });
});

describe('Rendu du CTA Klook', () => {
  it('affiche titre, CTA et lien externe sécurisé', () => {
    const html = renderToStaticMarkup(<KlookCtaBlock block={baseBlock} />);
    expect(html).toContain('Activités à Islande');
    expect(html).toContain('Voir les activités sur Klook');
    expect(html).toContain('https://www.klook.com/');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
  });

  it('affichage affilié : rel=sponsored noopener, PAS de noreferrer, mention partenaire', () => {
    const html = renderToStaticMarkup(
      <KlookCtaBlock block={{ ...baseBlock, isAffiliate: true, rel: 'sponsored noopener' }} />
    );
    expect(html).toContain('sponsored noopener');
    expect(html).not.toContain('noreferrer');
    expect(html).toContain('Lien partenaire');
  });

  it('bloc absent → aucun rendu', () => {
    expect(renderToStaticMarkup(<KlookCtaBlock block={null} />)).toBe('');
    expect(renderToStaticMarkup(<KlookCtaBlock />)).toBe('');
  });
});
