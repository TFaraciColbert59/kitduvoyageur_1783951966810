// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { firstFocusable, resolveFocusTarget } from '../focus';

describe('focus (FID-081)', () => {
  it('résout une tuile non focusable vers son lien interne', () => {
    const { container } = render(
      <article data-testid="tile">
        <a href="https://example.com/carnets/1">Ouvrir</a>
        <button type="button">J’aime</button>
      </article>,
    );
    const tile = container.querySelector('[data-testid="tile"]') as HTMLElement;
    const target = resolveFocusTarget(tile);
    expect(target?.tagName).toBe('A');
    expect(target?.getAttribute('href')).toBe('https://example.com/carnets/1');
  });

  it('rend l’élément lui-même quand il est focusable', () => {
    const { container } = render(<button type="button">Action</button>);
    const button = container.querySelector('button') as HTMLElement;
    expect(resolveFocusTarget(button)).toBe(button);
  });

  it('ne rend rien pour un élément hors du document ou absent', () => {
    const orphan = document.createElement('button');
    expect(resolveFocusTarget(orphan)).toBeNull();
    expect(resolveFocusTarget(null)).toBeNull();
    expect(firstFocusable(null)).toBeNull();
  });
});
