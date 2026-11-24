import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/api/serviceClient';
import type { ClubMapLiveMember, ClubMapPokedexItem } from '@/components/clubs/map/clubMapTypes';
import { buildOutingTrackGeometry, snapPointAlongTrack } from '@/components/clubs/map/clubTrackGeometry';
import { dbFailure, errorJson, isUuid, json, optionalUser } from '../../_lib/http';
import { canReadClub, loadClubBundle } from '../../_lib/db';
import { asArray, asNumber, asString, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 200;
const LIVE_WINDOW_MS = 4 * 3600_000;
const CORRELATION_BEFORE_MS = 12 * 3600_000;
const CORRELATION_AFTER_MS = 36 * 3600_000;

const EXCLUDED_KINGDOMS = new Set([
  'plante',
  'plant',
  'plantae',
  'champignon',
  'fungi',
  'flore',
  'flora',
  'geologie',
  'geology',
  'mineral',
  'roche',
]);

const NON_FAUNA_RE =
  /\b(gentiane|edelweiss|campanule|rhododendron|arnica|lys|lis|m[eé]l[eè]ze|pin|sapin|[eé]pic[eé]a|h[eê]tre|ch[eê]ne|bouleau|plante|fleur|champignon|bolet|chanterelle|amanite|flore|lichen|mousse|foug[eè]re|orchid[eé]e|saxifrage|soldanelle|an[eé]mone|sil[eè]ne|joubarbe|g[eé]n[eé]pi|v[eé]r[aâ]tre|aconit|digitale|myrtille|framboisier|quartz|granit|calcaire|schiste|fossile)\b/i;

const GENERIC_PLACE_WORDS = new Set([
  'sortie',
  'randonnee',
  'alpes',
  'france',
  'refuge',
  'montagne',
  'sommet',
  'circuit',
  'boucle',
  'traversee',
  'vallee',
  'massif',
  'etape',
]);

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function fuzzLocation250m(userId: string, lat: number, lng: number): { lat: number; lng: number } {
  const angle = hashUnit(`fuzz-angle:${userId}`) * Math.PI * 2;
  const distMeters = 210 + hashUnit(`fuzz-dist:${userId}`) * 70; // ~210–280 m
  const dLat = (Math.sin(angle) * distMeters) / 111_320;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLng = (Math.cos(angle) * distMeters) / (111_320 * cosLat);
  return {
    lat: Number((lat + dLat).toFixed(5)),
    lng: Number((lng + dLng).toFixed(5)),
  };
}

function formatClubRole(role: string | null): string {
  if (role === 'founder') return 'Fondateur';
  if (role === 'admin') return 'Guide & Sécurité';
  if (role === 'moderator') return 'Encadrant';
  return 'Membre actif';
}

interface ParsedEvent {
  id: string;
  title: string;
  massif: string;
  location: string;
  startsAtMs: number | null;
  endsAtMs: number | null;
  dateLabel: string;
  placeTerms: string[];
  coords: ReturnType<typeof buildOutingTrackGeometry>['coords'];
}

function extractPlaceTerms(ev: { massif: string; location: string; title: string }): string[] {
  const terms = new Set<string>();
  for (const raw of [ev.massif, ev.location]) {
    const norm = normalizeText(raw);
    if (norm.length >= 4 && !GENERIC_PLACE_WORDS.has(norm)) {
      terms.add(norm);
    }
    for (const token of norm.split(/[^a-z0-9]+/)) {
      if (token.length >= 5 && !GENERIC_PLACE_WORDS.has(token)) {
        terms.add(token);
      }
    }
  }
  const titleNorm = normalizeText(ev.title);
  for (const token of titleNorm.split(/[^a-z0-9]+/)) {
    if (token.length >= 6 && !GENERIC_PLACE_WORDS.has(token)) {
      terms.add(token);
    }
  }
  return Array.from(terms);
}

function isEventLive(ev: ParsedEvent, nowMs: number): boolean {
  if (ev.startsAtMs === null) return false;
  const windowEnd = Math.max(ev.startsAtMs + LIVE_WINDOW_MS, (ev.endsAtMs ?? ev.startsAtMs) + LIVE_WINDOW_MS);
  return nowMs >= ev.startsAtMs - LIVE_WINDOW_MS && nowMs <= windowEnd;
}

function matchEventForMoment(moment: Row, events: ParsedEvent[]): ParsedEvent | null {
  const text = `${normalizeText(moment.lieu)} ${normalizeText(moment.citation)}`.trim();
  const createdMs = moment.created_at ? Date.parse(String(moment.created_at)) : NaN;

  // 1. Place / massif match
  if (text.length > 0) {
    for (const ev of events) {
      if (ev.placeTerms.some((term) => text.includes(term))) {
        return ev;
      }
    }
  }

  // 2. Date window match: [event_date - 12h, event_date + 36h]
  if (Number.isFinite(createdMs)) {
    for (const ev of events) {
      if (ev.startsAtMs === null) continue;
      if (createdMs >= ev.startsAtMs - CORRELATION_BEFORE_MS && createdMs <= ev.startsAtMs + CORRELATION_AFTER_MS) {
        return ev;
      }
    }
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    // After canReadClub passes, use service_role to read member locations & carnet observations
    // without being blocked by client-side RLS on user_profiles.
    const db = createServiceClient() ?? supabase;

    // 1. Collect all active member user IDs + roles
    const { data: memberRows, error: memberErr } = await db
      .from('club_members')
      .select('user_id, role, status')
      .eq('club_id', id)
      .limit(1000);
    if (memberErr) return dbFailure('GET club_map_members', memberErr);

    const roleByUserId = new Map<string, string>();
    const activeUserIds: string[] = [];
    for (const row of asArray<Row>(memberRows)) {
      const uid = asString(row.user_id);
      const status = asString(row.status);
      if (!uid || (status && status !== 'active')) continue;
      if (!roleByUserId.has(uid)) {
        roleByUserId.set(uid, asString(row.role) ?? 'member');
        activeUserIds.push(uid);
      }
    }
    if (bundle.club.createdBy && !roleByUserId.has(bundle.club.createdBy)) {
      roleByUserId.set(bundle.club.createdBy, 'founder');
      activeUserIds.unshift(bundle.club.createdBy);
    }

    // 2. Load club_events for live-window detection and strict Pokédex correlation
    const { data: eventRows, error: eventErr } = await db
      .from('club_events')
      .select('*')
      .eq('club_id', id)
      .order('event_date', { ascending: false })
      .limit(200);
    if (eventErr) return dbFailure('GET club_map_events', eventErr);

    const parsedEvents: ParsedEvent[] = asArray<Row>(eventRows)
      .filter((ev) => !ev.cancelled_at)
      .map((ev, index) => {
        const title = asString(ev.title) ?? 'Sortie';
        const massif = asString(ev.massif) ?? asString(ev.location) ?? bundle.club.zoneLabel ?? '';
        const location = asString(ev.location) ?? '';
        const rawStart = asString(ev.starts_at) ?? asString(ev.event_date);
        const rawEnd = asString(ev.ends_at);
        const startsAtMs = rawStart && Number.isFinite(Date.parse(rawStart)) ? Date.parse(rawStart) : null;
        const endsAtMs = rawEnd && Number.isFinite(Date.parse(rawEnd)) ? Date.parse(rawEnd) : null;
        const dateLabel =
          startsAtMs !== null
            ? new Date(startsAtMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            : '';

        const built = buildOutingTrackGeometry({
          id: String(ev.id ?? ''),
          title,
          massif,
          lat: asNumber(ev.lat),
          lng: asNumber(ev.lng),
          km: asNumber(ev.distance_km) ?? asNumber(ev.km),
          dplus: asNumber(ev.elevation_gain_m) ?? asNumber(ev.dplus),
          maxAlt: asNumber(ev.max_alt),
          routeTrace: ev.route_trace ?? ev.routeTrace,
          index,
        });

        return {
          id: String(ev.id ?? ''),
          title,
          massif,
          location,
          startsAtMs,
          endsAtMs,
          dateLabel,
          placeTerms: extractPlaceTerms({ massif, location, title }),
          coords: built.coords,
        };
      });

    const nowMs = Date.now();
    const hasLiveOuting = parsedEvents.some((ev) => isEventLive(ev, nowMs));

    // 3. Query user_profiles in chunks of 200 for all active members
    const profileMap = new Map<string, Row>();
    const liveMembers: ClubMapLiveMember[] = [];
    const idChunks = chunkArray(activeUserIds, CHUNK_SIZE);

    for (const chunk of idChunks) {
      const { data: profiles, error: profErr } = await db
        .from('user_profiles')
        .select('id, full_name, handle, avatar_url, share_club_location, last_lat, last_lng')
        .in('id', chunk);
      if (profErr) return dbFailure('GET club_map_profiles', profErr);

      for (const prof of asArray<Row>(profiles)) {
        const uid = asString(prof.id);
        if (!uid) continue;
        profileMap.set(uid, prof);

        const lat = asNumber(prof.last_lat);
        const lng = asNumber(prof.last_lng);
        if (prof.share_club_location !== true || lat === null || lng === null) continue;

        const fullName = asString(prof.full_name) ?? 'Membre du club';
        const handle =
          asString(prof.handle) ??
          fullName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .slice(0, 24);
        const coords = hasLiveOuting ? { lat, lng } : fuzzLocation250m(uid, lat, lng);

        liveMembers.push({
          id: uid,
          name: fullName,
          handle,
          role: formatClubRole(roleByUserId.get(uid) ?? null),
          avatarUrl: asString(prof.avatar_url),
          lat: coords.lat,
          lng: coords.lng,
          fuzzy: !hasLiveOuting,
        });
      }
    }

    // 4. Query carnet_moments with identified_species across all active members (chunks of 200)
    const pokedex: ClubMapPokedexItem[] = [];
    if (parsedEvents.length > 0 && idChunks.length > 0) {
      for (const chunk of idChunks) {
        const { data: moments, error: momentErr } = await db
          .from('carnet_moments')
          .select('id, auteur_id, auteur_nom, lieu, citation, identified_species, created_at')
          .in('auteur_id', chunk)
          .not('identified_species', 'is', null)
          .order('created_at', { ascending: false })
          .limit(300);
        if (momentErr) return dbFailure('GET club_map_moments', momentErr);

        for (const mr of asArray<Row>(moments)) {
          const matchedEvent = matchEventForMoment(mr, parsedEvents);
          if (!matchedEvent) continue;

          const speciesList = Array.isArray(mr.identified_species)
            ? mr.identified_species
            : mr.identified_species && typeof mr.identified_species === 'object'
              ? [mr.identified_species]
              : [];

          for (let sIdx = 0; sIdx < speciesList.length; sIdx += 1) {
            const sp = (speciesList[sIdx] ?? {}) as Row;
            const group = normalizeText(sp.group ?? sp.kingdom);
            if (group && EXCLUDED_KINGDOMS.has(group)) continue;

            const commonName = asString(sp.common_name ?? sp.commonName ?? sp.name ?? sp.n);
            const latinName = asString(sp.scientific_name ?? sp.latinName ?? sp.latin ?? sp.lat) ?? undefined;
            if (!commonName) continue;
            if (NON_FAUNA_RE.test(commonName) || (latinName && NON_FAUNA_RE.test(latinName))) continue;

            const authorId = asString(mr.auteur_id) ?? '';
            const authorProf = profileMap.get(authorId);
            const observerName =
              asString(authorProf?.full_name) ?? asString(mr.auteur_nom) ?? 'Membre du club';
            const rawCreated = asString(mr.created_at);
            const observedAt = rawCreated
              ? new Date(rawCreated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
              : matchedEvent.dateLabel;
            const confidence =
              typeof sp.confidence === 'number' && Number.isFinite(sp.confidence)
                ? `${Math.round(sp.confidence * 100)}%`
                : undefined;

            const itemId = `${String(mr.id ?? '')}-${sIdx}`;
            const trackProgress = Number((0.18 + hashUnit(`pokedex:${itemId}`) * 0.66).toFixed(3));
            const [snappedLng, snappedLat] = snapPointAlongTrack(matchedEvent.coords, trackProgress);

            pokedex.push({
              id: itemId,
              commonName,
              latinName,
              outingId: matchedEvent.id,
              outingTitle: matchedEvent.title,
              observerName,
              observedAt,
              confidence,
              lat: snappedLat,
              lng: snappedLng,
              trackProgress,
            });
          }
        }
      }
    }

    return json({
      data: {
        liveMembers,
        pokedex,
      },
    });
  } catch (err) {
    return dbFailure('GET club_map', err);
  }
}
