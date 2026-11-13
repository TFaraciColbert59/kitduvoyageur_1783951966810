import { NextResponse } from 'next/server';

export const LIVE_SEGMENTS_NO_STORE = {
  'Cache-Control': 'no-store',
} as const;

export interface ApiIssue {
  code: string;
  message: string;
}

export function rejected(issue: ApiIssue, status = 422): NextResponse {
  return NextResponse.json(
    { error: issue.message, code: issue.code },
    { status, headers: LIVE_SEGMENTS_NO_STORE },
  );
}

export function notFound(message = 'Segment introuvable.'): NextResponse {
  return rejected({ code: 'not_found', message }, 404);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

