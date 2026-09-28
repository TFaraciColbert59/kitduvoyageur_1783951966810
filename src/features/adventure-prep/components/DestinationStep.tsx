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
  shortDateLabel,
  daysLabel,
  type PlaceParts,
} from '../engine/destinationModel';
import {
  canCreateStepOne,
  stepOneMissing,
  stepOneProfile,
  stepOneProfileIdFor,
  stepOneReadySummary,
  type StepOneCell,
  type StepOneRow,
} from './stepOneProfile';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { useDefaultOrigin } from './PrepSetupSheets';
import type { GroupBlock, PlaceRef } from '../types';
import type { PrepPlaceField, PrepSheetId } from './PrepSheets';

export interface DestinationStepProps {
  onOpenSheet: (
    sheet: PrepSheetId,
    focusStepId?: string | null,
    placeField?: PrepPlaceField | null
  ) => void;
}

interface BlockRowProps {
  label: string;
  icon: string;
  parts: PlaceParts | null;
  text?: string;
  unknown?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Regle anti-chevauchement, portee par le TSX.
 *
 * Le CSS donne au libelle `flex: 1 1 auto` SANS `overflow: hidden` : le texte
 * d'un element flex reduit deborde de sa boite et vient se peindre sur la
 * valeur voisine. C est exactement ce que montrait la ligne « Participants »,
 * ou « Participants » passait sur « 3 personnes · 1 ad… ».
 *
 * `adventure-prep.css` appartient a un autre agent : la correction est donc
 * posee ici, en style inline, avec une regle qui tient quelle que soit la
 * longueur du libelle. Le libelle est le seul element qui cede de la place ;
 * la valeur et les avatars gardent la leur.
 */
const LABEL_STYLE: React.CSSProperties = {
  flex: '0 1 auto',
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const STACK_STYLE: React.CSSProperties = {
  flex: '0 0 auto',
  minWidth: 0,
};

const AVATARS_STYLE: React.CSSProperties = { flex: '0 0 auto' };

function BlockRow({
  label,
  icon,
  parts,
  text,
  unknown,
  onClick,
  disabled,
  children,
}: BlockRowProps) {
  const isUnknown = unknown ?? parts === null;
  return (
    <button
      type="button"
      className="prep-block__row"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
    >
      <Icon name={icon} size={18} aria-hidden="true" />
      <span className="prep-block__label" style={LABEL_STYLE}>
        {label}
      </span>
      <span className="prep-block__stack" style={STACK_STYLE}>
        <span className="prep-block__value" data-unknown={isUnknown}>
          {parts ? parts.primary : (text ?? A_VERIFIER)}
        </span>
        {parts?.secondary ? <span className="prep-block__detail">{parts.secondary}</span> : null}
      </span>
      {children}
      {disabled ? null : <Icon name="chevron-right" size={18} aria-hidden="true" />}
    </button>
  );
}

interface CellProps {
  label: string;
  icon: string;
  value: string;
  unknown?: boolean;
  suggested?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

function Cell({ label, icon, value, unknown, suggested, onClick, children }: CellProps) {
  return (
    <button type="button" className="prep-cell" onClick={onClick}>
      <span className="prep-cell__head">
        <Icon name={icon} size={16} aria-hidden="true" />
        {label}
      </span>
      <span
        className="prep-cell__value"
        data-unknown={unknown ?? value === A_VERIFIER}
        data-suggested={suggested || undefined}
      >
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
    <span className="prep-avatars" style={AVATARS_STYLE} aria-hidden="true">
      {shown.map((avatar) => (
        <span key={avatar.key} className="prep-avatar" data-tone={avatar.tone}>
          {avatar.initials}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="prep-avatar" data-tone="more">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export function DestinationStep({ onOpenSheet }: DestinationStepProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const { activities, route, calendar, group } = draft;

  // Depart par defaut : propose la ou la personne est, une seule fois, et
  // seulement si elle n'a rien choisi. Le tiroir de lieux garde le meme point
  // en tete de liste, avec le nom de la commune.
  useDefaultOrigin(route.origin === null);

  const profileId = useMemo(() => stepOneProfileIdFor(activities), [activities]);
  const profile = stepOneProfile(profileId);
  const ready = canCreateStepOne(draft, profileId);
  // AN7 : le manque se dit en deux temps. Un bloqueur arrete, un facultatif
  // non, l IA le tranche. La ligne unique annoncait un arret qui n avait pas
  // lieu sous un CTA actif.
  const gap = stepOneMissing(draft, profileId);
  const readyNote = stepOneReadySummary(draft, profileId);
  // Un sejour ou une sortie locale n ont qu un seul lieu : rien a inverser.
  const swappable = profile.singlePlace === null && canSwapEnds(draft);

  const partsFor = useCallback(
    (field: StepOneRow['field']): PlaceParts | null =>
      field === 'origin' ? placeParts(route.origin) : placeParts(route.destination),
    [route.origin, route.destination]
  );
  /**
   * Valeur d une cellule du bloc calendrier.
   *
   * AN6 : une duree proposee par le moteur est un VRAI nombre, pas une
   * absence. La cacher derriere la formulation d absence creait un cul de
   * sac : la cellule paraissait invalide alors qu une proposition modifiable
   * attendait juste d etre validee. Le nombre s affiche, la pastille dit
   * qui l a propose. Une date, elle, reste une absence tant qu elle manque.
   */
  const valueFor = useCallback(
    (cell: StepOneCell): string => {
      if (cell.field === 'startDate') return shortDateLabel(calendar.startDate);
      return daysLabel(calendar.durationDays);
    },
    [calendar.startDate, calendar.durationDays]
  );

  const swapEnds = useCallback(() => {
    useAdventurePrepStore.getState().setRoute({
      ...route,
      origin: route.destination,
      destination: route.origin,
    });
  }, [route]);

  /** Invite libre : alimente la generation IA, elle n'est jamais obligatoire. */
  const onBriefChange = useCallback((value: string) => {
    useAdventurePrepStore.getState().setBrief(value);
  }, []);

  const handleCreate = useCallback(() => {
    const { completeStep, goToStep } = useAdventurePrepStore.getState();
    completeStep('destination');
    goToStep('itinerary');
  }, []);

  return (
    <div className="prep-screen">
      <div className="prep-body">
        <div className="prep-block prep-brief">
          <label className="prep-brief__label" htmlFor="prep-brief-input">
            <Icon name="sparkles" size={16} aria-hidden="true" />
            <span>Qu’est-ce que tu as en tête ?</span>
          </label>
          <textarea
            id="prep-brief-input"
            className="prep-brief__input"
            value={draft.brief ?? ''}
            onChange={(event) => onBriefChange(event.target.value)}
            placeholder="Une randonnée douce au bord d’un lac, avec un pique-nique au soleil, fin d’aprèm…"
            rows={3}
            maxLength={400}
            enterKeyHint="done"
          />
          <p className="prep-brief__hint">
            L’IA en tient compte pour tout générer. Tu resteras maître du parcours après.
          </p>
        </div>

        <div className="prep-block">
          {profile.rows.map((row) => {
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

          {swappable ? (
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
          {profile.cells.map((cell) => {
            // Chaque cellule nomme SA proposition. Un badge unique sous le bloc
            // disait « propose par l’IA » des que la seule duree l etait :
            // l’ecran annoncait alors une date qui n’avait pas ete proposee, et la
            // personne ne pouvait plus dire quel champ attendre. Le badge vit
            // donc dans la cellule, sur la cellule a cote de la valeur qu il
            // decrit.
            const suggested =
              cell.field === 'startDate'
                ? calendar.startDateIsSuggested
                : calendar.durationIsSuggested;
            return (
              <Cell
                key={cell.field}
                label={cell.label}
                icon={cell.icon}
                value={valueFor(cell)}
                suggested={suggested}
                onClick={() => onOpenSheet('calendar')}
              >
                {suggested ? (
                  <span className="badge badge--suggestion prep-cell__badge">
                    {cell.field === 'startDate'
                      ? 'Date proposée par l’IA · modifiable'
                      : 'Durée proposée · modifiable'}
                  </span>
                ) : null}
              </Cell>
            );
          })}
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

        {gap.blocking.length > 0 ? (
          <p
            className="prep-missing"
            role="status"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-2)' }}
          >
            <Icon name="alert-triangle" size={15} aria-hidden="true" />
            {`Il manque : ${gap.blocking.join(', ')}`}
          </p>
        ) : readyNote ? (
          <p
            className="prep-missing prep-missing--ready"
            role="status"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-2)' }}
          >
            <Icon name="sparkles" size={15} aria-hidden="true" />
            {readyNote}
          </p>
        ) : null}
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
