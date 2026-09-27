'use client';

import React from 'react';
import { Sheet, type SheetDetent } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import {
  PlaceSheet,
  CalendarSheet,
  GroupSheet,
  PreferencesSheet,
  CoverageSheet,
  ParticipantsSheet,
  type PrepPlaceField,
} from './PrepSetupSheets';
import { StepSheet, StepsSheet, AdjustSheet, AddStepSheet } from './PrepItinerarySheets';
import { GearSheet, ConsumablesSheet } from './PrepGearSheets';
import { PrepInviteScreen, type InviteUrlBuilder } from './PrepInviteScreen';
import { buildPrepInviteUrl } from '@/app/prepare/actions';

/**
 * Toutes les vues secondaires du préparateur, dans un seul Sheet.
 *
 * Un écran = UNE décision dominante ; tout le reste s'ouvre ici à la demande
 * (A1). Les écrans n'ont donc jamais à empiler plusieurs formulaires.
 */
export type PrepSheetId =
  | 'place'
  | 'calendar'
  | 'group'
  | 'preferences'
  | 'coverage'
  | 'participants'
  | 'step'
  | 'steps'
  | 'adjust'
  | 'add'
  | 'gear'
  | 'consumables'
  | 'invite';

// Le type est declare la ou il est consomme (la vue lieu) puis re-exporte ici
// pour que les ecrans n importent que le routeur de sheets.
export type { PrepPlaceField };

export interface PrepSheetsProps {
  sheet: PrepSheetId | null;
  onClose: () => void;
  /** Étape ciblée par la vue « step ». */
  focusStepId?: string | null;
  /** Extremite demandee par la ligne cliquee (Depart / Arrivee). */
  placeField?: PrepPlaceField | null;
  /** Permet a une vue d en ouvrir une autre (Participants -> Inviter). */
  onOpenSheet?: (
    id: PrepSheetId,
    focusStepId?: string | null,
    placeField?: PrepPlaceField | null,
  ) => void;
}

const TITLES: Readonly<Record<PrepSheetId, string>> = {
  place: 'Où tu pars',
  calendar: 'Quand tu pars',
  group: 'Avec qui',
  preferences: 'Préférences',
  coverage: "Couverture de l'aventure",
  participants: 'Participants',
  step: 'Détail de l’étape',
  steps: 'Le programme complet',
  adjust: 'Ajuster le parcours',
  add: 'Ajouter une étape',
  gear: 'Équipement',
  consumables: 'Eau et repas',
  invite: 'Inviter',
};

/**
 * Hauteur de chaque tiroir. Un ecran = UNE decision dominante : la plupart
 * n'ont qu'un champ ou une courte liste, et un detent `large` (90dvh) les
 * laissait « presque vides » (grand tiroir, deux lignes de contenu). `auto`
 * laisse le panneau epouser son contenu, plafonne a 90dvh par `.lkv-sheet-up`,
 * et defile en interne quand la liste est vraiment longue. On ne garde `large`
 * que pour les ecrans riches par nature (itineraire, equipement, invitation).
 */
const DETENT: Readonly<Record<PrepSheetId, SheetDetent>> = {
  place: 'auto',
  calendar: 'auto',
  group: 'auto',
  preferences: 'auto',
  coverage: 'auto',
  participants: 'large',
  step: 'large',
  steps: 'large',
  adjust: 'large',
  add: 'auto',
  gear: 'large',
  consumables: 'large',
  invite: 'auto',
};

/**
 * Le jeton signe ne porte pas les droits : il est emis une seule fois, les
 * 4 permissions restent cote client (cf. PrepInviteScreen). L adaptateur
 * ignore donc `permissions` plutot que de les encoder dans un jeton qui
 * expirait en meme temps que le lien.
 */
const BUILD_INVITE_URL: InviteUrlBuilder = ({ adventureId, expiresInHours }) =>
  buildPrepInviteUrl({ adventureId, expiresInHours });

export function PrepSheets({
  sheet,
  onClose,
  focusStepId = null,
  placeField = null,
  onOpenSheet,
}: PrepSheetsProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const store = useAdventurePrepStore;

  // Les actions sont stables : on lit le store au dernier moment pour éviter de
  // recréer 12 closures à chaque rendu de l'écran.
  const actions = useAdventurePrepStore.getState();

  void store;

  return (
    <Sheet
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={sheet ? TITLES[sheet] : ''}
      detent={sheet ? DETENT[sheet] : 'auto'}
      dragToDismiss
    >
      {sheet === 'place' && <PlaceSheet draft={draft} actions={actions} onClose={onClose} field={placeField} />}
      {sheet === 'calendar' && <CalendarSheet draft={draft} actions={actions} onClose={onClose} />}
      {sheet === 'group' && <GroupSheet draft={draft} actions={actions} onClose={onClose} />}
      {sheet === 'preferences' && (
        <PreferencesSheet draft={draft} actions={actions} onClose={onClose} />
      )}
      {sheet === 'coverage' && <CoverageSheet draft={draft} actions={actions} onClose={onClose} />}
      {sheet === 'participants' && (
        <ParticipantsSheet
          draft={draft}
          actions={actions}
          onClose={onClose}
          onOpenInvite={onOpenSheet ? () => onOpenSheet('invite') : undefined}
        />
      )}
      {sheet === 'step' && (
        <StepSheet
          draft={draft}
          actions={actions}
          stepId={focusStepId}
          onClose={onClose}
        />
      )}
      {sheet === 'steps' && <StepsSheet draft={draft} actions={actions} onClose={onClose} />}
      {sheet === 'adjust' && <AdjustSheet draft={draft} actions={actions} onClose={onClose} />}
      {sheet === 'add' && <AddStepSheet draft={draft} actions={actions} onClose={onClose} />}
      {sheet === 'gear' && <GearSheet draft={draft} actions={actions} />}
      {sheet === 'consumables' && <ConsumablesSheet draft={draft} actions={actions} />}
      {sheet === 'invite' && (
        <PrepInviteScreen buildInviteUrl={BUILD_INVITE_URL} onBack={onClose} />
      )}
    </Sheet>
  );
}

export default PrepSheets;