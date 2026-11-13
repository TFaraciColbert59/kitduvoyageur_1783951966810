import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadAccountBootstrap } from '@/features/compte/data/accountBootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bootstrap strictement privé : il contient le profil, les commandes, les
 * prêts et les notifications. Aucun cache HTTP ne doit pouvoir le resservir,
 * ni après une mutation, ni après un changement de compte sur le même
 * navigateur. Le cache mémoire processus a été retiré : `getCached` puis
 * `setCached` n'était ni atomique ni partagé entre instances, et pouvait
 * réécrire un payload périmé après une invalidation.
 */
function privateNoStore(payload: unknown) {
  const response = NextResponse.json(payload);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Vary', 'Cookie');
  return response;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const payload = await loadAccountBootstrap(supabase);
    return privateNoStore(payload);
  } catch {
    // Une erreur de lecture ne doit jamais casser le Compte : le runtime
    // conserve ses données connues et l'erreur reste côté serveur.
    return privateNoStore({ authenticated: false, error: 'bootstrap_unavailable' });
  }
}
