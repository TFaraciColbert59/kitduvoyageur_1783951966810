'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle2, MapPin, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { ClubVolunteerAssignmentStatus, ClubVolunteerShift } from '@/features/clubs/types';
import type {
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
} from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminGlassSelect } from '../AdminGlassSelect';
import { AdminCollapsibleCreate, AdminStatusPill } from '../AdminPrimitives';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminEventsOpsPaneProps {
  activeClub: ClubItemData;
  outings: ClubOutingData[];
  members: ClubMemberData[];
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

export function AdminEventsOpsPane({
  activeClub,
  outings,
  members,
  caps,
  onToast,
}: AdminEventsOpsPaneProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>(outings[0]?.id ?? '');
  const [shifts, setShifts] = useState<ClubVolunteerShift[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [openAssignShiftId, setOpenAssignShiftId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [zoneLabel, setZoneLabel] = useState('');
  const [capacity, setCapacity] = useState('6');
  const [creating, setCreating] = useState(false);
  const [assignMemberByShift, setAssignMemberByShift] = useState<Record<string, string>>({});

  const canManageShifts = caps.has('volunteers.manage_shifts');

  const loadShifts = useCallback(async () => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    setLoading(true);
    try {
      const qs =
        selectedEventId && UUID_RE.test(selectedEventId)
          ? `?eventId=${encodeURIComponent(selectedEventId)}`
          : '';
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/volunteers${qs}`, {
        credentials: 'include',
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { shifts?: ClubVolunteerShift[] };
      } | null;
      if (res.ok && payload?.data?.shifts) {
        setShifts(payload.data.shifts);
      }
    } finally {
      setLoading(false);
    }
  }, [activeClub.id, selectedEventId]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  const selectedEvent = outings.find((o) => o.id === selectedEventId) ?? outings[0] ?? null;
  const eventPct = selectedEvent
    ? Math.min(100, Math.round((selectedEvent.participantsCount / Math.max(1, selectedEvent.maxParticipants)) * 100))
    : 0;

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!canManageShifts || cleanTitle.length < 2 || !selectedEvent || creating) return;
    setCreating(true);
    const capNum = Math.max(1, Math.min(500, Number(capacity) || 4));
    try {
      if (
        UUID_RE.test(activeClub.id) &&
        UUID_RE.test(selectedEvent.id) &&
        typeof fetch === 'function'
      ) {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/volunteers`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_shift',
            eventId: selectedEvent.id,
            title: cleanTitle,
            zoneLabel: zoneLabel.trim() || null,
            capacity: capNum,
          }),
        });
        const payload = (await res.json().catch(() => null)) as {
          data?: ClubVolunteerShift;
        } | null;
        if (!res.ok || !payload?.data) throw new Error('Création refusée');
        setShifts((prev) => [...prev, { ...payload.data!, assignments: [] }]);
      } else {
        setShifts((prev) => [
          ...prev,
          {
            id: `shift-${Date.now()}`,
            clubId: activeClub.id,
            eventId: selectedEvent.id,
            title: cleanTitle,
            zoneLabel: zoneLabel.trim() || null,
            startsAt: null,
            endsAt: null,
            capacity: capNum,
            instructions: null,
            createdBy: null,
            createdAt: new Date().toISOString(),
            assignments: [],
          },
        ]);
      }
      setTitle('');
      setZoneLabel('');
      setCreateOpen(false);
      onToast?.({ title: 'Poste bénévole créé ✓', subtitle: cleanTitle });
    } catch {
      onToast?.({ title: 'Impossible de créer le poste' });
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (shiftId: string) => {
    const userId = assignMemberByShift[shiftId];
    if (!canManageShifts || !userId) return;
    if (
      UUID_RE.test(activeClub.id) &&
      UUID_RE.test(shiftId) &&
      UUID_RE.test(userId) &&
      typeof fetch === 'function'
    ) {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/volunteers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_volunteer', shiftId, userId }),
      });
      if (!res.ok) {
        onToast?.({ title: 'Affectation refusée' });
        return;
      }
      void loadShifts();
    } else {
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? {
                ...s,
                assignments: [
                  ...(s.assignments ?? []).filter((a) => a.userId !== userId),
                  {
                    id: `assign-${Date.now()}`,
                    shiftId,
                    clubId: activeClub.id,
                    userId,
                    status: 'assigned',
                    checkedInAt: null,
                    assignedBy: null,
                    notes: null,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : s,
        ),
      );
    }
    setAssignMemberByShift((prev) => ({ ...prev, [shiftId]: '' }));
    setOpenAssignShiftId(null);
    onToast?.({ title: 'Bénévole affecté ✓' });
  };

  const handleCheckIn = async (assignmentId: string, nextStatus: ClubVolunteerAssignmentStatus) => {
    if (!canManageShifts) return;
    if (
      UUID_RE.test(activeClub.id) &&
      UUID_RE.test(assignmentId) &&
      typeof fetch === 'function'
    ) {
      await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/volunteers`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_assignment', assignmentId, status: nextStatus }),
      });
    }
    setShifts((prev) =>
      prev.map((s) => ({
        ...s,
        assignments: (s.assignments ?? []).map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                status: nextStatus,
                checkedInAt: nextStatus === 'checked_in' ? new Date().toISOString() : null,
              }
            : a,
        ),
      })),
    );
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!canManageShifts) return;
    if (UUID_RE.test(activeClub.id) && UUID_RE.test(shiftId) && typeof fetch === 'function') {
      await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/volunteers`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_shift', shiftId }),
      });
    }
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    onToast?.({ title: 'Poste supprimé' });
  };

  const resolveMemberName = (userId: string) =>
    members.find((m) => m.userId === userId || m.id === userId)?.name ?? 'Bénévole';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
            <Calendar size={14} aria-hidden="true" />
            <span>Événement piloté</span>
          </span>
          {selectedEvent ? (
            <AdminStatusPill tone="sage">
              {selectedEvent.participantsCount}/{selectedEvent.maxParticipants} · {eventPct}%
            </AdminStatusPill>
          ) : null}
        </div>
        {outings.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>
            Aucun événement programmé pour le moment.
          </span>
        ) : (
          <>
            <AdminGlassSelect
              ariaLabel="Sélectionner un événement"
              value={selectedEvent?.id ?? ''}
              onChange={setSelectedEventId}
              options={outings.map((o) => ({
                value: o.id,
                label: `${o.title} · ${o.date}`,
              }))}
            />
            {selectedEvent ? (
              <ProgressBar
                value={eventPct}
                tone={eventPct >= 90 ? 'warn' : 'sage'}
                label={`Taux d’inscription ${selectedEvent.title}`}
              />
            ) : null}
          </>
        )}
      </div>

      {canManageShifts && selectedEvent ? (
        <AdminCollapsibleCreate
          label="Nouveau poste"
          open={createOpen}
          onToggle={setCreateOpen}
          rightSlot={
            <AdminStatusPill tone="neutral">{shifts.length} postes</AdminStatusPill>
          }
        >
          <form onSubmit={handleCreateShift} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Ex : Ravitaillement km 15, Retrait dossards…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px', gap: 8 }}>
              <input
                type="text"
                className="club-glass-input"
                placeholder="Zone / Lieu"
                value={zoneLabel}
                onChange={(e) => setZoneLabel(e.target.value)}
                maxLength={120}
              />
              <input
                type="number"
                className="club-glass-input"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                aria-label="Capacité bénévoles"
              />
            </div>
            <button
              type="submit"
              disabled={creating || title.trim().length < 2}
              className="lkdv-carnet-btn-soft"
              style={{
                justifyContent: 'center',
                height: 34,
                background: 'var(--club-soft-bg, #d3ebd9)',
                color: 'var(--tint, #17402c)',
                fontWeight: 700,
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{creating ? 'Création…' : 'Ajouter le poste'}</span>
            </button>
          </form>
        </AdminCollapsibleCreate>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
            <Users size={14} aria-hidden="true" />
            <span>Postes & Pointage</span>
          </span>
        </div>

        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement des postes…</span>
        ) : shifts.length === 0 ? (
          <ClubEmptyCard
            icon={<Users size={17} />}
            title="Aucun poste bénévole"
            description="Ajoutez des postes pour coordonner les bénévoles le jour J."
          />
        ) : (
          shifts.map((shift) => {
            const list = shift.assignments ?? [];
            const checkedInCount = list.filter((a) => a.status === 'checked_in').length;
            const fillPct = Math.min(100, Math.round((list.length / Math.max(1, shift.capacity)) * 100));
            const isAssignOpen = openAssignShiftId === shift.id;

            return (
              <div
                key={shift.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.62)',
                  border: '0.5px solid rgba(23, 43, 36, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ fontSize: 12.5, color: 'var(--label)' }}>{shift.title}</b>
                    {shift.zoneLabel ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--label2)', marginLeft: 6 }}>
                        <MapPin size={10} aria-hidden="true" />
                        <span>{shift.zoneLabel}</span>
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
                    <AdminStatusPill tone={checkedInCount === list.length && list.length > 0 ? 'sage' : 'neutral'}>
                      {list.length}/{shift.capacity} · {checkedInCount} ✓
                    </AdminStatusPill>
                    {canManageShifts ? (
                      <>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{
                            height: 24,
                            padding: '0 7px',
                            fontSize: 10.5,
                            color: 'var(--tint, #17402c)',
                            background: isAssignOpen ? 'var(--club-soft-bg, #d3ebd9)' : undefined,
                          }}
                          aria-expanded={isAssignOpen}
                          onClick={() => setOpenAssignShiftId(isAssignOpen ? null : shift.id)}
                        >
                          <UserPlus size={11} aria-hidden="true" />
                          <span>Affecter</span>
                        </button>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{ height: 24, width: 24, padding: 0, justifyContent: 'center', color: '#991b1b' }}
                          aria-label={`Supprimer le poste ${shift.title}`}
                          title="Supprimer"
                          onClick={() => void handleDeleteShift(shift.id)}
                        >
                          <Trash2 size={11} aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <ProgressBar
                  value={fillPct}
                  tone={fillPct >= 100 ? 'sage' : 'warn'}
                  label={`Remplissage ${shift.title}`}
                />

                {list.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {list.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '4px 7px',
                          borderRadius: 8,
                          background: 'rgba(23, 64, 44, 0.04)',
                          fontSize: 11.5,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{resolveMemberName(a.userId)}</span>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{
                            height: 22,
                            padding: '0 7px',
                            fontSize: 10.5,
                            color: a.status === 'checked_in' ? 'var(--tint, #17402c)' : 'var(--label2)',
                            background: a.status === 'checked_in' ? 'var(--club-soft-bg, #d3ebd9)' : undefined,
                          }}
                          onClick={() =>
                            void handleCheckIn(
                              a.id,
                              a.status === 'checked_in' ? 'confirmed' : 'checked_in',
                            )
                          }
                        >
                          <CheckCircle2 size={10} aria-hidden="true" />
                          <span>{a.status === 'checked_in' ? 'Pointé' : 'Pointer'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {canManageShifts && isAssignOpen ? (
                  <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
                    <AdminGlassSelect
                      compact
                      ariaLabel={`Affecter un bénévole au poste ${shift.title}`}
                      value={assignMemberByShift[shift.id] ?? ''}
                      onChange={(v) =>
                        setAssignMemberByShift((prev) => ({ ...prev, [shift.id]: v }))
                      }
                      placeholder="Choisir un membre…"
                      options={members.map((m) => ({
                        value: m.userId || m.id,
                        label: `${m.name} (${m.role})`,
                      }))}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      disabled={!assignMemberByShift[shift.id]}
                      className="lkdv-carnet-btn-soft"
                      style={{
                        height: 30,
                        padding: '0 10px',
                        fontSize: 11.5,
                        color: 'var(--tint, #17402c)',
                        background: 'var(--club-soft-bg, #d3ebd9)',
                        fontWeight: 700,
                      }}
                      onClick={() => void handleAssign(shift.id)}
                    >
                      OK
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
