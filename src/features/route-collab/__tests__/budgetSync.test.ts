import { describe, expect, it } from 'vitest';
import { desiredBudgetLines, planBudgetSync, type DesiredBudgetLine } from '../budgetSync';
import type { RouteWorkspaceState } from '../types';

function published(nights: Array<{ id: string; day: number; hint: { perPerson: number; currency: string } | null }>): RouteWorkspaceState {
  const stages = nights.map((n) => ({
    id: n.id, workspaceId: 'ws', orderKey: n.id, dayNumber: n.day, title: `J${n.day}`, dateIso: '2026-12-01', departureTimeLocal: '08:00',
    timezone: 'Europe/Paris', startPointId: 'a', endPointId: 'b', notes: '', waterObservations: [], weatherSlice: null, hazards: [], entityVersion: 1,
    overnightPlace: {
      id: `o-${n.id}`, name: `Refuge ${n.id}`, type: 'refuge' as const, lat: 45, lon: 6, bookingStatus: 'unknown' as const, provenance: 'OpenStreetMap', lastVerifiedAt: null,
      priceHint: n.hint ? { perPerson: n.hint.perPerson, currency: n.hint.currency, basis: 'bareme' as const, asOf: '2026-01-01' } : null,
    },
  }));
  return {
    id: 'ws', publishedRevisionId: 'r1', publishedRevisionNo: 1,
    revisions: [{ id: 'r1', workspaceId: 'ws', revisionNo: 1, kind: 'published', stages, points: [], sections: [], kitSnapshot: [], acknowledgedUnknowns: [], createdAt: '2026-11-20T00:00:00Z', createdBy: 'u', createdByName: 'U', basedOnSeq: 0, parentRevisionId: null, summary: '' }],
  } as unknown as RouteWorkspaceState;
}

describe('Budget depuis l\'itinéraire publié (10.6)', () => {
  it('n\'invente aucun montant : pas de repère de prix, pas de ligne', () => {
    expect(desiredBudgetLines(published([{ id: 's1', day: 1, hint: null }]), 3)).toEqual([]);
  });

  it('une ligne prévue par nuit avec repère, multipliée par le groupe, et dite comme repère', () => {
    const lines = desiredBudgetLines(published([{ id: 's1', day: 1, hint: { perPerson: 18, currency: 'EUR' } }]), 3);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ amount: 54, currency: 'EUR', category: 'hébergement', title: 'Nuit 1 · Refuge s1' });
    expect(lines[0].basis).toMatch(/pas le tarif du lieu/);
  });

  it('ignore une devise que le budget ne gère pas', () => {
    expect(desiredBudgetLines(published([{ id: 's1', day: 1, hint: { perPerson: 5, currency: 'XYZ' } }]), 2)).toEqual([]);
  });

  it('est idempotent : rejouée avec les lignes déjà écrites, rien à faire', () => {
    const desired = desiredBudgetLines(published([{ id: 's1', day: 1, hint: { perPerson: 18, currency: 'EUR' } }]), 2);
    const first = planBudgetSync(desired, []);
    expect(first.insert).toHaveLength(1);
    const existing = [{ id: 'e1', isPlanned: true, amount: desired[0].amount, metadata: { route_collab_key: desired[0].key, route_collab_amount: desired[0].amount } }];
    expect(planBudgetSync(desired, existing)).toEqual({ insert: [], update: [], remove: [] });
  });

  it('met à jour une ligne non retouchée quand le groupe change, jamais une ligne retouchée à la main', () => {
    const [two] = desiredBudgetLines(published([{ id: 's1', day: 1, hint: { perPerson: 18, currency: 'EUR' } }]), 2);
    const [four] = desiredBudgetLines(published([{ id: 's1', day: 1, hint: { perPerson: 18, currency: 'EUR' } }]), 4);
    const untouched = [{ id: 'e1', isPlanned: true, amount: two.amount, metadata: { route_collab_key: two.key, route_collab_amount: two.amount } }];
    expect(planBudgetSync([four], untouched).update).toEqual([{ id: 'e1', line: four }]);
    const edited = [{ id: 'e1', isPlanned: true, amount: 99, metadata: { route_collab_key: two.key, route_collab_amount: two.amount } }];
    expect(planBudgetSync([four], edited)).toEqual({ insert: [], update: [], remove: [] });
  });

  it('retire la ligne d\'une nuit disparue, sauf si elle a été retouchée ou n\'est plus « prévue »', () => {
    const gone: DesiredBudgetLine[] = [];
    const base = { route_collab_key: 'ws:s1:night', route_collab_amount: 36 };
    expect(planBudgetSync(gone, [{ id: 'e1', isPlanned: true, amount: 36, metadata: base }]).remove).toEqual(['e1']);
    expect(planBudgetSync(gone, [{ id: 'e1', isPlanned: true, amount: 40, metadata: base }]).remove).toEqual([]);
    expect(planBudgetSync(gone, [{ id: 'e1', isPlanned: false, amount: 36, metadata: base }]).remove).toEqual([]);
  });
});
