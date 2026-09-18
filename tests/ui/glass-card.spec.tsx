import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlassCard } from '@/components/ui/GlassCard';

describe('GlassCard surface contract', () => {
  it('renders canonical base and content during SSR without browser globals', () => {
    const html = renderToStaticMarkup(<GlassCard as="article" ariaLabelledBy="title"><h2 id="title">Voyage</h2></GlassCard>);
    expect(html).toContain('data-glass-variant="base"');
    expect(html).toContain('aria-labelledby="title"');
    expect(html).toContain('<h2 id="title">Voyage</h2>');
  });
  it('does not put a decorative hover surface with a nested link in the tab order', () => {
    const html = renderToStaticMarkup(<GlassCard interactive><a href="/voyages">Voyage</a></GlassCard>);
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('role="button"');
  });
  it('exposes an actionable card to keyboard users', () => {
    const html = renderToStaticMarkup(<GlassCard interactive onClick={() => {}}>Ouvrir</GlassCard>);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });
  it('removes disabled actionable cards from the tab order', () => {
    const html = renderToStaticMarkup(createElement(GlassCard, { interactive: true, disabled: true, onClick: () => {} } as any, 'Indisponible'));
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('tabindex="0"');
  });
  it.each(['base', 'elevated', 'interactive', 'selected', 'overlay', 'critical'])('preserves the %s semantic variant in SSR', (variant) => {
    const html = renderToStaticMarkup(createElement(GlassCard, { variant } as any, 'Contenu'));
    expect(html).toContain(`data-glass-variant="${variant}"`);
    expect(html).not.toContain(' variant=');
  });
});
