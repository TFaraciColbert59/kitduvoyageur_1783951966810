'use client';

import React from 'react';
import { Sheet } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { PlaceSheet, CalendarSheet, GroupSheet, PreferencesSheet, CoverageSheet, ParticipantsSheet } from './PrepSetupSheets';
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

export interface PrepSheetsProps {
  sheet: PrepSheetId | null;
  onClose: () => void;
  /** Étape ciblée par la vue « step ». */
  focusStepId?: string | null;
  /** Permet a une vue d en ouvrir une autre (Participants -> Inviter). */
  onOpenSheet?: (id: PrepSheetId) => void;
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
      detent="large"
      dragToDismiss
    >
      {sheet === 'place' && <PlaceSheet draft={draft} actions={actions} onClose={onClose} />}
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