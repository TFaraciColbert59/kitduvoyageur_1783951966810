import { NextResponse } from 'next/server';

export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export function jsonNoStore<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export function invalidPayload(message: string, details?: unknown): NextResponse {
  return jsonNoStore(
    {
      error: message,
      code: 'invalid_payload',
      ...(details === undefined ? {} : { details }),
    },
    400,
  );
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
