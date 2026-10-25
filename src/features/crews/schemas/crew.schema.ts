import { z } from 'zod';

export const crewVisibilityEnum = z.enum(['private', 'link', 'public']);
export const crewRoleEnum = z.enum(['owner', 'organizer', 'member', 'guest']);
export const crewMemberStatusEnum = z.enum(['active', 'pending', 'left', 'removed']);

export const createCrewSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(80, '80 caractères maximum'),
  slug: z
    .string()
    .min(3, 'Le slug doit contenir au moins 3 caractères')
    .max(80, '80 caractères maximum')
    .regex(/^[a-z0-9-]+$/, 'Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets')
    .optional(),
  description: z.string().max(500, '500 caractères maximum').optional().nullable(),
  theme: z.string().default('Trek'),
  visibility: crewVisibilityEnum.default('private'),
  max_members: z.coerce.number().int().min(2).max(200).default(12),
  cover_url: z.string().url().optional().nullable(),
});

export const updateCrewSchema = createCrewSchema.partial();

export const joinCrewCodeSchema = z.object({
  code: z
    .string()
    .min(4, 'Code trop court')
    .max(16, 'Code trop long')
    .regex(/^[A-Z0-9-]+$/, 'Code composé de lettres majuscules, chiffres ou tirets'),
  consent: z.boolean().default(true),
});

export const inviteCrewMemberSchema = z.object({
  email: z.string().email('Adresse email invalide').optional(),
  userId: z.string().uuid('Identifiant utilisateur invalide').optional(),
  role: crewRoleEnum.default('member'),
}).refine(data => Boolean(data.email || data.userId), {
  message: "Veuillez renseigner un email ou un identifiant d'utilisateur",
});

export type CreateCrewInput = z.infer<typeof createCrewSchema>;
export type UpdateCrewInput = z.infer<typeof updateCrewSchema>;
export type JoinCrewCodeInput = z.infer<typeof joinCrewCodeSchema>;
export type InviteCrewMemberInput = z.infer<typeof inviteCrewMemberSchema>;
