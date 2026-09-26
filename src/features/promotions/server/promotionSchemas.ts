import { z } from 'zod';

/**
 * Validation des entrees du cycle de vie `model_promotions` (evaluate -> promote).
 *
 * Miroir strict des contraintes SQL de `20260926050000_model_promotions_lifecycle.sql` :
 *   - `model_version` : `^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$` (CHECK SQL)
 *   - `score`          : `0 <= score <= 1`                (CHECK SQL)
 *   - `evidence`       : objet JSON                      (CHECK SQL)
 *
 * L'evidence est bornee en profondeur et en taille : une charge arbitraire
 * (payload volumineux, cles secretes par erreur) est refusee avant tout acces
 * base. Le secrement est traite separement, jamais par troncature silencieuse.
 */

/** Meme regex que le CHECK SQL `model_promotions_version_chk`. */
export const MODEL_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$/;

const MAX_EVIDENCE_BYTES = 16 * 1024;
const MAX_EVIDENCE_DEPTH = 4;
const MAX_EVIDENCE_KEYS = 64;

export const modelVersionSchema = z
  .string()
  .trim()
  .min(2, 'Version de modèle trop courte.')
  .max(120, 'Version de modèle trop longue.')
  .regex(MODEL_VERSION_PATTERN, 'Version de modèle invalide.');

export const promotionScoreSchema = z
  .number({ message: 'Score numérique attendu.' })
  .min(0, 'Score hors bornes (0..1).')
  .max(1, 'Score hors bornes (0..1).');

/** Evidence : objet JSON borne (le CHECK SQL exige `jsonb_typeof = 'object'`). */
export const promotionEvidenceSchema = z
  .record(z.string().min(1).max(80), z.unknown())
  .superRefine((value, context) => {
    const keys = Object.keys(value);
    if (keys.length > MAX_EVIDENCE_KEYS) {
      context.addIssue({ code: 'custom', message: 'Evidence trop riche en clés.' });
      return;
    }
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_EVIDENCE_BYTES) {
      context.addIssue({ code: 'custom', message: 'Evidence trop volumineuse.' });
      return;
    }
    if (depthOf(value) > MAX_EVIDENCE_DEPTH) {
      context.addIssue({ code: 'custom', message: 'Evidence trop imbriquée.' });
    }
  });

// `.strict()` : une cle inconnue est une faute de frappe, pas un champ a
// ignorer silencieusement. Zod `strip` par defaut accepterait `{ modelVersion,
// score: 1 }` sur /promote et renverrait 200 au lieu de 400.
export const evaluatePromotionRequestSchema = z
  .object({
    modelVersion: modelVersionSchema,
    score: promotionScoreSchema,
    evidence: promotionEvidenceSchema,
    promote: z.boolean().optional().default(false),
  })
  .strict();

export const promoteModelRequestSchema = z
  .object({
    modelVersion: modelVersionSchema,
  })
  .strict();

export type EvaluatePromotionRequest = z.input<typeof evaluatePromotionRequestSchema>;
export type PromoteModelRequest = z.input<typeof promoteModelRequestSchema>;

/** Profondeur d'un objet JSON, bornee pour ne pas traverser un graphe enorme. */
function depthOf(value: unknown, current = 1): number {
  if (current > MAX_EVIDENCE_DEPTH + 1) return current;
  if (value === null || typeof value !== 'object') return current;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  let deepest = current;
  for (const child of children) {
    deepest = Math.max(deepest, depthOf(child, current + 1));
    if (deepest > MAX_EVIDENCE_DEPTH + 1) break;
  }
  return deepest;
}
