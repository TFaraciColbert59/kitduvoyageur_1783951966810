/**
 * « Reprendre le tracé » depuis un carnet (9.10) : `/compas/itineraire?trip=…&from=carnet&carnetId=…`.
 * Pur : la lecture du carnet se fait côté serveur, sous RLS et avec les masques du lecteur
 * (`server/loadCarnetReplay.ts`). Le tracé repris devient un brouillon indépendant, provenance `activity_replay`.
 */
import { z } from 'zod';
import { parseGeoJsonTrace } from '@/features/community/v2/create/carnet/gpx';
import type { CatalogTrack } from './startBuilders';
import { startFromCatalogTrack } from './startBuilders';
import { adoptGuestWorkspace } from './guestDraft';
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import type { RouteWorkspaceState } from './types';

const carnetIdSchema = z.string().uuid();

type Raw = Readonly<Record<string, string | readonly string[] | undefined>>;

/** `?from=carnet&carnetId=<uuid>` ; tout autre cas (absent, illisible) donne `null`, jamais une valeur corrigée. */
export function parseCarnetReplayParams(raw: Raw): { carnetId: string } | null {
  const first = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : typeof v === 'string' ? v : undefined;
  };
  if (first('from')?.trim() !== 'carnet') return null;
  const parsed = carnetIdSchema.safeParse(first('carnetId')?.trim());
  return parsed.success ? { carnetId: parsed.data } : null;
}

/** Ce que la page transmet à l'atelier : sérialisable, sans coordonnée hors du tracé que le lecteur a le droit de voir. */
export interface CarnetReplay {
  readonly carnetId: string;
  readonly title: string;
  readonly coordinates: ReadonlyArray<readonly [number, number]>;
  /** Vrai si le lecteur voit une trace masquée (zone de départ) : annoncé. */
  readonly traceMasked: boolean;
}

export type CarnetReplayState =
  | { readonly status: 'none' }
  | { readonly status: 'ok'; readonly replay: CarnetReplay; readonly tripId: string | null }
  | { readonly status: 'not_found' | 'no_trace' | 'error' };

export function carnetTraceCoordinates(raw: unknown): [number, number][] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const out: [number, number][] = [];
    for (const p of raw) {
      if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') out.push([p[0], p[1]]);
    }
    return out;
  }
  const source = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return parseGeoJsonTrace(source).map((c) => [c[0], c[1]] as [number, number]);
}

export function carnetReplayNote(state: CarnetReplayState): string | null {
  if (state.status === 'not_found') return 'Carnet introuvable ou privé : l’itinéraire s’ouvre sans reprise.';
  if (state.status === 'no_trace') return 'Ce carnet n’a pas de tracé exploitable : l’itinéraire s’ouvre sans reprise.';
  if (state.status === 'error') return 'Le carnet n’a pas pu être lu pour l’instant : l’itinéraire s’ouvre sans reprise.';
  return null;
}

/**
 * Brouillon indépendant à partir du carnet : provenance `activity_replay` (id et titre du carnet, jamais de
 * coordonnée dans la provenance), rattaché au voyage d'entrée s'il y en a un. Identifiant propre (`ws-local-…`) :
 * un voyage qui a déjà un itinéraire n'est pas écrasé, la reprise en crée un autre.
 */
export function buildCarnetReplayWorkspace(
  replay: CarnetReplay,
  who: { userId: string; userName: string; tripId: string | null; sport: RouteSport; nowIso: string; idSeed: string },
): RouteWorkspaceState | null {
  const track: CatalogTrack = { id: `carnet-${replay.carnetId}`, kind: 'carnet', title: replay.title, coordinates: replay.coordinates };
  const built = startFromCatalogTrack(
    { trip: null, userId: who.userId, userName: who.userName, nowIso: who.nowIso, idSeed: who.idSeed },
    track,
    'activity',
    { sport: who.sport },
  );
  if (!built.ok) return null;
  const ws: RouteWorkspaceState = {
    ...built.workspace,
    sourceOrigin: {
      ...built.workspace.sourceOrigin,
      attribution: `Repris depuis le carnet « ${replay.title.slice(0, 80)} »${replay.traceMasked ? ' (zone de départ masquée)' : ''}`,
    },
  };
  return who.tripId ? adoptGuestWorkspace(ws, { userId: who.userId, userName: who.userName, tripId: who.tripId }) : ws;
}
