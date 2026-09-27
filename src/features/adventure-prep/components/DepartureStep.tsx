'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { activityById } from '../catalog';
import { A_VERIFIER } from '../engine/trust';
import { gearGaps, packWeight, resolvedGear } from '../engine/gear';
import { mealNeeds, uncoveredMeals, waterNeeds } from '../engine/consumables';
import { knownGaps } from '../engine/itinerary';
import { bookWeightLabel, gearSummary, gearToVerifyCount, plural } from '../engine/labels';
import type { AdventurePrepDraft, GearNeed, PlaceRef } from '../types';
import { PrepMap } from './PrepMap';
import type { PrepSheetId } from './PrepSheets';

export interface DepartureStepProps {
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
}

/** Point d'ouverture d'une ligne « à vérifier ». */
interface OpenPoint {
  id: string;
  label: string;
  sheet: PrepSheetId | null;
}

/** Tracé depuis le brouillon : jamais de coordonnée inventée, jamais de doublon. */
function routeCoords(draft: AdventurePrepDraft): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const push = (place: PlaceRef | null) => {
    if (!place) return;
    const last = coords[coords.length - 1];
    if (last && last[0] === place.lat && last[1] === place.lon) return;
    coords.push([place.lat, place.lon]);
  };
  push(draft.route.origin);
  if (draft.route.shape === 'aller_simple') push(draft.route.destination);
  return coords;
}

/**
 * Ce que l'app ne sait pas encore, dit en clair.
 *
 * Chaque point est une action possible, pas une alerte. Jamais de score, de
 * pourcentage ni de jauge : la préparation n'a pas de note (A9).
 */
function openPointsOf(draft: AdventurePrepDraft, gear: readonly GearNeed[]): OpenPoint[] {
  const points: OpenPoint[] = [];
  const pending = gearToVerifyCount(gear, draft.packedGearIds);
  if (pending > 0) {
    points.push({
      id: 'equipement',
      label: `Équipement : ${pending} ${plural(pending, 'élément')} à confirmer`,
      sheet: 'gear',
    });
  }
  for (const gap of draft.itinerary ? knownGaps(draft.itinerary) : []) {
    points.push({ id: `gap-${gap.id}`, label: gap.label, sheet: null });
  }
  const meals = uncoveredMeals(mealNeeds(draft.itinerary));
  if (meals.length > 0) {
    points.push({
      id: 'repas',
      label: `Repas : ${meals.length} à organiser`,
      sheet: 'consumables',
    });
  }
  if (!draft.activities.primary) {
    points.push({ id: 'activite', label: 'Activité à choisir', sheet: null });
  }
  if (!draft.route.origin) {
    points.push({ id: 'depart', label: 'Point de départ à vérifier', sheet: 'place' });
  }
  if (!draft.calendar.startDate) {
    points.push({ id: 'date', label: 'Date de départ à vérifier', sheet: 'calendar' });
  }
  const headcount = draft.group.adults + draft.group.children;
  if (draft.group.mode === 'groupe' && headcount > 1 && draft.group.knownMembers.length === 0) {
    points.push({ id: 'participants', label: 'Participants : personne n’est encore attribué', sheet: 'participants' });
  }
  return points;
}

/** Bloc cliquable : une ligne, un label, une valeur, une action. */
function ActionBlock({
  icon,
  label,
  value,
  unknown,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  unknown: boolean;
  onClick: () => void;
}) {
  return (
    <div className="prep-block">
      <button type="button" className="prep-block__row" onClick={onClick}>
        <span className="prep-step__thumb" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="prep-block__label">{label}</span>
        <span className="prep-block__value" data-unknown={unknown ? 'true' : undefined}>
          {value}
        </span>
        <Icon name="chevron-right" size={18} className="shrink-0 opacity-50" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Étape 3 — Départ : est-ce que tout est prêt pour partir ?
 *
 * A9 : la question est binaire et concrète (« qu'est-ce qui manque ? »), jamais
 * chiffrée. Aucune donnée n'est inventée pour combler un vide.
 */
export function DepartureStep({ onOpenSheet }: DepartureStepProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const syncGear = useAdventurePrepStore((state) => state.syncGear);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le contenu du Sheet « équipement » peut avoir changé la liste des besoins.
  useEffect(() => {
    syncGear();
  }, [syncGear, draft.activities.primary, draft.activities.nights.length]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const saveAdventure = useCallback(() => {
    if (save === 'saving') return;
    setSave('saving');
    // Le brouillon est déjà persisté à chaque mutation : il n'y a rien à
    // envoyer. On confirme juste à l'utilisateur que c'est enregistré.
    timer.current = setTimeout(() => setSave('saved'), 400);
  }, [save]);

  const activity = activityById(draft.activities.primary);
  const title = draft.coverName ?? 'Ton aventure';
  // Derivation pure : le premier rendu serveur et le premier rendu client
  // voient la meme liste, sans attendre un effet de synchronisation.
  const gear = resolvedGear(draft);
  const weight = packWeight(gear);
  const headcount = draft.group.adults + draft.group.children;
  const meals = uncoveredMeals(mealNeeds(draft.itinerary));
  const water = waterNeeds(draft.itinerary);
  const points = openPointsOf(draft, gear);
  const coords = routeCoords(draft);

  return (
    <div className="prep-screen">
      <div className="prep-body">
        <header className="prep-title">
          <h1>{title}</h1>
          <p className="prep-help">
            {activity
              ? `${activity.label} · ${draft.calendar.durationDays ?? A_VERIFIER} jour${draft.calendar.durationDays === 1 ? '' : 's'}`
              : A_VERIFIER}
          </p>
        </header>

        <div className="prep-block">
          <div className="prep-block__row">
            <span className="prep-block__label">Couverture</span>
            <span className="prep-block__value">{title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenSheet('coverage')}
              icon={<Icon name="edit2" size={16} aria-hidden="true" />}
            >
              Modifier
            </Button>
          </div>
        </div>

        <PrepMap name={title} routeCoords={coords} scopeLabel="Ensemble" />

        <ActionBlock
          icon="backpack"
          label="Équipement"
          value={gearSummary(gear, draft.packedGearIds)}
          unknown={gear.length === 0}
          onClick={() => onOpenSheet('gear')}
        />

        <ActionBlock
          icon="droplet"
          label="Eau et repas"
          value={
            meals.length === 0 && water.length > 0
              ? `${water.length} journée${water.length === 1 ? '' : 's'} prévue${water.length === 1 ? '' : 's'}`
              : `${meals.length} repas à organiser`
          }
          unknown={meals.length > 0}
          onClick={() => onOpenSheet('consumables')}
        />

        <ActionBlock
          icon="users"
          label="Participants"
          value={`${headcount} ${plural(headcount, 'personne')}`}
          unknown={draft.group.knownMembers.length === 0 && headcount > 1}
          onClick={() => onOpenSheet('participants')}
        />

        <p className="prep-note" data-tone={weight.hasGaps ? 'warn' : undefined}>
          {bookWeightLabel(weight)}
        </p>

        <section aria-labelledby="prep-a-verifier">
          <h2 className="prep-section-title" id="prep-a-verifier">
            À vérifier
          </h2>
          {points.length === 0 ? (
            <p className="prep-note">Tout est vérifié pour le moment.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--prep-block-gap)' }}>
              {points.map((point) => {
                const content = (
                  <>
                    <Icon name="alert-circle" size={16} aria-hidden="true" className="shrink-0" />
                    <span>{point.label}</span>
                  </>
                );
                return (
                  <li key={point.id}>
                    {point.sheet ? (
                      <button
                        type="button"
                        className="prep-block__row"
                        onClick={() => onOpenSheet(point.sheet as PrepSheetId)}
                      >
                        {content}
                        <Icon name="chevron-right" size={16} className="shrink-0 opacity-50" aria-hidden="true" />
                      </button>
                    ) : (
                      <p className="prep-note">{point.label}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* `gearGaps` est consumed ici pour que l'écart possession/préparation
            reste calculé par le moteur et non recompté à la main. */}
        <span className="prep-visually-hidden">
          {gearGaps(gear, draft.packedGearIds).length} équipement(s) sans responsable désigné.
        </span>
      </div>

      <div className="prep-footer">
        <div className="prep-actionrow">
          <Button
            variant="primary"
            size="lg"
            className="prep-footer__primary"
            onClick={saveAdventure}
            disabled={save === 'saving'}
            aria-busy={save === 'saving'}
            icon={
              save === 'saved' ? (
                <Icon name="check-circle2" size={18} aria-hidden="true" />
              ) : (
                <Icon name="check" size={18} aria-hidden="true" />
              )
            }
          >
            {save === 'saving' ? 'Enregistrement…' : save === 'saved' ? 'Aventure enregistrée' : 'Enregistrer mon aventure'}
          </Button>
        </div>
        <p className="prep-note" aria-live="polite">
          {save === 'saved'
            ? 'Tout est conservé sur cet appareil. Tu peux la retrouver depuis le hub.'
            : 'Tu peux fermer : ta progression est déjà enregistrée.'}
        </p>
      </div>
    </div>
  );
}

export default DepartureStep;
