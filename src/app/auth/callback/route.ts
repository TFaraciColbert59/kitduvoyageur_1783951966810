import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/supabase/safeNext';
import { isPasswordResetPath, PASSWORD_RESET_PATH } from '@/features/auth/passwordReset';

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

  // « Mot de passe oublié » : la page du nouveau mot de passe dit pourquoi le lien n'a pas marché
  // (expiré, déjà servi, ouvert dans un autre navigateur que celui de la demande) et en propose un autre.
  if (isPasswordResetPath(next)) {
    return NextResponse.redirect(new URL(`${PASSWORD_RESET_PATH}?lien=echec`, requestUrl.origin));
  }
  return NextResponse.redirect(new URL('/connexion?error=callback_failed', requestUrl.origin));
}
