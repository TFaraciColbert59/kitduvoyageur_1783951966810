'use client';

import { useState } from 'react';
import { Li } from '@/features/compas/v5/ui/primitives';
import { formatCoordinates, moveDistanceKm, parseCoordinates } from '../../../pointEdit';
import { fmtKm } from '../../../fmt';
import type { CollaborativeRoutePoint } from '../../../types';
import { useTrackTools } from '../useTrackTools';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note, Pill } from './atoms';

/**
 * 5.6 : nom, coordonnées ou adresse d'un point, depuis le tiroir. Une adresse n'est posée qu'après un choix
 * explicite (un résultat « inexact » est une piste à confirmer, pas un lieu établi) ; un déplacement de plus de
 * 5 km est annoncé avant d'être appliqué.
 */
export function PointEditor({ point }: { point: CollaborativeRoutePoint }) {
  const { setSubDrawer, orderedPoints } = useRouteWorkspace();
  const tools = useTrackTools();
  const [name, setName] = useState(point.name ?? '');
  const [coords, setCoords] = useState(formatCoordinates(point));
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const disabled = !tools.canEditGeo || tools.busy != null;
  const parsed = parseCoordinates(coords);
  const moved = parsed.ok ? moveDistanceKm(point, parsed.value) : null;
  const addressState = tools.addressState;

  return (
    <Block title="Modifier ce point" testId="point-editor">
      <form
        className="rts-row-form"
        onSubmit={(e) => {
          e.preventDefault();
          void tools.renamePoint(point.id, name).then((ok) => setError(ok ? null : 'Nom non enregistré.'));
        }}
      >
        <label className="rts-field">
          Nom du lieu
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={disabled} placeholder="Col, refuge, village…" />
        </label>
        <Btn type="submit" disabled={disabled || name.trim() === (point.name ?? '')}>
          Enregistrer
        </Btn>
      </form>

      <form
        className="rts-row-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed.ok) {
            setError(parsed.error);
            return;
          }
          setError(null);
          void tools.movePointTo(point.id, parsed.value.lat, parsed.value.lon, `de ${fmtKm(moved ?? 0)}`);
        }}
      >
        <label className="rts-field">
          Coordonnées (latitude, longitude)
          <input value={coords} inputMode="decimal" onChange={(e) => setCoords(e.target.value)} disabled={disabled} aria-invalid={!parsed.ok} />
        </label>
        <Btn type="submit" disabled={disabled || !parsed.ok || (moved ?? 0) < 0.001}>
          Déplacer
        </Btn>
      </form>
      {parsed.ok && parsed.swapped ? <Note>Lu comme longitude puis latitude : vérifiez avant de déplacer.</Note> : null}
      {parsed.ok && moved != null && moved > 5 ? <Note tone="warn">Ce point se déplacerait de {fmtKm(moved)} : les tronçons voisins seront recalculés.</Note> : null}
      {!parsed.ok && coords !== formatCoordinates(point) ? <Note tone="bad">{parsed.error}</Note> : null}

      <form
        className="rts-row-form"
        onSubmit={(e) => {
          e.preventDefault();
          void tools.findAddress(address);
        }}
      >
        <label className="rts-field">
          Chercher une adresse ou un lieu
          <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={disabled} placeholder="Annecy, col de la Croix-Fry…" />
        </label>
        <Btn type="submit" disabled={disabled || address.trim().length < 2}>
          Chercher
        </Btn>
      </form>
      {addressState === 'loading' ? <Note>Recherche…</Note> : null}
      {addressState && addressState !== 'loading' && addressState.status === 'ok' ? (
        <div className="v5-grp" data-testid="address-results">
          {addressState.matches.map((m) => (
            <Li
              key={m.id}
              icon="locate"
              title={m.name}
              detail={m.context || undefined}
              onClick={() => {
                if (disabled) return;
                tools.setAddressState(null);
                void tools.movePointTo(point.id, m.lat, m.lon, `à « ${m.name} »`);
              }}
              right={m.precision === 'inexact' ? <Pill tone="warn">À confirmer</Pill> : <Pill tone="good">Commune</Pill>}
            />
          ))}
        </div>
      ) : null}
      {addressState && addressState !== 'loading' && addressState.status === 'no_result' ? <Note>Aucun résultat : essayez un autre nom, ou saisissez les coordonnées.</Note> : null}
      {addressState && addressState !== 'loading' && addressState.status === 'unavailable' ? <Note tone="warn">La recherche d’adresse est indisponible : saisissez les coordonnées.</Note> : null}
      {error ? <Note tone="bad">{error}</Note> : null}

      {tools.canEditGeo && orderedPoints.length > 2 ? (
        <Btn
          tone="warn"
          disabled={disabled}
          testId="delete-point"
          onClick={() => {
            void tools.deletePoint(point.id);
            setSubDrawer(null);
          }}
        >
          Supprimer ce point (le tracé est recousu)
        </Btn>
      ) : null}
    </Block>
  );
}
