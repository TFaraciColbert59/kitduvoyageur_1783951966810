'use client';

import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { activityById } from '../catalog';
import { A_VERIFIER } from '../engine/trust';
import {
  canSwapEnds,
  groupValueLabel,
  MAX_AVATARS,
  participantAvatars,
  placeParts,
  ROUTE_SHAPE_OPTIONS,
  shortDateLabel,
  daysLabel,
  type PlaceParts,
} from '../engine/destinationModel';
import {
  canCreateStepOne,
  stepOneMissingSummary,
  stepOneProfile,
  stepOneProfileIdFor,
  type StepOneCell,
  type StepOneRow,
} from './stepOneProfile';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  ActivityDef,
  GroupBlock,
  PlaceRef,
  RouteShape,
} from '../types';
import PrepMap from './PrepMap';
import type { PrepPlaceField, PrepSheetId } from './PrepSheets';

export interface DestinationStepProps {
  onOpenSheet: (
    sheet: PrepSheetId,
    focusStepId?: string | null,
    placeField?: PrepPlaceField | null,
  ) => void;
}

function placeCoords(place: PlaceRef | null): [number, number] | null {
  if (!place) return null;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
  if (place.lat === 0 && place.lon === 0) return null;
  return [place.lat, place.lon];
}

interface BlockRowProps {
  label: string;
  icon: string;
  parts: PlaceParts | null;
  text?: string;
  unknown?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

function BlockRow({ label, icon, parts, text, unknown, onClick, children }: BlockRowProps) {
  const isUnknown = unknown ?? parts === null;
  return (
    <button type="button" className="prep-block__row" onClick={onClick}>
      <Icon name={icon} size={18} aria-hidden="true" />
      <span className="prep-block__label">{label}</span>
      <span className="prep-block__stack">
        <span className="prep-block__value" data-unknown={isUnknown}>
          {parts ? parts.primary : text ?? A_VERIFIER}
        </span>
        {parts?.secondary ? <span className="prep-block__detail">{parts.secondary}</span> : null}
      </span>
      {children}
      <Icon name="chevron-right" size={18} aria-hidden="true" />
    </button>
  );
}

interface CellProps {
  label: string;
  icon: string;
  value: string;
  unknown?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

function Cell({ label, icon, value, unknown, onClick, children }: CellProps) {
  return (
    <button type="button" className="prep-cell" onClick={onClick}>
      <span className="prep-cell__head">
        <Icon name={icon} size={16} aria-hidden="true" />
        {label}
      </span>
      <span className="prep-cell__value" data-unknown={unknown ?? value === A_VERIFIER}>
        {value}
      </span>
      {children}
    </button>
  );
}

function AvatarRow({ group }: { group: GroupBlock }) {
  const avatars = useMemo(() => participantAvatars(group), [group]);
  if (avatars.length === 0) return null;
  const shown = avatars.slice(0, MAX_AVATARS);
  const overflow = avatars.length - shown.length;
  return (
    <span className="prep-avatars" aria-hidden="true">
      {shown.map((avatar) => (
        <span key={avatar.key} className="prep-avatar" data-tone={avatar.tone}>
          {avatar.initials}
        </span>
      ))}
      {overflow > 0 ? <span className="prep-avatar" data-tone="more">+{overflow}</span> : null}
    </span>
  );
}

export function DestinationStep({ onOpenSheet }: DestinationStepProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const { activities, route, calendar, group, preferences } = draft;

  const profileId = useMemo(() => stepOneProfileIdFor(activities), [activities]);
  const profile = stepOneProfile(profileId);
  const ready = canCreateStepOne(draft, profileId);
  const missing = stepOneMissingSummary(draft, profileId);
  const isLoop = route.shape === 'boucle';

  const loopReturn = isLoop && profileId === 'trajet';

  const partsFor = useCallback(
    (field: StepOneRow['field']): PlaceParts | null =>
      field === 'origin' ? placeParts(route.origin) : placeParts(route.destination),
    [route.origin, route.destination],
  );

  const valueFor = useCallback(
    (cell: StepOneCell): string =>
      cell.field === 'startDate' ? shortDateLabel(calendar.startDate) : daysLabel(calendar.durationDays),
    [calendar.startDate, calendar.durationDays],
  );

  const routeCoords = useMemo<Array<[number, number]>>(() => {
    const asked = new Set(profile.rows.map((row) => row.field));
    const coords: Array<[number, number]> = [];
    if (asked.has('origin')) {
      const from = placeCoords(route.origin);
      if (from) coords.push(from);
    }
    if (asked.has('destination') && !loopReturn) {
      const to = placeCoords(route.destination);
      const last = coords[coords.length - 1];
      if (to && (last === undefined || to[0] !== last[0] || to[1] !== last[1])) coords.push(to);
    }
    return coords;
  }, [profile.rows, route.origin, route.destination, loopReturn]);

  const swapEnds = useCallback(() => {
    useAdventurePrepStore.getState().setRoute({
      ...route,
      origin: route.destination,
      destination: route.origin,
    });
  }, [route]);

  const setShape = useCallback(
    (shape: RouteShape) => {
      const state = useAdventurePrepStore.getState();
      if (shape === 'boucle') {
        state.setRoute({ ...route, shape, destination: null });
        return;
      }
      state.setRoute({ ...route, shape });
    },
    [route],
  );

  const handleCreate = useCallback(() => {
    const { proposeItinerary, completeStep, goToStep } = useAdventurePrepStore.getState();
    proposeItinerary();
    completeStep('destination');
    goToStep('itinerary');
  }, []);


  return (
    <div className="prep-screen">
      <div className="prep-body">

        <div className="prep-block">
          {profile.showRouteShape ? (
            <div className="prep-segmented" role="group" aria-label="Forme du parcours">
              {ROUTE_SHAPE_OPTIONS.map((option) => (
                <button
                  key={option.shape}
                  type="button"
                  className="prep-segmented__item"
                  aria-pressed={route.shape === option.shape}
                  onClick={() => setShape(option.shape)}
                >
                  <Icon name={option.icon} size={15} aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {profile.rows.map((row) => {
            if (isLoop && row.field === 'destination') {
              return (
                <BlockRow
                  key="destination"
                  label="Arrivée"
                  icon="refresh-cw"
                  parts={null}
                  text="Retour au départ"
                  onClick={() => onOpenSheet('place', null, 'destination')}
                />
              );
            }
            return (
              <BlockRow
                key={row.field}
                label={row.label}
                icon={row.icon}
                parts={partsFor(row.field)}
                onClick={() => onOpenSheet('place', null, row.field)}
              />
            );
          })}

          {profile.showRouteShape && !isLoop && canSwapEnds(draft) ? (
            <span className="prep-swap">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="prep-swap__button"
                onClick={swapEnds}
                aria-label="Inverser départ et arrivée"
              >
                <Icon name="arrow-right-left" size={16} aria-hidden="true" />
                <span className="prep-visually-hidden">Inverser départ et arrivée</span>
              </Button>
            </span>
          ) : null}
        </div>

        <div className="prep-block prep-block--cells">
          {profile.cells.map((cell) => (
            <Cell
              key={cell.field}
              label={cell.label}
              icon={cell.icon}
              value={valueFor(cell)}
              onClick={() => onOpenSheet('calendar')}
            />
          ))}
          {calendar.durationIsSuggested ? (
            <div style={{ padding: '0 var(--space-4) var(--space-3)', gridColumn: '1 / -1' }}>
              <span className="badge amber">C'est une durée suggérée · modifiable</span>
            </div>
          ) : null}
        </div>

        <div className="prep-block">
          <BlockRow
            label="Participants"
            icon="users"
            parts={null}
            text={groupValueLabel(group)}
            onClick={() => onOpenSheet('group')}
          >
            <AvatarRow group={group} />
          </BlockRow>
        </div>

        {missing ? (
          <p className="prep-missing" role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-2)' }}>
            <Icon name="alert-triangle" size={15} aria-hidden="true" />
            {missing}
          </p>
        ) : null}

        <PrepMap
          name={route.origin ? route.origin.name : 'Zone'}
          routeCoords={routeCoords}
          scopeLabel="Zone"
        />
      </div>

      <div className="prep-footer">
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={!ready}
          onClick={handleCreate}
          style={{ width: '100%' }}
        >
          {profile.cta}
        </Button>
      </div>
    </div>
  );
}

export default DestinationStep;
