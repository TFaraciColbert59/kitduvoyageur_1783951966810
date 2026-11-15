'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Route, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingParticipant } from '@/features/compte/server/sorties';
import type { RecordedActivityInvite } from '@/features/clubs';
import { DrawerEmpty } from '../shell/DrawerShell';
import { initials } from './shared';

export interface OutingParticipantsProps {
  outingId?: string;
  participants: OutingParticipant[];
  canEdit: boolean;
  busy: boolean;
  onAdd: (handle: string) => void;
  onRemove: (participantId: string) => void;
}

export function OutingParticipants({
  outingId,
  participants,
  canEdit,
  busy,
  onAdd,
  onRemove,
}: OutingParticipantsProps) {
  const [handle, setHandle] = useState('');
  const [traceHandle, setTraceHandle] = useState('');
  const [traceInvites, setTraceInvites] = useState<RecordedActivityInvite[]>([]);
  const [traceBusy, setTraceBusy] = useState(false);
  const [traceNotice, setTraceNotice] = useState<string | null>(null);
  const companions = participants.filter((person) => !person.isOwner);

  useEffect(() => {
    if (!canEdit || !outingId) return;
    let active = true;
    fetch(`/api/clubs/activity-invites?activityId=${encodeURIComponent(outingId)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: RecordedActivityInvite[] };
        if (active && Array.isArray(payload.data)) setTraceInvites(payload.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canEdit, outingId]);

  const sendTraceInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = traceHandle.trim();
    if (!cleaned || !outingId || traceBusy) return;
    setTraceBusy(true);
    setTraceNotice(null);
    try {
      const res = await fetch('/api/clubs/activity-invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: outingId, inviteeHandle: cleaned }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: RecordedActivityInvite;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !payload?.data) {
        setTraceNotice(payload?.message || payload?.error || 'Invitation impossible.');
      } else {
        setTraceInvites((prev) => [payload.data!, ...prev.filter((i) => i.id !== payload.data!.id)]);
        setTraceHandle('');
        setTraceNotice('Invitation de réutilisation de trace envoyée.');
      }
    } catch {
      setTraceNotice('Erreur réseau lors de l’invitation.');
    } finally {
      setTraceBusy(false);
    }
  };

  const revokeTraceInvite = async (inviteId: string) => {
    setTraceBusy(true);
    setTraceNotice(null);
    try {
      const res = await fetch('/api/clubs/activity-invites', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action: 'revoke' }),
      });
      const payload = (await res.json().catch(() => null)) as { data?: RecordedActivityInvite } | null;
      if (res.ok && payload?.data) {
        setTraceInvites((prev) => prev.map((inv) => (inv.id === inviteId ? payload.data! : inv)));
      }
    } finally {
      setTraceBusy(false);
    }
  };

  return (
    <div className="lkdv-sortie-pane">
      {canEdit ? (
        <form
          className="lkdv-sortie-invite"
          onSubmit={(event) => {
            event.preventDefault();
            const value = handle.trim();
            if (!value) return;
            onAdd(value);
            setHandle('');
          }}
        >
          <label>
            <span>Inviter un compagnon</span>
            <div>
              <span aria-hidden="true">@</span>
              <input
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="handle"
                aria-label="Handle du compagnon à inviter"
                maxLength={60}
              />
            </div>
          </label>
          <ActionPill type="submit" tone="primary" label="Ajouter le compagnon" icon={<UserPlus />} busy={busy} disabled={!handle.trim()} />
        </form>
      ) : null}

      {companions.length === 0 ? (
        <DrawerEmpty
          title="Sortie solo"
          action={
            <span className="lkdv-sortie-hint-ico" aria-hidden="true">
              <Users size={20} />
            </span>
          }
        />
      ) : (
        <ul className="lkdv-sortie-people">
          {participants.map((person) => (
            <li key={person.id}>
              <Link
                className="lkdv-sortie-person-link"
                href={`/profil/${encodeURIComponent(person.userId)}`}
                aria-label={`Voir le profil de ${person.name}`}
              >
              <span className="lkdv-sortie-avatar" aria-hidden="true">
                {person.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.avatarUrl} alt="" loading="lazy" />
                ) : (
                  initials(person.name)
                )}
              </span>
              <div>
                <b>{person.name}</b>
                <small>
                  @{person.handle} · {person.isOwner ? 'organisateur' : person.role}
                </small>
              </div>
              </Link>
              {canEdit && !person.isOwner ? (
                <button
                  type="button"
                  className="lkdv-sortie-people-remove"
                  onClick={() => onRemove(person.id)}
                  disabled={busy}
                  aria-label={`Retirer ${person.name}`}
                >
                  <UserMinus size={15} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && outingId ? (
        <section className="lkdv-sortie-section" aria-label="Inviter à réutiliser la trace">
          <header>
            <b>Réutilisation de trace (S5.19)</b>
            <span>Entre amis</span>
          </header>
          <form className="lkdv-sortie-invite" onSubmit={(e) => void sendTraceInvite(e)}>
            <label>
              <span>Inviter un ami à réutiliser cette trace</span>
              <div>
                <span aria-hidden="true">@</span>
                <input
                  value={traceHandle}
                  onChange={(event) => setTraceHandle(event.target.value)}
                  placeholder="handle"
                  aria-label="Handle de l’ami à inviter sur la trace"
                  maxLength={60}
                />
              </div>
            </label>
            <ActionPill
              type="submit"
              tone="glass"
              label="Inviter sur cette trace"
              icon={<Route />}
              busy={traceBusy}
              disabled={!traceHandle.trim()}
            />
          </form>
          {traceNotice ? <p className="lkdv-sortie-proof">{traceNotice}</p> : null}
          {traceInvites.length > 0 ? (
            <ul className="lkdv-sortie-people">
              {traceInvites.map((inv) => (
                <li key={inv.id}>
                  <div>
                    <b>Invitation #{inv.inviteeUserId.slice(0, 8)}</b>
                    <small>Statut : {inv.status}</small>
                  </div>
                  {inv.status === 'pending' ? (
                    <button
                      type="button"
                      className="lkdv-sortie-people-remove"
                      onClick={() => void revokeTraceInvite(inv.id)}
                      disabled={traceBusy}
                      aria-label="Révoquer l’invitation"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default OutingParticipants;
