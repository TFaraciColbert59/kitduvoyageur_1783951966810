import { describe, expect, it } from 'vitest';
import { readClubRouteProposal } from '../readClubRouteProposal';

type Reply = { data: unknown; error: unknown };

/** Faux client : chaque lecture (par liste de colonnes) répond selon `replies`, les filtres sont consignés. */
function fake(replies: Record<string, Reply>) {
  const calls: Array<{ columns: string; filter: string }> = [];
  const client = {
    from: () => ({
      select: (columns: string) => {
        const chain = (filter: string) => ({ maybeSingle: async () => { calls.push({ columns, filter }); return replies[columns] ?? { data: null, error: { code: '42703' } }; } });
        const eq2 = { or: (f: string) => chain(`or:${f}`), not: (c: string) => chain(`not:${c}`) };
        return { eq: () => ({ eq: () => eq2 }) };
      },
    }),
  };
  return { client, calls };
}

const FULL = 'route_name,distance_m,elevation_gain_m,source_revision_no';
const PROD = 'distance_m,elevation_gain_m,source_revision_no';
const LEGACY = 'route_name,distance_m,elevation_gain_m';

describe('readClubRouteProposal (10.5)', () => {
  it('révision issue d’un espace : lue, avec la version d’origine, sans lire la géométrie', async () => {
    const { client, calls } = fake({ [FULL]: { data: { route_name: 'Traversée', distance_m: '3300', elevation_gain_m: 200, source_revision_no: 2 }, error: null } });
    expect(await readClubRouteProposal(client, 'e', 3)).toEqual({ routeName: 'Traversée', distanceM: 3300, elevationGainM: 200, sourceRevisionNo: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0].filter).toBe('or:canonical_revision_id.not.is.null,trace.not.is.null');
    expect(calls[0].columns).not.toContain('trace');
  });

  it('révision du catalogue : pas de version d’origine', async () => {
    const { client } = fake({ [FULL]: { data: { route_name: 'GR', distance_m: 10, elevation_gain_m: null, source_revision_no: null }, error: null } });
    expect(await readClubRouteProposal(client, 'e', 1)).toMatchObject({ routeName: 'GR', elevationGainM: null, sourceRevisionNo: null });
  });

  it('schéma de production (ni route_name ni canonical_revision_id) : repli sur la trace', async () => {
    const { client, calls } = fake({ [PROD]: { data: { distance_m: 5000, elevation_gain_m: 120, source_revision_no: 1 }, error: null } });
    expect(await readClubRouteProposal(client, 'e', 1)).toEqual({ routeName: null, distanceM: 5000, elevationGainM: 120, sourceRevisionNo: 1 });
    expect(calls.map((c) => c.columns)).toEqual([FULL, PROD]);
  });

  it('base sans la migration des espaces : lecture historique inchangée', async () => {
    const { client, calls } = fake({ [LEGACY]: { data: { route_name: 'Col', distance_m: 8, elevation_gain_m: 1 }, error: null } });
    expect(await readClubRouteProposal(client, 'e', 1)).toMatchObject({ routeName: 'Col', sourceRevisionNo: null });
    expect(calls.map((c) => c.filter)).toEqual(['or:canonical_revision_id.not.is.null,trace.not.is.null', 'not:trace', 'not:canonical_revision_id']);
  });

  it('révision sans géométrie ou toutes lectures en erreur : rien à proposer', async () => {
    expect(await readClubRouteProposal(fake({ [FULL]: { data: null, error: null } }).client, 'e', 1)).toBeNull();
    expect(await readClubRouteProposal(fake({}).client, 'e', 1)).toBeNull();
  });
});
