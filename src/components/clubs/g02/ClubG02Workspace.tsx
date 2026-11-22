'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ActivityEventMatch,
  ChallengeMetric,
  ChallengeParticipantProgress,
  Club,
  ClubActivityInput,
  ClubChallenge,
  ClubChallengeSummary,
  ClubChannel,
  ClubChannelMessage,
  ClubEvent,
  ClubJoinRequest,
  ClubMember,
  ClubRole,
  EventAttendanceRecord,
  EventRegistration,
  GroupActivityCluster,
  InviteLink,
  ParticipantRouteSyncState,
  RecordedActivityInvite,
  RouteRevisionSnapshot,
  ViewerPrivacyContext,
  WeeklyClubLeaderboard,
} from '@/features/clubs';
import { createClient } from '@/lib/supabase/client';
import { ClubActivityMatchingPanel } from './ClubActivityMatchingPanel';
import { ClubCollectionsPanel } from './ClubCollectionsPanel';
import { ClubChallengesPanel, type ClubChallengeCreateInput } from './ClubChallengesPanel';
import { ClubEventDetail } from './ClubEventDetail';
import { ClubEventsBoard } from './ClubEventsBoard';
import { ClubG02Screen, type ClubG02Section } from './ClubG02Screen';
import { ClubInvitesPanel, type CreateInviteInput } from './ClubInvitesPanel';
import { ClubLeaderboard } from './ClubLeaderboard';
import { ClubMembersPanel } from './ClubMembersPanel';
import { ClubSalonsPanel } from './ClubSalonsPanel';
import type { EventCounts } from './model';
import styles from './g02.module.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ClubG02WorkspaceProps {
  clubId: string;
  initialSection?: ClubG02Section;
  lockedSection?: boolean;
  currentUserId?: string | null;
  onOpenActivity?: (activityId: string) => void;
}

async function readApiJson<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as { data?: T; error?: string; message?: string } | null;
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || `Erreur ${res.status}`);
  }
  return (payload?.data ?? payload) as T;
}

export function ClubG02Workspace({
  clubId,
  initialSection = 'events',
  lockedSection = false,
  currentUserId: currentUserIdProp,
  onOpenActivity,
}: ClubG02WorkspaceProps) {
  const isValidClubId = UUID_RE.test(clubId);

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(currentUserIdProp ?? null);
  const [activeSection, setActiveSection] = useState<ClubG02Section>(initialSection);

  const [club, setClub] = useState<Club | null>(null);
  const [viewerMembership, setViewerMembership] = useState<ClubMember | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<ClubJoinRequest[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, EventCounts>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetailData, setEventDetailData] = useState<{
    event: ClubEvent;
    club: Club;
    coHostClubs: Club[];
    registrations: EventRegistration[];
    eventCounts: EventCounts;
    attendanceRecords: EventAttendanceRecord[];
    latestRevision: RouteRevisionSnapshot | null;
    routeSyncState: ParticipantRouteSyncState | null;
  } | null>(null);

  const [channels, setChannels] = useState<ClubChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClubChannelMessage[]>([]);

  const [challengeSummaries, setChallengeSummaries] = useState<ClubChallengeSummary[]>([]);
  const [challengeProgress, setChallengeProgress] = useState<ChallengeParticipantProgress[]>([]);
  const [canCreateChallenges, setCanCreateChallenges] = useState(false);

  const [leaderboard, setLeaderboard] = useState<WeeklyClubLeaderboard | null>(null);
  const [leaderboardSports, setLeaderboardSports] = useState<string[]>([]);
  const [leaderboardMetric, setLeaderboardMetric] = useState<ChallengeMetric>('distance_m');
  const [leaderboardSport, setLeaderboardSport] = useState<string | null>(null);

  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [activityInvites, setActivityInvites] = useState<RecordedActivityInvite[]>([]);

  const [matches, setMatches] = useState<ActivityEventMatch[]>([]);
  const [matchingActivities, setMatchingActivities] = useState<ClubActivityInput[]>([]);
  const [clusters, setClusters] = useState<GroupActivityCluster[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const [loadingBase, setLoadingBase] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [errorBase, setErrorBase] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserIdProp !== undefined) {
      setResolvedUserId(currentUserIdProp);
      return;
    }
    let active = true;
    const supabase = createClient();
    if (!supabase?.auth?.getUser) {
      setResolvedUserId(null);
      return;
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setResolvedUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (active) setResolvedUserId(null);
      });
    return () => {
      active = false;
    };
  }, [currentUserIdProp]);

  const currentUserId = currentUserIdProp !== undefined ? currentUserIdProp : resolvedUserId;
  const nowIso = new Date().toISOString();

  const viewerContext = useMemo<ViewerPrivacyContext>(() => {
    const clubIds = new Set<string>();
    if (viewerMembership?.status === 'active') clubIds.add(clubId);
    return {
      viewerId: currentUserId,
      viewerClubIds: clubIds,
    };
  }, [clubId, currentUserId, viewerMembership]);

  const clubsById = useMemo<Record<string, Club>>(() => {
    return club ? { [club.id]: club } : {};
  }, [club]);

  const loadBaseAndEvents = useCallback(async () => {
    if (!isValidClubId) return;
    setLoadingBase(true);
    setErrorBase(null);
    try {
      const [clubRes, eventsRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}`, { credentials: 'include' }),
        fetch(`/api/clubs/${clubId}/events`, { credentials: 'include' }),
      ]);
      const clubPayload = await readApiJson<{
        club: Club;
        viewerMembership: ClubMember | null;
        members: ClubMember[];
        events: ClubEvent[];
        channels: ClubChannel[];
      }>(clubRes);
      setClub(clubPayload.club);
      setViewerMembership(clubPayload.viewerMembership ?? null);
      if (clubPayload.members?.length) setMembers(clubPayload.members);
      if (clubPayload.channels?.length) setChannels(clubPayload.channels);

      if (eventsRes.ok) {
        const eventsPayload = await readApiJson<{
          events: ClubEvent[];
          registrations: EventRegistration[];
          eventCounts: Record<string, EventCounts>;
        }>(eventsRes);
        setEvents(eventsPayload.events ?? []);
        setRegistrations(eventsPayload.registrations ?? []);
        setEventCounts(eventsPayload.eventCounts ?? {});
      } else {
        setEvents(clubPayload.events ?? []);
      }
    } catch (err) {
      setErrorBase(err instanceof Error ? err.message : 'Impossible de charger le club.');
    } finally {
      setLoadingBase(false);
    }
  }, [clubId, isValidClubId]);

  useEffect(() => {
    setSelectedEventId(null);
    setEventDetailData(null);
    void loadBaseAndEvents();
  }, [loadBaseAndEvents]);

  const loadEventDetail = useCallback(
    async (eventId: string) => {
      if (!isValidClubId) return;
      setSectionLoading(true);
      setSectionError(null);
      try {
        const res = await fetch(`/api/clubs/${clubId}/events/${eventId}`, {
          credentials: 'include',
        });
        const data = await readApiJson<{
          event: ClubEvent;
          club: Club;
          coHostClubs: Club[];
          registrations: EventRegistration[];
          eventCounts: EventCounts;
          attendanceRecords: EventAttendanceRecord[];
          latestRevision: RouteRevisionSnapshot | null;
          routeSyncState: ParticipantRouteSyncState | null;
        }>(res);
        setEventDetailData(data);
      } catch (err) {
        setSectionError(err instanceof Error ? err.message : 'Impossible de charger la sortie.');
      } finally {
        setSectionLoading(false);
      }
    },
    [clubId, isValidClubId],
  );

  const loadSalons = useCallback(
    async (channelId?: string | null) => {
      if (!isValidClubId) return;
      setSectionLoading(true);
      setSectionError(null);
      try {
        const qs = channelId ? `?channelId=${encodeURIComponent(channelId)}` : '';
        const res = await fetch(`/api/clubs/${clubId}/salons${qs}`, { credentials: 'include' });
        const data = await readApiJson<{
          channels: ClubChannel[];
          activeChannelId: string | null;
          messages: ClubChannelMessage[];
        }>(res);
        setChannels(data.channels ?? []);
        setActiveChannelId(data.activeChannelId ?? null);
        setMessages(data.messages ?? []);
      } catch (err) {
        setSectionError(err instanceof Error ? err.message : 'Salons réservés aux membres actifs.');
      } finally {
        setSectionLoading(false);
      }
    },
    [clubId, isValidClubId],
  );

  const loadChallenges = useCallback(async () => {
    if (!isValidClubId) return;
    setSectionLoading(true);
    setSectionError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/challenges`, { credentials: 'include' });
      const data = await readApiJson<{
        summaries: ClubChallengeSummary[];
        progress: ChallengeParticipantProgress[];
        canCreate: boolean;
      }>(res);
      setChallengeSummaries(data.summaries ?? []);
      setChallengeProgress(data.progress ?? []);
      setCanCreateChallenges(Boolean(data.canCreate));
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Impossible de charger les défis.');
    } finally {
      setSectionLoading(false);
    }
  }, [clubId, isValidClubId]);

  const loadLeaderboard = useCallback(
    async (metric: ChallengeMetric, sport: string | null) => {
      if (!isValidClubId) return;
      setSectionLoading(true);
      setSectionError(null);
      try {
        const params = new URLSearchParams({ metric });
        if (sport) params.set('sport', sport);
        const res = await fetch(`/api/clubs/${clubId}/leaderboard?${params.toString()}`, {
          credentials: 'include',
        });
        const data = await readApiJson<{
          leaderboard: WeeklyClubLeaderboard;
          sports: string[];
        }>(res);
        setLeaderboard(data.leaderboard);
        setLeaderboardSports(data.sports ?? []);
      } catch (err) {
        setSectionError(err instanceof Error ? err.message : 'Impossible de charger le classement.');
      } finally {
        setSectionLoading(false);
      }
    },
    [clubId, isValidClubId],
  );

  const loadMembers = useCallback(async () => {
    if (!isValidClubId) return;
    setSectionLoading(true);
    setSectionError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`, { credentials: 'include' });
      const data = await readApiJson<{
        members: ClubMember[];
        joinRequests: ClubJoinRequest[];
      }>(res);
      setMembers(data.members ?? []);
      setJoinRequests(data.joinRequests ?? []);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Impossible de charger les membres.');
    } finally {
      setSectionLoading(false);
    }
  }, [clubId, isValidClubId]);

  const loadInvites = useCallback(async () => {
    if (!isValidClubId) return;
    setSectionLoading(true);
    setSectionError(null);
    try {
      const [invRes, actRes] = await Promise.all([
        fetch(`/api/clubs/invites?clubId=${encodeURIComponent(clubId)}`, { credentials: 'include' }),
        fetch('/api/clubs/activity-invites', { credentials: 'include' }),
      ]);
      if (invRes.ok) {
        const data = await readApiJson<InviteLink[]>(invRes);
        setInvites(Array.isArray(data) ? data : []);
      } else {
        setInvites([]);
      }
      if (actRes.ok) {
        const actData = await readApiJson<RecordedActivityInvite[]>(actRes);
        setActivityInvites(Array.isArray(actData) ? actData : []);
      } else {
        setActivityInvites([]);
      }
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Impossible de charger les invitations.');
    } finally {
      setSectionLoading(false);
    }
  }, [clubId, isValidClubId]);

  const loadMatching = useCallback(async () => {
    if (!isValidClubId) return;
    setSectionLoading(true);
    setSectionError(null);
    try {
      const res = await fetch(`/api/clubs/matching?clubId=${encodeURIComponent(clubId)}`, {
        credentials: 'include',
      });
      const data = await readApiJson<{
        matches: ActivityEventMatch[];
        activities: ClubActivityInput[];
        clusters: GroupActivityCluster[];
        memberNames: Record<string, string>;
      }>(res);
      setMatches(data.matches ?? []);
      setMatchingActivities(data.activities ?? []);
      setClusters(data.clusters ?? []);
      setMemberNames(data.memberNames ?? {});
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Impossible de charger les activités.');
    } finally {
      setSectionLoading(false);
    }
  }, [clubId, isValidClubId]);

  useEffect(() => {
    if (!isValidClubId) return;
    if (activeSection === 'salons') void loadSalons(activeChannelId);
    else if (activeSection === 'challenges') void loadChallenges();
    else if (activeSection === 'leaderboard') void loadLeaderboard(leaderboardMetric, leaderboardSport);
    else if (activeSection === 'members') void loadMembers();
    else if (activeSection === 'invites') void loadInvites();
    else if (activeSection === 'matching') void loadMatching();
  }, [
    activeChannelId,
    activeSection,
    isValidClubId,
    leaderboardMetric,
    leaderboardSport,
    loadChallenges,
    loadInvites,
    loadLeaderboard,
    loadMatching,
    loadMembers,
    loadSalons,
  ]);

  if (!isValidClubId) {
    return (
      <div className={styles.empty}>
        <p className={styles.muted}>
          Cet aperçu est local : ouvrez ou créez un club enregistré pour accéder aux sorties, salons, défis et classements.
        </p>
      </div>
    );
  }

  if (loadingBase && !club) {
    return (
      <div className={styles.empty}>
        <p className={styles.muted}>Chargement de l’espace club…</p>
      </div>
    );
  }

  if (errorBase || !club) {
    return (
      <div className={styles.empty}>
        <p className={styles.errorText}>{errorBase ?? 'Club introuvable ou accès restreint.'}</p>
        <button type="button" className={styles.ghostBtn} onClick={() => void loadBaseAndEvents()}>
          Réessayer
        </button>
      </div>
    );
  }

  const eventAction = async (eventId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/clubs/${clubId}/events/${eventId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await readApiJson(res);
    await loadBaseAndEvents();
    if (selectedEventId === eventId) await loadEventDetail(eventId);
  };

  const sectionContent = (
    <>
      {activeSection === 'events' && (
        selectedEventId && eventDetailData ? (
          <ClubEventDetail
            event={eventDetailData.event}
            club={eventDetailData.club}
            coHostClubs={eventDetailData.coHostClubs}
            memberships={members}
            registrations={eventDetailData.registrations}
            eventCounts={eventDetailData.eventCounts}
            attendanceRecords={eventDetailData.attendanceRecords}
            viewerContext={viewerContext}
            currentUserId={currentUserId}
            nowIso={nowIso}
            shareUrl={
              typeof window !== 'undefined'
                ? `${window.location.origin}/sorties/${eventDetailData.event.id}?source=club`
                : `/sorties/${eventDetailData.event.id}?source=club`
            }
            latestRevision={eventDetailData.latestRevision}
            routeSyncState={eventDetailData.routeSyncState}
            onBack={() => {
              setSelectedEventId(null);
              setEventDetailData(null);
            }}
            onRegister={(paceGroupId) =>
              eventAction(eventDetailData.event.id, {
                action: 'register',
                paceGroupId: paceGroupId ?? null,
              })
            }
            onCancel={() => eventAction(eventDetailData.event.id, { action: 'cancel' })}
            onPublishRoute={(input) =>
              eventAction(eventDetailData.event.id, {
                action: 'publish_route',
                ...input,
              })
            }
            onSyncRoute={() => eventAction(eventDetailData.event.id, { action: 'sync_route' })}
            onDecideRoute={(revision, adopt) => eventAction(eventDetailData.event.id, {
              action: 'decide_route', revision, adopt,
            })}
            onCopyShareUrl={async (url) => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(url);
              }
            }}
          />
        ) : (
          <ClubEventsBoard
            events={events}
            clubsById={clubsById}
            memberships={members}
            viewerContext={viewerContext}
            registrations={registrations}
            eventCounts={eventCounts}
            currentUserId={currentUserId}
            nowIso={nowIso}
            loading={loadingBase || sectionLoading}
            error={sectionError}
            onRegister={(event, paceGroupId) =>
              eventAction(event.id, { action: 'register', paceGroupId: paceGroupId ?? null })
            }
            onCancel={(event) => eventAction(event.id, { action: 'cancel' })}
            onOpen={(event) => {
              setSelectedEventId(event.id);
              void loadEventDetail(event.id);
            }}
            onRetry={() => void loadBaseAndEvents()}
          />
        )
      )}

      {activeSection === 'salons' && (
        <ClubSalonsPanel
          channels={channels}
          activeChannelId={activeChannelId}
          messages={messages}
          memberships={members}
          viewerContext={viewerContext}
          currentUserId={currentUserId}
          nowIso={nowIso}
          loading={sectionLoading}
          error={sectionError}
          onSelectChannel={(cid) => {
            setActiveChannelId(cid);
            void loadSalons(cid);
          }}
          onSendMessage={async (channel, body) => {
            const res = await fetch(`/api/clubs/${clubId}/salons`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'post_message',
                channelId: channel.id,
                body,
              }),
            });
            await readApiJson(res);
            await loadSalons(channel.id);
          }}
          onModerateMessage={async (message, action, reason) => {
            const res = await fetch(`/api/clubs/${clubId}/salons`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'moderate',
                messageId: message.id,
                moderation: action,
                reason: reason ?? undefined,
              }),
            });
            await readApiJson(res);
            await loadSalons(message.channelId);
          }}
          onReportMessage={async (message, reason) => {
            const res = await fetch(`/api/clubs/${clubId}/salons`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'report',
                messageId: message.id,
                reason,
              }),
            });
            await readApiJson(res);
          }}
          onRetry={() => void loadSalons(activeChannelId)}
        />
      )}

      {activeSection === 'challenges' && (
        <ClubChallengesPanel
          summaries={challengeSummaries}
          progress={challengeProgress}
          currentUserId={currentUserId}
          nowIso={nowIso}
          canCreate={canCreateChallenges}
          loading={sectionLoading}
          error={sectionError}
          onJoin={async (challenge) => {
            const res = await fetch(`/api/clubs/${clubId}/challenges`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'join', challengeId: challenge.id }),
            });
            await readApiJson(res);
            await loadChallenges();
          }}
          onCreate={async (input: ClubChallengeCreateInput) => {
            const res = await fetch(`/api/clubs/${clubId}/challenges`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create',
                scope: 'club',
                ...input,
              }),
            });
            await readApiJson(res);
            await loadChallenges();
          }}
          onRetry={() => void loadChallenges()}
        />
      )}

      {activeSection === 'leaderboard' && (
        <ClubLeaderboard
          leaderboard={
            leaderboard ?? {
              clubId,
              metric: leaderboardMetric,
              sport: leaderboardSport,
              weekStartIso: nowIso,
              weekEndIso: nowIso,
              entries: [],
              excludedCount: 0,
            }
          }
          sports={leaderboardSports}
          loading={sectionLoading}
          error={sectionError}
          onMetricChange={(metric) => setLeaderboardMetric(metric)}
          onSportChange={(sport) => setLeaderboardSport(sport)}
          onRetry={() => void loadLeaderboard(leaderboardMetric, leaderboardSport)}
        />
      )}

      {activeSection === 'members' && (
        <ClubMembersPanel
          club={club}
          members={members}
          joinRequests={joinRequests}
          viewerContext={viewerContext}
          currentUserId={currentUserId}
          nowIso={nowIso}
          loading={sectionLoading}
          error={sectionError}
          onReviewRequest={async (request, approve) => {
            const res = await fetch(`/api/clubs/${clubId}/members`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'review', requestId: request.id, approve }),
            });
            await readApiJson(res);
            await loadMembers();
          }}
          onChangeRole={async (member, role: ClubRole) => {
            const res = await fetch(`/api/clubs/${clubId}/members`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'role', userId: member.userId, role }),
            });
            await readApiJson(res);
            await loadMembers();
          }}
          onRemoveMember={async (member, mode) => {
            const res = await fetch(`/api/clubs/${clubId}/members`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'remove', userId: member.userId, mode }),
            });
            await readApiJson(res);
            await loadMembers();
          }}
          onMuteMember={async (member, mutedUntil) => {
            const res = await fetch(`/api/clubs/${clubId}/members`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'mute', userId: member.userId, mutedUntil }),
            });
            await readApiJson(res);
            await loadMembers();
          }}
          onRetry={() => void loadMembers()}
        />
      )}

      {activeSection === 'invites' && (
        <ClubInvitesPanel
          invites={invites}
          activityInvites={activityInvites}
          memberships={members}
          viewerContext={viewerContext}
          currentUserId={currentUserId}
          nowIso={nowIso}
          canCreate={viewerMembership?.status === 'active'}
          loading={sectionLoading}
          error={sectionError}
          onCreateInvite={async (input: CreateInviteInput) => {
            const res = await fetch('/api/clubs/invites', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(input),
            });
            await readApiJson(res);
            await loadInvites();
          }}
          onRevokeInvite={async (invite) => {
            const res = await fetch(`/api/clubs/invites/${encodeURIComponent(invite.token)}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            await readApiJson(res);
            await loadInvites();
          }}
          onRespondActivityInvite={async (invite, action) => {
            const res = await fetch('/api/clubs/activity-invites', {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inviteId: invite.id, action }),
            });
            await readApiJson(res);
            await loadInvites();
          }}
          onRetry={() => void loadInvites()}
        />
      )}

      {activeSection === 'collections' && (
        <ClubCollectionsPanel
          clubId={club.id}
          canWrite={Boolean(viewerMembership && viewerMembership.status === 'active')}
        />
      )}

      {activeSection === 'matching' && (
        <ClubActivityMatchingPanel
          activities={matchingActivities}
          clusters={clusters}
          matches={matches}
          blocks={viewerContext.blocks}
          nowIso={nowIso}
          currentUserId={currentUserId}
          memberNames={memberNames}
          onDetachMatch={async (match) => {
            const res = await fetch('/api/clubs/matching', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'detach', matchId: match.id }),
            });
            await readApiJson(res);
            await loadMatching();
          }}
          onOpenActivity={onOpenActivity}
        />
      )}
    </>
  );

  if (lockedSection) {
    return (
      <div className={styles.workspace} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sectionContent}
      </div>
    );
  }

  return (
    <ClubG02Screen
      club={club}
      memberCount={members.filter((m) => m.status === 'active').length}
      eventCount={events.length}
      challengeCount={challengeSummaries.length}
      viewerMembership={viewerMembership}
      activeSection={activeSection}
      onSectionChange={(section) => {
        setSelectedEventId(null);
        setActiveSection(section);
      }}
      onInvite={() => setActiveSection('invites')}
      sportContext={club.primarySport}
    >
      {sectionContent}
    </ClubG02Screen>
  );
}
export default ClubG02Workspace;
