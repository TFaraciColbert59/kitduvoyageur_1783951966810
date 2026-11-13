'use client';

import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import {
  anchorStageToLodging,
  type LodgingAnchor,
  type LodgingType,
  type MultiDayPlan,
} from '@/features/planning';
import { endOfDayIso, formatDistanceKm, isoDatePlusDays } from './format';

const FIELD_CLASS =
  'h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LODGING_TYPES: LodgingType[] = ['refuge', 'hut', 'camp', 'gite', 'hotel', 'bivouac'];

export interface LodgingPickerProps {
  plan: MultiDayPlan;
  nowIso: string;
  initialDay?: number;
  lodgings?: LodgingAnchor[];
  onPlanChange: (plan: MultiDayPlan) => void;
}

/**
 * K2.31 : un refuge ou hébergement devient la fin d'étape. Le point du tracé
 * le plus proche est choisi ; au-delà de 2,5 km ou hors saison, le contrat refuse.
 */
export function LodgingPicker({
  plan,
  nowIso,
  initialDay,
  lodgings = [],
  onPlanChange,
}: LodgingPickerProps) {
  const movableStages = plan.stages.slice(0, -1);
  const [dayNumber, setDayNumber] = useState(initialDay ?? movableStages[0]?.dayNumber ?? 1);
  const stage = plan.stages.find((candidate) => candidate.dayNumber === dayNumber) ?? null;

  const [name, setName] = useState('Refuge de la Croix du Bonhomme');
  const [lodgingType, setLodgingType] = useState<LodgingType>('refuge');
  const [lat, setLat] = useState(stage ? String(stage.endCoord.lat) : '45.9');
  const [lon, setLon] = useState(stage ? String(stage.endCoord.lon) : '6.85');
  const [eleM, setEleM] = useState('2443');
  const [openMonths, setOpenMonths] = useState('6,7,8,9');
  const [capacity, setCapacity] = useState('70');
  const [stayDate, setStayDate] = useState(() => isoDatePlusDays(nowIso, 7));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!stage) {
    return (
      <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
        Aucune étape ajustable pour ce plan.
      </p>
    );
  }

  const fillFromLodging = (lodging: LodgingAnchor) => {
    setName(lodging.name);
    setLodgingType(lodging.type);
    setLat(String(lodging.lat));
    setLon(String(lodging.lon));
    setEleM(lodging.eleM === null ? '' : String(lodging.eleM));
    setOpenMonths(lodging.openMonths?.join(',') ?? '');
    setCapacity(lodging.capacity === null || lodging.capacity === undefined ? '' : String(lodging.capacity));
    setError(null);
    setSuccess(null);
  };

  const anchor = () => {
    setError(null);
    setSuccess(null);
    const parsedLat = Number.parseFloat(lat);
    const parsedLon = Number.parseFloat(lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
      setError('Les coordonnées du refuge doivent être numériques.');
      return;
    }
    const parsedMonths = openMonths
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12);
    const parsedCapacity = Number.parseInt(capacity, 10);

    const lodging: LodgingAnchor = {
      id: `lodging-${plan.id}-${dayNumber}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: name.trim() || 'Hébergement sans nom',
      type: lodgingType,
      lat: parsedLat,
      lon: parsedLon,
      eleM: eleM.trim() === '' ? null : Number.parseFloat(eleM),
      openMonths: parsedMonths.length > 0 ? parsedMonths : null,
      capacity: Number.isInteger(parsedCapacity) ? parsedCapacity : null,
    };

    const result = anchorStageToLodging(plan, dayNumber, lodging, {
      expectedPlanRevision: plan.revision,
      nowIso,
      maxSnapDistanceKm: 2.5,
      stayDateIso: stayDate ? endOfDayIso(stayDate) : null,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'lodging_too_far':
          setError(
            `Refuge trop éloigné du tracé${
              result.snappedDistanceKm !== undefined
                ? ` (${formatDistanceKm(result.snappedDistanceKm)} > 2,5 km)`
                : ''
            }.`,
          );
          break;
        case 'lodging_closed_season':
          setError('Ce refuge est fermé à la date de séjour choisie.');
          break;
        case 'revision_conflict':
          setError('Le plan a changé entre-temps ; rechargez le panneau.');
          break;
        case 'invalid_day':
          setError('Cette journée ne peut pas recevoir d’hébergement de fin d’étape.');
          break;
        case 'invalid_boundary':
          setError('Aucun point de tracé valide ne peut servir de borne.');
          break;
      }
      return;
    }

    onPlanChange(result.plan);
    setSuccess(
      `Refuge ancré à ${formatDistanceKm(result.snappedDistanceKm)} du tracé ; jours ${dayNumber} et ${
        dayNumber + 1
      } ajustés.`,
    );
  };

  return (
    <div className="space-y-[var(--space-3)]">
      <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
        Le refuge est rattaché au point du tracé le plus proche (2,5 km maximum), puis les jours N
        et N+1 sont recalculés. La date de séjour vérifie l’ouverture saisonnière.
      </p>

      {lodgings.length > 0 && (
        <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Refuges suggérés">
          {lodgings.map((lodging) => (
            <Button key={lodging.id} variant="secondary" size="sm" onClick={() => fillFromLodging(lodging)}>
              {lodging.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Journée</span>
          <select
            className={FIELD_CLASS}
            value={dayNumber}
            onChange={(event) => {
              const nextDay = Number.parseInt(event.target.value, 10);
              const nextStage = plan.stages.find((candidate) => candidate.dayNumber === nextDay);
              setDayNumber(nextDay);
              if (nextStage) {
                setLat(String(nextStage.endCoord.lat));
                setLon(String(nextStage.endCoord.lon));
              }
              setError(null);
              setSuccess(null);
            }}
          >
            {movableStages.map((candidate) => (
              <option key={candidate.dayNumber} value={candidate.dayNumber}>
                Fin du jour {candidate.dayNumber}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Nom de l’hébergement</span>
          <input
            type="text"
            className={FIELD_CLASS}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Type</span>
          <select
            className={FIELD_CLASS}
            value={lodgingType}
            onChange={(event) => setLodgingType(event.target.value as LodgingType)}
          >
            {LODGING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Date de séjour</span>
          <input
            type="date"
            className={FIELD_CLASS}
            value={stayDate}
            onChange={(event) => setStayDate(event.target.value)}
          />
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Latitude</span>
          <input
            type="number"
            step="0.0001"
            className={FIELD_CLASS}
            value={lat}
            onChange={(event) => setLat(event.target.value)}
          />
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Longitude</span>
          <input
            type="number"
            step="0.0001"
            className={FIELD_CLASS}
            value={lon}
            onChange={(event) => setLon(event.target.value)}
          />
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Altitude (m)</span>
          <input
            type="number"
            className={FIELD_CLASS}
            value={eleM}
            onChange={(event) => setEleM(event.target.value)}
          />
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Capacité</span>
          <input
            type="number"
            min={0}
            className={FIELD_CLASS}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)] sm:col-span-2">
          <span>Mois d’ouverture (1–12, séparés par des virgules)</span>
          <input
            type="text"
            className={FIELD_CLASS}
            value={openMonths}
            onChange={(event) => setOpenMonths(event.target.value)}
            placeholder="6,7,8,9"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Badge tone="info">
          Point de départ : {stage.endCoord.lat.toFixed(4)}, {stage.endCoord.lon.toFixed(4)}
        </Badge>
        <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          {stage.points.length} points sur l’étape
        </span>
      </div>

      {error && (
        <p role="alert" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-success)]">
          {success}
        </p>
      )}

      <Button
        variant="primary"
        size="sm"
        icon={<MapPin aria-hidden="true" size={14} />}
        onClick={anchor}
      >
        Ancrer ce refuge à l’étape
      </Button>
    </div>
  );
}

export default LodgingPicker;
