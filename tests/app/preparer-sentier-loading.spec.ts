import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PreparerSentierLoading from '@/app/preparer-sentier/[id]/loading';

describe('PreparerSentierLoading — écran de préparation streamé', () => {
  const html = renderToStaticMarkup(React.createElement(PreparerSentierLoading));

  it('expose le repère de test et un statut accessible sans texte visible', () => {
    expect(html).toContain('data-testid="preparer-sentier-loading"');
    expect(html).toMatch(/aria-label="Préparation de l[^"]*activité en cours"/);
    expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
  });

  it('n’utilise que les tokens du design system', () => {
    for (const forbidden of ['rose-', 'sand-', 'forest-', 'bg-white/60', 'bg-white/90', 'dark:']) {
      expect(html).not.toContain(forbidden);
    }
  });
});
