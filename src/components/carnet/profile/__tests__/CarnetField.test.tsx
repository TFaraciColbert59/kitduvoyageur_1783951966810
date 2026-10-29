// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarnetField } from '../CarnetField';

/**
 * Le champ de donnée est la seule ligne de la feuille : sa valeur peut être un
 * lieu long. La forme (colonne de 120 px, ellipse) est peinte par la feuille ;
 * ces tests garantissent que le marquage ne perd ni la donnée ni l'accessible.
 */
afterEach(() => cleanup());

describe('CarnetField — ellipse au milieu (lot B)', () => {
  it('marque un lieu long pour une ellipse au milieu, sans perdre le texte', () => {
    const { container } = render(
      <CarnetField label="lieu" value="Islande · Landmannalaugar" wide mid />,
    );
    const field = container.querySelector('.ckp-field') as HTMLElement;
    expect(field.classList.contains('ckp-field--mid')).toBe(true);
    expect(field.classList.contains('ckp-field--wide')).toBe(true);
    /* Le texte réel reste entier : le DOM, le titre et le nom accessible. */
    expect(field.getAttribute('title')).toBe('Islande · Landmannalaugar');
    expect(field.querySelector('.ckp-field-value')?.textContent).toBe('Islande · Landmannalaugar');
  });

  it('garde l’ellipse de fin par défaut', () => {
    const { container } = render(<CarnetField label="allure" value="4,2 km/h" />);
    expect(container.querySelector('.ckp-field--mid')).toBeNull();
  });

  it('garde le tiret quand la donnée est absente, même en ellipse milieu', () => {
    const { container } = render(<CarnetField label="arrivée" value="" mid />);
    expect(container.querySelector('.ckp-field-value')?.textContent).toBe('—');
    expect(container.querySelector('.ckp-field')?.classList.contains('is-missing')).toBe(true);
  });
});

describe('CarnetField — composants (lot D)', () => {
  it('ne peint un chevron que sur une ligne qui navigue', () => {
    const { container, rerender } = render(<CarnetField label="matériel" href="/compas" />);
    expect(container.querySelector('.ckp-field-chevron')).toBeTruthy();
    /* Destination externe : le glyphe d'ouverture vient de l'appelant, jamais
       un chevron de navigation. */
    rerender(<CarnetField label="x" href="https://example.com" value="ouvrir" />);
    expect(container.querySelector('.ckp-field-chevron')).toBeNull();
    /* Ligne de donnée sans destination : aucun chevron. */
    rerender(<CarnetField label="allure" value="4,2 km/h" />);
    expect(container.querySelector('.ckp-field-chevron')).toBeNull();
  });

  it('ajoute le message d’erreur sous la ligne, sans bandeau', () => {
    const { container } = render(
      <CarnetField label="trace gps" value="" error errorMessage="point unique" />,
    );
    const field = container.querySelector('.ckp-field') as HTMLElement;
    expect(field.getAttribute('data-error')).toBe('true');
    const message = container.querySelector('.ckp-field-error') as HTMLElement;
    expect(message.textContent).toBe('point unique');
    expect(message.getAttribute('role')).toBe('alert');
    /* Le message vit sous la ligne, dans le même bloc. */
    expect(container.querySelector('.ckp-field-wrap')?.contains(message)).toBe(true);
  });

  it('ne pose aucun message quand le champ n’est pas en erreur', () => {
    const { container } = render(<CarnetField label="allure" value="4,2 km/h" errorMessage="inutile" />);
    expect(container.querySelector('.ckp-field-error')).toBeNull();
  });
});
