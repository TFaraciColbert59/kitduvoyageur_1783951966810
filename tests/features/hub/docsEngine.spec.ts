import { describe, it, expect } from 'vitest';
import { buildDocsView } from '@/features/hub/mobile/docsEngine';

const NOW = new Date('2026-09-10T12:00:00Z');

function doc(id: string, expires_at: string | null, title = id) {
  return { id, title, category: 'identite', expires_at };
}

describe('docs engine (mobile sortie)', () => {
  it('compte expirés / à renouveler / valides / sans échéance', () => {
    const view = buildDocsView(
      [
        doc('exp', '2026-09-01'),
        doc('warn', '2027-01-15'),
        doc('valid', '2028-06-01'),
        doc('none', null),
      ],
      NOW
    );
    expect(view.expired).toBe(1);
    expect(view.warning).toBe(1);
    expect(view.valid).toBe(1);
    expect(view.none).toBe(1);
    expect(view.total).toBe(4);
  });

  it('trie les plus urgents d’abord (expiré, warning, valide, sans échéance)', () => {
    const view = buildDocsView(
      [doc('valid', '2028-06-01'), doc('none', null), doc('warn', '2027-01-15'), doc('exp', '2026-09-01')],
      NOW
    );
    expect(view.rows.map((row) => row.id)).toEqual(['exp', 'warn', 'valid', 'none']);
    expect(view.rows[0].label).toMatch(/Expiré/);
  });

  it('conserve le statut et les jours restants par ligne', () => {
    const view = buildDocsView([doc('exp', '2026-09-01')], NOW);
    expect(view.rows[0].status).toBe('expired');
    expect(view.rows[0].daysRemaining).toBeLessThan(0);
  });

  it('liste vide → zéros, jamais d’erreur', () => {
    expect(buildDocsView([], NOW)).toEqual({ rows: [], expired: 0, warning: 0, valid: 0, none: 0, total: 0 });
  });
});
