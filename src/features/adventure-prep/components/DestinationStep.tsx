'use client';

import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { activityById, selectedActivities } from '../catalog';
import { daysLabel } from '../engine/labels';
import { isStepSatisfied } from '../engine/steps';
import { A_VERIFIER } from '../engine/trust';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  ActivityDef,
  BudgetLevel,
  GroupBlock,
  Pace,
  PlaceRef,
  TransportPreference,
} from '../types';
import PrepMap from './PrepMap';
import type { PrepSheetId } from './PrepSheets';

export interface DestinationStepProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

/* ------------------------------------------------------------------ */
/* Libelles : la mise en forme vit ici, jamais dans le brouillon       */
/* ------------------------------------------------------------------ */

const PACE_LABELS: Readonly<Record<Pace, string>> = {
  tranquille: 'Tranquille',
  normal: 'Normal',
  rapide: 'Rapide',
};

const BUDGET_LEVEL_LABELS: Readonly<Record<BudgetLevel, string>> = {
  economique: 'Économe',
  modere: 'Modéré',
  confort: 'Confort',
};

const TRANSPORT_LABELS: Readonly<Record<TransportPreference, string>> = {
  peigne: 'À pied',
  train: 'Train',
  voiture: 'Voiture',
  avion: 'Avion',
  mixte: 'Mixte',
};

const START_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Une date absente ou illisible reste « à vérifier » : aucune date n'est
 * déduite de la durée. `T12:00:00` garde le jour calendaire stable quelle que
 * soit la machine (aucun décalage de fuseau à l'affichage).
 */
function startDateLabel(iso: string | null): string {
  if (!iso) return A_VERIFIER;
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return A_VERIFIER;
  return START_DATE_FORMAT.format(parsed);
}

function placeLabel(place: PlaceRef | null): string {
  return place ? place.name : A_VERIFIER;
}

/** Effectif réel : adultes + enfants. Jamais de total partiel présenté comme tel. */
function groupValueLabel(group: GroupBlock): string {
  if (group.mode === 'solo') return 'Seul·e';
  const total = group.adults + group.children;
  const people = `En groupe · ${total} ${total > 1 ? 'personnes' : 'personne'}`;
  return group.children > 0
    ? `${people} · ${group.children} ${group.children > 1 ? 'enfants' : 'enfant'}`
    : people;
}

/**
 * Coordonnées affichables. Un lieu saisi à la main porte (0, 0) : ce n'est pas
 * une position mais une absence, donc la carte ne l'affiche pas.
 */
function placeCoords(place: PlaceRef | null): [number, number] | null {
  if (!place) return null;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
  if (place.lat === 0 && place.lon === 0) return null;
  return [place.lat, place.lon];
}

/* ------------------------------------------------------------------ */
/* Ligne de bloc                                                       */
/* ------------------------------------------------------------------ */

interface BlockRowProps {
  label: string;
  value: string;
  icon: string;
  onClick: () => void;
}

function BlockRow({ label, value, icon, onClick }: BlockRowProps) {
  return (
    <button type="button" className="prep-block__row" onClick={onClick}>
      <Icon name={icon} size={18} aria-hidden="true" />
      <span className="prep-block__label">{label}</span>
      <span className="prep-block__value" data-unknown={value === A_VERIFIER}>
        {value}
      </span>
      <Icon name="chevron-right" size={18} aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 — Destination                                              */
/* ------------------------------------------------------------------ */

/**
 * A2 — où tu pars, quand, avec qui.
 *
 * UNE décision dominante : le parcours. Tout le reste (dates, groupe,
 * préférences) s'ouvre à la demande dans une vue secondaire (A1).
 *
 * A4 : avant toute génération cet écran ne montre que deux mesures — la durée
 * et l'effectif. Jamais de distance, de dénivelé ni de budget ici : ces
 * grandeurs n'existent pas tant que le parcours n'est pas calculé.
 */
export function DestinationStep({ onOpenSheet }: DestinationStepProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const { activities, route, calendar, group, preferences } = draft;

  const ready = isStepSatisfied(draft, 'destination');
  const isLoop = route.shape === 'boucle';

  const duration = daysLabel(calendar.durationDays);
  const hasStart = calendar.startDate !== null;
  const hasDuration = calendar.durationDays !== null;
  const dateValue = !hasStart && !hasDuration ? A_VERIFIER : `${startDateLabel(calendar.startDate)} · ${duration}`;

  // Sur une boucle, l'arrivée EST le départ : une seule ligne à renseigner.
  const loopValue = route.origin === null ? A_VERIFIER : `${route.origin.name} → Retour au départ`;

  // `selectedActivities` couvre déjà les activités complémentaires ET les nuits
  // ajoutées : on n'affiche donc que ce qui complète l'activité principale.
  const extraActivities = useMemo(
    () => selectedActivities(activities).filter((activity) => activity.id !== activities.primary),
    [activities],
  );
  const pills: readonly ActivityDef[] = useMemo(() => {
    const primary = activityById(activities.primary);
    return primary === null ? extraActivities : [primary, ...extraActivities];
  }, [activities, extraActivities]);

  const routeCoords = useMemo<Array<[number, number]>>(() => {
    const from = placeCoords(route.origin);
    const to = placeCoords(route.destination);
    const coords: Array<[number, number]> = [];
    if (from) coords.push(from);
    if (to && (from === null || to[0] !== from[0] || to[1] !== from[1])) coords.push(to);
    return coords;
  }, [route.origin, route.destination]);

  // Un aller simple a un sens : l'inverser doit rester possible tant que les
  // deux extrémités ne sont pas figées.
  const swapEnds = useCallback(() => {
    useAdventurePrepStore.getState().setRoute({
      ...route,
      origin: route.destination,
      destination: route.origin,
    });
  }, [route]);

  const handleCreate = useCallback(() => {
    const { proposeItinerary, completeStep, goToStep } = useAdventurePrepStore.getState();
    proposeItinerary();
    completeStep('destination');
    goToStep('itinerary');
  }, []);

  return (
    <div className="prep-screen">
      <div className="prep-body">
        <h1 className="prep-title">Tu pars où&nbsp;?</h1>
        <p className="prep-help">
          Un point de départ, une date et le nombre de personnes. Le reste s&apos;ajustera
          avec le parcours.
        </p>

        {pills.length > 0 ? (
          <div className="prep-actionrow">
            {pills.map((activity) => (
              <span key={activity.id} className="prep-pill">
                <Icon name={activity.icon} size={16} aria-hidden="true" />
                {activity.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="prep-note">
            Aucune activité choisie pour l&apos;instant. Reviens à l&apos;écran de départ
            pour en prendre une.
          </p>
        )}

        <div className="prep-block">
          {isLoop ? (
            <BlockRow
              label="Parcours"
              icon="route"
              value={loopValue}
              onClick={() => onOpenSheet('place')}
            />
          ) : (
            <>
              <BlockRow
                label="Départ"
                icon="map-pin"
                value={placeLabel(route.origin)}
                onClick={() => onOpenSheet('place')}
              />
              <BlockRow
                label="Arrivée"
                icon="map-pin"
                value={placeLabel(route.destination)}
                onClick={() => onOpenSheet('place')}
              />
            </>
          )}
        </div>

        {!isLoop ? (
          <div className="prep-actionrow">
            <button type="button" className="prep-action" onClick={swapEnds}>
              <Icon name="arrow-right-left" size={16} aria-hidden="true" />
              Inverser départ et arrivée
            </button>
          </div>
        ) : null}

        <div className="prep-block">
          <BlockRow
            label="Dates"
            icon="calendar"
            value={dateValue}
            onClick={() => onOpenSheet('calendar')}
          />
          {calendar.durationIsSuggested ? (
            <p className="prep-block__hint">
              Cette durée est une durée suggérée d&apos;après l&apos;activité :
              ce n&apos;est pas encore un choix, modifie-la quand tu veux.
            </p>
          ) : null}
        </div>

        <div className="prep-block">
          <BlockRow
            label="Avec qui"
            icon="users"
            value={groupValueLabel(group)}
            onClick={() => onOpenSheet('group')}
          />
        </div>

        <div className="prep-block">
          <BlockRow
            label="Préférences"
            icon="compass"
            value={`${PACE_LABELS[preferences.pace]} · ${BUDGET_LEVEL_LABELS[preferences.budgetLevel]} · ${TRANSPORT_LABELS[preferences.transport]}`}
            onClick={() => onOpenSheet('preferences')}
          />
        </div>

        {/* Aucun point connu : la carte garde son squelette, on n'invente pas
            de position pour la faire fonctionner. */}
        <PrepMap
          name={route.origin ? route.origin.name : 'Ton parcours'}
          routeCoords={routeCoords}
          scopeLabel="Ensemble"
        />
      </div>

      <div className="prep-footer">
        <div className="prep-actionrow" style={{ flex: '1 1 auto' }}>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="prep-footer__primary"
            disabled={!ready}
            onClick={handleCreate}
          >
            {ready ? 'Créer mon parcours' : 'Compléter la destination'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DestinationStep;
