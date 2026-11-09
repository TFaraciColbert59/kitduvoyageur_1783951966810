import { describe, expect, it } from 'vitest';
import { countdownTone, formatRemaining, sortInbox } from './countdown';

/**
 * Couche 2 : EX-INBOX-02 (tri) et EX-INBOX-03 (tons du compte à rebours).
 * Seuils du bundle, jamais à la baisse : gris > 5 min et > 20 % du délai,
 * orange ≤ 5 min ou ≤ 20 %, rouge dépassé.
 */

const MIN = 60_000;

describe('countdownTone — tons du compte à rebours', () => {
  it('passe en rouge dès que le délai est dépassé (zéro compris)', () => {
    expect(countdownTone(0, 30 * MIN)).toBe('rouge');
    expect(countdownTone(-1, 30 * MIN)).toBe('rouge');
    expect(countdownTone(-60 * MIN, null)).toBe('rouge');
  });

  it('passe en orange à 5 minutes ou moins, quelle que soit l’échéance totale', () => {
    expect(countdownTone(5 * MIN, null)).toBe('orange');
    expect(countdownTone(5 * MIN, 24 * 60 * MIN)).toBe('orange');
    expect(countdownTone(4 * MIN + 59_000, null)).toBe('orange');
    expect(countdownTone(1, null)).toBe('orange');
  });

  it('reste en gris au-delà de 5 minutes et au-delà de 20 % du délai total', () => {
    expect(countdownTone(5 * MIN + 1, null)).toBe('gris');
    expect(countdownTone(6 * MIN, 20 * MIN)).toBe('gris'); // 30 % du délai, > 5 min
    expect(countdownTone(60 * MIN, null)).toBe('gris');
  });

  it('passe en orange à 20 % du délai total restant, avant même les 5 minutes', () => {
    const total = 100 * MIN;
    expect(countdownTone(Math.floor(total * 0.2), total)).toBe('orange');
    expect(countdownTone(Math.floor(total * 0.2) + 1, total)).toBe('gris');
    expect(countdownTone(Math.floor(total * 0.21), total)).toBe('gris');
    expect(countdownTone(Math.floor(total * 0.19), total)).toBe('orange');
  });

  it('ignore la règle des 20 % quand le délai total est inconnu ou nul', () => {
    expect(countdownTone(10 * MIN, null)).toBe('gris');
    expect(countdownTone(10 * MIN, 0)).toBe('gris');
    expect(countdownTone(10 * MIN, -5)).toBe('gris');
  });

  it('ne passe en orange que si l’une des deux bornes est franchie', () => {
    const total = 24 * MIN; // 20 % = 4,8 min
    expect(countdownTone(6 * MIN, total)).toBe('gris'); // 25 % du total, > 5 min
    expect(countdownTone(5 * MIN + 1, total)).toBe('gris');
    expect(countdownTone(5 * MIN, total)).toBe('orange'); // borne des 5 minutes
    expect(countdownTone(4 * MIN, total)).toBe('orange'); // borne des 20 %
    expect(countdownTone(1, total)).toBe('orange');
  });
});

describe('formatRemaining — texte du compte à rebours', () => {
  it('écrit « Dépassé » sous la minute', () => {
    expect(formatRemaining(0)).toBe('Dépassé');
    expect(formatRemaining(-1)).toBe('Dépassé');
    expect(formatRemaining(-59_999)).toBe('Dépassé');
  });

  it('chiffre le dépassement en minutes puis en heures', () => {
    expect(formatRemaining(-1 * MIN)).toBe('Dépassé de 1 min');
    expect(formatRemaining(-59 * MIN)).toBe('Dépassé de 59 min');
    expect(formatRemaining(-60 * MIN)).toBe('Dépassé de 1 h');
    expect(formatRemaining(-121 * MIN)).toBe('Dépassé de 2 h');
  });

  it('arrondit au supérieur le temps restant en minutes', () => {
    expect(formatRemaining(1)).toBe('Reste 1 min');
    expect(formatRemaining(30_000)).toBe('Reste 1 min');
    expect(formatRemaining(60_000)).toBe('Reste 1 min');
    expect(formatRemaining(60_001)).toBe('Reste 2 min');
    expect(formatRemaining(59 * MIN)).toBe('Reste 59 min');
  });

  it('affiche heures et minutes au-delà d’une heure', () => {
    expect(formatRemaining(60 * MIN)).toBe('Reste 1 h 0 min');
    expect(formatRemaining(90 * MIN)).toBe('Reste 1 h 30 min');
    expect(formatRemaining(25 * 60 * MIN)).toBe('Reste 25 h 0 min');
  });
});

type Item = { key: string; urgency: 'haute' | 'normale'; due_at: string | null; created_at: string };

const at = (minutesFromNow: number, base = '2026-11-09T12:00:00.000Z'): string =>
  new Date(Date.parse(base) + minutesFromNow * MIN).toISOString();

describe('sortInbox — tri de la file (EX-INBOX-02)', () => {
  it('place l’urgence haute avant tout le reste', () => {
    const items: Item[] = [
      { key: 'normale-tot', urgency: 'normale', due_at: at(1), created_at: at(-100) },
      { key: 'haute-tard', urgency: 'haute', due_at: at(240), created_at: at(-1) }
    ];
    expect(sortInbox(items).map((i) => i.key)).toEqual(['haute-tard', 'normale-tot']);
  });

  it('trie ensuite par délai le plus proche, les sans-délai en dernier', () => {
    const items: Item[] = [
      { key: 'sans-delai', urgency: 'normale', due_at: null, created_at: at(-500) },
      { key: 'delai-30', urgency: 'normale', due_at: at(30), created_at: at(-10) },
      { key: 'delai-5', urgency: 'normale', due_at: at(5), created_at: at(-1) },
      { key: 'delai-60', urgency: 'normale', due_at: at(60), created_at: at(-20) }
    ];
    expect(sortInbox(items).map((i) => i.key)).toEqual(['delai-5', 'delai-30', 'delai-60', 'sans-delai']);
  });

  it('départage à délai égal par l’ancienneté (le plus ancien d’abord)', () => {
    const items: Item[] = [
      { key: 'recent', urgency: 'normale', due_at: at(10), created_at: at(-2) },
      { key: 'ancien', urgency: 'normale', due_at: at(10), created_at: at(-40) }
    ];
    expect(sortInbox(items).map((i) => i.key)).toEqual(['ancien', 'recent']);
  });

  it('trie les urgences hautes entre elles par délai puis ancienneté', () => {
    const items: Item[] = [
      { key: 'haute-sans-delai-vieux', urgency: 'haute', due_at: null, created_at: at(-99) },
      { key: 'haute-delai-2-ancien', urgency: 'haute', due_at: at(2), created_at: at(-60) },
      { key: 'haute-delai-2-recent', urgency: 'haute', due_at: at(2), created_at: at(-5) },
      { key: 'haute-delai-9', urgency: 'haute', due_at: at(9), created_at: at(-1) }
    ];
    expect(sortInbox(items).map((i) => i.key)).toEqual([
      'haute-delai-2-ancien',
      'haute-delai-2-recent',
      'haute-delai-9',
      'haute-sans-delai-vieux'
    ]);
  });

  it('ne modifie pas le tableau reçu et reste stable sur une entrée déjà triée', () => {
    const items: Item[] = [
      { key: 'a', urgency: 'haute', due_at: at(5), created_at: at(-1) },
      { key: 'b', urgency: 'normale', due_at: at(1), created_at: at(-2) },
      { key: 'c', urgency: 'normale', due_at: null, created_at: at(-3) }
    ];
    const before = items.map((i) => i.key);
    const sorted = sortInbox(items);
    expect(items.map((i) => i.key)).toEqual(before);
    expect(sorted).not.toBe(items);
    expect(sortInbox(sorted).map((i) => i.key)).toEqual(sorted.map((i) => i.key));
  });
});
