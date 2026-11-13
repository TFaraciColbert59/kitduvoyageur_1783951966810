import type { SupabaseClient } from '@supabase/supabase-js';

import {
  canViewClub,
  isActiveMember,
  type Club,
  type ClubChannel,
  type ClubEvent,
  type ClubMember,
  type EventAttendanceRecord,
  type EventRegistration,
  type ViewerPrivacyContext,
} from '@/features/clubs';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import {
  asArray,
  asBoolean,
  asString,
  mapChannelRow,
  mapClubRow,
  mapEventRow,
  mapMemberRow,
  mapRegistrationRow,
  type Row,
} from './mappers';

export interface ViewerContextResult {
  context: ViewerPrivacyContext;
  memberships: ClubMember[];
}

/** Contexte P01/S6.19 du lecteur : blocages + clubs dont il est membre actif. */
export async function loadViewerContext(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<ViewerContextResult> {
  if (!userId) return { context: { viewerId: null }, memberships: [] };

  const [{ data: blockRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id, created_at')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
      .limit(500),
    supabase
      .from('club_members')
      .select('club_id, user_id, role, status, joined_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(500),
  ]);

  const blocks = asArray<Row>(blockRows).map((row) => ({
    blockerId: String(row.blocker_id ?? ''),
    blockedId: String(row.blocked_id ?? ''),
    createdAt: String(row.created_at ?? ''),
  }));

  return {
    context: {
      viewerId: userId,
      blocks,
      viewerClubIds: new Set(asArray<Row>(memberRows).map((row) => String(row.club_id ?? ''))),
    },
    memberships: asArray<Row>(memberRows).map((row) => mapMemberRow(row)),
  };
}

export async function loadClubMembers(supabase: SupabaseClient, clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('*')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = asArray<Row>(data);
  const profiles = await fetchPublicProfilesWith(
    supabase,
    rows.map((row) => asString(row.user_id)),
  );
  return rows.map((row) => mapMemberRow(row, profiles[String(row.user_id ?? '')]));
}

export async function loadClub(
  supabase: SupabaseClient,
  clubId: string,
): Promise<Club | null> {
  const { data, error } = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
  if (error) throw error;
  return data ? mapClubRow(data as Row) : null;
}

export interface ClubBundle {
  club: Club;
  members: ClubMember[];
  viewerMembership: ClubMember | null;
  viewerContext: ViewerPrivacyContext;
}

export async function loadClubBundle(
  supabase: SupabaseClient,
  clubId: string,
  userId: string | null,
): Promise<ClubBundle | null> {
  const [club, members, viewer] = await Promise.all([
    loadClub(supabase, clubId),
    loadClubMembers(supabase, clubId),
    loadViewerContext(supabase, userId),
  ]);
  if (!club) return null;
  return {
    club,
    members,
    viewerMembership: userId
      ? members.find((member) => member.userId === userId) ?? null
      : null,
    viewerContext: {
      ...viewer.context,
      viewerClubIds: new Set([
        ...(viewer.context.viewerClubIds ?? []),
        ...members
          .filter((member) => member.userId === userId && isActiveMember(member))
          .map((member) => member.clubId),
      ]),
    },
  };
}

export function canReadClub(bundle: ClubBundle): boolean {
  return canViewClub(bundle.club, bundle.viewerContext, bundle.members);
}

export function isManager(bundle: ClubBundle): boolean {
  return Boolean(
    bundle.viewerMembership &&
      isActiveMember(bundle.viewerMembership) &&
      (bundle.viewerMembership.role === 'admin' || bundle.viewerMembership.role === 'moderator'),
  );
}

export function isAdmin(bundle: ClubBundle): boolean {
  return Boolean(
    bundle.viewerMembership && isActiveMember(bundle.viewerMembership) && bundle.viewerMembership.role === 'admin',
  );
}

export async function loadEvent(
  supabase: SupabaseClient,
  eventId: string,
  clubId?: string,
): Promise<ClubEvent | null> {
  let query = supabase.from('club_events').select('*').eq('id', eventId);
  if (clubId) query = query.eq('club_id', clubId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapEventRow(data as Row) : null;
}

export async function loadEvents(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubEvent[]> {
  const { data, error } = await supabase
    .from('club_events')
    .select('*')
    .eq('club_id', clubId)
    .order('event_date', { ascending: true })
    .limit(200);
  if (error) throw error;
  return asArray<Row>(data).map(mapEventRow);
}

export async function loadEventRegistrations(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventRegistration[]> {
  const { data, error } = await supabase
    .from('club_event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .limit(1000);
  if (error) throw error;
  return asArray<Row>(data).map(mapRegistrationRow);
}

export async function loadAttendanceRecords(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('club_event_attendance')
    .select('*')
    .eq('event_id', eventId)
    .limit(1000);
  if (error) throw error;
  return asArray<Row>(data).map((row) => ({
    eventId: String(row.event_id ?? ''),
    userId: String(row.user_id ?? ''),
    activityId: String(row.activity_id ?? ''),
    consentGranted: asBoolean(row.consent_granted),
    activityVisibility: (asString(row.activity_visibility) as EventAttendanceRecord['activityVisibility']) ?? 'private',
    matchedAt: String(row.matched_at ?? ''),
  }));
}

export async function loadChannels(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubChannel[]> {
  const { data, error } = await supabase
    .from('club_channels')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  return asArray<Row>(data).map(mapChannelRow);
}
