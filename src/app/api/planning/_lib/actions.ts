/**
 * Exécution des actions de planification.
 *
 * Chaque action est un calcul pur appliqué au payload reçu. Aucun plan, partage
 * ou bulletin n'est écrit ici : les routes sont volontairement sans état pour
 * rester utilisables par un écran, un test ou un adaptateur de stockage.
 */

import { z } from 'zod';
import {
  anchorStageToLodging,
  commitStageBoundaryMove,
  createPlanShare,
  evaluatePlanWeather,
  evaluateShareAccessP01,
  findOptimalWindows,
  getStageLaunchReadiness,
  previewStageBoundaryMove,
  revokePlanShare,
  searchMultiDayPlans,
  splitRouteIntoDays,
  type AnchorLodgingResult,
  type BoundaryMoveResult,
  type ShareCreationResult,
} from '@/features/planning';
import {
  anchorLodgingPayloadSchema,
  boundaryCommitPayloadSchema,
  boundaryPreviewPayloadSchema,
  searchPayloadSchema,
  shareAccessPayloadSchema,
  shareCreatePayloadSchema,
  shareRevokePayloadSchema,
  splitPayloadSchema,
  stageLaunchPayloadSchema,
  weatherEvaluatePayloadSchema,
  weatherWindowsPayloadSchema,
} from './schemas';

export const PLANNING_ACTIONS = [
  'search',
  'split',
  'boundary.preview',
  'boundary.commit',
  'lodging.anchor',
  'weather.evaluate',
  'weather.windows',
  'shares.create',
  'shares.revoke',
  'shares.access',
  'stages.launch',
] as const;

export type PlanningAction = (typeof PLANNING_ACTIONS)[number];

export interface ActionResponse {
  status: number;
  body: unknown;
}

export function isPlanningAction(value: string): value is PlanningAction {
  return (PLANNING_ACTIONS as readonly string[]).includes(value);
}

function invalidRequest(error: z.ZodError): ActionResponse {
  return {
    status: 400,
    body: {
      error: 'invalid_request',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    },
  };
}

function contractError(error: unknown): ActionResponse {
  const message = error instanceof Error ? error.message : 'Erreur de contrat de planification.';
  return { status: 422, body: { error: 'contract_error', message } };
}

function boundaryStatus(result: BoundaryMoveResult): number {
  if (result.ok) return 200;
  return result.reason === 'revision_conflict' ? 409 : 422;
}

function lodgingStatus(result: AnchorLodgingResult): number {
  if (result.ok) return 200;
  return result.reason === 'revision_conflict' ? 409 : 422;
}

function shareCreationStatus(result: ShareCreationResult): number {
  if (result.ok) return 201;
  switch (result.reason) {
    case 'forbidden_not_owner':
      return 403;
    case 'consent_missing_p01':
      return 409;
    case 'invalid_expiration':
      return 422;
    default:
      return 422;
  }
}

/**
 * Applique une action de planification. Les erreurs de validation sont 400,
 * les refus métier gardent leur statut propre (403/409/422) et les calculs
 * valides répondent 200/201.
 */
export function executePlanningAction(action: string, input: unknown): ActionResponse {
  if (!isPlanningAction(action)) {
    return {
      status: 404,
      body: { error: 'unknown_action', actions: PLANNING_ACTIONS },
    };
  }

  try {
    switch (action) {
      case 'search': {
        const payload = searchPayloadSchema.parse(input);
        return {
          status: 200,
          body: searchMultiDayPlans(payload.plans, payload.query, payload.viewer),
        };
      }

      case 'split': {
        const payload = splitPayloadSchema.parse(input);
        return {
          status: 201,
          body: { plan: splitRouteIntoDays(payload.route, payload.options) },
        };
      }

      case 'boundary.preview': {
        const payload = boundaryPreviewPayloadSchema.parse(input);
        return {
          status: 200,
          body: {
            preview: previewStageBoundaryMove(
              payload.plan,
              payload.dayNumber,
              payload.newEndPointIndex,
              payload.expectedPlanRevision,
              payload.lodging ?? null,
            ),
          },
        };
      }

      case 'boundary.commit': {
        const payload = boundaryCommitPayloadSchema.parse(input);
        const result = commitStageBoundaryMove(
          payload.plan,
          payload.dayNumber,
          payload.newEndPointIndex,
          payload.expectedPlanRevision,
          payload.nowIso,
          payload.lodging ?? null,
        );
        return { status: boundaryStatus(result), body: result };
      }

      case 'lodging.anchor': {
        const payload = anchorLodgingPayloadSchema.parse(input);
        const result = anchorStageToLodging(
          payload.plan,
          payload.dayNumber,
          payload.lodging,
          payload.options,
        );
        return { status: lodgingStatus(result), body: result };
      }

      case 'weather.evaluate': {
        const payload = weatherEvaluatePayloadSchema.parse(input);
        return {
          status: 200,
          body: evaluatePlanWeather(payload.plan, payload.feed, payload.nowIso),
        };
      }

      case 'weather.windows': {
        const payload = weatherWindowsPayloadSchema.parse(input);
        return {
          status: 200,
          body: findOptimalWindows(
            payload.plan,
            payload.feed,
            payload.nowIso,
            payload.options,
          ),
        };
      }

      case 'shares.create': {
        const payload = shareCreatePayloadSchema.parse(input);
        const result = createPlanShare(payload.plan, payload.actorId, payload.request);
        return { status: shareCreationStatus(result), body: result };
      }

      case 'shares.revoke': {
        const payload = shareRevokePayloadSchema.parse(input);
        const result = revokePlanShare(payload.record, payload.actorId, payload.revokedAtIso);
        return { status: result.ok ? 200 : 403, body: result };
      }

      case 'shares.access': {
        const payload = shareAccessPayloadSchema.parse(input);
        return {
          status: 200,
          body: evaluateShareAccessP01(
            payload.plan,
            payload.share,
            payload.viewer,
            payload.nowIso,
          ),
        };
      }

      case 'stages.launch': {
        const payload = stageLaunchPayloadSchema.parse(input);
        return {
          status: 200,
          body: getStageLaunchReadiness(
            payload.plan,
            payload.dayNumber,
            payload.viewer,
            payload.activeSport ?? null,
          ),
        };
      }
      default:
        return { status: 404, body: { error: 'unknown_action', actions: PLANNING_ACTIONS } };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return invalidRequest(error);
    }
    return contractError(error);
  }
}
