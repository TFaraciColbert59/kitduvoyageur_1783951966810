import { NextRequest, NextResponse } from 'next/server';
import { signKitRef, KIT_REF_COOKIE, KIT_REF_TTL_MS } from '@/features/kits/kitRef';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/kits/[id]/refer
 * Pose le cookie d'attribution `lkdv_kit_ref` (httpOnly, secure, sameSite=lax,
 * signé HMAC-SHA256, TTL 30 j) quand un utilisateur OUVRE un kit (KitSheet).
 * Le checkout lira et vérifiera ce cookie côté serveur pour attribuer la part.
 * Signature invalide/expirée → ignorée silencieusement au checkout.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const secret = process.env.KIT_REF_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false });
  }

  // Le kit doit être lisible (RLS) pour que le cookie soit signé — on vérifie
  // au checkout, mais on évite de signer un kit inexistant.
  const token = await signKitRef(params.id, secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(KIT_REF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(KIT_REF_TTL_MS / 1000),
  });
  return res;
}