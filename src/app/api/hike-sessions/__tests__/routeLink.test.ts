import { describe, expect, it } from 'vitest';
import { isMissingColumnError, MAX_KIT_SNAPSHOT_ITEMS, parseRouteLink, resolveRouteLink } from '../routeLink';

const WS = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';
const REV = '1c9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3d';

/** Lecteur Supabase minimal : `rows[table]` est la ligne visible (RLS) ou `null`. */
function reader(rows: Record<string, unknown>, fail?: string) {
  return {
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = async () => (fail === t ? { data: null, error: { code: 'x' } } : { data: rows[t] ?? null, error: null });
      return q;
    },
  };
}

describe('hike-sessions · lien avec la version suivie (9.8, rétrocompatible)', () => {
  it('sans champ ou avec un identifiant invalide : aucun lien, comportement historique', () => {
    expect(parseRouteLink({})).toBeNull();
    expect(parseRouteLink({ routeWorkspaceId: 'pas-un-uuid' })).toBeNull();
    expect(parseRouteLink({ routeWorkspaceId: 42 })).toBeNull();
  });

  it('garde l’espace, la version et le sac borné ; ignore les objets invalides', () => {
    const kit = Array.from({ length: MAX_KIT_SNAPSHOT_ITEMS + 20 }, (_, i) => ({ id: `k${i}`, name: `Objet ${i}`, weightGrams: 100, quantity: 1, shared: false, assigneeUserId: null }));
    const p = parseRouteLink({ routeWorkspaceId: WS, routeRevisionId: REV, kitSnapshot: [...kit, { id: '', name: 'x' }, 'bruit'] });
    expect(p?.workspaceId).toBe(WS);
    expect(p?.revisionId).toBe(REV);
    expect(p?.kitSnapshot).toHaveLength(MAX_KIT_SNAPSHOT_ITEMS);
    expect(parseRouteLink({ routeWorkspaceId: WS, routeRevisionId: 'x' })?.revisionId).toBeNull();
    expect(parseRouteLink({ routeWorkspaceId: WS })?.kitSnapshot).toBeNull();
  });

  it('n’écrit le lien que si la personne lit l’espace (RLS) ; la version doit appartenir à l’espace', async () => {
    const input = { routeWorkspaceId: WS, routeRevisionId: REV, kitSnapshot: [{ id: 'k1', name: 'Tente' }] };
    expect(await resolveRouteLink(reader({ route_workspaces: { id: WS }, route_revisions: { id: REV } }), input)).toEqual({
      route_workspace_id: WS,
      route_revision_id: REV,
      kit_snapshot: [{ id: 'k1', name: 'Tente' }],
    });
    // Espace non lisible : pas de lien, la sortie s'enregistre quand même.
    expect(await resolveRouteLink(reader({}), input)).toBeNull();
    // Version d'un autre espace : ignorée, l'espace reste lié.
    expect(await resolveRouteLink(reader({ route_workspaces: { id: WS } }), input)).toMatchObject({ route_workspace_id: WS, route_revision_id: null });
    // Table absente (migration pas appliquée) : pas de lien.
    expect(await resolveRouteLink(reader({ route_workspaces: { id: WS } }, 'route_workspaces'), input)).toBeNull();
    expect(await resolveRouteLink(reader({}), {})).toBeNull();
  });

  it('reconnaît une colonne absente (migration pas appliquée)', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ code: '23505' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});
