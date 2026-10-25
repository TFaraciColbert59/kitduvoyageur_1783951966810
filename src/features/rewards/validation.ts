import { z } from 'zod';

/**
 * Validation des corps des routes récompenses (pure, sans IO).
 * Le client ne fournit jamais de points, de prix ni d'identité.
 */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const goalBodySchema = z.object({ rewardId: uuid }).strict();

export const redeemBodySchema = z
  .object({
    rewardId: uuid,
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  })
  .strict();

/**
 * Retrait cash legacy (droits acquis) : montant en euros à deux décimales au
 * plus, fournisseur fermé, coordonnées bornées. IBAN/BIC/e-mail ne sont ni
 * journalisés ni renvoyés.
 */
export const withdrawBodySchema = z
  .object({
    amount: z.number().finite().positive().max(100_000).refine((v) => Math.round(v * 100) === v * 100, 'deux_decimales'),
    payment_provider: z.enum(['bank_transfer', 'paypal']).default('bank_transfer'),
    idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    metadata: z
      .object({
        iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/).optional(),
        bic: z.string().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/).optional(),
        paypal_email: z.string().email().max(254).optional(),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.payment_provider === 'bank_transfer' && (!value.metadata.iban || !value.metadata.bic)) {
      ctx.addIssue({ code: 'custom', message: 'coordonnees_bancaires', path: ['metadata'] });
    }
    if (value.payment_provider === 'paypal' && !value.metadata.paypal_email) {
      ctx.addIssue({ code: 'custom', message: 'email_paypal', path: ['metadata'] });
    }
  });

export type GoalBody = z.infer<typeof goalBodySchema>;
export type RedeemBody = z.infer<typeof redeemBodySchema>;
export type WithdrawBody = z.infer<typeof withdrawBodySchema>;
