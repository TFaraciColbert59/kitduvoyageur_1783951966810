'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { compasOpenTripAction } from '../server/compasActions';
import type { CompasTripChoice } from '../server/myTrips';
import type { TripInvitationView } from '../server/invitationActions';
import { TripInvitationsInbox } from './TripInvitations';
import { useTranslation } from '@/lib/i18n/context';
import { formatDate } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import type { CompasT } from './compasTypes';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };

function dates(trip: CompasTripChoice, t: CompasT, locale: Locale): string {
  if (!trip.startDate) return t('compas.picker.noDates');
  const fmt = (d: string) => formatDate(`${d}T12:00:00Z`, DAY, locale);
  const a = fmt(trip.startDate);
  if (!trip.endDate || trip.endDate === trip.startDate) return a;
  return `${a} → ${fmt(trip.endDate)}`;
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
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await compasOpenTripAction({ tripId: id }).catch(() => ({
      success: false as const,
      error: t('compas.screen.connectionLost'),
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
        <h1 id="cp-pick-title">{t('compas.picker.title')}</h1>
        <p className="cp-sub" style={{ margin: 0 }}>
          {t('compas.picker.sub')}
        </p>
        <TripInvitationsInbox
          invitations={invitations}
          title={t('compas.start.invitationsTitle')}
        />
        <div
          className="cp-list"
          style={{ width: '100%' }}
          role="group"
          aria-label={t('compas.picker.myTrips')}
        >
          {trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="cp-row"
              disabled={busy !== null}
              onClick={() => void open(trip.id)}
            >
              <span className="cp-thumb">
                <LKDVIcon name="carte" size={20} />
              </span>
              <span className="cp-row__t">
                <b>{trip.title}</b>
                <span>
                  {dates(trip, t, locale)}
                  {trip.role === 'collaborator' ? ` · ${t('compas.picker.shared')}` : ''}
                </span>
              </span>
              <span className="cp-row__end">
                {busy === trip.id ? (
                  <span className="cp-sub">{t('compas.picker.opening')}</span>
                ) : (
                  <LKDVIcon name="suivant" size={16} />
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
          <LKDVIcon name="plus" size={16} />
          {t('compas.picker.newAdventure')}
        </Link>
      </section>
    </div>
  );
}
