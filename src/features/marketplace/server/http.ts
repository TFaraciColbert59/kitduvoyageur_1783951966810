import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
export function errorResponse(error: { code?: string; message?: string }) {
  const status =
    error.code === '42501'
      ? 403
      : error.code === 'P0002'
        ? 404
        : ['PT409', '40001', '23505', '55000'].includes(error.code ?? '')
          ? 409
          : error.code === 'PT429'
            ? 429
            : ['23514', '22P02', '22023', '23503', '22007', '22008'].includes(error.code ?? '')
              ? 400
              : 500;
  return NextResponse.json(
    { error: status === 500 ? 'Erreur serveur' : (error.message ?? 'Requête refusée') },
    { status }
  );
}
export async function mutate<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
  rpc: string,
  map: (body: T) => Record<string, unknown>,
  key: string,
  status = 200
) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const limited = await enforceRateLimit(user.id, {
      scope: 'marketplace-write',
      limit: 40,
      windowMs: 60000,
      failMode: 'open',
    });
    if (limited) return limited;
    if (Number(req.headers.get('content-length') ?? 0) > 16384)
      return NextResponse.json({ error: 'Requête trop volumineuse' }, { status: 413 });
    const raw = await req.text();
    if (raw.length > 16384)
      return NextResponse.json({ error: 'Requête trop volumineuse' }, { status: 413 });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    const { data, error } = await db.rpc(rpc, map(parsed.data));
    if (error) return errorResponse(error);
    return NextResponse.json(key ? { [key]: data } : data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof SyntaxError ? 'JSON invalide' : 'Erreur serveur' },
      { status: error instanceof SyntaxError ? 400 : 500 }
    );
  }
}
export async function authenticatedRead(
  read: (db: Awaited<ReturnType<typeof createClient>>) => Promise<NextResponse>
) {
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    return await read(db);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
export const uuidSchema = z.string().uuid();
