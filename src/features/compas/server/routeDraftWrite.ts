import 'server-only';
import { z } from 'zod';
import { MAX_ROUTE_WAYPOINTS } from '@/features/adventure-prep/routeProfiles';
import { compasMeta, updateTripMetadata, type Supa, type TripMetadataWriteResult } from './compasServer';

/**
 * Écrivain UNIQUE de `trips.metadata.compas.routeDraft` (P4 / 10.1 « un seul tracé par voyage »).
 *
 * Deux appelants, une seule écriture, la même validation :
 *  - `compasSaveRouteDraftAction` (l'éditeur de tracé du Compas) ;
 *  - la synchronisation depuis la version PUBLIÉE de l'itinéraire collaboratif
 *    (`route-collab/server/publishedRoute.ts`), qui est la source de vérité quand elle existe.
 *
 * Aucune migration : le contrat vit dans `trips.metadata`, protégé par `can_edit_trip` (RLS) ; l'appelant
 * vérifie le droit d'édition (`requireEditor`) avant d'appeler.
 */

const routeCoordinate = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const routeEditorPointSchema = z.object({
  id: z.string().min(1).max(40),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  kind: z.enum(['start', 'via', 'end']),
  // Facultatifs : un point nommé (refuge, col…) garde son nom, sa nature et sa note jusqu'à l'atelier
  // d'itinéraire (le routeDraft d'une version publiée les porte ; `readRouteDraft` les revalide en lecture).
  name: z.string().max(80).nullish(),
  semanticKind: z.string().max(24).optional(),
  note: z.string().max(280).nullish(),
  shared: z.boolean().optional(),
  poiId: z.string().max(80).nullish(),
});

const routeSectionSchema = z.object({
  id: z.string().min(1).max(80),
  mode: z.enum(['routed', 'manual']),
  fromIndex: z.number().int().min(0).max(MAX_ROUTE_WAYPOINTS - 2),
  toIndex: z.number().int().min(1).max(MAX_ROUTE_WAYPOINTS - 1),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(routeCoordinate).min(2).max(20_000),
  }),
  distanceKm: z.number().min(0).max(1_000_000),
  durationMin: z.number().min(0).max(10_000_000).nullable(),
  provider: z.string().max(40).nullable(),
});

export const routeDraftSchema = z
  .object({
    id: z.string().min(1).max(80),
    version: z.number().int().min(1).max(10_000),
    sport: z.enum(['marche', 'route', 'gravel', 'vtt', 'enduro']),
    engine: z.string().min(1).max(80),
    savedAt: z.string().min(1).max(40),
    points: z.array(routeEditorPointSchema).min(2).max(MAX_ROUTE_WAYPOINTS),
    geometry: z.object({
      type: z.literal('LineString'),
      coordinates: z.array(routeCoordinate).min(2).max(20_000),
    }),
    // Facultatif : un client d'avant K2.14 n'en envoie pas. Quand il est
    // présent, le découpage doit couvrir exactement les paires de points.
    sections: z.array(routeSectionSchema).max(MAX_ROUTE_WAYPOINTS - 1).optional(),
    distanceKm: z.number().min(0).max(1_000_000).nullable(),
    durationMin: z.number().min(0).max(10_000_000).nullable(),
    provider: z.string().max(40).nullable(),
    warnings: z.array(z.string().max(200)).max(10),
  })
  .superRefine((draft, ctx) => {
    const sections = draft.sections;
    if (!sections) return;
    if (sections.length !== draft.points.length - 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'sections_incomplete',
      });
    }
    for (const [index, section] of sections.entries()) {
      if (section.fromIndex !== index || section.toIndex !== index + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', index],
          message: 'section_not_consecutive',
        });
      }
      if (section.fromIndex >= draft.points.length - 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', index, 'fromIndex'],
          message: 'section_out_of_range',
        });
      }
    }
  });


export type RouteDraftInput = z.infer<typeof routeDraftSchema>;

/** Valide un brouillon de tracé (même schéma que l'éditeur). `null` si invalide. */
export function parseRouteDraft(input: unknown): RouteDraftInput | null {
  const parsed = routeDraftSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/**
 * Écrit `compas.routeDraft` sans écraser une écriture concurrente (`updateTripMetadata`). `provenance`
 * (facultatif) est consignée dans `compas.routeSource` : d'où vient le tracé (`explorer_route`,
 * `itineraire_publie`…), jamais de coordonnée.
 */
export async function writeTripRouteDraft(
  supabase: Supa,
  tripId: string,
  draft: RouteDraftInput,
  provenance?: { kind: string; id?: string | null; name?: string | null },
): Promise<TripMetadataWriteResult> {
  return updateTripMetadata(supabase, tripId, (meta) => {
    const compas = compasMeta(meta);
    return {
      ...meta,
      compas: {
        ...compas,
        routeDraft: draft,
        ...(provenance
          ? {
              routeSource: {
                kind: provenance.kind.slice(0, 40),
                ...(provenance.id ? { id: provenance.id.slice(0, 80) } : {}),
                ...(provenance.name ? { name: provenance.name.slice(0, 120) } : {}),
              },
            }
          : {}),
      },
    };
  });
}
