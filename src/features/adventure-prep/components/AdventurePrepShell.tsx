'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { stepPosition } from '../engine/steps';
import { usePrepDayFocusPublisher } from '../hooks/usePrepDayFocusPublisher';
import {
  offlineReadiness,
  type OfflineReadiness,
  type OfflineUnavailableAction,
} from '../engine/resilience';
import {
  PREP_STEPS,
  PREP_STEP_LABELS,
  failedGenerationPhase,
  failedGenerationReason,
  type AdventurePrepDraft,
  type GenerationPhase,
  type GenerationPhaseId,
  type GenerationState,
  type ItineraryModel,
  type PrepStepId,
} from '../types';
import type { PhaseRetry, PhaseRetryDeps } from '../engine/itineraryPhases';
import type { PrepSheetId } from './PrepSheets';
import { PrepNav } from './PrepCrumb';
import { stepOneMissing, stepOneProfileIdFor } from './stepOneProfile';

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
 *
 * Le bandeau tient sur UNE ligne. Il occupait quatre lignes — pres de 15 % de
 * l'ecran — pour une information de degrade, sur l'etape 2, ou chaque pixel
 * compte. Le detail n'a pas disparu : il est dans le `<details>`, ouvert au
 * toucher, et present dans le HTML rendu donc lu par les technologies d'assistance.
 */
const NOTICE_BOX: React.CSSProperties = {
  flex: '0 0 auto',
  backgroundColor: 'color-mix(in srgb, var(--lkv-warning-dark) 12%, var(--lkv-surface))',
  color: 'var(--lkv-text-primary)',
  borderBottom:
    'var(--prep-hairline) solid color-mix(in srgb, var(--lkv-warning-dark) 34%, transparent)',
};

/* La ligne unique. `listStyle: none` retire la puce natively dessinee. */
const NOTICE_SUMMARY: React.CSSProperties = {
  display: 'flex',
  // `flex-start` et non `center` : quand le titre passe à la ligne, l’icône
  // et le bouton restent alignés sur la PREMIÈRE ligne du texte.
  alignItems: 'flex-start',
  gap: 'var(--prep-space-2)',
  padding: 'var(--prep-space-2) var(--prep-space-4)',
  cursor: 'pointer',
  listStyle: 'none',
  minWidth: 0,
};

/**
 * Le nom de la phase tombée doit se lire EN ENTIER.
 *
 * Mesuré sur `proof/D4-20` : la ligne unique coupait le titre en
 * « Échec : Calcul des di… ». Un nom tronqué ne dit pas ce qui a échoué —
 * donc le bandeau, qui ne porte que cette information, ne sert plus à rien.
 * Le titre passe donc à la ligne plutôt que de disparaitre : une ligne de plus
 * vaut mieux qu'une cause illisible.
 */
const NOTICE_HEADLINE: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflowWrap: 'anywhere',
  lineHeight: 1.25,
  fontWeight: 640,
};

const NOTICE_ACTION: React.CSSProperties = {
  flex: '0 0 auto',
  padding: 'var(--prep-space-1) var(--prep-space-3)',
  border: 'var(--prep-hairline) solid var(--lkv-action)',
  borderRadius: '999px',
  backgroundColor: 'transparent',
  color: 'var(--lkv-action)',
  font: 'inherit',
  fontWeight: 640,
  cursor: 'pointer',
};

const NOTICE_BODY: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prep-space-2)',
  padding: '0 var(--prep-space-4) var(--prep-space-3)',
};

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

const NOTICE_REASON: React.CSSProperties = { color: 'var(--lkv-text-subtle)' };

/* ------------------------------------------------------------------ */
/* La ligne unique : titre, action, repli                              */
/* ------------------------------------------------------------------ */

export interface PrepNoticeHeadlineInput {
  online: boolean;
  unavailableCount: number;
  failedPhase: GenerationPhase | null;
}

/**
 * Le titre de la ligne, en un seul segment court.
 *
 * Un seul texte, compose de fragments REELS : l'etat du reseau, l'existence
 * d'une indisponibilite, et le libelle exact de la phase tombee. Aucun de ces
 * fragments n'est invente — « Hors ligne » n'apparait que si le reseau est
 * reellement absent, et le nom de la phase vient de l'etat de generation.
 *
 * Une chaine vide signifie « rien a dire » : le bandeau ne rend alors rien du
 * tout, plutot qu'un « tout va bien » permanent qui apprendrait a etre ignore.
 */
export function prepNoticeHeadline({
  online,
  unavailableCount,
  failedPhase,
}: PrepNoticeHeadlineInput): string {
  const parts: string[] = [];
  if (!online) parts.push('Hors ligne');
  if (unavailableCount > 0) parts.push('Enrichissement indisponible');
  if (failedPhase) parts.push(`Échec : ${failedPhase.label}`);
  return parts.join(' · ');
}

/**
 * Le clic du bouton « Réessayer », isole de la bascule du `<details>`.
 *
 * Le bouton vit DANS le `<summary>` — c'est la seule facon de tenir sur une
 * ligne. Sans `preventDefault` ni `stopPropagation`, le meme clic ouvrirait le
 * repli ET lancerait la reprise : l'utilisateur verrait un panneau s'ouvrir
 * pendant que la phase travaille, sans savoir lequel des deux il a declenche.
 */
export function noticeRetryHandler(
  onRetryPhase?: ((id: GenerationPhaseId) => void) | null,
  failedPhase?: GenerationPhase | null
): (event: { preventDefault: () => void; stopPropagation: () => void }) => void {
  return (event) => {
    if (!onRetryPhase || !failedPhase) return;
    event.preventDefault();
    event.stopPropagation();
    onRetryPhase(failedPhase.id);
  };
}

export interface PrepOfflineNoticeProps {
  online: boolean;
  readiness: OfflineReadiness;
  /** La phase reellement tombee, ou `null` : jamais une phase supposee. */
  failedPhase?: GenerationPhase | null;
  /** La raison ecrite par le moteur lors d'un echec, affichee au repli. */
  failureReason?: string | null;
  /** Present uniquement quand une phase peut etre rejouee. */
  onRetryPhase?: ((id: GenerationPhaseId) => void) | null;
}

/**
 * Bandeau de degradation — `role="status"`, `aria-live="polite"`, sans
 * animation : un bandeau qui clignote fatigue et fait parler deux fois.
 *
 * Pourquoi il ne rend `null` que sur une vraie degradation : en ligne avec
 * l'assistant et sans phase tombee, rien n'est degrade. Un « tout va bien »
 * permanent deviendrait du papier peint, et l'utilisateur cesserait de lire le
 * seul qui compte.
 *
 * Pourquoi il est exporte : le rendu degrade se verifie directement a partir
 * du resultat du moteur pur, sans DOM ni evenement reseau.
 */
export function PrepOfflineNotice({
  online,
  readiness,
  failedPhase = null,
  failureReason = null,
  onRetryPhase = null,
}: PrepOfflineNoticeProps) {
  const headline = prepNoticeHeadline({
    online,
    unavailableCount: readiness.unavailable.length,
    failedPhase,
  });
  if (headline === '') return null;

  const retry = noticeRetryHandler(onRetryPhase, failedPhase);

  return (
    <details style={NOTICE_BOX} role="status" aria-live="polite">
      <summary style={NOTICE_SUMMARY}>
        <Icon name={online ? 'alert-triangle' : 'wifi-off'} size={14} aria-hidden="true" />
        <span style={NOTICE_HEADLINE}>{headline}</span>
        {failedPhase && onRetryPhase ? (
          <button type="button" style={NOTICE_ACTION} onClick={retry}>
            Réessayer
          </button>
        ) : null}
        <Icon name="chevron-down" size={14} aria-hidden="true" />
      </summary>
      <div style={NOTICE_BODY}>
        {failureReason ? <p style={NOTICE_REASON}>{failureReason}</p> : null}
        <p style={NOTICE_REASON}>{readiness.summary}</p>
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
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Reprise de phase — la porte vers le moteur                          */
/* ------------------------------------------------------------------ */

/**
 * La fonction que le moteur expose pour rejouer UNE phase.
 *
 * Le moteur livre `retryGenerationPhase(draft, model, phase, deps)`. L'ecran ne
 * parle pas cette signature : il veut « rejouer cette phase, rien d'autre ». Ce
 * port est donc le seul point de contact, et il separe l'intention de l'ecran
 * de l'API reelle : si celle-ci change de forme, ce bloc change seul.
 */
export type PrepPhaseRunner = (
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  phase: GenerationPhaseId,
  deps: PhaseRetryDeps
) => Promise<PhaseRetry>;

/**
 * L'adAPTATEUR CIBLE — a remplacer des que le moteur est integre.
 *
 * Elle est chargee a la demande : le moteur de generation pese, et le bandeau
 * n'en a besoin qu'au moment ou l'utilisateur clique « Réessayer ». Si le module
 * n'est pas disponible, l'echec est remonte tel quel — jamais un resultent
 * fabrique pour meubler le bandeau.
 */
export async function runPrepPhaseRetry(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  phase: GenerationPhaseId,
  deps: PhaseRetryDeps
): Promise<PhaseRetry> {
  const moteur = await import('../engine/itineraryPhases');
  return moteur.retryGenerationPhase(draft, model, phase, deps);
}

export interface PrepPhaseRetryPort {
  /** L'etat courant, lu au moment du clic. */
  draft: () => AdventurePrepDraft;
  /** Remet la phase « en attente » dans le rail, avant l'appel. */
  armPhase: (id: GenerationPhaseId) => void;
  /** Depose le resultat reel du moteur dans le brouillon. */
  applyRetry: (retry: PhaseRetry) => void;
  /** `undefined` tant que le moteur n'est pas branche : rien n'est alors simule. */
  runPhase?: PrepPhaseRunner;
  deps?: PhaseRetryDeps;
}

/**
 * Le bouton « Réessayer », en une phase et une seule.
 *
 * Quatre garde-fous, tous exiges :
 *
 * 1. Seule la phase que l'etat designe comme tombee est acceptee. Sans cela, un
 *    bouton unique pourrait rejouer une phase deja reussie.
 * 2. La phase est re-armee AVANT l'appel, pour que le rail montre l'attente
 *    pendant le travail et non apres.
 * 3. Sans moteur, la fonction s'arrete la : la phase reste « en attente » et
 *    `applyRetry` n'est jamais appele. C'est le point exact ou une reprise
 *    « fonctionnerait » en n'affichant qu'un resultat invente.
 * 4. Sans parcours, idem : l'API du moteur travaille sur un modele existant, et
 *    lui en passer un fabrique serait exactement l'invention interdite.
 */
export function createPrepPhaseRetry(
  port: PrepPhaseRetryPort
): (phase: GenerationPhaseId) => Promise<PhaseRetry | null> {
  return async (phase) => {
    const draft = port.draft();
    const fallen = failedGenerationPhase(draft.generation);
    if (!fallen || fallen.id !== phase) return null;

    port.armPhase(phase);

    const model = draft.itinerary;
    if (!port.runPhase || !model) return null;

    const retry = await port.runPhase(draft, model, phase, port.deps ?? {});
    port.applyRetry(retry);
    return retry;
  };
}

/* ------------------------------------------------------------------ */
/* Le rail : l'etape REELLEMENT affichee, pas l'etape nominale         */
/* ------------------------------------------------------------------ */

/**
 * Le nom de l'ecran qui precede les trois etapes.
 *
 * Il n'a pas de segment : l'ecran de selection d'activite n'est ni
 * « Creations » ni « Preparation » ni « En avant ! ». Le nommer plutot que de
 * le laisser sans nom evite qu'il soit lu comme une etape manquante.
 */
export const PREP_ACTIVITE_SCREEN = 'Choix de l’activité';

/**
 * Ce que le rail decrit, tel que l'ecran le montre — jamais tel que le
 * brouillon le suppose.
 *
 * Deux valeurs, et pas une de plus : ce shell ne rend que deux ecrans. Le
 * troisieme etat du parcours — la reprise « Reprise de ta preparation… » —
 * est rendu par `PrepFlow` AVANT le shell (le drapeau `mounted` n est pas
 * encore leve), donc rien dans ce fichier ne peut l'atteindre. Ecrire cet
 * etat ici serait du code mort : il donnerait au rail l'air de couvrir un
 * ecran de plus qu il n en couvre, sans qu'aucun rendu puisse le produire.
 * Le trou reel est ailleurs et est signale au proprietaire : la reprise doit
 * monter le cadre, pas le contourner.
 */
export type PrepRailScreen =
  /** L'ecran de selection d'activite : il ne PRECEDE aucune des trois etapes. */
  | 'activite'
  /** Une des trois etapes est a l'ecran. */
  | 'etape';

export interface PrepRailState {
  /**
   * L'etape reellement affichee — `null` quand AUCUNE ne l'est.
   *
   * `null` n'est ni un cas degrade ni une absence d'information : c'est
   * l'etat exact de `/prepare?nouvelle=1`, ou `ActivityPickerScreen` est
   * monte. Y mettre « destination » — ce que faisait le shell en passant
   * `step` a la volee — affirmait une etape affichee qui ne l'etait pas.
   */
  step: PrepStepId | null;
  screen: PrepRailScreen;
  /**
   * La generation tourne-t-elle ?
   *
   * Elle ne change pas l'etape affichee : l'ecran de generation est rendu
   * DANS l'etape 2, donc « Preparation » reste le segment courant. Elle change
   * en revanche ce que le rail doit permettre de voir, d'ou un etat distinct.
   */
  generating: boolean;
  /** Le nom de l'ecran affiche, en toutes lettres. Jamais invente. */
  label: string;
}

/**
 * L'etat du rail, DERIVE de l'ecran monte.
 *
 * Mesure du 2026-09-29 (`/prepare?nouvelle=1`, 393x852) : le rail portait
 * `aria-current="step"` sur « Creations » alors que l'ecran visible etait
 * `ActivityPickerScreen`. Le rail affirmait donc une etape affichee qui ne
 * l'etait pas, et `progressOf(draft)` — derive de `draft.currentStep` —
 * repetait la meme mensonge dans la region annoncee.
 *
 * La regle tient en une ligne : le rail decrit ce qui est A L'ECRAN. L'etape
 * nominale (`draft.currentStep`) ne decrit que l'intention du parcours, et
 * elle peut viser un ecran qui n'est pas monte.
 */
export function prepRailState(input: {
  picking: boolean;
  step: PrepStepId;
  generation: GenerationState;
}): PrepRailState {
  if (input.picking) {
    return { step: null, screen: 'activite', generating: false, label: PREP_ACTIVITE_SCREEN };
  }
  return {
    step: input.step,
    screen: 'etape',
    generating: input.generation.status === 'en_cours',
    label: PREP_STEP_LABELS[input.step],
  };
}

/** Ce que la region annoncee doit dire, ou rien du tout. */
export function prepRailAnnouncement(rail: PrepRailState): string {
  if (rail.step === null) return rail.label;
  return `${rail.label}, étape ${stepPosition(rail.step)} sur ${PREP_STEPS.length}`;
}

/**
 * L'etat du rail quand AUCUNE des trois etapes n'est affichee.
 *
 * Les trois noms restent, dans l'ordre, sans segment courant : c'est la seule
 * representation honnete — un rail vide ferait croire a une perte, et un
 * segment « actif » ferait croire a une etape qui n'est pas la.
 *
 * `prep-crumb`, `prep-crumb__sep`, `prep-crumb__item` et
 * `prep-crumb__label` sont les memes classes que le rail des trois etapes :
 * une seule recette de verre, donc (P5.1). Les trois etats sont ceux de
 * `PrepCrumb` — `locked` pour un segment qui n'est pas atteint — donc la
 * feuille de style n'a pas de regle a inventer pour cette variante.
 *
 * Pas de style en ligne : un style en ligne l'emporte sur la feuille de style,
 * donc il interdirait au verre d'agir sur ce rail. L aspect appartient au CSS,
 * la structure et l'etat restent ici.
 *
 * Ce bloc ne duplique pas la logique des etapes — il n'y en a aucune ici : ni
 * navigation, ni contenu atteint.
 */
export function PrepGateRail({ screenLabel }: { screenLabel: string }) {
  return (
    <nav
      className="prep-nav"
      style={{ position: 'relative', zIndex: 20 }}
      aria-label="Progression de la préparation"
    >
      <ol
        className="prep-crumb prep-crumb--gate"
        style={{ gridColumn: '1 / -1' }}
        aria-label="Étapes de la préparation"
      >
        {PREP_STEPS.map((id, index) => (
          <React.Fragment key={id}>
            {index > 0 && (
              <li className="prep-crumb__sep" aria-hidden="true">
                ·
              </li>
            )}
            <li className="prep-crumb__item" data-step={id} data-current={false} data-locked>
              <span className="prep-crumb__label" data-state="locked" data-current={false} data-locked>
                {PREP_STEP_LABELS[id]}
              </span>
            </li>
          </React.Fragment>
        ))}
      </ol>
      {/*
        L'ecran se nomme pour les lecteurs d'ecran. Visuellement, l'absence de
        segment courant EST l'information : un bandeau qui designait
        « Creations » mentait, un bandeau muet ne ment pas.
      */}
      <span className="prep-visually-hidden">{screenLabel}</span>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Le bloqueur du CTA, RESERVE dans le flux du cadre                    */
/* ------------------------------------------------------------------ */

/**
 * Ce qui manque vraiment avant que « Creer mon parcours » fasse quoi que ce
 * soit — ou `null` s'il ne manque rien.
 *
 * La MEME source que celle de l'ecran : `stepOneMissing` applique au profil
 * que `stepOneProfileIdFor` deduit de la selection. Aucune liste n'est
 * reecrite ici, donc le cadre et l'ecran ne peuvent pas diverger sur CE QUI
 * bloque.
 *
 * Le cadre ne parle que pour l'ecran qui porte ce CTA. L'ecran de selection
 * d'activite a son propre message et son propre fichier ; l'ecran de
 * generation n'a pas de CTA bloque.
 */
export function prepBlockerSummary(
  draft: AdventurePrepDraft,
  displayed: PrepStepId | null
): string | null {
  if (displayed !== 'destination') return null;
  const { blocking } = stepOneMissing(draft, stepOneProfileIdFor(draft.activities));
  if (blocking.length === 0) return null;
  return `Il manque : ${blocking.join(', ')}`;
}

/**
 * `flex: 0 0 auto` : la ligne ne se comprime jamais et ne defile jamais.
 * Elle vit dans la colonne du cadre, au-dessus de l'ecran enfant — donc hors
 * du scroller, et hors de la portee du `.prep-footer` qui appartient a cet
 * ecran enfant.
 */
const BLOCKER_BOX: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--prep-space-2)',
  margin: 'var(--prep-space-3) var(--prep-space-4) 0',
  color: 'var(--lkv-text-primary)',
};

/**
 * Le message « Il manque : … », la ou il ne peut pas disparaitre.
 *
 * Mesure du 2026-09-29, 393x852 puis 375x852, ecran « Partir librement » puis
 * `/prepare?nouvelle=1` : `.prep-body` vaut `scrollHeight 642 / clientHeight
 * 467`, `scrollTop 0`, `maxScroll 175`. Le `.prep-footer` est bien
 * `position: relative; flex: 0 0 auto` (mesure : `top 523 / bottom 593`,
 * corps `top 60 / bottom 527`) — il ne recouvre donc RIEN. Le message, lui,
 * etait a `top 611` : dans le flux du scroller, 175 px plus bas que la ligne
 * de coupe, donc invisible a l'arrivee. Le symptome (un CTA mort sans
 * explication) etait exact ; la cause, elle, etait le pli, pas le pied.
 *
 * Le reserve est donc la qu'il est TOUJOURS visible : hors du scroller, dans
 * la colonne du cadre, au-dessus de l'ecran. Ce n'est pas une repetition
 * decorative — c'est le seul endroit ou l'information ne depend pas d'un geste
 * de defilement que personne ne sait qu'il faut faire.
 */
export function PrepBlockerNote({ summary }: { summary: string }) {
  return (
    <p className="prep-blocker" style={BLOCKER_BOX}>
      <Icon name="alert-triangle" size={15} aria-hidden="true" />
      <span>{summary}</span>
    </p>
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
  /**
   * Les dependances du moteur de reprise de phase (mesures, proposeur).
   *
   * Elles sont INJECTEES et non importees : le shell n'a pas a savoir mesurer
   * une distance ni appeler le service. Tant qu'elles ne sont pas fournies, la
   * reprise arme la phase et s'arrete — elle ne fabrique aucun resultat.
   */
  phaseRetryDeps?: PhaseRetryDeps;
}

/**
 * Ce que le bandeau haut n'affiche plus, mais qui doit rester atteignable.
 *
 * Le bandeau est devenu un rail purement informatif : plus de fleche de retour,
 * plus de croix, plus de bouton de filtres. Supprimer ces trois boutons ne doit
 * pas supprimer les capacites qu'ils portaient.
 *
 * Elles vivent donc ici, hors du flux visuel et du toucher : clavier et
 * technologies d'assistance les atteignent, l'ecran ne les montre pas. Le
 * tactile, lui, passe par le bouton systeme (retour, geste) et par la barre
 * d'onglets basse, qui reste visible sur /prepare.
 */
interface PrepNavActionsProps {
  onOpenPreferences: () => void;
  onGoHub: () => void;
}

/**
 * Le revirement au focus, porte par le composant, pas par la feuille.
 *
 * `prep-visually-hidden` ecrase le groupe en 1 px (clip-path inset(50%)). Un
 * bouton qui y reste focusable est donc un focus ORPHELIN : le clavier y va,
 * l ecran ne montre rien, et rien ne signale ou l on est. Ces deux constantes
 * neutralisent la coupe quand le groupe porte le focus, et le replongent
 * dans le cache quand il le perd.
 */
const PREP_ACTIONS_REVEAL: React.CSSProperties = {
  position: 'fixed',
  top: '0.5rem',
  left: '0.5rem',
  zIndex: 80,
  display: 'flex',
  gap: '0.5rem',
  width: 'auto',
  height: 'auto',
  margin: 0,
  padding: '0.5rem',
  overflow: 'visible',
  clip: 'auto',
  clipPath: 'none',
  whiteSpace: 'normal',
};

/** Le bouton redevient un bouton : 44 pt de haut, pastille, contraste herite. */
const PREP_ACTION_BOUTON: React.CSSProperties = {
  minHeight: '44px',
  padding: '0 1rem',
  borderRadius: '999px',
  border: '1px solid currentColor',
  background: 'var(--lkv-surface, Canvas)',
  color: 'var(--lkv-text-primary, CanvasText)',
  cursor: 'pointer',
};

export function PrepNavActions({ onOpenPreferences, onGoHub }: PrepNavActionsProps) {
  const [auFocus, setAuFocus] = React.useState(false);
  return (
    <div
      className='prep-visually-hidden'
      style={auFocus ? PREP_ACTIONS_REVEAL : undefined}
      role='group'
      aria-label="Actions de la préparation"
      onFocusCapture={() => setAuFocus(true)}
      onBlurCapture={() => setAuFocus(false)}
    >
      <button
        type='button'
        style={auFocus ? PREP_ACTION_BOUTON : undefined}
        onClick={onGoHub}
      >
        Revenir au hub
      </button>
      <button
        type='button'
        style={auFocus ? PREP_ACTION_BOUTON : undefined}
        onClick={onOpenPreferences}
      >
        Ouvrir les préférences du trajet
      </button>
    </div>
  );
}

/**
 * Cadre commun des trois étapes (A1).
 *
 * Plein ecran, bandeau de 52 px qui ne contient plus qu'un rail d'etapes :
 * la progression, et rien d'autre. Aucun bouton chromé — mais une
 * étape ATTEINTE est un bouton invisible à l'oeil (voir PrepCrumb) :
 * c'est par là qu'on revient en arriere. La redirection vers le hub et
 * la feuille des preferences restent hors du flux visuel.
 *
 * La barre d onglets basse, elle, reste visible : MobileNavWrapper ne masque
 * plus /prepare et la route rend AppShell hasBottomNav, donc la reservation
 * --bottom-nav-height vaut exactement la hauteur reelle de la barre.
 *
 * Sous la barre d'etape, le bandeau hors-ligne ne s'affiche que si
 * l'application degrade reellement. Il occupe une bande de flux (`flex: 0 0
 * auto`) : l'ecran enfant se reduit, le viewport ne scrolle jamais.
 */ export function AdventurePrepShell({
  step,
  onOpenSheet,
  children,
  picking = false,
  aiEnabled = true,
  phaseRetryDeps,
}: AdventurePrepShellProps) {
  const router = useRouter();
  const draft = useAdventurePrepStore((state) => state.draft);
  const goToStep = useAdventurePrepStore((state) => state.goToStep);
  const retryPhaseInStore = useAdventurePrepStore((state) => state.retryPhase);
  const applyPhaseRetry = useAdventurePrepStore((state) => state.applyPhaseRetry);
  // Le rail et le message du CTA lisent le MEME etat, calcule ici une
  // seule fois : deux lectures independantes du brouillon finiraient par
  // diverger, et c'est precisement la divergence qui produit un ecran muet
  // sous un CTA actif — ou un CTA actif sous un message de blocage.
  const rail = prepRailState({ picking, step, generation: draft.generation });
  const blocker = prepBlockerSummary(draft, rail.step);
  const online = useOnlineStatus();

  // Le rail jour vit dans la barre basse, montee par `MobileNavWrapper` : les
  // deux arbres React sont disjoints et aucun contexte ne peut les relier. Le
  // store module `useDayFocusStore` est donc le seul canal possible.
  //
  // Il est publie ICI, et non dans un ecran : le rail doit etre le meme sur
  // les trois etapes. Publie depuis l ecran de l etape 2 seulement, il se
  // vidait des que l utilisateur revenait a « Creations » ou partait sur
  // « En avant ! », et la selection de jour ne survivait pas au changement de
  // page. Ici, l etat de jour selectionne est un SEUL etat partage, publie
  // depuis le cadre commun des trois ecrans — et jamais recalcule par l un
  // d eux.
  usePrepDayFocusPublisher(draft, step !== 'destination');

  // Une seule identity : le bandeau et le contexte lisent le meme objet.
  //
  // Le kill-switch a disparu, et c'est le coeur du correctif. Il derivait un
  // isAiCut de la seule presence d'une erreur de generation, puis le passait
  // a offlineReadiness comme un iEnabled: false. Une meteo muette suffisait
  // donc a declarer l'assistant coupe pour TOUTE l'aventure, sans retour possible :
  // les enfants du preparateur grillaient leurs actions, et rien ne proposait de
  // rejouer la phase tombee. Un echec LOCAL devenait une coupure GLOBALE.
  //
  // Desormais iEnabled dit la seule chose qu'il sait — ce que l'utilisateur a
  // choisi — et un echec de phase reste un echec de phase : visible, rejouable,
  // borne a la phase concernee.
  const offlineValue = useMemo(() => {
    const readiness = offlineReadiness({
      model: draft.itinerary,
      online,
      aiEnabled,
      aiFailure: draft.generation.failure,
    });
    return createOfflinePrepValue(online, readiness);
  }, [draft.itinerary, online, aiEnabled, draft.generation.failure]);

  // La phase a rejouer, DERIVEE de l'etat de generation — jamais supposee.
  const failedPhase = failedGenerationPhase(draft.generation);

  // Le port est reconstruit a chaque rendu : il lit l'etat au moment du clic,
  // donc une reprise ne peut pas partir d'un brouillon perime.
  const retryPhase = useMemo(
    () =>
      createPrepPhaseRetry({
        draft: () => draft,
        armPhase: retryPhaseInStore,
        applyRetry: applyPhaseRetry,
        runPhase: runPrepPhaseRetry,
        deps: phaseRetryDeps,
      }),
    [draft, retryPhaseInStore, applyPhaseRetry, phaseRetryDeps]
  );

  return (
    <OfflinePrepContext.Provider value={offlineValue}>
      <div className="adventure-prep">
        {/*
          `display: contents` : le conteneur ne genere aucune boite, donc la
          colonne flex du cadre reste inchangee et le rail occupe exactement la
          place qu'il occupait. Il porte neanmoins `data-rail-state` : une seule
          accroche pour tout l'etat du rail — `gate` (aucune des trois etapes
          affichee), `step`, `generation` — donc une seule recette de verre.

          `prep-steprail`, et NON `prep-rail` : ce nom appartient deja au rail
          des phases de generation, rendu par `ItineraryStep` dans l'etape 2.
          Deux ecrans, un meme nom de classe, et un recipe de panneau qui
          s'appliquerait aux deux par accident.
        */}
        <div
          className="prep-steprail"
          data-rail-state={rail.step === null ? 'gate' : rail.generating ? 'generation' : 'step'}
          style={{ display: 'contents' }}
        >
          {rail.step === null ? (
            <PrepGateRail screenLabel={rail.label} />
          ) : (
            <PrepNav step={rail.step} draft={draft} onOpenStep={goToStep} />
          )}
        </div>

        <PrepOfflineNotice
          online={online}
          readiness={offlineValue.readiness}
          failedPhase={failedPhase}
          failureReason={failedGenerationReason(draft.generation)}
          onRetryPhase={failedPhase ? retryPhase : null}
        />

        {blocker && <PrepBlockerNote summary={blocker} />}

        {children}

        {!picking && (
          <PrepNavActions
            onOpenPreferences={() => onOpenSheet('preferences')}
            onGoHub={() => router.push('/hub')}
          />
        )}

        {/*
          La region annoncee dit l'ecran Affiche. Elle lisait
          `progressOf(draft)`, qui derive de `draft.currentStep` — l'etape
          nominale. Sur l'ecran de selection d'activite, elle annoncait donc
          « Etape 1 sur 3 » pendant que l'ecran montrait autre chose : le meme
          mensonge que le rail, rejoue a voix haute.
        */}
        <span className="prep-visually-hidden" aria-live="polite">
          {prepRailAnnouncement(rail)}
        </span>
      </div>
    </OfflinePrepContext.Provider>
  );
}

export default AdventurePrepShell;
