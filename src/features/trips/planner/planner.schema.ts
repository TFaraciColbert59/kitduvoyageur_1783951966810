import { z } from 'zod';

export const stepTransportModes = [
  'walking',
  'hiking',
  'car',
  'bus',
  'train',
  'flight',
  'boat',
  'bike',
  'other',
] as const;

export const createTripStepSchema = z.object({
  trip_id: z.string().uuid('ID de voyage invalide'),
  day_number: z.number().int().min(1, 'Le jour doit être au moins 1'),
  order_index: z.number().int().min(0).optional(),
  title: z.string().min(1, 'Le titre est obligatoire').max(150, 'Le titre est trop long'),
  description: z.string().max(1000).optional().nullable(),
  location_name: z.string().max(150).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accommodation_name: z.string().max(150).optional().nullable(),
  transport_mode: z.enum(stepTransportModes).optional().nullable(),
  distance_km: z.number().min(0).max(2000).optional().nullable(),
  elevation_gain_m: z.number().int().min(0).max(9000).optional().nullable(),
  elevation_loss_m: z.number().int().min(0).max(9000).optional().nullable(),
});

export const updateTripStepSchema = z.object({
  step_id: z.string().uuid('ID d’étape invalide'),
  trip_id: z.string().uuid('ID de voyage invalide'),
  day_number: z.number().int().min(1).optional(),
  order_index: z.number().int().min(0).optional(),
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  location_name: z.string().max(150).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accommodation_name: z.string().max(150).optional().nullable(),
  transport_mode: z.enum(stepTransportModes).optional().nullable(),
  distance_km: z.number().min(0).max(2000).optional().nullable(),
  elevation_gain_m: z.number().int().min(0).max(9000).optional().nullable(),
  elevation_loss_m: z.number().int().min(0).max(9000).optional().nullable(),
});

export const reorderTripStepsSchema = z.object({
  trip_id: z.string().uuid('ID de voyage invalide'),
  day_number: z.number().int().min(1, 'Le jour doit être au moins 1'),
  step_ids_in_order: z.array(z.string().uuid()).min(1, 'Au moins une étape requise'),
});

export const moveStepSchema = z.object({
  trip_id: z.string().uuid('ID de voyage invalide'),
  step_id: z.string().uuid('ID d’étape invalide'),
  from_day_number: z.number().int().min(1),
  to_day_number: z.number().int().min(1),
  target_order_index: z.number().int().min(0).optional(),
});

export const insertDaySchema = z.object({
  trip_id: z.string().uuid('ID de voyage invalide'),
  after_day_number: z.number().int().min(0),
});

export const deleteDaySchema = z.object({
  trip_id: z.string().uuid('ID de voyage invalide'),
  day_number: z.number().int().min(1),
  cascade_steps: z.boolean().default(false),
});

export const duplicateDaySchema = z.object({
  trip_id: z.string().uuid('ID de voyage invalide'),
  day_number: z.number().int().min(1),
});

export type CreateTripStepInput = z.infer<typeof createTripStepSchema>;
export type UpdateTripStepInput = z.infer<typeof updateTripStepSchema>;
export type ReorderTripStepsInput = z.infer<typeof reorderTripStepsSchema>;
export type MoveStepInput = z.infer<typeof moveStepSchema>;
export type InsertDayInput = z.infer<typeof insertDaySchema>;
export type DeleteDayInput = z.infer<typeof deleteDaySchema>;
export type DuplicateDayInput = z.infer<typeof duplicateDaySchema>;
