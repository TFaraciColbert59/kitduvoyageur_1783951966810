// src/features/discovery/providers/klook/klookSchemas.ts
import { z } from 'zod';

export const klookLinkConfigSchema = z.object({
  url: z.string().min(1),
  title: z.string().min(1).max(160).optional(),
  description: z.string().min(1).max(300).optional(),
});

export const klookLinksSchema = z.record(
  z.string().regex(/^[A-Za-z]{2}$/, 'Code pays ISO A2 attendu'),
  klookLinkConfigSchema
);

export type KlookLinks = z.infer<typeof klookLinksSchema>;
