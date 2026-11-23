import { z } from 'zod';

/**
 * Lien d'une sortie avec la version d'itinéraire suivie et le sac emporté (9.8). Champs additifs de
 * `POST /api/hike-sessions` : absents ou invalides, la route garde exactement son comportement historique.
 * Les colonnes (`route_workspace_id`, `route_revision_id`, `kit_snapshot`) viennent de la migration route-collab ;
 * tant qu'elle n'est pas appliquée, l'écriture se refait sans elles (`isMissingColumnError`).
 */
const uuid = z.string().uuid();

const kitItemSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  category: z.string().max(80).optional(),
  weightGrams: z.number().min(0).max(100_000).nullable().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  shared: z.boolean().optional(),
  assigneeUserId: z.string().max(120).nullable().optional(),
});

export const MAX_KIT_SNAPSHOT_ITEMS = 200;

export interface RouteLinkInput {
  readonly routeWorkspaceId?: unknown;
  readonly routeRevisionId?: unknown;
  readonly kitSnapshot?: unknown;
}

export interface RouteLinkColumns {
  readonly route_workspace_id: string;
  readonly route_revision_id: string | null;
  readonly kit_snapshot: z.infer<typeof kitItemSchema>[] | null;
}

type Reader = {
  from: (table: string) => {
    select: (cols: string) => { eq: (col: string, v: string) => { eq: (col: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> }; maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
  };
};

/** Valide l'entrée ; `null` quand aucun lien exploitable n'est fourni. */
export function parseRouteLink(input: RouteLinkInput): { workspaceId: string; revisionId: string | null; kitSnapshot: RouteLinkColumns['kit_snapshot'] } | null {
  const ws = uuid.safeParse(input.routeWorkspaceId);
  if (!ws.success) return null;
  const rev = uuid.safeParse(input.routeRevisionId);
  let kit: RouteLinkColumns['kit_snapshot'] = null;
  if (Array.isArray(input.kitSnapshot)) {
    kit = [];
    for (const raw of input.kitSnapshot.slice(0, MAX_KIT_SNAPSHOT_ITEMS)) {
      const item = kitItemSchema.safeParse(raw);
      if (item.success) kit.push(item.data);
    }
  }
  return { workspaceId: ws.data, revisionId: rev.success ? rev.data : null, kitSnapshot: kit };
}

/**
 * Le lien n'est gardé que si la personne LIT l'espace (RLS) ; la version doit appartenir à cet espace, sinon
 * elle est ignorée. Une table absente ou une erreur : pas de lien, la sortie s'enregistre quand même.
 */
export async function resolveRouteLink(supabase: unknown, input: RouteLinkInput): Promise<RouteLinkColumns | null> {
  const parsed = parseRouteLink(input);
  if (!parsed) return null;
  const db = supabase as Reader;
  try {
    const ws = await db.from('route_workspaces').select('id').eq('id', parsed.workspaceId).maybeSingle();
    if (ws.error || !ws.data) return null;
    let revisionId: string | null = null;
    if (parsed.revisionId) {
      const rev = await db.from('route_revisions').select('id').eq('id', parsed.revisionId).eq('workspace_id', parsed.workspaceId).maybeSingle();
      revisionId = !rev.error && rev.data ? parsed.revisionId : null;
    }
    return { route_workspace_id: parsed.workspaceId, route_revision_id: revisionId, kit_snapshot: parsed.kitSnapshot };
  } catch {
    return null;
  }
}

/** Colonne absente (migration pas encore appliquée) : Postgres `42703`, PostgREST `PGRST204`. */
export function isMissingColumnError(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}
