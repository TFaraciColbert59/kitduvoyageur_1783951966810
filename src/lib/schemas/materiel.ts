import { z } from 'zod';

/** Schémas Zod pour Mon Matériel — validation stricte côté serveur (charte LKDV). */

export const categorySchema = z.enum([
  'Sacs & Portage',
  'Couchage & Tentes',
  'Vêtements & Vestes',
  'Cuisine & Réchauds',
  'Eau & Filtres',
  'Lampes & Éclairage',
  'Navigation & GPS',
  'Sécurité & Soins',
  'Accessoires & Outils',
  'Autre',
]);

export const conditionSchema = z.enum(['neuf', 'bon', 'use', 'a_remplacer', 'pour_pieces']);

export const seasonSchema = z.enum(['printemps', 'ete', 'automne', 'hiver', 'toute_saison']);

export const alertTypeSchema = z.enum([
  'entretien', 'peremption', 'pret', 'etat', 'conflit', 'meteo', 'reglementation',
]);

export const alertSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const loanStatusSchema = z.enum(['en_cours', 'rendu', 'en_retard', 'litige']);

export const sharePermissionSchema = z.enum(['lecture', 'fork', 'co_edition']);

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)').nullable().optional();

/** Objet d'inventaire personnel (table product_ownership). */
export const productOwnershipSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(120),
  brand: z.string().max(80).nullable().optional(),
  category: categorySchema.default('Autre'),
  weight_g: z.number().int().min(0).max(50000).default(0),
  price_cents: z.number().int().min(0).max(100000000).nullable().optional(),
  purchase_date: dateString,
  condition: conditionSchema.default('bon'),
  photo_url: z.string().url('URL d’image invalide').nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  is_lent: z.boolean().default(false),
  maintenance_due_at: dateString,
  expiry_date: dateString,
  tags: z.array(z.string().max(40)).max(20).nullable().optional(),
});

export type ProductOwnershipInput = z.infer<typeof productOwnershipSchema>;

/** Article de kit utilisateur (table materiel_kit_items). */
export const materielKitItemSchema = z.object({
  product_ownership_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Le nom de l’article est requis').max(120),
  category: categorySchema.default('Autre'),
  weight_g: z.number().int().min(0).max(50000).default(0),
  quantity: z.number().int().min(1).max(999).default(1),
  is_checked: z.boolean().default(false),
});

/** Kit utilisateur (table materiel_kits). */
export const materielKitSchema = z.object({
  name: z.string().min(1, 'Le nom du kit est requis').max(120),
  description: z.string().max(1000).nullable().optional(),
  season: seasonSchema.nullable().optional(),
  total_weight_g: z.number().int().min(0).max(1000000).default(0),
  is_public: z.boolean().default(false),
  is_favorite: z.boolean().default(false),
  is_trashed: z.boolean().default(false),
  cover_image_url: z.string().url('URL d’image invalide').nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).nullable().optional(),
  consumables: z.record(z.string(), z.number()).optional(),
  items: z.array(materielKitItemSchema).max(200, 'Un kit ne peut contenir plus de 200 articles.'),
});

export type MaterielKitInput = z.infer<typeof materielKitSchema>;

/** Prêt d'objet (table materiel_loans). */
export const materielLoanSchema = z.object({
  product_ownership_id: z.string().uuid('Identifiant d’objet invalide'),
  borrower_contact: z.string().min(1, 'Contact de l’emprunteur requis').max(160),
  status: loanStatusSchema.default('en_cours'),
  due_date: dateString,
});

/** Alerte (table alerts). */
export const alertSchema = z.object({
  product_ownership_id: z.string().uuid().nullable().optional(),
  type: alertTypeSchema,
  severity: alertSeveritySchema.default('warning'),
  message: z.string().min(1).max(500),
  due_at: z.string().datetime().nullable().optional(),
});

export const shareSchema = z.object({
  kit_id: z.string().uuid('Identifiant de kit invalide'),
  permission: sharePermissionSchema.default('lecture'),
  expires_in_days: z.number().int().min(1).max(365).default(7),
});

export const participantSchema = z.object({
  kit_id: z.string().uuid('Identifiant de kit invalide'),
  name: z.string().min(1, 'Nom requis').max(80),
  is_emergency_contact: z.boolean().default(false),
  contact: z.string().max(160).nullable().optional(),
});

export const exportSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf', 'gpx']),
  scope: z.enum(['inventory', 'kit']),
  kit_id: z.string().uuid().nullable().optional(),
});

export const optimizeRequestSchema = z.object({
  kit_id: z.string().uuid().nullable().optional(),
  goal: z.string().max(400).optional().default('alléger le kit'),
  target_kg: z.number().min(1).max(50).nullable().optional(),
  items: z.array(
    z.object({
      name: z.string(),
      category: z.string().nullable().optional(),
      weight_g: z.number().optional().default(0),
      quantity: z.number().optional().default(1),
    })
  ).optional(),
});

export const scanRequestSchema = z.object({
  image_data_url: z.string().min(1, 'Image manquante'),
});

export const conflictsRequestSchema = z.object({
  departure_id: z.string().uuid().nullable().optional(),
});
