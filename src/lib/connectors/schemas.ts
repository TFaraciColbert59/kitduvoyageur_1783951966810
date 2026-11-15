import { z } from 'zod';

import { PARTNER_PROVIDER_IDS, type PartnerProviderId } from '@/features/connectors';

export const providerIdSchema = z.enum(PARTNER_PROVIDER_IDS);

export function parseProviderId(value: string): PartnerProviderId | null {
  return (PARTNER_PROVIDER_IDS as readonly string[]).includes(value)
    ? (value as PartnerProviderId)
    : null;
}

const waypointSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(0).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  elevationMeters: z.number().finite().optional(),
  distanceFromStartMeters: z.number().finite().min(0),
  category: z.enum([
    'summit',
    'col_pass',
    'water_source',
    'refuge_food',
    'danger',
    'turn_left',
    'turn_right',
    'continue_straight',
    'first_aid',
    'viewpoint',
    'camping',
    'custom',
  ]),
  description: z.string().max(500).optional(),
  approachAlertMeters: z.number().finite().min(0).optional(),
});

const climbSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  startDistanceMeters: z.number().finite().min(0),
  endDistanceMeters: z.number().finite().min(0),
  lengthMeters: z.number().finite().min(0),
  elevationGainMeters: z.number().finite().min(0),
  averageGradePercent: z.number().finite(),
  category: z.enum(['hc', 'cat_1', 'cat_2', 'cat_3', 'cat_4', 'unclassified']),
});

const maneuverSchema = z.object({
  id: z.string().min(1).max(120),
  distanceFromStartMeters: z.number().finite().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  direction: z.enum([
    'left',
    'slight_left',
    'sharp_left',
    'right',
    'slight_right',
    'sharp_right',
    'straight',
    'uturn',
  ]),
  instruction: z.string().min(1).max(200),
});

export const canonicalRouteSchema = z.object({
  routeId: z.string().min(1).max(200),
  revision: z.number().int().min(1).max(1_000_000),
  title: z.string().min(1).max(200),
  sportType: z.enum([
    'hiking',
    'trail_running',
    'road_cycling',
    'gravel_cycling',
    'mtb',
    'mountaineering',
    'ski_touring',
  ]),
  totalDistanceMeters: z.number().finite().min(0),
  elevationGainMeters: z.number().finite().min(0),
  elevationLossMeters: z.number().finite().min(0),
  coordinates: z
    .array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().finite().optional()]))
    .min(2)
    .max(100_000),
  waypoints: z.array(waypointSchema).max(2_000),
  climbs: z.array(climbSchema).max(500).optional(),
  maneuvers: z.array(maneuverSchema).max(5_000).optional(),
});

export const routeSendBodySchema = z.object({
  providerId: providerIdSchema,
  deviceModelId: z.string().min(1).max(120).optional(),
  route: canonicalRouteSchema,
});

export const oauthStartBodySchema = z
  .object({
    returnTo: z.string().max(500).optional(),
  })
  .strict();
