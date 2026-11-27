import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  canViewClubEvent,
  isActiveMember,
} from '@/features/clubs';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  isUuid,
  json,
  optionalUser,
  readJson,
} from '../../../../_lib/http';
import {
  canReadClub,
  loadClubBundle,
} from '../../../../_lib/db';
import { asArray, asNumber, asString, iso, mapEventRow, type Row } from '../../../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const directionEnum = z.enum(['aller_retour', 'aller', 'retour']);
const modeEnum = z.enum(['carpool', 'minibus_club', 'train', 'bus', 'bike', 'foot']);

const transportActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('offer_transport'),
      direction: directionEnum.default('aller_retour'),
      mode: modeEnum.default('carpool'),
      outboundFromLabel: z.string().trim().min(2).max(160),
      outboundFromLat: z.number().min(-90).max(90).nullish(),
      outboundFromLng: z.number().min(-180).max(180).nullish(),
      outboundDepartureAt: z.string().trim().max(40).nullish(),
      outboundToLabel: z.string().trim().max(160).nullish(),
      returnFromLabel: z.string().trim().max(160).nullish(),
      returnFromLat: z.number().min(-90).max(90).nullish(),
      returnFromLng: z.number().min(-180).max(180).nullish(),
      returnDepartureAt: z.string().trim().max(40).nullish(),
      returnToLabel: z.string().trim().max(160).nullish(),
      seatsTotal: z.number().int().min(0).max(50).default(3),
      gearNotes: z.string().trim().max(240).nullish(),
      costShareCents: z.number().int().min(0).max(50000).default(0),
      notes: z.string().trim().max(400).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('book_seat'),
      transportId: z.string().uuid(),
      leg: directionEnum.default('aller_retour'),
      pickupNote: z.string().trim().max(200).nullish(),
      hasBulkyGear: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal('cancel_booking'),
      transportId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('delete_transport'),
      transportId: z.string().uuid(),
    })
    .strict(),
]);

function isMissingRelationError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    Boolean(err?.message?.includes('club_event_transports'))
  );
}

/** GET — trajets Aller & Retour (covoiturage, minibus club, train, bus) d'une sortie. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id, eventId } = await context.params;
  if (!isUuid(id) || !isUuid(eventId)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const { data: evRow, error: evErr } = await supabase
      .from('club_events')
      .select('*')
      .eq('id', eventId)
      .eq('club_id', id)
      .maybeSingle();
    if (evErr) return dbFailure('GET transport event', evErr);
    if (!evRow) return errorJson('not_found', 404);
    const event = mapEventRow(evRow as Row);
    if (!canViewClubEvent(event, bundle.club, bundle.viewerContext, bundle.members)) {
      return errorJson('not_found', 404);
    }

    const [{ data: transportRows, error: tErr }, { data: bookingRows, error: bErr }] =
      await Promise.all([
        supabase
          .from('club_event_transports')
          .select('*')
          .eq('event_id', eventId)
          .eq('club_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('club_event_transport_bookings')
          .select('*')
          .eq('event_id', eventId)
          .eq('status', 'confirmed')
          .order('created_at', { ascending: true }),
      ]);

    if (tErr) {
      if (isMissingRelationError(tErr)) {
        return json({ data: { transports: [], migrationPending: true } });
      }
      return dbFailure('GET club_event_transports', tErr);
    }
    if (bErr && !isMissingRelationError(bErr)) {
      return dbFailure('GET club_event_transport_bookings', bErr);
    }

    const transports = asArray<Row>(transportRows);
    const bookings = asArray<Row>(bookingRows);

    const userIds = Array.from(
      new Set<string>([
        ...transports.map((r) => asString(r.organizer_id) ?? '').filter(Boolean),
        ...bookings.map((r) => asString(r.user_id) ?? '').filter(Boolean),
      ]),
    );

    const profileMap = new Map<string, { name: string; handle: string; avatarUrl: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      for (const p of asArray<Row>(profiles)) {
        const pid = String(p.id ?? '');
        if (!pid) continue;
        profileMap.set(pid, {
          name: asString(p.full_name) ?? asString(p.username) ?? 'Membre',
          handle: asString(p.username) ?? '',
          avatarUrl: asString(p.avatar_url) ?? null,
        });
      }
    }

    const enriched = transports.map((row) => {
      const tid = String(row.id ?? '');
      const orgId = String(row.organizer_id ?? '');
      const orgProf = profileMap.get(orgId);
      const tBookings = bookings
        .filter((b) => String(b.transport_id ?? '') === tid)
        .map((b) => {
          const uid = String(b.user_id ?? '');
          const bProf = profileMap.get(uid);
          return {
            id: String(b.id ?? ''),
            transportId: tid,
            userId: uid,
            userName: bProf?.name ?? 'Membre',
            userHandle: bProf?.handle ?? '',
            userAvatarUrl: bProf?.avatarUrl ?? null,
            leg: (asString(b.leg) ?? 'aller_retour') as 'aller_retour' | 'aller' | 'retour',
            pickupNote: asString(b.pickup_note),
            hasBulkyGear: Boolean(b.has_bulky_gear),
          };
        });

      const seatsTotal = asNumber(row.seats_total) ?? 3;
      const usedAller = tBookings.filter((b) => b.leg === 'aller_retour' || b.leg === 'aller').length;
      const usedRetour = tBookings.filter((b) => b.leg === 'aller_retour' || b.leg === 'retour').length;
      const myBooking = user ? tBookings.find((b) => b.userId === user.id) ?? null : null;

      return {
        id: tid,
        eventId,
        clubId: id,
        organizerId: orgId,
        organizerName: orgProf?.name ?? 'Membre du club',
        organizerHandle: orgProf?.handle ?? '',
        organizerAvatarUrl: orgProf?.avatarUrl ?? null,
        direction: (asString(row.direction) ?? 'aller_retour') as 'aller_retour' | 'aller' | 'retour',
        mode: (asString(row.mode) ?? 'carpool') as 'carpool' | 'minibus_club' | 'train' | 'bus' | 'bike' | 'foot',
        outboundFromLabel: asString(row.outbound_from_label) ?? '',
        outboundFromLat: asNumber(row.outbound_from_lat),
        outboundFromLng: asNumber(row.outbound_from_lng),
        outboundDepartureAt: asString(row.outbound_departure_at) ? iso(row.outbound_departure_at) : null,
        outboundToLabel: asString(row.outbound_to_label),
        returnFromLabel: asString(row.return_from_label),
        returnFromLat: asNumber(row.return_from_lat),
        returnFromLng: asNumber(row.return_from_lng),
        returnDepartureAt: asString(row.return_departure_at) ? iso(row.return_departure_at) : null,
        returnToLabel: asString(row.return_to_label),
        seatsTotal,
        seatsLeftAller: Math.max(0, seatsTotal - usedAller),
        seatsLeftRetour: Math.max(0, seatsTotal - usedRetour),
        gearNotes: asString(row.gear_notes),
        costShareCents: asNumber(row.cost_share_cents) ?? 0,
        notes: asString(row.notes),
        bookings: tBookings,
        myBookingLeg: myBooking?.leg ?? null,
      };
    });

    return json({ data: { transports: enriched, migrationPending: false } });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/events/[eventId]/transport', error);
  }
}

/** POST — proposer un trajet, réserver une place Aller/Retour, annuler ou supprimer. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; eventId: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id, eventId } = await context.params;
  if (!isUuid(id) || !isUuid(eventId)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const parsed = transportActionSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);
    if (!bundle.viewerMembership || !isActiveMember(bundle.viewerMembership)) {
      return errorJson('forbidden', 403);
    }

    const action = parsed.data;

    if (action.action === 'offer_transport') {
      const { data, error } = await supabase
        .from('club_event_transports')
        .insert({
          club_id: id,
          event_id: eventId,
          organizer_id: user.id,
          direction: action.direction,
          mode: action.mode,
          outbound_from_label: action.outboundFromLabel,
          outbound_from_lat: action.outboundFromLat ?? null,
          outbound_from_lng: action.outboundFromLng ?? null,
          outbound_departure_at: action.outboundDepartureAt ?? null,
          outbound_to_label: action.outboundToLabel ?? null,
          return_from_label: action.returnFromLabel ?? null,
          return_from_lat: action.returnFromLat ?? null,
          return_from_lng: action.returnFromLng ?? null,
          return_departure_at: action.returnDepartureAt ?? null,
          return_to_label: action.returnToLabel ?? null,
          seats_total: action.seatsTotal,
          gear_notes: action.gearNotes ?? null,
          cost_share_cents: action.costShareCents,
          notes: action.notes ?? null,
        })
        .select('*')
        .single();
      if (error) return dbFailure('POST offer_transport', error);
      return json({ data }, 201);
    }

    if (action.action === 'book_seat') {
      const { data: transport, error: tErr } = await supabase
        .from('club_event_transports')
        .select('id, seats_total, direction, organizer_id')
        .eq('id', action.transportId)
        .eq('event_id', eventId)
        .maybeSingle();
      if (tErr) return dbFailure('POST book_seat fetch', tErr);
      if (!transport) return errorJson('not_found', 404);

      const { data: existingBookings } = await supabase
        .from('club_event_transport_bookings')
        .select('user_id, leg')
        .eq('transport_id', action.transportId)
        .eq('status', 'confirmed');

      const others = asArray<Row>(existingBookings).filter(
        (b) => String(b.user_id ?? '') !== user.id,
      );
      const seatsTotal = asNumber((transport as Row).seats_total) ?? 3;
      const needAller = action.leg === 'aller_retour' || action.leg === 'aller';
      const needRetour = action.leg === 'aller_retour' || action.leg === 'retour';
      const usedAller = others.filter((b) => b.leg === 'aller_retour' || b.leg === 'aller').length;
      const usedRetour = others.filter((b) => b.leg === 'aller_retour' || b.leg === 'retour').length;

      if (seatsTotal > 0) {
        if (needAller && usedAller >= seatsTotal) {
          return errorJson('no_seats_aller', 409);
        }
        if (needRetour && usedRetour >= seatsTotal) {
          return errorJson('no_seats_retour', 409);
        }
      }

      const { data, error } = await supabase
        .from('club_event_transport_bookings')
        .upsert(
          {
            transport_id: action.transportId,
            event_id: eventId,
            user_id: user.id,
            leg: action.leg,
            pickup_note: action.pickupNote ?? null,
            has_bulky_gear: action.hasBulkyGear,
            status: 'confirmed',
          },
          { onConflict: 'transport_id,user_id' },
        )
        .select('*')
        .single();
      if (error) return dbFailure('POST book_seat upsert', error);
      return json({ data }, 201);
    }

    if (action.action === 'cancel_booking') {
      const { error } = await supabase
        .from('club_event_transport_bookings')
        .delete()
        .eq('transport_id', action.transportId)
        .eq('user_id', user.id);
      if (error) return dbFailure('POST cancel_booking', error);
      return json({ data: { cancelled: true } });
    }

    const { error } = await supabase
      .from('club_event_transports')
      .delete()
      .eq('id', action.transportId)
      .eq('event_id', eventId)
      .eq('organizer_id', user.id);
    if (error) return dbFailure('POST delete_transport', error);
    return json({ data: { deleted: true } });
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/events/[eventId]/transport', error);
  }
}
