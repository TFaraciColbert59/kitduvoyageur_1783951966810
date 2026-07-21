import { NextResponse } from 'next/server';

// Auction system has been removed.
export async function POST() {
  return NextResponse?.json({ error: 'Le système d\'enchères a été supprimé.' }, { status: 410 });
}

export async function GET() {
  return NextResponse?.json({ error: 'Le système d\'enchères a été supprimé.' }, { status: 410 });
}
