'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { compasOpenTripAction } from '../server/compasActions';
import type { CompasTripChoice } from '../server/myTrips';
import type { TripInvitationView } from '../server/invitationActions';
import { TripInvitationsInbox } from './TripInvitations';

const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function dates(t: CompasTripChoice): string {
  if (!t.startDate) return 'dates non choisies';
  const a = fmt.format(new Date(`${t.startDate}T12:00:00Z`));
  if (!t.endDate || t.endDate === t.startDate) return a;
  return `${a} → ${fmt.format(new Date(`${t.endDate}T12:00:00Z`))}`;
}

/**
 * Aucune aventure active, mais des voyages existent : on demande lequel
 * préparer au lieu d'ouvrir d'office la création (qui donnait l'impression de
 * retomber sur l'ancien préparateur).
 */
export function CompasTripPicker({
  trips,
  invitations = [],
}: {
  trips: CompasTripChoice[];
  invitations?: TripInvitationView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await compasOpenTripAction({ tripId: id }).catch(() => ({
      success: false as const,
      error: 'Connexion perdue : réessaie.',
    }));
    if (res.success) {
      router.refresh();
      return;
    }
    setBusy(null);
    setError(res.error);
  };

  return (
    <div className="compas compas--empty">
      <div className="cp-bg" aria-hidden="true" />
      <section className="cp-empty cp-sheet-glass" aria-labelledby="cp-pick-title">
        <h1 id="cp-pick-title">Quelle aventure préparer ?</h1>
        <p className="cp-sub" style={{ margin: 0 }}>
          Choisis un de tes voyages : le Compas s’ouvre dessus.
        </p>
        <TripInvitationsInbox invitations={invitations} title="On t’invite" />
        <div className="cp-list" style={{ width: '100%' }} role="group" aria-label="Mes voyages">
          {trips.map((t) => (
            <button
              key={t.id}
              type="button"
              className="cp-row"
              disabled={busy !== null}
              onClick={() => void open(t.id)}
            >
              <span className="cp-thumb">
                <Icon name="map" size={20} />
              </span>
              <span className="cp-row__t">
                <b>{t.title}</b>
                <span>
                  {dates(t)}
                  {t.role === 'collaborator' ? ' · partagé avec toi' : ''}
                </span>
              </span>
              <span className="cp-row__end">
                {busy === t.id ? (
                  <span className="cp-sub">Ouverture…</span>
                ) : (
                  <Icon name="chevron-right" size={16} />
                )}
              </span>
            </button>
          ))}
        </div>
        {error && (
          <p className="cp-note" role="alert">
            {error}
          </p>
        )}
        <Link className="cp-btn cp-btn--soft" href="/compas?nouvelle=1">
          <Icon name="plus" size={16} />
          Nouvelle aventure
        </Link>
      </section>
    </div>
  );
}
