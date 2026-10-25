import { z } from 'zod';
export const supportTicketSchema = z
  .object({
    subject: z.enum(['commande', 'retour', 'produit', 'compte', 'partenariat', 'autre']),
    message: z.string().trim().min(10).max(5000),
  })
  .strict();
export const supportResponseSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved']),
    response: z.string().trim().min(1).max(5000),
  })
  .strict();
