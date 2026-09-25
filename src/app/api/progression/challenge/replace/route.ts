import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { replaceProgressionChallenge } from '@/features/progression/server/challengeService';

export const dynamic = 'force-dynamic';

const GENERIC_ERROR = 'Erreur lors du remplacement du défi';

/**
 * Corps facultatif : aucun champ n'est attendu (le serveur choisit le défi).
 * Tout corps non vide doit néanmoins être un objet JSON valide.
 */
async function isBodyAcceptable(request: NextRequest): Promise<boolean> {
  let text = '';
  try {
    text = await request.text();
  } catch {
    return false;
  }

  if (text.trim().length === 0) return true;

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!(await isBodyAcceptable(request))) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const result = await replaceProgressionChallenge(user.id);

    if (result.ok) {
      return NextResponse.json({ success: true, challengeId: result.challengeId });
    }

    if (
      result.reason === 'cooldown' ||
      result.reason === 'no_progression' ||
      result.reason === 'no_alternative'
    ) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 409 });
    }

    return NextResponse.json({ success: false, error: 'unavailable' }, { status: 503 });
  } catch (err) {
    console.error('[API /api/progression/challenge/replace] Error:', err);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
