import { describe, expect, it } from 'vitest';
import { keyboardInsetFrom } from '../useKeyboardInset';

describe('keyboardInsetFrom', () => {
  it('0 quand le viewport visuel couvre la fenêtre', () => {
    expect(keyboardInsetFrom(852, 852, 0)).toBe(0);
  });

  it('ignore les petites variations (barre d’adresse)', () => {
    expect(keyboardInsetFrom(852, 800, 0)).toBe(0);
  });

  it('mesure la hauteur du clavier', () => {
    expect(keyboardInsetFrom(852, 520, 0)).toBe(332);
  });

  it('tient compte du décalage du viewport visuel', () => {
    expect(keyboardInsetFrom(852, 500, 40)).toBe(312);
  });
});
