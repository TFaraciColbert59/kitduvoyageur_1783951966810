import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  correlationResponseHeaders,
  readCorrelationId,
  resolveCorrelationId,
} from '@/lib/observability/correlation';
import { createStructuredLogger } from '@/lib/observability/logger';
import {
  boundedImportFileName,
  resolveTraceImportIdentity,
  validateTraceImportPayload,
} from '@/features/hiking/import/importContract';
import {
  normalizeTraceImportLaps,
  type TraceImportLapPayload,
} from '@/features/hiking/import/lapContract';

const logger = createStructuredLogger({ service: 'api.hike-sessions' });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PoiEvent {
  poiName: string;
  reachedAt: string;
  lat: number;
  lon: number;
}

interface TimedSample {
  lat: number;
  lng: number;
  timestamp: string;
  elevationM?: number | null;
  accuracyM?: number | null;
  speedMps?: number | null;
}

interface SaveHikeSessionBody {
  routeId?: string | null;
  kitId?: string | null;
  carnetId?: string | null;
  /** Phase 7 — voyage associé à la session, quand le contexte le fournit. */
  tripId?: string | null;
  /** Phase 2 — corrélation de chaîne propagée à la session et au carnet. */
  correlationId?: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM?: number | null;
  positions: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    speed?: number;
    timestamp?: number;
  }[];
  /** A10 (10.3) — échantillons horodatés, source unique de temps du traitement. */
  positionsTimed?: TimedSample[];
  poiEvents: PoiEvent[];
  /**
   * Champs additifs utilisés par l'import FIT/TCX. Absents des appels
   * historiques : la route conserve alors exactement son comportement.
   */
  title?: string | null;
  notes?: string | null;
  maxAltitudeM?: number | null;
  /**
   * Contrat d'import : le format source et l'empreinte du fichier original.
   * Quand l'empreinte est présente, la route passe par `record_trace_import`
   * et ne déduplique plus sur `started_at`.
   */
  source?: string | null;
  sourceFingerprint?: string | null;
  sourceFileName?: string | null;
  sourceByteLength?: number | null;
  /**
   * Tours source lus dans le fichier. Absents d'un client antérieur : la
   * route écrit alors la sortie sans tour, sans en inventer. Présents, ils
   * sont validés, bornés puis écrits dans la même transaction que la sortie
   * et sa provenance.
   */
  laps?: unknown;
  /**
   * `false` pour un import : la sortie ne crée pas de carnet automatique.
   * Sans ce champ, le comportement historique (carnet auto) reste actif.
   */
  createCarnet?: boolean;
}

/** Texte borné, jamais une valeur inventée quand la source est absente. */
function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Le titre est rendu par le runtime du Compte dans du HTML (cartes Sorties).
 * On retire les délimiteurs de balise et les caractères de contrôle à
 * l'écriture : un nom de fichier importé ne peut pas devenir du balisage.
 */
function boundedTitle(value: unknown): string | null {
  const text = boundedText(value, 120);
  if (!text) return null;
  const cleaned = text.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}

/** Reconstruit les échantillons horodatés depuis les positions brutes si besoin. */
function deriveTimedPositions(positions: SaveHikeSessionBody['positions']): TimedSample[] {
  const timed = positions.filter((position) => Number.isFinite(position.timestamp));
  if (timed.length < 2) return [];
  return timed.map((position) => {
    const sample: TimedSample = {
      lat: position.latitude,
      lng: position.longitude,
      timestamp: new Date(position.timestamp as number).toISOString(),
    };
    if (typeof position.altitude === 'number') sample.elevationM = position.altitude;
    if (typeof position.accuracy === 'number') sample.accuracyM = position.accuracy;
    if (typeof position.speed === 'number') sample.speedMps = position.speed;
    return sample;
  });
}

function sanitizeTimedPositions(samples: TimedSample[] | undefined): TimedSample[] {
  if (!Array.isArray(samples)) return [];
  return samples.filter(
    (sample) =>
      Number.isFinite(sample?.lat) &&
      Number.isFinite(sample?.lng) &&
      typeof sample?.timestamp === 'string' &&
      sample.timestamp.length > 0
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Phase 7 — identifiant de voyage validé (jamais un identifiant inventé). */
function sanitizeTripId(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

/**
 * Phase 7 — résout le voyage d'une session : le voyage explicite s'il est
 * lisible par l'utilisateur, sinon le plan réel sélectionné sur la route.
 * Aucun voyage n'est inventé : si rien n'est disponible, la session reste
 * simplement sans lien.
 */
async function resolveTripId(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  explicitTripId: string | null,
  routeId: string | null | undefined
): Promise<string | null> {
  if (explicitTripId) {
    const { data } = await supabase
      .from('trips')
      .select('id')
      .eq('id', explicitTripId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (routeId && !Number.isNaN(Number(routeId))) {
    const { data } = await supabase
      .from('adventure_plans')
      .select('trip_id')
      .eq('selected_route_id', Number(routeId))
      .eq('owner_id', userId)
      .not('trip_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.trip_id) return data.trip_id;
  }

  return null;
}

/**
 * POST /api/hike-sessions
 * Sauvegarde une session de randonnée terminée et génère optionnellement
 * des carnet_moments automatiques si carnetId est fourni.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let correlationId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        sessionId: null,
        carnetId: null,
        isGuest: true,
      });
    }

    const userId = user.id;

    // Phase 8 — écritures GPS volumineuses : 30/min, fail-open.
    const limited = await enforceRateLimit(userId, {
      scope: 'hike-sessions-save',
      limit: 30,
      windowMs: 60_000,
      failMode: 'open',
    });
    if (limited) return limited;

    const body: SaveHikeSessionBody = await req.json();
    // Phase 10 — corps (chaîne) > en-tête `x-correlation-id` > génération.
    // Toujours un UUID : la session et le carnet restent corrélés même si le
    // client n'a jamais fourni d'identifiant.
    correlationId = resolveCorrelationId({
      header: readCorrelationId(req),
      body: body.correlationId,
    }).correlationId;

    const importIdentity = resolveTraceImportIdentity(body);
    if (importIdentity.kind === 'invalid') {
      return NextResponse.json({ error: importIdentity.message }, { status: 400 });
    }
    let laps: TraceImportLapPayload[] = [];
    if (importIdentity.kind === 'import') {
      const importError = validateTraceImportPayload(body);
      if (importError) {
        return NextResponse.json({ error: importError }, { status: 400 });
      }
      const normalizedLaps = normalizeTraceImportLaps(body.laps);
      if (!normalizedLaps.ok) {
        return NextResponse.json({ error: normalizedLaps.message }, { status: 400 });
      }
      laps = normalizedLaps.laps;
    } else if (body.laps !== undefined && body.laps !== null) {
      return NextResponse.json(
        { error: 'Les tours du fichier ne concernent qu’un import de trace.' },
        { status: 400 }
      );
    }

    // Un import reste volontairement sans voyage : la RPC ne lie ni carnet ni
    // trip, et la route n'a pas à résoudre un plan qui n'a pas été demandé.
    const tripId = importIdentity.kind === 'import'
      ? null
      : await resolveTripId(
          supabase,
          userId,
          sanitizeTripId(body.tripId),
          body.routeId
        );

    if (!body.startedAt || !body.endedAt || body.distanceKm == null || body.durationSeconds == null) {
      return NextResponse.json({ error: 'Données de session incomplètes' }, { status: 400 });
    }

    // Simplifier les positions : 1 point toutes les ~10 secondes max
    const simplified = simplifyPositions(body.positions, 10);
    const positionsGeojson = simplified.length > 1
      ? {
          type: 'LineString',
          coordinates: simplified.map((p) => [p.longitude, p.latitude]),
        }
      : null;

    // A10 (10.3) — positions_geojson reste la géométrie ; positions_timed est
    // la source unique de temps (envoyée par le client, sinon dérivée des
    // horodatages bruts). Les positions simplifiées conservent `timestamp`.
    const timedCandidates = sanitizeTimedPositions(body.positionsTimed);
    const positionsTimed = timedCandidates.length >= 2
      ? timedCandidates
      : deriveTimedPositions(simplified);

    // Import FIT/TCX/GPX : la clé est (propriétaire, empreinte SHA-256), jamais
    // l'heure de départ. Deux fichiers différents démarrant à la même seconde
    // restent deux sorties ; un rejeu du même contenu retourne l'existante.
    if (importIdentity.kind === 'import') {
      // La RPC à tours est une nouvelle fonction : l'ancienne reste intacte
      // pour les clients et les imports sans tour. Si le code précède la
      // migration et qu'il y a des tours, la route refuse explicitement (503)
      // au lieu de les perdre silencieusement.
      const withLaps = laps.length > 0;
      const rpcName = withLaps
        ? 'record_trace_import_with_laps'
        : 'record_trace_import';
      const rpcArgs: Record<string, unknown> = {
        p_started_at: body.startedAt,
        p_ended_at: body.endedAt,
        p_distance_km: body.distanceKm,
        p_duration_seconds: Math.max(1, Math.round(body.durationSeconds)),
        p_elevation_gain_m: body.elevationGainM ?? null,
        p_max_altitude_m: boundedInteger(body.maxAltitudeM, -500, 9000),
        p_positions_geojson: positionsGeojson,
        p_positions_timed: positionsTimed.length >= 2 ? positionsTimed : null,
        p_poi_events: [],
        p_title: boundedTitle(body.title),
        p_notes: boundedText(body.notes, 2000),
        p_source: importIdentity.source,
        p_source_fingerprint: importIdentity.fingerprint,
        p_source_file_name: boundedImportFileName(body.sourceFileName),
        p_source_byte_length:
          typeof body.sourceByteLength === 'number' && Number.isFinite(body.sourceByteLength)
            ? Math.round(body.sourceByteLength)
            : null,
        p_correlation_id: correlationId,
      };
      if (withLaps) rpcArgs.p_laps = laps;

      const { data: importResult, error: importRpcError } = await supabase.rpc(
        rpcName,
        rpcArgs
      );

      if (importRpcError) {
        const code = importRpcError.code ?? '';
        if (code === '28000') {
          return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
        }
        if (code === '22023') {
          return NextResponse.json({ error: importRpcError.message }, { status: 400 });
        }
        if (code === '22007' || code === '22008' || code === '22P02' || code === '23514') {
          return NextResponse.json({ error: 'Import ou tours invalides.' }, { status: 400 });
        }
        if (code === '23505') {
          return NextResponse.json(
            { error: 'Un import identique est déjà en cours. Réessaie.' },
            { status: 409 }
          );
        }
        if (code === 'PGRST202' || code === '42883') {
          return NextResponse.json(
            {
              error: withLaps
                ? 'La persistance des tours n’est pas encore disponible.'
                : 'La persistance des imports n’est pas encore disponible.',
            },
            { status: 503 }
          );
        }
        // Pas de details/hint : une violation d'unicité peut y recopier
        // l'empreinte. Le code et le message suffisent au diagnostic.
        console.error(
          '[hike-sessions] import RPC error:',
          importRpcError.code,
          importRpcError.message
        );
        return NextResponse.json(
          { error: 'Erreur lors de la sauvegarde de l’import.' },
          { status: 500 }
        );
      }

      const result = importResult as {
        session_id?: string | null;
        carnet_id?: string | null;
        existing?: boolean;
        lap_count?: number | string | null;
      } | null;
      if (!result?.session_id) {
        return NextResponse.json(
          { error: 'Erreur lors de la sauvegarde de l’import.' },
          { status: 500 }
        );
      }

      const rawLapCount =
        typeof result.lap_count === 'number'
          ? result.lap_count
          : Number(result.lap_count ?? 0);
      const lapCount =
        Number.isFinite(rawLapCount) && rawLapCount >= 0
          ? Math.min(Math.round(rawLapCount), 10_000)
          : 0;

      logger.info('hike_sessions.imported', {
        correlation_id: correlationId,
        latency_ms: Date.now() - startedAt,
        status: 200,
        session_id: result.session_id,
        import_source: importIdentity.source,
        import_existing: result.existing === true,
        import_lap_count: lapCount,
      });

      return NextResponse.json(
        {
          sessionId: result.session_id,
          carnetId: result.carnet_id ?? null,
          existing: result.existing === true,
          lapCount,
        },
        { headers: correlationResponseHeaders(correlationId) }
      );
    }

    // 1. Idempotence historique, hors import : ce contrôle porte sur
    //    (user_id, started_at). Il ne s'applique jamais au contrat d'import
    //    ci-dessus, qui déduplique par (propriétaire, empreinte) et distingue
    //    donc deux fichiers différents démarrant à la même seconde.
    let query = supabase
      .from('hike_sessions')
      .select('id, carnet_id')
      .eq('started_at', body.startedAt);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: existingSession } = await query.maybeSingle();

    if (existingSession) {
      return NextResponse.json({
        sessionId: existingSession.id,
        carnetId: existingSession.carnet_id || null,
        existing: true,
      });
    }

    // 2. Automatic Carnet Creation if carnetId is not provided
    let carnetId = body.carnetId || null;

    if (!carnetId && body.createCarnet !== false) {
      let title = `Randonnée du ${new Date(body.startedAt).toLocaleDateString('fr-FR')}`;
      if (body.routeId) {
        const { data: rData } = await supabase
          .from('hiking_routes')
          .select('name')
          .eq('id', Number(body.routeId))
          .maybeSingle();
        if (rData?.name) title = rData.name;
      }

      const { data: newCarnet, error: carnetErr } = await supabase
        .from('carnets')
        .insert({
          title,
          description: `Carnet d'expédition outdoor récapitulant ${body.distanceKm.toFixed(1)} km en ${formatDuration(body.durationSeconds)}.`,
          destination: title,
          distance_km: body.distanceKm,
          elevation_m: body.elevationGainM ?? 0,
          duration: formatDuration(body.durationSeconds),
          author_id: userId,
          visibility: 'private',
          trip_id: tripId,
          created_at: new Date().toISOString(),
          correlation_id: correlationId,
        })
        .select('id')
        .single();

      if (!carnetErr && newCarnet) {
        carnetId = newCarnet.id;
      } else {
        console.warn('[hike-sessions] Automatic carnet creation notice:', carnetErr?.message);
      }
    }

    // 3. Insert the hike session
    const { data: session, error: sessionError } = await supabase
      .from('hike_sessions')
      .insert({
        user_id: userId,
        route_id: body.routeId ? Number(body.routeId) : null,
        kit_id: body.kitId || null,
        carnet_id: carnetId,
        trip_id: tripId,
        started_at: body.startedAt,
        ended_at: body.endedAt,
        distance_km: body.distanceKm,
        duration_seconds: body.durationSeconds,
        elevation_gain_m: body.elevationGainM ?? null,
        positions_geojson: positionsGeojson,
        positions_timed: positionsTimed.length >= 2 ? positionsTimed : null,
        poi_events: body.poiEvents || [],
        title: boundedTitle(body.title),
        notes: boundedText(body.notes, 2000),
        max_altitude_m: boundedInteger(body.maxAltitudeM, -500, 9000),
        visibility: 'private',
        correlation_id: correlationId,
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('[hike-sessions] Insert error:', sessionError);
      return NextResponse.json({ error: sessionError ? sessionError.message : 'Erreur lors de la sauvegarde de session' }, { status: 500 });
    }

    const sessionId = session.id;

    // 4. Generate auto moments for the carnet if carnetId exists
    if (carnetId) {
      await generateAutoMoments(supabase, {
        sessionId,
        carnetId,
        startedAt: body.startedAt,
        endedAt: body.endedAt,
        distanceKm: body.distanceKm,
        durationSeconds: body.durationSeconds,
        elevationGainM: body.elevationGainM,
        poiEvents: body.poiEvents || [],
        positions: simplified,
      });
    }

    // Phase 10 — log structuré sans PII (identifiants techniques seulement).
    logger.info('hike_sessions.saved', {
      correlation_id: correlationId,
      latency_ms: Date.now() - startedAt,
      status: 200,
      session_id: sessionId,
      carnet_id: carnetId,
      trip_linked: Boolean(tripId),
    });

    return NextResponse.json(
      { sessionId, carnetId, existing: false },
      { headers: correlationResponseHeaders(correlationId) }
    );
  } catch (err) {
    console.error('[hike-sessions] Unexpected error:', err);
    logger.error('hike_sessions.failed', {
      correlation_id: correlationId,
      latency_ms: Date.now() - startedAt,
      status: 500,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Erreur inattendue' },
      { status: 500, headers: correlationId ? correlationResponseHeaders(correlationId) : undefined }
    );
  }
}

/**
 * GET /api/hike-sessions?carnetId=X
 * Liste les sessions de randonnée de l'utilisateur connecté pour un carnet donné.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const carnetId = searchParams.get('carnetId');

    let query = supabase
      .from('hike_sessions')
      .select('id, route_id, kit_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, poi_events, narratives, created_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (carnetId) {
      query = query.eq('carnet_id', carnetId);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[hike-sessions] GET error:', err);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Garde 1 point max par intervalle (secondes), sans supprimer le premier et dernier. */
function simplifyPositions(
  positions: { latitude: number; longitude: number; altitude?: number }[],
  intervalSeconds: number
): { latitude: number; longitude: number; altitude?: number }[] {
  if (positions.length <= 2) return positions;
  const result = [positions[0]];
  // On suppose positions est chronologique, ~1 entrée/seconde depuis le hook
  const step = Math.max(1, Math.round(intervalSeconds));
  for (let i = step; i < positions.length - 1; i += step) {
    result.push(positions[i]);
  }
  result.push(positions[positions.length - 1]);
  return result;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

/** Génère des carnet_moments auto depuis la session. */
async function generateAutoMoments(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  params: {
    sessionId: string;
    carnetId: string;
    startedAt: string;
    endedAt: string;
    distanceKm: number;
    durationSeconds: number;
    elevationGainM?: number | null;
    poiEvents: PoiEvent[];
    positions: { latitude: number; longitude: number; altitude?: number }[];
  }
) {
  const moments: object[] = [];

  // Moment Départ
  const startPos = params.positions[0];
  moments.push({
    carnet_id: params.carnetId,
    hike_session_id: params.sessionId,
    moment_timestamp: params.startedAt,
    source: 'auto',
    citation: '🥾 Départ de la randonnée',
    lieu: startPos
      ? `${startPos.latitude.toFixed(4)}, ${startPos.longitude.toFixed(4)}`
      : null,
    heure: new Date(params.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    jour_numero: 1,
  });

  // Moments POIs atteints
  for (const poi of params.poiEvents) {
    moments.push({
      carnet_id: params.carnetId,
      hike_session_id: params.sessionId,
      moment_timestamp: poi.reachedAt,
      source: 'auto',
      citation: `📍 ${poi.poiName}`,
      lieu: `${poi.lat.toFixed(4)}, ${poi.lon.toFixed(4)}`,
      heure: new Date(poi.reachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      jour_numero: 1,
    });
  }

  // Moment Arrivée
  const endPos = params.positions[params.positions.length - 1];
  const summary = [
    `📏 ${params.distanceKm.toFixed(1)} km`,
    `⏱ ${formatDuration(params.durationSeconds)}`,
    params.elevationGainM ? `↑ ${Math.round(params.elevationGainM)} m D+` : null,
  ].filter(Boolean).join(' · ');

  moments.push({
    carnet_id: params.carnetId,
    hike_session_id: params.sessionId,
    moment_timestamp: params.endedAt,
    source: 'auto',
    citation: `🏁 Arrivée — ${summary}`,
    lieu: endPos
      ? `${endPos.latitude.toFixed(4)}, ${endPos.longitude.toFixed(4)}`
      : null,
    heure: new Date(params.endedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    jour_numero: 1,
  });

  // Insérer tous les moments
  if (moments.length > 0) {
    const { error } = await supabase.from('carnet_moments').insert(moments);
    if (error) {
      console.error('[hike-sessions] generateAutoMoments error:', error);
    }
  }
}
