'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { OfflineBanner } from '@/features/adventure-intelligence/ui/OfflineBanner';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { canOpenStep, progressOf, stepCountDone } from '../engine/steps';
import {
  offlineReadiness,
  type OfflineReadiness,
  type OfflineUnavailableAction,
} from '../engine/resilience';
import { PREP_STEPS, PREP_STEP_LABELS, type AdventurePrepDraft, type PrepStepId } from '../types';
import type { PrepSheetId } from './PrepSheets';
import { PrepNav } from './PrepCrumb';

/* ------------------------------------------------------------------ */
/* Etat reseau                                                        */
/* ------------------------------------------------------------------ */

/**
 * Etat suppose tant que le navigateur n'a pas parle.
 *
 * Le serveur ne peut PAS connaitre la connexion : rendre « hors ligne » au
 * premier rendu produirait un bandeau fantome absent du HTML serveur, donc un
 * mismatch d'hydratation. On suppose donc « en ligne » des deux cotes, et
 * l'etat reel arrive juste apres l'hydratation. Meme exigence que le store
 * focus-jour : premier rendu serveur et premier rendu client identiques, la
 * correction arrive ensuite (voir `dayFocusStore.ts`).
 */
export const PREP_SERVER_ONLINE = true;

/**
 * Instantané réseau cote client.
 *
 * On teste `window` et jamais `navigator` : Node expose `globalThis.navigator`
 * (sans `onLine` fiable) depuis la v21, alors que `window` est absent au rendu
 * serveur. Une information absente vaut « en ligne » : on ne degrade jamais
 * l'ecran sur la foi d'une donnee qu'on n'a pas.
 */
export function readPrepNetwork(): boolean {
  if (typeof window === 'undefined' || !window.navigator) return PREP_SERVER_ONLINE;
  return window.navigator.onLine !== false;
}

/** Instantané serveur : constant, pour que l'hydratation ne diverge pas. */
export function readPrepNetworkOnServer(): boolean {
  return PREP_SERVER_ONLINE;
}

function subscribeToNetwork(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** `useSyncExternalStore` plutot qu'un `useState` : le snapshot est la source. */
function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeToNetwork, readPrepNetwork, readPrepNetworkOnServer);
}

/* ------------------------------------------------------------------ */
/* Contexte consomme par les enfants                                   */
/* ------------------------------------------------------------------ */

export interface OfflinePrepValue {
  online: boolean;
  readiness: OfflineReadiness;
  /** La liste exacte, partagee : aucun enfant ne recalcule l'etat reseau. */
  unavailable: readonly OfflineUnavailableAction[];
  /** Pour desactiver une action en gardant sa raison a portee de main. */
  isUnavailable: (id: string) => boolean;
  reasonFor: (id: string) => string | null;
}

const OfflinePrepContext = React.createContext<OfflinePrepValue | null>(null);

/**
 * Hors du shell (feuilles rendues en portail) on ne pretend pas degrader :
 * `isUnavailable` vaut faux plutot que d'inventer une panne.
 */
const OUTSIDE_PREP: OfflinePrepValue = {
  online: true,
  readiness: offlineReadiness({ model: null, online: true, aiEnabled: true }),
  unavailable: [],
  isUnavailable: () => false,
  reasonFor: () => null,
};

function createOfflinePrepValue(online: boolean, readiness: OfflineReadiness): OfflinePrepValue {
  const byId = new Map(readiness.unavailable.map((action) => [action.id, action]));
  return {
    online,
    readiness,
    unavailable: readiness.unavailable,
    isUnavailable: (id) => byId.has(id),
    reasonFor: (id) => byId.get(id)?.reason ?? null,
  };
}

/**
 * Ce que voit un enfant du preparateur : l'etat hors-ligne et la raison de
 * chaque action indisponible. Un enfant peut donc desactiver son bouton ET
 * afficher la raison, au lieu de griser en silence.
 */
export function useOfflinePrep(): OfflinePrepValue {
  return React.useContext(OfflinePrepContext) ?? OUTSIDE_PREP;
}

/* ------------------------------------------------------------------ */
/* Bandeau de degradation                                             */
/* ------------------------------------------------------------------ */

/*
 * Couleurs : uniquement des tokens. `--lkv-warning-dark` teinte le fond par
 * `color-mix` au lieu d'etre utilise en aplat, ce qui garde le texte en
 * `--lkv-text-primary` — donc contraste eleve dans les deux themes.
 */
const NOTICE_BOX: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prep-space-2)',
  padding: 'var(--prep-space-3) var(--prep-space-4)',
  textAlign: 'left',
  backgroundColor: 'color-mix(in srgb, var(--lkv-warning-dark) 12%, var(--lkv-surface))',
  color: 'var(--lkv-text-primary)',
  borderBottom:
    'var(--prep-hairline) solid color-mix(in srgb, var(--lkv-warning-dark) 34%, transparent)',
  fontSize: 'var(--lkv-text-note)',
  lineHeight: 'var(--lkv-line-body)',
};

const NOTICE_HEAD: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--prep-space-2)',
};

const NOTICE_SUMMARY: React.CSSProperties = { flex: '1 1 12rem', minWidth: 0 };

const UNAVAILABLE_LIST: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prep-space-1)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const UNAVAILABLE_ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--prep-space-2)',
};

export interface PrepOfflineNoticeProps {
  online: boolean;
  readiness: OfflineReadiness;
}

/**
 * Bandeau de degradation — `role="status"`, `aria-live="polite"`, sans
 * animation : un bandeau qui clignote fatigue et fait parler deux fois.
 *
 * Pourquoi il ne rend `null` que sur une vraie degradation : en ligne avec
 * l'assistant, rien n'est degrade. Un « tout va bien » permanent deviendrait
 * du papier peint, et l'utilisateur cesserait de lire le seul qui compte.
 *
 * Pourquoi il est exporte : le rendu degrade se verifie directement a partir
 * du resultat du moteur pur, sans DOM ni evenement reseau.
 */
export function PrepOfflineNotice({ online, readiness }: PrepOfflineNoticeProps) {
  if (readiness.unavailable.length === 0) return null;

  return (
    <div style={NOTICE_BOX} role="status" aria-live="polite">
      <div style={NOTICE_HEAD}>
        <OfflineBanner offline={!online} className="shrink-0" />
        <p style={NOTICE_SUMMARY}>{readiness.summary}</p>
      </div>
      <ul style={UNAVAILABLE_LIST}>
        {readiness.unavailable.map((action) => (
          <li key={action.id} style={UNAVAILABLE_ITEM}>
            <Icon name="wifi-off" size={13} aria-hidden="true" />
            <span>
              <strong>{action.label}</strong> — {action.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cadre                                                              */
/* ------------------------------------------------------------------ */

export interface AdventurePrepShellProps {
  step: PrepStepId;
  onOpenSheet: (sheet: PrepSheetId, focusStepId?: string | null) => void;
  children: React.ReactNode;
  /** Affiche l'action « Préparer une activité » (écran de choix d'activité). */
  picking?: boolean;
  /**
   * `false` quand l'assistant est coupe pour cette aventure.
   *
   * `true` par defaut : on ne degrade l'ecran que sur un `false` explicite,
   * jamais sur une information absente. L'appelant (PrepFlow) ne fournit rien
   * aujourd'hui, donc l'ecran reste en ligne tant que la deconnexion n'est
   * pas constatee — c'est le comportement par defaut du chantier.
   */
  aiEnabled?: boolean;
}

/** La navigation en mots reste atteignable au doigt une fois terminee. */
interface CompletedStepsProps {
  draft: AdventurePrepDraft;
  onOpenStep: (step: PrepStepId) => void;
}

function CompletedSteps({ draft, onOpenStep }: CompletedStepsProps) {
  if (stepCountDone(draft) === 0) return null;
  return (
    <div className="prep-visually-hidden" role="group" aria-label="Étapes déjà terminées">
      {PREP_STEPS.map((id) =>
        canOpenStep(draft, id) && draft.completedSteps.includes(id) ? (
          <button key={id} type="button" onClick={() => onOpenStep(id)}>
            Revenir à {PREP_STEP_LABELS[id]}
          </button>
        ) : null,
      )}
    </div>
  );
}

/**
 * Cadre commun des trois étapes (A1).
 *
 * Plein écran, barre de navigation basse masquée (la route rend
 * `AppShell hasBottomNav={false}`), bandeau de 52 px : retour à gauche,
 * progression en mots simples au centre, fermeture à droite. Fermer
 * enregistre le brouillon — il est déjà persisté à chaque mutation.
 *
 * Sous la barre d'etape, le bandeau hors-ligne ne s'affiche que si
 * l'application degrade reellement. Il occupe une bande de flux (`flex: 0 0
 * auto`) : l'ecran enfant se reduit, le viewport ne scrolle jamais.
 */export function AdventurePrepShell({
  step,
  onOpenSheet,
  children,
  picking = false,
  aiEnabled = true,
}: AdventurePrepShellProps) {
  const router = useRouter();
  const draft = useAdventurePrepStore((state) => state.draft);
  const goToStep = useAdventurePrepStore((state) => state.goToStep);
  const progress = progressOf(draft);
  const online = useOnlineStatus();

  // Une seule identity : le bandeau et le contexte lisent le meme objet.
  const offlineValue = useMemo(
    () => {
      const isAiCut = draft.generation.error !== null || draft.generation.notice !== null || draft.generation.status === 'echec';
      const finalAiEnabled = aiEnabled && !isAiCut;
      const readiness = offlineReadiness({ model: draft.itinerary, online, aiEnabled: finalAiEnabled });
      return createOfflinePrepValue(online, readiness);
    },
    [draft.itinerary, online, aiEnabled, draft.generation.error, draft.generation.notice, draft.generation.status],
  );

  return (
    <OfflinePrepContext.Provider value={offlineValue}>
      <div className="adventure-prep">
        <PrepNav
          step={step}
          draft={draft}
                  onOpenStep={goToStep}
          onClose={() => router.push('/hub')}
        />

        <PrepOfflineNotice online={online} readiness={offlineValue.readiness} />

        {children}

        {!picking && <CompletedSteps draft={draft} onOpenStep={goToStep} />}

        <span className="prep-visually-hidden" aria-live="polite">
          {picking ? '' : progress.label}
        </span>
      </div>
    </OfflinePrepContext.Provider>
  );
}

export default AdventurePrepShell;