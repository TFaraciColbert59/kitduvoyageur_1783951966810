import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PRIVATE_MOMENT_BUCKET, privateMomentMediaPath, privateMomentMediaRef } from '@/features/carnet/detail/privateMomentMedia';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; owner: string; file: string }> }) {
  const { id, owner, file } = await params;
  const path = privateMomentMediaPath(privateMomentMediaRef(id, owner, file), id);
  if (!path) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });

  const supabase = await createClient();
  // L’accès à l’objet est vérifié par la politique Storage avec la session du lecteur.
  const { data, error } = await supabase.storage.from(PRIVATE_MOMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
  return NextResponse.redirect(data.signedUrl, { status: 307, headers });
}
