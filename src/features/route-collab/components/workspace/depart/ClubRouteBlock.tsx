'use client';

import { useEffect, useState } from 'react';
import { Cap, PBtn } from '@/features/compas/v5/ui/primitives';
import { V5Scope } from '../ui/V5Scope';
import { fetchOrganizerEvents, proposeToClubEvent, type ClubEventChoice, type ClubFetch } from './clubRouteClient';
import '../analyse/analyse.css';

/**
 * 10.5 « Proposer à la sortie du club » : visible seulement pour une personne qui organise une sortie de club à
 * venir ET qui peut publier cet itinéraire. La base refuse de toute façon toute autre personne (RPC) ; s'inscrire
 * à une sortie ne donne aucun droit sur le tracé.
 */
export function ClubRouteBlock({
  workspaceId,
  canPublish,
  hasPublished,
  fetchFn,
}: {
  workspaceId: string;
  canPublish: boolean;
  hasPublished: boolean;
  fetchFn?: ClubFetch;
}) {
  const [events, setEvents] = useState<ClubEventChoice[]>([]);
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!canPublish || !hasPublished) return;
    let alive = true;
    void fetchOrganizerEvents(fetchFn).then((list) => {
      if (!alive) return;
      setEvents(list);
      setEventId((cur) => cur || list[0]?.id || '');
    });
    return () => {
      alive = false;
    };
  }, [canPublish, hasPublished, fetchFn]);

  if (!canPublish || !hasPublished || events.length === 0) return null;
  const chosen = events.find((e) => e.id === eventId);
  const publicNote = chosen && chosen.visibility !== 'club_only' && chosen.visibility !== 'private';

  const send = async () => {
    if (!eventId || busy) return;
    setBusy(true);
    const out = await proposeToClubEvent(workspaceId, eventId, fetchFn);
    setBusy(false);
    setMessage(
      out.kind === 'ok'
        ? out.unchanged
          ? `Cette version est déjà proposée (révision ${out.revision}).`
          : `Proposé aux inscrits : révision ${out.revision} de la sortie. Chacun choisit de l’adopter ou non.`
        : out.message,
    );
  };

  return (
    <V5Scope>
      <div className="rcw-block" data-testid="club-route-block">
        <Cap>Sortie du club</Cap>
        <p className="rcw-publish-sentence">Propose la version publiée à l’une de tes sorties de club.</p>
        <select aria-label="Sortie du club" className="rcw-select-sm rcw-select-tap" value={eventId} onChange={(e) => setEventId(e.target.value)} data-testid="club-route-select">
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
              {e.startsAt ? ` · ${e.startsAt.slice(0, 10)}` : ''}
            </option>
          ))}
        </select>
        {publicNote ? <p className="rcw-sub-note">Sortie ouverte : ta zone de départ privée est masquée dans le tracé proposé.</p> : null}
        <PBtn onClick={() => void send()} disabled={busy || !eventId}>
          Proposer à la sortie du club
        </PBtn>
        {message ? (
          <p className="rcw-sub-note" role="status" data-testid="club-route-message">
            {message}
          </p>
        ) : null}
      </div>
    </V5Scope>
  );
}
