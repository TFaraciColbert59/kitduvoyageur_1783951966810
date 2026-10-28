// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarnetCollapsible } from '../CarnetCollapsible';

afterEach(() => cleanup());

describe('CarnetCollapsible — section repliable (lot D)', () => {
  it('porte un en-tête de section et un corps ouvert par défaut', () => {
    const { container } = render(
      <CarnetCollapsible label="récit">
        <p>Douze jours de désert.</p>
      </CarnetCollapsible>,
    );
    const head = screen.getByRole('button', { name: 'récit' });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.ckp-section-head')?.textContent).toBe('récit');
    expect(container.querySelector('.ckp-collapse')?.getAttribute('data-open')).toBe('true');
    /* Rien n'est perdu : le contenu reste monté, même replié. */
    expect(screen.getByText('Douze jours de désert.')).toBeTruthy();
  });

  it('replie et déplie au clic, sans démonter le contenu', () => {
    const { container } = render(
      <CarnetCollapsible label="récit">
        <p>Douze jours de désert.</p>
      </CarnetCollapsible>,
    );
    const head = screen.getByRole('button', { name: 'récit' });
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.ckp-collapse')?.getAttribute('data-open')).toBeNull();
    expect(screen.getByText('Douze jours de désert.')).toBeTruthy();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.ckp-collapse')?.getAttribute('data-open')).toBe('true');
  });

  it('relie l’en-tête à son corps par aria-controls', () => {
    const { container } = render(
      <CarnetCollapsible label="récit">
        <p>texte</p>
      </CarnetCollapsible>,
    );
    const head = screen.getByRole('button', { name: 'récit' });
    const id = head.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelector(`#${id}`)?.classList.contains('ckp-collapse')).toBe(true);
  });
});
