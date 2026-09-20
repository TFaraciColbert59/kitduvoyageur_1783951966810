import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card } from '@/components/ui';

describe('Card surface contract', () => {
  it('renders canonical standard surface and content during SSR without browser globals', () => {
    const html = renderToStaticMarkup(<Card as="article" ariaLabelledBy="title"><h2 id="title">Voyage</h2></Card>);
    expect(html).toContain('data-variant="standard"');
    expect(html).toContain('aria-labelledby="title"');
    expect(html).toContain('<h2 id="title">Voyage</h2>');
  });
  it('does not put a decorative hover surface with a nested link in the tab order', () => {
    const html = renderToStaticMarkup(<Card variant="interactive"><a href="/voyages">Voyage</a></Card>);
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('role="button"');
  });
  it('exposes an actionable card to keyboard users', () => {
    const html = renderToStaticMarkup(<Card variant="interactive" onClick={() => {}}>Ouvrir</Card>);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });
  it('marks the selected card state for assistive tech', () => {
    const html = renderToStaticMarkup(<Card selected>Choisi</Card>);
    expect(html).toContain('aria-pressed="true"');
  });
  it.each(['standard', 'interactive', 'featured', 'compact'] as const)('preserves the %s semantic variant in SSR', (variant) => {
    const html = renderToStaticMarkup(createElement(Card, { variant }, 'Contenu'));
    expect(html).toContain(`data-variant="${variant}"`);
    expect(html).not.toContain(' variant=');
  });
});
