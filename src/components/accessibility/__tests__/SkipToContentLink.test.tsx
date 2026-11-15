// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SkipToContentLink } from '../SkipToContentLink';

afterEach(cleanup);

describe('SkipToContentLink — évitement RGAA 12.1', () => {
  it('place le focus sur le contenu et le rend tabbable une fois', () => {
    render(
      <>
        <SkipToContentLink targetId="contenu-test" />
        <main id="contenu-test">
          <h1>Contenu</h1>
        </main>
      </>,
    );

    const link = screen.getByRole('link', { name: 'Aller au contenu principal' });
    expect(link.getAttribute('href')).toBe('#contenu-test');

    const main = document.getElementById('contenu-test') as HTMLElement;
    expect(main.hasAttribute('tabindex')).toBe(false);

    fireEvent.click(link);
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('laisse le comportement natif si la cible est absente', () => {
    render(<SkipToContentLink targetId="introuvable" label="Aller au contenu" />);
    const link = screen.getByRole('link', { name: 'Aller au contenu' });
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(true);
  });
});
