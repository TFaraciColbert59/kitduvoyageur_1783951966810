import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { shareSchema } from '@/lib/schemas/materiel';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SERVICE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** POST /api/materiel/share — créer un token de partage pour un kit. */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const parsed = shareSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + parsed.data.expires_in_days * 86400000).toISOString();

    const { data, error } = await supabase
      .from('share_tokens')
      .insert({
        kit_id: parsed.data.kit_id,
        owner_id: user.id,
        permission: parsed.data.permission,
        expires_at: expiresAt,
      })
      .select('token')
      .single();
    if (error) throw error;

    return NextResponse.json({ url: `/k/${data.token}` });
  } catch (err) {
    console.error('POST /api/materiel/share', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/** GET /api/materiel/share?token=... — lecture publique d'un kit partagé. */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token || !/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 });
    }
    if (!SERVICE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 });
    }

    // Lecture hors RLS avec la clé service_role (la validation du token se fait ici).
    const supabase = createServiceClient(SERVICE_URL, SERVICE_KEY);

    const { data: shareToken } = await supabase
      .from('share_tokens')
      .select('kit_id, permission, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (!shareToken || (shareToken.expires_at && new Date(shareToken.expires_at) < new Date())) {
      return NextResponse.json({ error: 'Lien expiré ou invalide' }, { status: 404 });
    }

    const { data: kit } = await supabase
      .from('materiel_kits')
      .select('*, materiel_kit_items(*)')
      .eq('id', shareToken.kit_id)
      .single();

    // Pose du cookie d'attribution (Lot 6.3) : un lien /k/token ouvert devient
    // une référence signée que le checkout lira (httpOnly, signé HMAC).
    let res: NextResponse = NextResponse.json({ kit, permission: shareToken.permission });
    const secret = process.env.KIT_REF_SECRET;
    if (secret) {
      const { signKitRef, KIT_REF_COOKIE, KIT_REF_TTL_MS } = await import('@/features/kits/kitRef');
      const tokenSigned = await signKitRef(shareToken.kit_id, secret);
      res = NextResponse.json({ kit, permission: shareToken.permission });
      res.cookies.set(KIT_REF_COOKIE, tokenSigned, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(KIT_REF_TTL_MS / 1000),
      });
    }
    return res;
  } catch (err) {
    console.error('GET /api/materiel/share', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
