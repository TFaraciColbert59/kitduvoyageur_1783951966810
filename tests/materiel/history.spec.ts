import { describe, it, expect } from 'vitest';
import { historyLabel, historyTone } from '@/lib/materiel/history';

describe('history', () => {
  it('libelle les actions connues', () => {
    expect(historyLabel('created')).toBe('Création');
    expect(historyLabel('deleted')).toBe('Suppression');
    expect(historyLabel('forked')).toBe('Fork');
  });
  it('retombe sur l’action brute', () => {
    expect(historyLabel('unknown')).toBe('unknown');
  });
  it('mappe les tons', () => {
    expect(historyTone('deleted')).toBe('danger');
    expect(historyTone('created')).toBe('sage');
    expect(historyTone('zzz')).toBe('stone');
  });
});