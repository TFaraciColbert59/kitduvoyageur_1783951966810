import { NextResponse } from 'next/server';

/**
 * L'ancienne page dediee n'existe plus : la progression vit dans le tiroir
 * POINTS du Hub. On conserve une redirection stable pour les anciens liens.
 */
export function GET(request: Request) {
  const url = new URL('/hub', request.url);
  url.searchParams.set('panel', 'points');
  return NextResponse.redirect(url, 307);
}
