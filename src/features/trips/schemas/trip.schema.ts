import { z } from 'zod';
import type { TripRole, TripPermissions } from '../types/trip.types';

export const tripStatusEnum = z.enum([
  'draft',
  'planned',
  'active',
  'completed',
  'cancelled',
]);

export const tripVisibilityEnum = z.enum(['private', 'unlisted', 'public']);

export const tripCollaboratorRoleEnum = z.enum(['owner', 'editor', 'viewer']);

export const tripActivityTypeEnum = z.enum([
  'hiking',
  'trekking',
  'bivouac',
  'roadtrip',
  'cultural',
  'bushcraft',
  'mixed',
]);

export const tripDifficultyEnum = z.enum([
  'easy',
  'moderate',
  'hard',
  'expert',
]);

export const tripItemStatusEnum = z.enum([
  'packed',
  'needed',
  'optional',
  'missing',
]);

export const tripBudgetCurrencyEnum = z.enum([
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'JPY',
]);

export const tripDocumentCategoryEnum = z.enum([
  'passport',
  'insurance',
  'booking',
  'ticket',
  'medical',
  'other',
]);

export const tripStepTransportEnum = z.enum([
  'foot',
  'car',
  'bus',
  'train',
  'plane',
  'boat',
  'bike',
  'other',
]);

/**
 * Objet de base pour un voyage (sans refinements pour autoriser partial)
 */
export const baseTripSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Le titre doit comporter au moins 3 caractères')
    .max(120, 'Le titre ne peut pas dépasser 120 caractères'),
  description: z.string().trim().max(2000).nullable().optional(),
  destination_country_code: z
    .string()
    .trim()
    .length(2, 'Le code pays doit être au format ISO A2 (2 lettres)')
    .regex(/^[A-Za-z]{2}$/, 'Le code pays doit comporter 2 lettres')
    .toUpperCase()
    .nullable()
    .optional(),
  destination_name: z.string().trim().max(150).nullable().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)')
    .nullable()
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)')
    .nullable()
    .optional(),
  status: tripStatusEnum.default('draft').optional(),
  visibility: tripVisibilityEnum.default('private').optional(),
  difficulty: tripDifficultyEnum.default('moderate').optional(),
  primary_activity: tripActivityTypeEnum.default('hiking').optional(),
  estimated_budget: z
    .number()
    .min(0, 'Le budget estimé ne peut pas être négatif')
    .nullable()
    .optional(),
  budget_currency: tripBudgetCurrencyEnum.default('EUR').optional(),
  cover_image_url: z.string().url().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schéma de création d'un voyage
 */
export const createTripSchema = baseTripSchema.refine(
  data => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'La date de fin doit être postérieure ou égale à la date de début',
    path: ['end_date'],
  }
);

export type CreateTripInput = z.infer<typeof createTripSchema>;

/**
 * Schéma de mise à jour d'un voyage
 */
export const updateTripSchema = baseTripSchema
  .partial()
  .refine(
    data => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) >= new Date(data.start_date);
      }
      return true;
    },
    {
      message: 'La date de fin doit être postérieure ou égale à la date de début',
      path: ['end_date'],
    }
  );

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

/**
 * Schéma d'une étape de voyage
 */
export const tripStepSchema = z.object({
  trip_id: z.string().uuid(),
  day_number: z.number().int().min(1, 'Le jour doit être supérieur ou égal à 1'),
  order_index: z.number().int().min(0).default(0),
  title: z.string().trim().min(1, 'Le titre de l’étape est requis').max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  location_name: z.string().trim().max(150).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  accommodation_name: z.string().trim().max(150).nullable().optional(),
  transport_mode: tripStepTransportEnum.nullable().optional(),
  distance_km: z.number().min(0).nullable().optional(),
  elevation_gain_m: z.number().int().min(0).nullable().optional(),
  elevation_loss_m: z.number().int().min(0).nullable().optional(),
});

export type TripStepInput = z.infer<typeof tripStepSchema>;

/**
 * Schéma d'un item / matériel de voyage
 */
export const tripItemSchema = z.object({
  trip_id: z.string().uuid(),
  item_name: z.string().trim().min(1, 'Le nom de l’équipement est requis').max(150),
  category: z.string().trim().max(80).nullable().optional(),
  quantity: z.number().int().min(1, 'La quantité minimale est 1').default(1),
  weight_grams: z.number().min(0).nullable().optional(),
  is_packed: z.boolean().default(false).optional(),
  status: tripItemStatusEnum.default('needed').optional(),
  packed_by: z.string().uuid().nullable().optional(),
  inventory_item_id: z.string().uuid().nullable().optional(),
  affiliate_link_id: z.string().uuid().nullable().optional(),
});

export type TripItemInput = z.infer<typeof tripItemSchema>;

/**
 * Schéma d'une dépense de voyage
 */
export const tripExpenseSchema = z.object({
  trip_id: z.string().uuid(),
  payer_id: z.string().uuid(),
  title: z.string().trim().min(1, 'La description est requise').max(150),
  amount: z.number().positive('Le montant doit être supérieur à zéro'),
  currency: tripBudgetCurrencyEnum.default('EUR').optional(),
  category: z.string().trim().max(80).nullable().optional(),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)')
    .default(() => new Date().toISOString().split('T')[0]),
  split_type: z.enum(['equal', 'custom', 'individual']).default('equal'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TripExpenseInput = z.infer<typeof tripExpenseSchema>;

/**
 * Schéma d'un document de voyage
 */
export const tripDocumentSchema = z.object({
  trip_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().trim().min(1, 'Le titre du document est requis').max(150),
  category: tripDocumentCategoryEnum.default('other').optional(),
  file_url: z.string().url('URL du fichier invalide'),
  file_name: z.string().trim().max(255).nullable().optional(),
  file_size_bytes: z.number().int().min(0).nullable().optional(),
  mime_type: z.string().trim().max(100).nullable().optional(),
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)')
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type TripDocumentInput = z.infer<typeof tripDocumentSchema>;

/**
 * Schéma d'un POI de voyage
 */
export const tripPoiSchema = z.object({
  trip_id: z.string().uuid(),
  step_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Le nom du point d’intérêt est requis').max(150),
  category: z.string().trim().max(80).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  visited: z.boolean().default(false).optional(),
  osm_id: z.string().trim().max(100).nullable().optional(),
});

export type TripPoiInput = z.infer<typeof tripPoiSchema>;

/**
 * Schéma d'un checkpoint de sécurité
 */
export const tripSafetyCheckpointSchema = z.object({
  trip_id: z.string().uuid(),
  label: z.string().trim().min(1, 'Le libellé est requis').max(150),
  scheduled_at: z.string().datetime(),
  checked_at: z.string().datetime().nullable().optional(),
  contact_phone: z.string().trim().max(30).nullable().optional(),
  contact_name: z.string().trim().max(100).nullable().optional(),
  status: z.enum(['pending', 'checked', 'missed', 'alert_sent']).default('pending'),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type TripSafetyCheckpointInput = z.infer<typeof tripSafetyCheckpointSchema>;

/**
 * Schéma d'une note de voyage
 */
export const tripNoteSchema = z.object({
  trip_id: z.string().uuid(),
  author_id: z.string().uuid(),
  title: z.string().trim().max(150).nullable().optional(),
  content: z.string().trim().min(1, 'Le contenu de la note ne peut pas être vide'),
  day_number: z.number().int().min(1).nullable().optional(),
  is_pinned: z.boolean().default(false).optional(),
});

export type TripNoteInput = z.infer<typeof tripNoteSchema>;

/**
 * Schéma de filtrage des voyages (URL search params)
 */
export const tripFiltersSchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .union([tripStatusEnum, z.literal('all')])
    .default('all')
    .optional(),
  difficulty: z
    .union([tripDifficultyEnum, z.literal('all')])
    .default('all')
    .optional(),
  activity: z
    .union([tripActivityTypeEnum, z.literal('all')])
    .default('all')
    .optional(),
  destination: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12).optional(),
  sort_by: z.enum(['start_date', 'created_at', 'title']).default('created_at').optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type TripFiltersInput = z.infer<typeof tripFiltersSchema>;

/**
 * Helper pur de calcul des permissions utilisateur pour un voyage
 */
export function computeTripPermissions(role?: TripRole | null): TripPermissions {
  if (!role) {
    return {
      canEdit: false,
      canDelete: false,
      canInvite: false,
      canManageBudget: false,
      canViewDocuments: false,
    };
  }

  switch (role) {
    case 'owner':
      return {
        canEdit: true,
        canDelete: true,
        canInvite: true,
        canManageBudget: true,
        canViewDocuments: true,
      };
    case 'editor':
      return {
        canEdit: true,
        canDelete: false,
        canInvite: false,
        canManageBudget: true,
        canViewDocuments: true,
      };
    case 'viewer':
    default:
      return {
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canManageBudget: false,
        canViewDocuments: false,
      };
  }
}
