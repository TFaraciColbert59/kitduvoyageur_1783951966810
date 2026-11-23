import { describe, expect, it } from 'vitest';
import { formatPillSummary, readinessFacts, routeQualityLight, threeLineSynthesis } from '../summary';
import { baseWorkspace, basePoints, kit, section, stage } from './fixtures';

describe('formatPillSummary', () => {
  it('formate jours, km et D+ avec espace fine insécable', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({
      sections: [section('s1', a, b, { distanceKm: 20, ascentM: 1000 }), section('s2', b, c, { distanceKm: 22, ascentM: 1180 })],
      stages: [stage('g1', 1, 'a', 'b'), stage('g2', 2, 'b', 'c'), stage('g3', 3, 'c', 'c')],
    });
    expect(formatPillSummary(ws)).toBe('3 j · 42 km · 2 180 m');
  });
  it('D+ inconnu : « D+ ? », jamais 0', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({ sections: [section('s1', a, b), section('s2', b, c, { ascentM: null })] });
    expect(formatPillSummary(ws)).toBe('2 j · 20 km · D+ ?');
  });
  it('rien de calculé : points d’interrogation', () => {
    expect(formatPillSummary(baseWorkspace({ sections: [], stages: [] }))).toBe('? km · D+ ?');
  });
});

describe('routeQualityLight', () => {
  it('vert quand tout est connu et continu', () => {
    const r = routeQualityLight(baseWorkspace());
    expect(r.level).toBe('green');
    expect(r.firstFaultySectionId).toBeNull();
  });
  it('rouge si un raccord manque, avec le tronçon fautif', () => {
    const ws = baseWorkspace();
    const r = routeQualityLight({ ...ws, sections: [ws.sections[0]] });
    expect(r.level).toBe('red');
    expect(r.firstFaultySectionId).toBe('s1');
    expect(r.reasons[0]).toContain('raccord manquant');
  });
  it('rouge si deux tronçons ne se touchent pas (saut de plus de 100 m)', () => {
    const ws = baseWorkspace();
    const s2 = ws.sections[1];
    const shifted = { ...s2, geometry: { ...s2.geometry, coordinates: s2.geometry.coordinates.map(([x, y]) => [x + 0.05, y] as [number, number]) } };
    expect(routeQualityLight({ ...ws, sections: [ws.sections[0], shifted] }).level).toBe('red');
  });
  it('orange : manuel non vérifié, altitude ou surface inconnues', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({
      sections: [
        section('s1', a, b, { mode: 'manual', provenance: { provider: null, calculatedAt: null, profile: null, confidence: 'unknown' } }),
        section('s2', b, c, { ascentM: null, surfaceSegments: [] }),
      ],
    });
    const r = routeQualityLight(ws);
    expect(r.level).toBe('orange');
    expect(r.reasons).toHaveLength(3);
    expect(r.firstFaultySectionId).toBe('s1');
  });
});

describe('readinessFacts', () => {
  it('Prêt : aucun fait restant (nuit trouvée, dates connues)', () => {
    const ws = baseWorkspace({
      stages: [
        stage('g1', 1, 'a', 'b', { overnightPlace: { id: 'o', name: 'Refuge X', type: 'refuge', lat: 45.9, lon: 6.13, bookingStatus: 'confirmed', provenance: 'osm', lastVerifiedAt: null } }),
        stage('g2', 2, 'b', 'c'),
      ],
    });
    expect(readinessFacts(ws)).toEqual({ label: 'Prêt', remaining: [] });
  });
  it('Presque prêt : un ou deux faits non bloquants, en comptes', () => {
    const r = readinessFacts(baseWorkspace());
    expect(r.label).toBe('Presque prêt');
    expect(r.remaining).toEqual([{ code: 'overnight_missing', count: 1, text: '1 nuit à trouver' }]);
  });
  it('À compléter : tracé interrompu ou trop de faits', () => {
    const ws = baseWorkspace();
    expect(readinessFacts({ ...ws, sections: [ws.sections[0]] }).label).toBe('À compléter');
    const many = baseWorkspace({ kitItems: [kit('k1'), kit('k2', { status: 'needs_revalidation', assigneeUserId: 'u' })] });
    expect(readinessFacts(many).label).toBe('À compléter');
  });
  it('donnée inconnue : D+ et surface comptés comme faits', () => {
    const [a, b, c] = basePoints();
    const r = readinessFacts(baseWorkspace({ sections: [section('s1', a, b, { ascentM: null }), section('s2', b, c, { surfaceSegments: [] })] }));
    expect(r.remaining.map((f) => f.code)).toEqual(expect.arrayContaining(['elevation_unknown', 'surface_unknown']));
  });
});

describe('threeLineSynthesis', () => {
  it('range les constats dans ok / à vérifier / bloquant', () => {
    const ws = baseWorkspace({ kitItems: [kit('k1', { status: 'needs_revalidation' })] });
    const s = threeLineSynthesis(ws, { now: new Date('2026-07-01T00:00:00Z'), lateStageDays: [2], longestWaterGapKm: 14.5, waterGapAlertKm: 10 });
    expect(s.blocking).toEqual([]);
    expect(s.ok).toContain('Tracé continu, altitude et surface connues');
    expect(s.toCheck).toEqual(
      expect.arrayContaining(['1 nuit à trouver', 'Arrivée après le coucher du soleil, jour 2', '14,5 km sans point d\'eau connu', '1 objet à revérifier']),
    );
  });
  it('bloquant : aucun tracé', () => {
    const s = threeLineSynthesis(baseWorkspace({ sections: [], stages: [] }), { now: new Date('2026-07-01') });
    expect(s.blocking).toContain('Aucun tracé');
  });
  it('alerte expirée ignorée, eau inconnue non affichée', () => {
    const ws = baseWorkspace({
      stages: [
        stage('g1', 1, 'a', 'b', { hazards: [{ id: 'h', title: 't', type: 'closure', severitySource: 's', observedAt: '2026-06-01', expiresAt: '2026-06-10', source: 's' }] }),
        stage('g2', 2, 'b', 'c'),
      ],
    });
    const s = threeLineSynthesis(ws, { now: new Date('2026-07-01'), longestWaterGapKm: null, waterGapAlertKm: 10 });
    expect(s.toCheck.join(' ')).not.toContain('alerte');
    expect(s.toCheck.join(' ')).not.toContain('eau');
  });
});
