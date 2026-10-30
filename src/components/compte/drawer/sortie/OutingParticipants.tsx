'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserMinus, UserPlus, Users } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingParticipant } from '@/features/compte/server/sorties';
import { DrawerEmpty } from '../shell/DrawerShell';
import { initials } from './shared';

export interface OutingParticipantsProps {
  participants: OutingParticipant[];
  canEdit: boolean;
  busy: boolean;
  onAdd: (handle: string) => void;
  onRemove: (participantId: string) => void;
}

export function OutingParticipants({ participants, canEdit, busy, onAdd, onRemove }: OutingParticipantsProps) {
  const [handle, setHandle] = useState('');
  const companions = participants.filter((person) => !person.isOwner);

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
    </div>
  );
}

export default OutingParticipants;
