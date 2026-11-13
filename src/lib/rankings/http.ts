import { NextResponse } from 'next/server';

export function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code: 'bad_request' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function unauthorized(message = 'Session requise.'): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code: 'unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}
