import { NextResponse } from 'next/server';

// Auction system has been removed. This route is kept as a stub to prevent 404s.
export async function POST() {
  return NextResponse?.json({ error: 'Le système d\'enchères a été supprimé.' }, { status: 410 });
}

export async function GET() {
  return NextResponse?.json({ error: 'Le système d\'enchères a été supprimé.' }, { status: 410 });
}
