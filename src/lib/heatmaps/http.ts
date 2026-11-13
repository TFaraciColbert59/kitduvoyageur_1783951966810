import 'server-only';

import { NextResponse } from 'next/server';
import { HeatmapDataError, isHeatmapDataError } from './errors';

/** Toute réponse heatmap est privée et non cachable : une révocation est immédiate. */
export function heatmapJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie',
    },
  });
}

export function heatmapErrorResponse(error: unknown): NextResponse {
  if (isHeatmapDataError(error)) {
    return heatmapJson(
      { error: 'Données de contribution indisponibles.', code: error.code },
      503
    );
  }
  console.error('[api/heatmaps] erreur inattendue', error);
  return heatmapJson({ error: 'Erreur interne de heatmap.', code: 'server' }, 500);
}

export function isDataError(error: unknown): error is HeatmapDataError {
  return isHeatmapDataError(error);
}
