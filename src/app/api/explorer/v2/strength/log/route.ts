import { NextResponse } from 'next/server';
import {
  buildSyncStrengthLogRpcBody,
  parseStrengthLogBody,
  STRENGTH_LOG_ID_PATTERN,
} from '@/features/explorer-v2/server/strengthLog';

export const dynamic = 'force-dynamic';

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function bearerToken(header: string | null): string {
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match?.[1] ?? '';
}

function upstreamStatus(status: number): number {
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 409) return 409;
  if (status === 400 || status === 422) return 400;
  return 503;
}

function supabaseConfig(): { url: string; anon: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url: url.replace(/\/$/, ''), anon };
}

async function callRpc(
  url: string,
  anon: string,
  token: string,
  name: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Lecture du carnet privé du propriétaire.
 *
 * `logId` facultatif : sans lui, la RPC renvoie le carnet le plus récemment
 * modifié, ce qui permet de restaurer un appareil qui n’a plus de brouillon
 * local. Une réponse vide reste un succès (`log: null`), jamais une erreur.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return json({ error: 'authentification requise' }, 401);

  const config = supabaseConfig();
  if (!config) return json({ error: 'configuration absente' }, 503);

  const logId = new URL(request.url).searchParams.get('logId');
  if (logId !== null && !STRENGTH_LOG_ID_PATTERN.test(logId)) {
    return json({ error: 'identifiant de carnet invalide' }, 400);
  }

  try {
    const res = await callRpc(config.url, config.anon, token, 'read_strength_log', {
      p_client_log_id: logId,
    });
    if (!res.ok) {
      return json({ error: 'lecture refusée' }, upstreamStatus(res.status));
    }
    const payload = await res.json().catch(() => null);
    if (payload !== null && (typeof payload !== 'object' || Array.isArray(payload))) {
      return json({ error: 'réponse serveur invalide' }, 503);
    }
    return json({ log: payload }, 200);
  } catch (error) {
    console.error('[explorer-v2] strength/log GET', error);
    return json({ error: 'indisponible' }, 503);
  }
}

/**
 * Synchronisation d’un carnet complet.
 *
 * Le brouillon local est déjà écrit avant cet appel. Une réponse perdue est
 * sans danger : le même état est rejoué avec les mêmes identifiants client et
 * la RPC remplace le contenu au lieu de créer des doublons.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return json({ error: 'authentification requise' }, 401);

  const parsed = parseStrengthLogBody(await request.json().catch(() => null));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const config = supabaseConfig();
  if (!config) return json({ error: 'configuration absente' }, 503);

  try {
    const res = await callRpc(
      config.url,
      config.anon,
      token,
      'sync_strength_log',
      buildSyncStrengthLogRpcBody(parsed.value),
    );
    if (!res.ok) {
      return json({ error: 'synchronisation refusée' }, upstreamStatus(res.status));
    }

    const payload = await res.json().catch(() => null);
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      (payload as { ok?: unknown }).ok !== true
    ) {
      return json({ error: 'réponse serveur invalide' }, 503);
    }
    const result = payload as {
      ok: true;
      clientLogId?: unknown;
      revision?: unknown;
      updatedAt?: unknown;
    };
    if (
      typeof result.revision !== 'number' ||
      !Number.isInteger(result.revision) ||
      result.revision < 1
    ) {
      return json({ error: 'réponse serveur invalide' }, 503);
    }
    return json(
      {
        ok: true,
        clientLogId:
          typeof result.clientLogId === 'string' ? result.clientLogId : parsed.value.log.id,
        revision: result.revision,
        updatedAt: typeof result.updatedAt === 'string' ? result.updatedAt : null,
      },
      200,
    );
  } catch (error) {
    console.error('[explorer-v2] strength/log PUT', error);
    return json({ error: 'indisponible' }, 503);
  }
}

/**
 * Suppression explicite du carnet du propriétaire. Une suppression déjà
 * effectuée (ou un carnet appartenant à un autre compte) répond
 * `deleted: false` sans révéler l’existence de la ligne.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return json({ error: 'authentification requise' }, 401);

  const logId = new URL(request.url).searchParams.get('logId');
  if (!logId || !STRENGTH_LOG_ID_PATTERN.test(logId)) {
    return json({ error: 'identifiant de carnet invalide' }, 400);
  }

  const config = supabaseConfig();
  if (!config) return json({ error: 'configuration absente' }, 503);

  try {
    const res = await callRpc(config.url, config.anon, token, 'delete_strength_log', {
      p_client_log_id: logId,
    });
    if (!res.ok) {
      return json({ error: 'suppression refusée' }, upstreamStatus(res.status));
    }
    const payload = await res.json().catch(() => null);
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      typeof (payload as { deleted?: unknown }).deleted !== 'boolean'
    ) {
      return json({ error: 'réponse serveur invalide' }, 503);
    }
    return json({ deleted: (payload as { deleted: boolean }).deleted }, 200);
  } catch (error) {
    console.error('[explorer-v2] strength/log DELETE', error);
    return json({ error: 'indisponible' }, 503);
  }
}
