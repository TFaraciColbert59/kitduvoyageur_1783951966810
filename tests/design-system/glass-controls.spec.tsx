import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, IconButton } from '@/components/ui';
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
    const html = renderToStaticMarkup(<Button type="submit" loading>Enregistrer</Button>);
    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Enregistrer');
  });

  it('keeps canonical size and icon-only contracts for small controls', () => {
    const text = renderToStaticMarkup(<Button size="sm" aria-label="Ajouter">+</Button>);
    expect(text).toContain('data-size="sm"');
    expect(text).toContain('h-[var(--control-height-sm)]');

    const icon = renderToStaticMarkup(<IconButton size="sm" aria-label="Ajouter">+</IconButton>);
    expect(icon).toContain('data-size="sm"');
    expect(icon).toContain('h-[var(--control-height-sm)]');
    expect(icon).toContain('w-[var(--control-height-sm)]');
  });
});
