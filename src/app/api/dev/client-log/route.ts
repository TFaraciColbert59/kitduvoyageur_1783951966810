import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.error('================ CLIENT RUNTIME ERROR ================');
    console.error('Message:', data.error);
    console.error('Stack:', data.stack);
    console.error('Component Stack:', data.componentStack);
    console.error('URL:', data.href);
    console.error('======================================================');
  } catch (e) {
    console.error('Failed to parse client log', e);
  }
  return NextResponse.json({ ok: true });
}
