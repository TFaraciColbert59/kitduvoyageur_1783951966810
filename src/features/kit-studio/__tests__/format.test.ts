import { describe, expect, it } from 'vitest';
import { formatEuro, formatKg, formatLitres, formatPercent, formatWeight } from '../domain/format';

const NB = ' ';

describe('formatWeight', () => {
  it('affiche des grammes sous 1 000 g', () => {
    expect(formatWeight(0)).toBe(`0${NB}g`);
    expect(formatWeight(820)).toBe(`820${NB}g`);
    expect(formatWeight(999)).toBe(`999${NB}g`);
  });
  it('affiche des kilogrammes à partir de 1 000 g (1 décimale, virgule)', () => {
    expect(formatWeight(1000)).toBe(`1,0${NB}kg`);
    expect(formatWeight(1049)).toBe(`1,0${NB}kg`);
    expect(formatWeight(10250)).toBe(`10,3${NB}kg`);
  });
  it('utilise une espace insécable U+00A0 avant l’unité', () => {
    expect(formatWeight(820).charCodeAt(3)).toBe(0x00a0);
    expect(formatWeight(10250).charCodeAt(4)).toBe(0x00a0);
  });
  it('ramène un négatif ou une valeur invalide à 0', () => {
    expect(formatWeight(-5)).toBe(`0${NB}g`);
    expect(formatWeight(Number.NaN)).toBe(`0${NB}g`);
  });
});

describe('formatKg', () => {
  it('est toujours en kg', () => {
    expect(formatKg(820)).toBe(`0,8${NB}kg`);
    expect(formatKg(0)).toBe(`0,0${NB}kg`);
    expect(formatKg(10250)).toBe(`10,3${NB}kg`);
    expect(formatKg(-1)).toBe(`0,0${NB}kg`);
  });
});

describe('formatEuro', () => {
  it('formate des centimes en euros entiers', () => {
    expect(formatEuro(0)).toBe(`0${NB}€`);
    expect(formatEuro(99900)).toBe(`999${NB}€`);
    expect(formatEuro(-100)).toBe(`0${NB}€`);
  });
  it('sépare les milliers par une espace insécable et place U+00A0 avant €', () => {
    const s = formatEuro(123400);
    expect(s.endsWith(`${NB}€`)).toBe(true);
    expect(s.charCodeAt(1)).toBe(0x202f);
    expect(s.replace(/[  ]/g, ' ')).toBe('1 234 €');
  });
});

describe('formatPercent', () => {
  it('place U+00A0 avant %', () => {
    expect(formatPercent(14)).toBe(`14${NB}%`);
    expect(formatPercent(0)).toBe(`0${NB}%`);
    expect(formatPercent(14.4).charCodeAt(2)).toBe(0x00a0);
  });
});

describe('formatLitres', () => {
  it('une décimale sous 10 L, aucune au-dessus', () => {
    expect(formatLitres(6.5)).toBe(`6,5${NB}L`);
    expect(formatLitres(0)).toBe(`0,0${NB}L`);
    expect(formatLitres(40)).toBe(`40${NB}L`);
  });
});
