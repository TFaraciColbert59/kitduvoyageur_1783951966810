import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaysMiniChat } from '@/components/pays/PaysMiniChat';

vi.mock('@/hooks/useCountryPracticalGuide', () => ({
  useCountryPracticalGuide: () => ({ data: undefined, isLoading: false }),
}));

describe('PaysMiniChat', () => {
  it('rend la barre fermee avec suggestions et toggle accessible', () => {
    const html = renderToStaticMarkup(
      React.createElement(PaysMiniChat, { countryCode: 'IS', countryName: 'Islande' })
    );
    // Suggestions POC (§9 : kit + periode) visibles sans ouvrir
    expect(html).toContain('Crée mon kit');
    expect(html).toContain('Quand partir ?');
    // Toggle accessible, panneau ferme par defaut
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Ouvrir le mini-chat');
  });
});
