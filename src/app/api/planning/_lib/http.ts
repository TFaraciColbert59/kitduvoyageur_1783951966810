import { NextResponse } from 'next/server';
import type { ActionResponse } from './actions';

/** Corps JSON tolérant : un JSON illisible devient `null`, donc une 400 propre. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function toNextResponse(result: ActionResponse): NextResponse {
  return NextResponse.json(result.body, { status: result.status });
}
