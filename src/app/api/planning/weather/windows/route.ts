import { executePlanningAction } from '../../_lib/actions';
import { readJson, toNextResponse } from '../../_lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/planning/weather/windows — fenêtres optimales dans le fuseau du plan. */
export async function POST(request: Request) {
  return toNextResponse(executePlanningAction('weather.windows', await readJson(request)));
}
