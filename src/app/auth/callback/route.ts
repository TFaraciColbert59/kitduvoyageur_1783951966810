import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/supabase/safeNext';
import { KEEP_TRIAL_PATH } from '@/features/demo/keepTrial';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // Un chemin du site seulement : `next=//autre.site` ne doit pas faire sortir de LKDV.
  const next = safeNextPath(requestUrl.searchParams.get('next'), '/compte');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // « Garder mon essai » : le lien ouvert ailleurs que dans le navigateur de l'essai ne casse
  // rien (l'e-mail est confirmé côté Supabase) ; la page le dit au lieu d'un échec de connexion.
  if (next === KEEP_TRIAL_PATH || next.startsWith(`${KEEP_TRIAL_PATH}?`)) {
    return NextResponse.redirect(new URL(`${KEEP_TRIAL_PATH}?lien=echec`, requestUrl.origin));
  }
  return NextResponse.redirect(new URL('/connexion?error=callback_failed', requestUrl.origin));
}
