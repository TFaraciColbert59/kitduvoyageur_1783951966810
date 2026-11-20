'use client';

import { useActionState, useId } from 'react';
import type { EventAdventureRef } from '@/features/hub/context/eventAdventureRef';
import { openEventAdventure, saveEventAdventure } from './eventHubActions';

type TripChoice = { id: string; title: string };

export default function EventHubLink({
  eventRef,
  linked,
  choices,
}: {
  eventRef: EventAdventureRef;
  linked: TripChoice | null;
  choices: TripChoice[];
}) {
  const inputId = useId();
  const [opening, open, isOpening] = useActionState(openEventAdventure.bind(null, eventRef), {});
  const [saving, save, isSaving] = useActionState(saveEventAdventure.bind(null, eventRef), {});
  if (!linked && !choices.length) return null;

  return (
    <section className="lkdv-event-card lkdv-event-section" aria-label="Aventure du HUB">
      {choices.length > 0 && (
        <form action={save} className="lkdv-event-hub-form">
          <label htmlFor={inputId} className="lkdv-event-h2">Aventure liée</label>
          <select key={linked?.id} id={inputId} name="tripId" defaultValue={linked?.id ?? ''} disabled={isSaving}>
            <option value="">Aucune aventure liée</option>
            {choices.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
          </select>
          <p className="lkdv-event-muted">Les inscrits confirmés pourront consulter l’itinéraire.</p>
          <button type="submit" className="lkdv-event-primary" disabled={isSaving}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saving.error && <p className="lkdv-event-error" role="alert">{saving.error}</p>}
          {saving.message && <p className="lkdv-event-notice" role="status">{saving.message}</p>}
        </form>
      )}
      {linked && (
        <form action={open} className="lkdv-event-hub-form">
          {!choices.length && <p className="lkdv-event-h2">{linked.title}</p>}
          <button type="submit" className="lkdv-event-primary" disabled={isOpening}>
            {isOpening ? 'Ouverture…' : 'Ouvrir dans le HUB'}
          </button>
          {opening.error && <p className="lkdv-event-error" role="alert">{opening.error}</p>}
        </form>
      )}
    </section>
  );
}
