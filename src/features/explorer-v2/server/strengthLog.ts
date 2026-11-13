import 'server-only';

/**
 * Contrat serveur du carnet de musculation (S2.32).
 *
 * Le client envoie l’état complet de son brouillon ; la route ne fait que
 * valider, borner et transmettre à la RPC `sync_strength_log`. Aucune valeur
 * n’est déduite : une charge absente reste `null`, jamais un poids de corps
 * inventé. Aucun import partenaire ni aucune capture ne sont lus ici.
 *
 * Le module est volontairement sans accès réseau, sans lecture
 * d’environnement et sans dépendance à React, pour rester vérifiable sur
 * fixtures lorsque les contrôles seront relancés.
 */

import { z } from 'zod';
import {
  MAX_STRENGTH_EXERCISE_NAME,
  MAX_STRENGTH_LOAD,
  MAX_STRENGTH_REPS,
  STRENGTH_CLIENT_ID_PATTERN,
  STRENGTH_LOG_VERSION,
} from '../strength/model';

export const STRENGTH_LOG_ID_PATTERN = STRENGTH_CLIENT_ID_PATTERN;
export const MAX_STRENGTH_EXERCISES = 100;
export const MAX_STRENGTH_SETS_TOTAL = 1000;
export const MIN_STRENGTH_TIMESTAMP = 946_684_800_000;
export const MAX_STRENGTH_TIMESTAMP = 4_102_444_800_000;

const idSchema = z.string().regex(STRENGTH_LOG_ID_PATTERN, 'identifiant client invalide');

const exerciseNameSchema = z
  .string()
  .max(MAX_STRENGTH_EXERCISE_NAME * 4)
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine(
    (value) => value.length >= 1 && value.length <= MAX_STRENGTH_EXERCISE_NAME,
    `le nom doit contenir entre 1 et ${MAX_STRENGTH_EXERCISE_NAME} caractères`,
  );

const setSchema = z
  .object({
    id: idSchema,
    reps: z.number().int().min(1).max(MAX_STRENGTH_REPS),
    load: z.number().finite().min(0).max(MAX_STRENGTH_LOAD).nullable(),
    unit: z.enum(['kg', 'lb']),
  })
  .strict();

const exerciseSchema = z
  .object({
    id: idSchema,
    name: exerciseNameSchema,
    sets: z.array(setSchema).max(MAX_STRENGTH_SETS_TOTAL),
  })
  .strict();

const logSchema = z
  .object({
    version: z.literal(STRENGTH_LOG_VERSION),
    id: idSchema,
    startedAt: z
      .number()
      .int()
      .min(MIN_STRENGTH_TIMESTAMP)
      .max(MAX_STRENGTH_TIMESTAMP),
    updatedAt: z
      .number()
      .int()
      .min(MIN_STRENGTH_TIMESTAMP)
      .max(MAX_STRENGTH_TIMESTAMP),
    exercises: z.array(exerciseSchema).max(MAX_STRENGTH_EXERCISES),
  })
  .strict()
  .superRefine((log, ctx) => {
    const exerciseIds = new Set<string>();
    let totalSets = 0;

    log.exercises.forEach((exercise, exerciseIndex) => {
      if (exerciseIds.has(exercise.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', exerciseIndex, 'id'],
          message: 'identifiant d’exercice dupliqué',
        });
      }
      exerciseIds.add(exercise.id);

      const setIds = new Set<string>();
      exercise.sets.forEach((set, setIndex) => {
        if (setIds.has(set.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['exercises', exerciseIndex, 'sets', setIndex, 'id'],
            message: 'identifiant de série dupliqué dans l’exercice',
          });
        }
        setIds.add(set.id);
      });
      totalSets += exercise.sets.length;
    });

    if (totalSets > MAX_STRENGTH_SETS_TOTAL) {
      ctx.addIssue({
        code: 'custom',
        path: ['exercises'],
        message: `le carnet ne peut pas dépasser ${MAX_STRENGTH_SETS_TOTAL} séries`,
      });
    }
  });

const bodySchema = z
  .object({
    log: logSchema,
    /** Séance d’activité facultative, propriétaire, jamais déduite du client. */
    activitySessionId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type StrengthLogBody = z.infer<typeof bodySchema>;

export type StrengthLogParseResult =
  | { ok: true; value: StrengthLogBody }
  | { ok: false; error: string };

/** Valide le corps fermé ; toute clé inconnue est refusée. */
export function parseStrengthLogBody(input: unknown): StrengthLogParseResult {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'carnet invalide' };
  }
  return { ok: true, value: parsed.data };
}

/** Corps exact attendu par la RPC `sync_strength_log`. */
export function buildSyncStrengthLogRpcBody(value: StrengthLogBody): {
  p_log: StrengthLogBody['log'];
  p_activity_session_id: string | null;
} {
  return {
    p_log: value.log,
    p_activity_session_id: value.activitySessionId ?? null,
  };
}
