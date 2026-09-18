import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LkvButton } from '@/components/ui/LkvButton';
import { LkvChip } from '@/components/ui/LkvChip';

describe('Accessible shared glass controls', () => {
  it('exposes a selected chip as a native toggle button', () => {
    const html = renderToStaticMarkup(<LkvChip active onClick={() => {}}>Carte</LkvChip>);
    expect(html).toMatch(/^<button\b/);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Carte');
  });

  it('retains button semantics and disabled state for an unavailable action', () => {
    const html = renderToStaticMarkup(<LkvChip disabled onClick={() => {}}>Indisponible</LkvChip>);
    expect(html).toMatch(/^<button\b/);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-pressed="false"');
  });

  it('renders a passive chip as text without keyboard stop or optical layer', () => {
    const html = renderToStaticMarkup(<LkvChip label="Recommandé" />);
    expect(html).toMatch(/^<span\b/);
    expect(html).not.toMatch(/role="button"|tabindex|backdrop-filter/);
  });

  it('announces loading and prevents a second submission', () => {
    const html = renderToStaticMarkup(<LkvButton type="submit" loading>Enregistrer</LkvButton>);
    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Enregistrer');
  });

  it('keeps small icon and text controls at least 44px high and wide', () => {
    for (const variant of ['primary', 'icon-only'] as const) {
      const html = renderToStaticMarkup(<LkvButton variant={variant} size="sm" aria-label="Ajouter">+</LkvButton>);
      expect(html).toContain('min-height:var(--lkv-touch-min)');
      expect(html).toContain('min-width:var(--lkv-touch-min)');
    }
  });
});
