'use client';

import { readoutParts, type ProfileReadout } from '../../../profileLink';

/** Km, altitude, pente et heure de passage du curseur du profil (2.6). Absent tant qu'aucun curseur n'est posé. */
export function ProfileReadoutLine({
  readout,
  hasElevation,
  className = 'rcw-readout',
}: {
  readout: ProfileReadout | null;
  hasElevation: boolean;
  className?: string;
}) {
  if (!readout) return null;
  const parts = readoutParts(readout, hasElevation);
  return (
    <div className={className} data-testid="profile-readout" role="status" aria-live="off">
      {parts.map((p) => (
        <span key={p.key} className="rcw-readout-part" data-known={p.known ? 'true' : 'false'}>
          <span className="rcw-readout-label">{p.label}</span> <strong>{p.value}</strong>
        </span>
      ))}
    </div>
  );
}
