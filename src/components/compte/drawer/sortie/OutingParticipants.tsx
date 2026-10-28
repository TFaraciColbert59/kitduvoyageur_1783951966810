'use client';

import React, { useState } from 'react';
import type { OutingParticipant } from '@/features/compte/server/sorties';
import { DrawerEmpty } from '../shell/DrawerShell';
import { initials } from './shared';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

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
          <button type="submit" className="lkdv-sortie-btn primary" disabled={busy || !handle.trim()}>
            <LKDVIcon name="amis" size={15} aria-hidden="true" /> {busy ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      ) : null}

      {companions.length === 0 ? (
        <DrawerEmpty
          title="Sortie solo"
          hint={
            canEdit
              ? 'Personne n’est encore rattaché à cette sortie. Invite un compagnon avec son handle.'
              : 'Le propriétaire n’a pas encore ajouté de compagnon à cette sortie.'
          }
          action={
            <span className="lkdv-sortie-hint-ico" aria-hidden="true">
              <LKDVIcon name="communaute" size={20} />
            </span>
          }
        />
      ) : (
        <ul className="lkdv-sortie-people">
          {participants.map((person) => (
            <li key={person.id}>
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
              {canEdit && !person.isOwner ? (
                <button
                  type="button"
                  className="lkdv-sortie-people-remove"
                  onClick={() => onRemove(person.id)}
                  disabled={busy}
                  aria-label={`Retirer ${person.name}`}
                >
                  <LKDVIcon name="amis" size={15} aria-hidden="true" />
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
