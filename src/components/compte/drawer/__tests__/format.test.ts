import { describe, expect, it } from 'vitest';
import { formatHistoryLine } from '../cards/format';

describe('formatHistoryLine — historique du kit', () => {
  it('localise les actions connues de materiel_kit_history', () => {
    const date = '2026-10-01T09:00:00Z';
    expect(formatHistoryLine({ action: 'created', created_at: date })).toBe('Créé · 01/10/2026');
    expect(formatHistoryLine({ action: 'updated', created_at: date })).toBe('Modifié · 01/10/2026');
    expect(formatHistoryLine({ action: 'deleted', created_at: date })).toBe('Supprimé · 01/10/2026');
    expect(formatHistoryLine({ action: 'restored', created_at: date })).toBe('Restauré · 01/10/2026');
    expect(formatHistoryLine({ action: 'forked', created_at: date })).toBe('Récupéré · 01/10/2026');
    expect(formatHistoryLine({ action: 'optimized', created_at: date })).toBe('Optimisé · 01/10/2026');
    expect(formatHistoryLine({ action: 'compared', created_at: date })).toBe('Comparé · 01/10/2026');
  });

  it('garde une action inconnue telle quelle, sans inventer de libellé', () => {
    expect(formatHistoryLine({ action: 'archived', created_at: '2026-10-01T09:00:00Z' })).toBe(
      'archived · 01/10/2026'
    );
  });
});
