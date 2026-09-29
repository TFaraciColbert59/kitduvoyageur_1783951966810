'use client';

import React from 'react';
import { Sheet, type SheetDetent } from '@/components/ui';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { useDrawerDetent } from './useDrawerDetent';
import {
  PlaceSheet,
  CalendarSheet,
  GroupSheet,
  PreferencesSheet,
  CoverageSheet,
  ParticipantsSheet,
  type PrepPlaceField,
} from './PrepSetupSheets';
import { StepSheet, StepsSheet, AdjustSheet } from './PrepItinerarySheets';
import { ReplaceSheet } from './PrepStepReplaceSheet';
import { AddStepRail } from './PrepAddStepRail';
import { GearSheet, ConsumablesSheet } from './PrepGearSheets';
import { PrepInviteScreen, type InviteUrlBuilder } from './PrepInviteScreen';
import { buildPrepInviteUrl } from '@/app/prepare/actions';

/**
 * Toutes les vues secondaires du preparateur, dans un seul Sheet.
 *
 * Un ecran = UNE decision dominante ; tout le reste s ouvre ici a la demande
 * (A1). Les ecrans n ont donc jamais a empiler plusieurs formulaires.
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
  | 'replace'
  | 'gear'
  | 'consumables'
  | 'invite';

// Le type est declare la ou il est consomme (la vue lieu) puis re-exporte ici
// pour que les ecrans n importent que le routeur de sheets.
export type { PrepPlaceField };

export interface PrepSheetsProps {
  sheet: PrepSheetId | null;
  onClose: () => void;
  /** Etape ciblee par la vue « step ». */
  focusStepId?: string | null;
  /** Extremite demandee par la ligne cliquee (Depart / Arrivee). */
  placeField?: PrepPlaceField | null;
  /** Etape a remplacer, pour la vue « replace » (P2.4). */
  replaceStepId?: string | null;
  /** Jour cible par « replace » et « add », quand la ligne l a designe. */
  focusDay?: number | null;
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
  replace: 'Remplacer cette étape',
  gear: 'Équipement',
  consumables: 'Eau et repas',
  invite: 'Inviter',
};

/**
 * Les hauteurs FIGEES. Tout le reste se derive du contenu (C14).
 *
 * Une seule epingle, et elle n est pas une convention : le tiroir Lieu est le
 * gabarit, donc par construction il est court — deux extremes et une recherche
 * saisie en direct. Le forcer sur 90 dvh produirait exactement l ecran « a
 * moitie vide » que C14 refuse (L4.5). Les autres tiroirs, eux, changent de
 * taille selon ce que la base a reellement rendu : c est `useDrawerDetent`
 * qui tranche, d apres la mesure du DOM, ou a defaut le nombre de lignes du
 * brouillon.
 */
const DETENT_FIGE: Readonly<Partial<Record<PrepSheetId, SheetDetent>>> = {
  place: 'auto',
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
  replaceStepId = null,
  focusDay = null,
  onOpenSheet,
}: PrepSheetsProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const store = useAdventurePrepStore;

  // Les actions sont stables : on lit le store au dernier moment pour eviter de
  // recreer 12 closures a chaque rendu de l ecran.
  const actions = useAdventurePrepStore.getState();

  void store;

  const { detent, contentRef } = useDrawerDetent(sheet, draft, { focusStepId });

  return (
    <Sheet
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={sheet ? TITLES[sheet] : ''}
      detent={sheet ? (DETENT_FIGE[sheet] ?? detent) : 'auto'}
      dragToDismiss
    >
      {/* La mesure de C14 se fait sur ce noeud : il enveloppe exactement ce
          que le tiroir affiche, et rien d autre. */}
      <div data-prep-drawer-content="" ref={contentRef}>
        {sheet === 'place' && (
          <PlaceSheet draft={draft} actions={actions} onClose={onClose} field={placeField} />
        )}
        {sheet === 'calendar' && (
          <CalendarSheet draft={draft} actions={actions} onClose={onClose} />
        )}
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
            /* E9 : depuis la fiche, « Remplacer » ouvre la meme vue que la
               carte ouvrait. L identite de l etape est transmise, sinon le
               tiroir afficherait son etat vide - qui se lirait comme un stock
               de lieux vide alors que la base n a pas ete consultee. */
            onOpenReplace={onOpenSheet ? (stepId) => onOpenSheet('replace', stepId) : undefined}
          />
        )}
        {sheet === 'steps' && <StepsSheet draft={draft} actions={actions} onClose={onClose} />}
        {sheet === 'adjust' && <AdjustSheet draft={draft} actions={actions} onClose={onClose} />}
        {/* P2.7 : le rail remplace le champ libre. On ne saisit plus un nom,
            on choisit un lieu que la base a reellement rendu autour du trace. */}
        {sheet === 'add' && (
          <AddStepRail draft={draft} actions={actions} onClose={onClose} day={focusDay} />
        )}
        {sheet === 'replace' && (
          <ReplaceSheet
            draft={draft}
            actions={actions}
            stepId={replaceStepId ?? focusStepId}
            onClose={onClose}
          />
        )}
        {sheet === 'gear' && <GearSheet draft={draft} actions={actions} />}
        {sheet === 'consumables' && <ConsumablesSheet draft={draft} actions={actions} />}
        {sheet === 'invite' && (
          <PrepInviteScreen buildInviteUrl={BUILD_INVITE_URL} onBack={onClose} />
        )}
      </div>
    </Sheet>
  );
}

export default PrepSheets;