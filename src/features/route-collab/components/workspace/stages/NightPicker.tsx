'use client';

import { useState } from 'react';
import { Li, MBtn } from '@/features/compas/v5/ui/primitives';
import { V5Icon, stayIcon } from '@/features/compas/v5/ui/icons';
import { moneyShort } from '@/features/compas/v5/model/format';
import { PLACES_SOURCE, STAY_KIND_LABEL, overnightFromNote, overnightFromStay } from '../../../nights';
import type { DayReading } from '../../../dayReading';
import type { CollaborativeStage, OvernightPlace } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note, Pill } from '../track/atoms';

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`);

const NOTE_TYPES: ReadonlyArray<{ id: OvernightPlace['type']; label: string }> = [
  { id: 'refuge', label: 'Refuge' },
  { id: 'camp', label: 'Camping' },
  { id: 'bivouac', label: 'Bivouac' },
  { id: 'gite', label: 'Hébergement' },
];

/** Prix : toujours dit comme repère du barème, jamais comme le tarif de l'établissement (6.3). */
function priceDetail(price: { perPerson: number; currency: string } | null | undefined): string | null {
  if (!price) return null;
  return `repère du barème ${moneyShort(price.perPerson, price.currency, 'fr')} par personne, pas le tarif du lieu`;
}

/**
 * 6.3 : la nuit d'une étape. Seuls des lieux réels (OpenStreetMap) sont proposés, classés comme le Compas v5 ;
 * sans lieu, « nuit à trouver ». La personne peut aussi noter une nuit à la main (dite « saisie voyageur »).
 */
export function NightPicker({ stage, reading, onLoad, canEdit, runOperation }: {
  stage: CollaborativeStage;
  reading: DayReading;
  onLoad: () => void;
  canEdit: boolean;
  runOperation: ReturnType<typeof useRouteWorkspace>['runOperation'];
}) {
  const { expert } = useRouteViewMode();
  const [name, setName] = useState('');
  const [type, setType] = useState<OvernightPlace['type']>('gite');
  const night = reading.night;
  if (night.status === 'last') return <Note>Dernier jour : pas de nuit à prévoir.</Note>;

  const set = (place: OvernightPlace | null) => runOperation({ type: 'set_overnight', stageId: stage.id, overnightPlace: place }, { [stage.id]: stage.entityVersion });
  const chosen = night.status === 'chosen' ? night.chosen : null;
  const options = night.status === 'unknown' ? [] : night.options.filter((o) => o.name !== chosen?.name);
  const arrival = reading.endLat != null && reading.endLon != null ? { lat: reading.endLat, lon: reading.endLon } : null;

  return (
    <Block title="Ce soir" right={chosen ? 'Retenue' : night.status === 'to_find' ? 'Nuit à trouver' : undefined} testId={`night-${stage.id}`}>
      <div className="v5-grp">
        {chosen ? (
          <Li
            icon="bed"
            title={chosen.name}
            detail={[chosen.provenance, priceDetail(chosen.priceHint)].filter(Boolean).join(' · ')}
            right={
              canEdit ? (
                <MBtn aria-label={`Retirer la nuit : ${chosen.name}`} onClick={() => void set(null)}>
                  <V5Icon name="trash" size="s" />
                </MBtn>
              ) : undefined
            }
          />
        ) : (
          <Li icon="bed" title={night.status === 'to_find' ? 'Nuit à trouver' : 'Aucune nuit retenue'} detail={night.status === 'to_find' ? 'Aucun refuge, camping ou hébergement relevé près de l’arrivée.' : undefined} />
        )}
        {options.map((o) => (
          <Li
            key={o.id}
            icon={stayIcon(o.kind)}
            title={o.name}
            detail={[`${STAY_KIND_LABEL[o.kind]} · à ${metres(o.distanceM)} de l’arrivée`, priceDetail(o.price)].filter(Boolean).join(' · ')}
            right={
              canEdit ? (
                <MBtn primary aria-label={`Retenir pour la nuit : ${o.name}`} onClick={() => void set(overnightFromStay(o, new Date().toISOString()))}>
                  <V5Icon name="check" size="s" />
                </MBtn>
              ) : undefined
            }
          />
        ))}
      </div>
      {night.status === 'unknown' ? (
        <>
          <Note>
            {night.reason === 'loading' ? 'Relevé des lieux en cours…' : night.reason === 'error' ? 'Les lieux d’OpenStreetMap sont indisponibles pour l’instant : aucune nuit n’est proposée.' : 'Les lieux autour de l’arrivée ne sont pas encore relevés.'}
          </Note>
          {night.reason !== 'loading' ? <Btn onClick={onLoad}>{night.reason === 'error' ? 'Réessayer' : 'Chercher des nuits réelles'}</Btn> : null}
        </>
      ) : (
        <Note>Lieux : {PLACES_SOURCE}.{expert ? ' Classement du Compas v5 : distance à l’arrivée, préférence de nuits, taille du groupe.' : ''}</Note>
      )}
      {canEdit ? (
        <form
          className="rts-row-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = name.trim();
            if (!value || !arrival) return;
            void set(overnightFromNote(value, type, arrival, new Date().toISOString())).then((ok) => ok && setName(''));
          }}
        >
          <label className="rts-field">
            Noter une nuit à la main
            <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Nom du lieu" />
          </label>
          <Btn type="submit" disabled={!name.trim()}>
            Noter
          </Btn>
        </form>
      ) : null}
      {canEdit && name.trim() ? (
        <div className="rts-chips" role="group" aria-label="Type de nuit notée">
          {NOTE_TYPES.map((t) => (
            <button key={t.id} type="button" className="v5-chip" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      {chosen?.provenance === 'Saisie voyageur' ? <Pill tone="warn">Saisie voyageur : position de l’arrivée, non vérifiée</Pill> : null}
    </Block>
  );
}
