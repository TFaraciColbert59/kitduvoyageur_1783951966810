import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { joinActivity } from '@/features/trips/server/joinActivity';

/**
 * Task 17 — Acceptation d'une invitation « Rejoindre ».
 *
 * Route Handler : session requise (sinon renvoi connexion avec retour), puis
 * `joinActivity` (membres + snapshot + recalcul). Le cache hub est revalidé au
 * niveau route — jamais dans le moteur, qui peut tourner dans un rendu.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await context.params;
  const formData = await request.formData();
  const consentValue = formData.get('consent');
  const consent = consentValue === 'true' || consentValue === 'on';
  const rawToken = formData.get('token');
  const token =
    typeof rawToken === 'string' && rawToken.trim() !== '' ? rawToken.trim() : null;

  const nextPath = token
    ? `/rejoindre/${slug}?token=${encodeURIComponent(token)}`
    : `/rejoindre/${slug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(`/connexion?next=${encodeURIComponent(nextPath)}`, request.url),
      { status: 303 }
    );
  }

  const result = await joinActivity(slug, { consent, token, userId: user.id });

  if (result.ok || result.code === 'already_member') {
    revalidatePath('/hub');
    return NextResponse.redirect(new URL('/hub', request.url), { status: 303 });
  }

  const separator = nextPath.includes('?') ? '&' : '?';
  return NextResponse.redirect(new URL(`${nextPath}${separator}erreur=1`, request.url), {
    status: 303,
  });
}
