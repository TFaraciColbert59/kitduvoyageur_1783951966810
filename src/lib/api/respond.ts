import { NextResponse } from 'next/server';

export type ApiErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'server';

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  server: 500,
};

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function fail(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status: STATUS[code], headers: { 'Cache-Control': 'no-store' } }
  );
}
