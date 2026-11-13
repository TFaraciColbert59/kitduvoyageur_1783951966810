import { NextResponse } from 'next/server';
import {
  buildStartActivityRpcBody,
  parseActivityStartBody,
  parseStartActivityRpcResult,
} from '@/features/explorer-v2/server/activityStart';

export const dynamic = 'force-dynamic';

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function upstreamStatus(status: number): number {
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 409) return 409;
  if (status === 400 || status === 422) return 400;
  return 503;
}

/** Le schéma HTTP `Bearer` est insensible à la casse ; le jeton reste intact. */
function bearerToken(header: string | null): string {
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match?.[1] ?? '';
}

/**
 * Démarrage persistant d'une activité (S1.02, K6.15).
 *
 * Le client fournit un identifiant de séance stable (`clientSessionId`) ; le
 * serveur génère l'identifiant public de séance et le retourne. Un rejeu
 * légitime du même propriétaire avec le même contenu retourne le même
 * identifiant (`created=false`, HTTP 200) ; un contenu différent est refusé
 * (HTTP 409). L'acteur n'est jamais lu dans le corps : le jeton de
 * l'utilisateur est relayé à PostgREST, et la RPC `start_activity_session`
 * appelle `auth.uid()`.
 *
 * Aucune écriture directe ici : la RPC applique les bornes, la clé
 * d'idempotence propriétaire et l'insertion dans `activity_sessions`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) {
    return json({ error: 'authentification requise' }, 401);
  }

  const parsed = parseActivityStartBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return json({ error: parsed.error, code: parsed.code }, 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return json({ error: 'configuration absente' }, 503);
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/start_activity_session`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildStartActivityRpcBody(parsed.value)),
    });

    if (!res.ok) {
      return json(
        {
          error:
            res.status === 401
              ? 'authentification refusée'
              : res.status === 403
                ? 'accès refusé'
                : 'démarrage refusé',
        },
        upstreamStatus(res.status)
      );
    }

    const result = parseStartActivityRpcResult(await res.json().catch(() => null));
    if (!result.ok) {
      if (result.reason === 'payload_mismatch') {
        return json(
          {
            error: 'clientSessionId déjà utilisé avec un autre contenu',
            code: 'client_session_conflict',
          },
          409
        );
      }
      return json({ error: 'réponse serveur invalide' }, 503);
    }

    return json(result.session, result.session.created ? 201 : 200);
  } catch (error) {
    console.error('[explorer-v2] activity/start', error);
    return json({ error: 'indisponible' }, 503);
  }
}
