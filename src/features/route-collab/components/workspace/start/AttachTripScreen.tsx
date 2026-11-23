'use client';

import './start.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import { compasCreateTripAction } from '@/features/compas/server/compasActions';
import { activityForRouteSport, type AttachTripChoice } from '../../../attach';
import { provenanceOf } from '../../../entry';
import { hasDraftContent, saveGuestWorkspace } from '../../../guestDraft';
import { buildItineraryHref } from '../../../insights/deepLinks';
import type { RouteWorkspaceState } from '../../../types';
import type { TripLinkState } from './RouteEntryContext';

export interface AttachTripScreenProps {
  /** Voyages que la personne peut modifier (lus côté serveur, sous RLS). */
  choices: ReadonlyArray<AttachTripChoice>;
  /** Brouillon gardé sur l'appareil : conservé tel quel (provenance comprise) en changeant de voyage. */
  draft: RouteWorkspaceState | null;
  tripLink: TripLinkState;
  onSkip: () => void;
}

function datesOf(c: AttachTripChoice): string | null {
  if (c.startDate && c.endDate) return `${c.startDate} → ${c.endDate}`;
  return c.startDate ?? null;
}

/**
 * 1.1 : sans `?trip=`, l'itinéraire n'est pas laissé flottant. On choisit un voyage de la personne ou on en
 * crée un (action du Compas), puis on ouvre `?trip=<id>` ; le brouillon de l'appareil est ré-étiqueté avec ce
 * voyage avant la navigation, donc repris tel quel (points, provenance) par la page.
 */
export function AttachTripScreen({ choices, draft, tripLink, onSkip }: AttachTripScreenProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kept = draft && hasDraftContent(draft) ? draft : null;
  const prov = kept ? provenanceOf(kept) : null;
  const points = kept ? kept.points.filter((p) => !p.deletedAt).length : 0;

  const open = (tripId: string) => {
    if (kept) {
      const res = saveGuestWorkspace({ ...kept, tripId });
      if (res !== 'saved') {
        setError('Le brouillon n’a pas pu être gardé sur cet appareil : rattachement annulé.');
        setBusy(null);
        return;
      }
    }
    router.push(buildItineraryHref({ tripId }));
  };

  const pick = (c: AttachTripChoice) => {
    if (busy) return;
    setBusy(c.id);
    setError(null);
    open(c.id);
  };

  const create = async () => {
    if (busy) return;
    setBusy('new');
    setError(null);
    try {
      const res = await compasCreateTripAction({ activity: activityForRouteSport(kept?.sport ?? 'marche') });
      if (!res.success || !res.id) {
        setError(res.success ? 'Le voyage a été créé mais n’a pas pu être ouvert. Réessayez.' : res.error);
        setBusy(null);
        return;
      }
      open(res.id);
    } catch {
      setError('Création du voyage impossible pour l’instant. Réessayez.');
      setBusy(null);
    }
  };

  return (
    <div className="xp-root rcw-start" data-theme="light" data-testid="route-attach-screen">
      <div className="rcw-start-card">
        <p className="rcw-start-eyebrow">Itinéraire</p>
        <h1 className="rcw-start-title">Rattacher à un voyage</h1>
        <p className="rcw-start-note" data-testid="attach-explain">
          Un itinéraire vit dans un voyage : budget, sac, équipe et carnet s’y retrouvent. Choisissez le voyage, ou créez-en un.
        </p>
        {tripLink === 'invalid' || tripLink === 'not_found' || tripLink === 'error' ? (
          <p className="rcw-start-note" role="status" data-testid="attach-trip-note">
            {tripLink === 'invalid'
              ? 'Le lien du voyage est illisible.'
              : tripLink === 'not_found'
                ? 'Voyage introuvable ou privé.'
                : 'Le voyage n’a pas pu être lu pour l’instant.'}
          </p>
        ) : null}
        {kept && prov ? (
          <p className="rcw-start-note" role="status" data-testid="attach-draft-note">
            Brouillon gardé sur cet appareil : {prov.label}, {points} point{points > 1 ? 's' : ''}. Il sera repris dans le voyage choisi.
          </p>
        ) : null}

        <div className="rcw-start-tiles" role="list" data-testid="attach-trip-list">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className="rcw-start-tile"
              data-testid={`attach-trip-${c.id}`}
              disabled={busy != null}
              onClick={() => pick(c)}
            >
              <span className="rcw-start-tile-ico" aria-hidden="true">
                <XpIcon name="map" size={18} />
              </span>
              <span className="rcw-start-tile-text">
                <strong>{c.title}</strong>
                <span>
                  {[c.destinationName && c.destinationName !== c.title ? c.destinationName : null, datesOf(c)]
                    .filter(Boolean)
                    .join(' · ') || 'Sans lieu ni date'}
                  {c.hasRoute ? ' · a déjà un itinéraire : il sera ouvert' : ''}
                </span>
              </span>
              <XpIcon name="chevr" size={14} />
            </button>
          ))}
          <button
            type="button"
            role="listitem"
            className="rcw-start-tile"
            data-testid="attach-new-trip"
            disabled={busy != null}
            onClick={() => void create()}
          >
            <span className="rcw-start-tile-ico" aria-hidden="true">
              <XpIcon name="plus" size={18} />
            </span>
            <span className="rcw-start-tile-text">
              <strong>{busy === 'new' ? 'Création du voyage…' : 'Nouveau voyage'}</strong>
              <span>Brouillon sans date ni lieu inventés</span>
            </span>
            <XpIcon name="chevr" size={14} />
          </button>
        </div>
        {choices.length === 0 ? (
          <p className="rcw-start-note" data-testid="attach-empty">
            Aucun voyage modifiable pour l’instant.
          </p>
        ) : null}
        {error ? (
          <p className="rcw-start-error" role="alert" data-testid="attach-error">
            {error}
          </p>
        ) : null}
        <p className="rcw-start-note">
          <button type="button" className="rcw-start-link" onClick={onSkip} data-testid="attach-skip">
            Continuer sans voyage
          </button>{' '}
          (l’itinéraire reste sur cet appareil)
        </p>
      </div>
    </div>
  );
}
