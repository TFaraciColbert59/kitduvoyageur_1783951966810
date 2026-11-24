'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle2, MapPin, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import type { ClubVolunteerAssignmentStatus, ClubVolunteerShift } from '@/features/clubs/types';
import type {
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
} from '../../ClubDrawerTypes';
import { ClubEmptyCard } from '../../ClubSharedUi';
import { AdminGlassSelect } from '../AdminGlassSelect';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
          <Calendar size={14} aria-hidden="true" />
          <span>Événement / Sortie pilotée</span>
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
                label: `${o.title} · ${o.date} (${o.participantsCount}/${o.maxParticipants})`,
              }))}
            />
            {selectedEvent ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--label2)' }}>
                <span className="club-badge-sage">
                  {selectedEvent.participantsCount}/{selectedEvent.maxParticipants} inscrits
                </span>
                <span>{selectedEvent.massif}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {canManageShifts && selectedEvent ? (
        <form onSubmit={handleCreateShift} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            Nouveau poste / créneau bénévole
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Zone / Lieu (ex : Col du Lautaret)"
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
              height: 36,
              background: 'rgba(23, 64, 44, 0.12)',
              color: '#17402c',
              fontWeight: 700,
            }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>{creating ? 'Création…' : 'Ajouter ce poste bénévole'}</span>
          </button>
        </form>
      ) : null}

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Users size={14} aria-hidden="true" />
            <span>Postes & Pointage jour J</span>
          </span>
          <span className="club-badge-sage">{shifts.length} postes</span>
        </div>

        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>Chargement des postes…</span>
        ) : shifts.length === 0 ? (
          <ClubEmptyCard
            icon={<Users size={18} />}
            title="Aucun poste bénévole"
            description="Créez des postes (ravitaillement, sas départ, signaleurs) pour coordonner vos grands événements."
          />
        ) : (
          shifts.map((shift) => {
            const list = shift.assignments ?? [];
            const checkedInCount = list.filter((a) => a.status === 'checked_in').length;
            return (
              <div
                key={shift.id}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '0.5px solid rgba(23, 43, 36, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <b style={{ fontSize: 13 }}>{shift.title}</b>
                    {shift.zoneLabel ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--label2)', marginLeft: 8 }}>
                        <MapPin size={11} aria-hidden="true" />
                        <span>{shift.zoneLabel}</span>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="club-badge-sage" style={{ fontSize: 10.5 }}>
                      {list.length}/{shift.capacity} · {checkedInCount} pointés
                    </span>
                    {canManageShifts ? (
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ height: 24, width: 24, padding: 0, justifyContent: 'center', color: '#b91c1c' }}
                        aria-label={`Supprimer le poste ${shift.title}`}
                        onClick={() => void handleDeleteShift(shift.id)}
                      >
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {list.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {list.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '5px 8px',
                          borderRadius: 8,
                          background: 'rgba(23, 64, 44, 0.04)',
                          fontSize: 12,
                        }}
                      >
                        <span>{resolveMemberName(a.userId)}</span>
                        <button
                          type="button"
                          className="lkdv-carnet-btn-soft"
                          style={{
                            height: 24,
                            padding: '0 8px',
                            fontSize: 11,
                            color: a.status === 'checked_in' ? '#17402c' : 'var(--label2)',
                            background: a.status === 'checked_in' ? 'rgba(23, 64, 44, 0.14)' : undefined,
                          }}
                          onClick={() =>
                            void handleCheckIn(
                              a.id,
                              a.status === 'checked_in' ? 'confirmed' : 'checked_in',
                            )
                          }
                        >
                          <CheckCircle2 size={11} aria-hidden="true" />
                          <span>{a.status === 'checked_in' ? 'Pointé ✓' : 'Pointer'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {canManageShifts ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <AdminGlassSelect
                      compact
                      ariaLabel={`Affecter un bénévole au poste ${shift.title}`}
                      value={assignMemberByShift[shift.id] ?? ''}
                      onChange={(v) =>
                        setAssignMemberByShift((prev) => ({ ...prev, [shift.id]: v }))
                      }
                      placeholder="Affecter un membre / bénévole…"
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
                      style={{ height: 30, padding: '0 10px', fontSize: 11.5, color: '#17402c' }}
                      onClick={() => void handleAssign(shift.id)}
                    >
                      <UserPlus size={12} aria-hidden="true" />
                      <span>Affecter</span>
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
