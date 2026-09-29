'use client';



import React, { useEffect, useMemo, useRef, useState } from 'react';

import Icon from '@/components/ui/Icon';

import { Button, Chip } from '@/components/ui';

import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';

import { AffiliateLinkCard } from '@/features/affiliation/components/AffiliateLinkCard';

import { buildAffiliateUrl } from '@/features/affiliation/engine/affiliateEngine';

import type { AffiliateLink } from '@/features/affiliation/types/affiliate.types';

import { adjustmentIds, previewAdjustment } from '../engine/adjustments';

import { daySteps, knownGaps, stepById } from '../engine/itinerary';

import { PrepMap, PREP_POINT_COLORS, type PrepMapPoint } from './PrepMap';

import { A_VERIFIER, formatEur, formatMinutes } from '../engine/trust';

import type { AdventurePrepStore } from '../store/useAdventurePrepStore';

import type {

  AdventurePrepDraft, AdjustmentId, BookingState, ItineraryStep, ItineraryStepKind,

  MealSlot, MoneyValue, PriceBreakdown,

} from '../types';

import { MEAL_SLOT_LABELS } from '../types';



const KIND_LABELS: Readonly<Record<ItineraryStepKind, string>> = {

  trajet: 'Trajet', arret: 'Arrêt', repos: 'Pause', nuit: 'Nuit', ravitaillement: 'Ravitaillement',

};

const STEP_ICONS: Readonly<Record<ItineraryStepKind, string>> = {

  trajet: 'route', arret: 'map-pin', repos: 'footprints', nuit: 'bed-double', ravitaillement: 'droplets',

};

const ADJUSTMENT_LABELS: Readonly<Record<AdjustmentId, string>> = {

  moins_cher: 'Moins cher', moins_de_transport: 'Moins de transport',

  plus_de_nature: 'Plus de nature', plus_tranquille: 'Plus tranquille',

  plus_de_decouvertes: 'Plus de découvertes',

};



function section(title: string, children: React.ReactNode) {

  return (

    <section style={{ display: 'grid', gap: 10, marginBottom: 20 }}>

      <h3 className="prep-section-title">{title}</h3>

      {children}

    </section>

  );

}



/* L3.4 — meme regle que sur la carte, et pour la meme raison : la ligne
 * d une etape est un couple (heure de depart, duree sur place). La ligne
 * juxtaposait TOUJOURS les deux, meme absentes, et lisait alors
 * « Heure à vérifier · À vérifier sur place » : deux badges pour une seule
 * absence. On n affiche que ce qui existe, et une absence reste une absence
 * — jamais un zero pour completer le couple. */
function whenLabel(step: ItineraryStep): string {

  const parts: string[] = [];

  if (step.startTime) parts.push(step.startTime);

  if (step.durationMin !== null && Number.isFinite(step.durationMin)) {

    parts.push(`${formatMinutes(step.durationMin)} sur place`);

  }

  return parts.length > 0 ? parts.join(' · ') : 'Heure et durée à vérifier';

}



/* --- Écran 41 : la fiche d'un lieu (A6) ------------------------------- */



/** Quatre positions, dans l'ordre traversé : les deux dernières engagent quelqu'un. */

export const BOOKING_STATES: readonly BookingState[] = [

  'propose', 'a_reserver', 'confirme', 'confirme_communaute',

];

export const BOOKING_SEGMENT_LABELS: Readonly<Record<BookingState, string>> = {

  propose: 'Proposé',

  a_reserver: 'À réserver',

  confirme: 'Confirmé par toi',

  confirme_communaute: 'Confirmé par la communauté',

};

export const CONFIRMED_BOOKING_STATES: readonly BookingState[] = ['confirme', 'confirme_communaute'];



/** Sans cette mention, un chiffre de travail se lit comme un prix ferme. */

export const ESTIMATION_NOTICE =

  'Estimations non contractuelles : vérifié à la source juste avant ton départ';

export const STEP_SHEET_FOCUS_SELECTOR = '[data-prep-step-title]';



/** Catégorie lisible : le type d'étape ne se dit pas ainsi à l'utilisateur. */

const CATEGORY_LABELS: Readonly<Partial<Record<ItineraryStepKind, string>>> = { nuit: 'Hébergement' };



/** Preuves communautaires réellement connues : `null` = on ne l'affirme pas. */

export interface StepSheetCommunity { reportCount: number | null }

/** Une offre existant pour CE lieu. Rien n'est proposé hors de ce contrat. */

export interface StepSheetOffer { link: AffiliateLink }



/** Contrat commun des feuilles : brouillon et actions viennent de l'hôte. Les feuilles ne

 *  lisent jamais le store elles-mêmes — une seule source, aucun état dupliqué. */

export interface ItinerarySheetProps {

  draft: AdventurePrepDraft;

  actions: AdventurePrepStore;

  onClose: () => void;

  stepId?: string | null;

}



export interface StepSheetProps extends ItinerarySheetProps {

  /** Piloté par l'hôte : la fiche ne décide jamais seule d'un état de réservation. */

  bookingState?: BookingState | null;

  onBookingStateChange?: (state: BookingState) => void;

  offer?: StepSheetOffer | null;

  community?: StepSheetCommunity | null;

  /**
   * Ouvre la feuille de remplacement pour CETTE etape (E9, deplacee).
   *
   * L3.6 a retire « Remplacer » de la carte focalisee : trois boutons de meme
   * poids se lisent comme trois actions de meme importance, et l on ne sait
   * plus laquelle est secondaire. La capacite, elle, n a pas disparu - elle
   * se trouve la ou l on cherche les details de l etape, c est-a-dire dans la
   * fiche. Le tiroir route donc vers la MEME vue, avec la MEME identite.
   */
  onOpenReplace?: (stepId: string) => void;

  /** `true` SEULEMENT quand la fiche est elle-même le dialogue. L'hôte de production est

   *  déjà une `Sheet` Radix (role=dialog, FocusScope, Échap) : y empiler un second piège

   *  de Tab bloquerait le focus sur le premier élément en Maj+Tab. Par défaut la fiche se

   *  contente donc d'être le CONTENU d'un dialogue. */

  modal?: boolean;

}



const PERSON_LABEL = 'par personne';

const GROUP_LABEL = 'total groupe';

/** Unité inconnue mais ligne gardée : une ligne manquante se lit comme un prix oublié. */

const UNKNOWN_UNIT_LABEL = 'par unité';

const SOURCE_TO_VERIFY = 'Source à vérifier';



const ZONE: React.CSSProperties = { display: 'grid', gap: 'var(--prep-space-2)', marginBottom: 'var(--prep-space-4)' };

const PRICE_TABLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--lkv-text-caption)' };

const PRICE_TH: React.CSSProperties = { textAlign: 'left', fontWeight: 500, color: 'var(--lkv-text-muted)', padding: 'var(--prep-space-1) var(--prep-space-2) var(--prep-space-1) 0' };

const PRICE_TD: React.CSSProperties = { textAlign: 'right', fontWeight: 700, color: 'var(--lkv-text-primary)', padding: 'var(--prep-space-1) 0' };

const OUTGOING: React.CSSProperties = {

  display: 'inline-flex', alignItems: 'center', gap: 'var(--prep-space-2)', minHeight: 'var(--lkv-touch-min)',

  padding: '0 var(--prep-space-4)', borderRadius: 'var(--lkv-radius-full)', background: 'var(--g2-bg)',

  color: 'var(--lkv-text-primary)', boxShadow: 'inset 0 0 0 var(--prep-hairline) var(--glass-rim)',

  fontWeight: 600, fontSize: 'var(--lkv-text-caption)', textDecoration: 'none',

};

const PICKER_TRACK: React.CSSProperties = {

  display: 'grid', gridAutoFlow: 'column', gap: 'var(--prep-hairline)', padding: 'var(--prep-hairline)',

  borderRadius: 'var(--lkv-radius-full)', background: 'var(--g2-bg)',

  boxShadow: 'inset 0 0 0 var(--prep-hairline) var(--glass-rim)',

};

const SEGMENT_BASE: React.CSSProperties = {

  minHeight: 'var(--lkv-touch-min)', padding: '0 var(--prep-space-2)', border: 'none',

  borderRadius: 'var(--lkv-radius-full)', background: 'transparent', color: 'var(--lkv-text-muted)',

  font: 'inherit', fontSize: 'var(--lkv-text-caption)', fontWeight: 600, lineHeight: 1.2, cursor: 'pointer',

};



/** Un état confirmé se voit : une teinte d'appui seule serait indiscernable au contraste. */

function segmentStyle(selected: boolean, confirmed: boolean): React.CSSProperties {

  if (!selected) return confirmed ? { ...SEGMENT_BASE, color: 'var(--lkv-success)', fontWeight: 700 } : SEGMENT_BASE;

  const on: React.CSSProperties = { ...SEGMENT_BASE, background: 'var(--g3-bg)', color: 'var(--g3-text)' };

  return confirmed ? { ...on, boxShadow: 'inset 0 0 0 2px var(--lkv-success)' } : on;

}



export interface BookingStatePickerProps {

  value: BookingState;

  stepId: string;

  onChange: (state: BookingState) => void;

}



/** Segmenté piloté par props, sans état interne : aucune position n'est cachée dans un menu. */

export function BookingStatePicker({ value, stepId, onChange }: BookingStatePickerProps) {

  return (

    <div className="prep-step__states" style={PICKER_TRACK} role="radiogroup" aria-label="État de la réservation">

      {BOOKING_STATES.map((state) => {

        const selected = state === value;

        const confirmed = CONFIRMED_BOOKING_STATES.includes(state);

        return (

          <button

            key={state} type="button" role="radio" aria-checked={selected}

            data-confirmed={confirmed ? 'true' : 'false'}

            onClick={() => onChange(state)} style={segmentStyle(selected, confirmed)}

          >

            {BOOKING_SEGMENT_LABELS[state]}

          </button>

        );

      })}

    </div>

  );

}



/* --- Prix : jamais de chiffre sans source ----------------------------- */



export interface PriceRow { readonly label: string; readonly value: string; readonly unknown: boolean }



/** Un montant absent n'est jamais un zéro ni un tiret : c'est « à vérifier ». */

function cell(label: string, money: MoneyValue | null | undefined): PriceRow {

  const amount = money && money.amount !== null && Number.isFinite(money.amount) ? money.amount : null;

  return { label, value: amount === null ? A_VERIFIER : formatEur(amount), unknown: amount === null };

}



/** Une unité qui répéterait « par personne » ou « total groupe » doublerait la ligne. */

function isDistinctUnit(label: string | null | undefined): label is string {

  if (typeof label !== 'string') return false;

  const unit = label.trim().toLowerCase();

  return unit.length > 0 && unit !== PERSON_LABEL && unit !== GROUP_LABEL;

}



/** Trois lignes stables : unité absente = libellé neutre, unité redondante = ligne retirée. */

export function priceRows(breakdown: PriceBreakdown | null | undefined): readonly PriceRow[] {

  if (!breakdown) return [cell(UNKNOWN_UNIT_LABEL, null), cell(PERSON_LABEL, null), cell(GROUP_LABEL, null)];

  const base = [cell(PERSON_LABEL, breakdown.perPerson), cell(GROUP_LABEL, breakdown.groupTotal)];

  return isDistinctUnit(breakdown.unitLabel) ? [cell(breakdown.unitLabel, breakdown.perUnit), ...base] : base;

}



/* --- Hypothèses, source, affiliation ---------------------------------- */



/** La source nommée vient de l'état, jamais d'un compteur inventé. */

export function resolveSourceLine(state: BookingState, community: StepSheetCommunity | null): string {

  if (state === 'confirme') return 'Confirmé par toi';

  if (state !== 'confirme_communaute') return SOURCE_TO_VERIFY;

  const reports = community?.reportCount;

  return typeof reports === 'number' && Number.isFinite(reports) && reports > 0

    ? `Confirmé par la communauté · ${reports} signalements`

    : 'Confirmé par la communauté';

}



export function resolveBookingState(

  retained: BookingState | null | undefined,

  chosen: BookingState | null | undefined,

  stepState: BookingState,

): BookingState {

  return retained ?? chosen ?? stepState;

}



/** L'URL passe par le moteur d'affiliation : lui seul refuse le clair, applique le tracking

 *  et porte les garde-fous d'open redirect. Son refus vaut absence d'offre. */

export function resolveOfferHref(offer: StepSheetOffer | null, stepId?: string | null): string | null {

  const link = offer?.link;

  if (!link) return null;

  try {

    return buildAffiliateUrl(link.target_url, link.tracking_params ?? {}, { subId: stepId ?? undefined });

  } catch {

    return null;

  }

}



export interface TruncatedPlace {

  readonly text: string;

  readonly truncated: boolean;

}



/** Au milieu : le début (le nom) et la fin (la ville) sont les deux bouts utiles. */

export function resolveTruncatedPlace(value: string, max = 44): TruncatedPlace {

  const text = value.trim();

  if (text.length <= max) return { text, truncated: false };

  const keep = max - 1;

  const head = Math.ceil(keep / 2);

  return { text: `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`, truncated: true };

}



/** Un partenaire sans nom ne reçoit jamais un nom inventé. */

function partnerLabel(link: AffiliateLink | undefined): string {

  const name = link?.partner?.name;

  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'le partenaire';

}



function commissionLine(link: AffiliateLink): string {

  const rate = link.partner?.commission_rate_desc?.trim();

  return rate ? `Affilié LKDV · ${rate}` : 'Affilié LKDV';

}



/* --- Clavier et focus ------------------------------------------------- */



/** `activeElement` est un `Element` et le focus n'existe que sur l'interactif : c'est le piège qui décide. */

export interface StepSheetFocusable { focus?(): void; getAttribute?(name: string): string | null }

export type StepSheetFocusContainer = Pick<Element, 'querySelectorAll' | 'querySelector'> | null;

export interface StepSheetKeyEvent {

  key: string; shiftKey: boolean; preventDefault(): void; stopPropagation?(): void;

}



const FOCUSABLE_SELECTOR = ['button:not([disabled])', '[href]', 'input:not([disabled])', 'summary', '[tabindex]:not([tabindex="-1"])'].join(', ');



export function collectStepSheetFocusable(container: StepSheetFocusContainer): readonly StepSheetFocusable[] {

  if (!container) return [];

  const found = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as StepSheetFocusable[];

  return found.filter((node) => node.getAttribute?.('aria-hidden') !== 'true' && typeof node.focus === 'function');

}



/** Une liste de contrôles est un anneau ; un index négatif = focus encore dehors. */

function trappedIndex(count: number, current: number, backwards: boolean): number {

  if (count <= 0) return -1;

  if (current < 0) return backwards ? count - 1 : 0;

  return (current + (backwards ? -1 : 1) + count) % count;

}



/** Échap ferme, Tab boucle : laissé au navigateur, le Tab file vers la page masquée. La

 *  propagation est coupée au cas où la fiche serait ouverte depuis un dialogueenglobant :

 *  deux fermetures pour un seul Échap feraient perdre la fiche entière. */

export function handleStepSheetKeyEvent(

  event: StepSheetKeyEvent,

  options: { container: StepSheetFocusContainer; activeElement: () => Element | null; onEscape: () => void },

): void {

  if (event.key === 'Escape') {

    event.stopPropagation?.();

    options.onEscape();

    return;

  }

  if (event.key !== 'Tab') return;

  const items = collectStepSheetFocusable(options.container);

  event.preventDefault();

  if (items.length === 0) return;

  const current = items.indexOf(options.activeElement() as StepSheetFocusable);

  items[trappedIndex(items.length, current, event.shiftKey)]?.focus?.();

}



/** Focus d'ouverture sur le titre, pas sur « Réserver » : ce serait un consentement.

 *  La fermeture restitue le focus au déclencheur. */

export function applyStepSheetFocus(options: {

  container: StepSheetFocusContainer; activeElement: () => Element | null; preferredSelector: string;

}): () => void {

  const previous = options.activeElement() as StepSheetFocusable | null;

  const preferred = options.container?.querySelector(options.preferredSelector) ?? null;

  const controls = collectStepSheetFocusable(options.container);

  ((preferred ?? controls[0]) as StepSheetFocusable | undefined)?.focus?.();

  return () => { previous?.focus?.(); };

}



function StepHead(props: {

  step: ItineraryStep; titleId: string; state: BookingState; onState: (next: BookingState) => void;

}) {

  const { step, titleId, state, onState } = props;

  const place = step.placeName ? resolveTruncatedPlace(step.placeName) : null;

  return (

    <header style={ZONE}>

      <p className="prep-act__meta">{`Jour ${step.day} · ${CATEGORY_LABELS[step.kind] ?? KIND_LABELS[step.kind]}`}</p>

      <h2 className="prep-step__name" id={titleId} tabIndex={-1} data-prep-step-title="">{step.title}</h2>

      <p className="prep-step__place" title={step.placeName ?? undefined}>{place ? place.text : 'Lieu à vérifier'}</p>

      <p className="prep-step__when">{whenLabel(step)}</p>

      <BookingStatePicker value={state} stepId={step.id} onChange={onState} />

    </header>

  );

}



function StepPrice(props: { step: ItineraryStep; titleId: string }) {
  const { step, titleId } = props;

  const estimated = step.priceBreakdown?.isEstimate === true;

  return (
    <section style={ZONE} aria-labelledby={`${titleId}-prix`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--prep-space-2)' }}>
        <h3 className="prep-section-title" id={`${titleId}-prix`}>Prix</h3>
        {estimated ? <span className="prep-act__meta" data-tone="warn">Estimation</span> : null}
      </div>

      <table style={PRICE_TABLE}>
        <tbody>
          {priceRows(step.priceBreakdown).map((row) => (
            <tr key={row.label}>
              <th scope="row" style={PRICE_TH}>{row.label}</th>
              <td style={PRICE_TD} data-unknown={row.unknown ? "true" : undefined}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {estimated ? <p className="prep-note">{ESTIMATION_NOTICE}</p> : null}
    </section>
  );
}



function StepReasons(props: {

  step: ItineraryStep; titleId: string; state: BookingState; community: StepSheetCommunity | null;

}) {

  const { step, titleId, state, community } = props;

  return (

    <section style={ZONE} aria-labelledby={`${titleId}-hypotheses`}>

      <h3 className="prep-section-title" id={`${titleId}-hypotheses`}>Hypothèses</h3>

      <p className="prep-step__reason">{step.reason ?? 'Motif à vérifier'}</p>

      <p className="prep-note">{resolveSourceLine(state, community)}</p>

    </section>

  );

}



/** Sans offre réelle, aucun bloc affiliation : pas de carte vide, pas de « à venir ». */

function StepAffiliate(props: { offer: StepSheetOffer; titleId: string }) {

  const { offer, titleId } = props;

  return (

    <section style={ZONE} aria-labelledby={`${titleId}-offre`}>

      <h3 className="prep-section-title" id={`${titleId}-offre`}>Offre partenaire</h3>

      <AffiliateDisclosure />

      <AffiliateLinkCard link={offer.link} />

      <p className="prep-note">{commissionLine(offer.link)}</p>

    </section>

  );

}



/** L'hôte non modal retire la sémantique de dialogue : un rôle unique ne peut pas être vrai deux fois. */

function stepShell(titleId: string, modal: boolean): React.HTMLAttributes<HTMLDivElement> {

  return modal

    ? { className: 'prep-body', 'aria-labelledby': titleId, role: 'dialog', 'aria-modal': 'true' }

    : { className: 'prep-body', 'aria-labelledby': titleId };

}



/** `ownsTrap` dit si la fiche EST le dialogue. Tant qu'un `Sheet` Radix l'entoure, il pose

 *  déjà role=dialog, FocusScope et Échap : un second piège de Tab resterait bloqué, car

 *  FocusScope reboucle sur `last` après notre saut et la Maj+Tab ne avancerait plus.

 *  Deux effets distincts aussi : si le focus dépendait de `onClose`, un parent qui recrée

 *  son callback rejouerait le focus à chaque rendu et la fiche volerait le clavier. */

function useStepSheetDialog(

  ref: { current: HTMLDivElement | null }, stepId: string | null | undefined,

  onClose: () => void, ownsTrap: boolean,

) {

  useEffect(() => {

    const container = ref.current;

    if (!container) return;

    // Le titre est visé même sous un hôte modal : Radix ne prend que le premier élément

    // tabulable, ce serait « Réserver » — un consentement glissé à la tabulation.

    const restore = applyStepSheetFocus({

      container, activeElement: () => document.activeElement, preferredSelector: STEP_SHEET_FOCUS_SELECTOR,

    });

    // L'hôte modal restaure déjà le focus au déclencheur : deux restaurations se

    // marchent dessus pour rien, la nôtre ne vaut que pour une fiche autonome.

    return ownsTrap ? restore : undefined;

  }, [ref, stepId, ownsTrap]);



  useEffect(() => {

    const container = ref.current;

    if (!container || !ownsTrap) return;

    const onKeyDown = (event: KeyboardEvent) => handleStepSheetKeyEvent(event, {

      container, activeElement: () => document.activeElement, onEscape: onClose,

    });

    container.addEventListener('keydown', onKeyDown);

    return () => container.removeEventListener('keydown', onKeyDown);

  }, [ref, onClose, stepId, ownsTrap]);

}



/** Le détail long vit sous un repli : la vue principale tient en six zones, sans défiler. */

function StepActions(props: {
  step: ItineraryStep;
  actions: AdventurePrepStore;
  onClose: () => void;
  onOpenReplace?: (stepId: string) => void;
}) {

  const { step, actions, onClose, onOpenReplace } = props;

  return (

    <details className="prep-note">

      <summary>Repas associé et actions sur l'étape</summary>

      <div role="region" aria-label="Repas associé et actions sur l'étape" style={ZONE}>

        <div className="prep-cats">

          <Chip selected={step.mealSlot === null} onClick={() => actions.linkMeal(step.id, null)}>Aucun</Chip>

          {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (

            <Chip key={slot} selected={step.mealSlot === slot} onClick={() => actions.linkMeal(step.id, slot)}>{MEAL_SLOT_LABELS[slot]}</Chip>

          ))}

        </div>

        <div className="prep-actionrow prep-actionrow--sticky">

          <Button variant="secondary" size="md" aria-pressed={step.kept} onClick={() => actions.keepStep(step.id, !step.kept)}>

            {step.kept ? 'Ne plus conserver' : 'À conserver'}

          </Button>

          {/* E9 : « Remplacer », deplace de la carte vers la fiche (L3.6).
              La carte focalisee garde deux actions - consulter, et decider si
              l etape reste - parce que trois boutons de meme poids se lisent
              comme trois actions de meme importance. Ici l action est ou son
              contexte existe : on la cherche en regardant le detail de l etape.
              Le bouton n est rendu QUE si le routeur sait ouvrir la feuille ;
              un bouton qui ne promettrait rien serait pire que son absence. */}
          {onOpenReplace ? (
            <Button variant="secondary" size="md" onClick={() => onOpenReplace(step.id)}>
              Remplacer l&apos;étape
            </Button>
          ) : null}

          <Button variant="destructive" size="md" onClick={() => { actions.dropStep(step.id); onClose(); }}>

            Retirer l'étape

          </Button>

        </div>

      </div>

    </details>

  );

}



/** Double appel à l'action quand une offre existe, jamais un bouton muet quand elle

 *  n'existe pas : réserver sans offre reviendrait à inventer un prix. */

function StepFooter(props: { href: string | null; partner: string; onClose: () => void }) {
  const { href, partner, onClose } = props;

  const openOffer = (label: string) => (
    <a className="prep-actionrow__link prep-act" style={OUTGOING} href={href ?? undefined}
      target="_blank" rel="noopener noreferrer sponsored nofollow">{label}</a>
  );

  return (
    <div className="prep-footer prep-actionrow prep-actionrow--sticky">
      {href !== null ? (
        <div className="prep-actionrow">
          {openOffer('Voir l’offre ↗')}
          {openOffer('Réserver via ' + partner)}
        </div>
      ) : null}

      <Button variant="primary" size="lg" className="prep-footer__primary prep-primary" onClick={onClose}>
        Fermer
      </Button>
    </div>
  );
}



export function StepSheet(props: StepSheetProps) {

  const {

    draft, actions, onClose, stepId, bookingState = null, onBookingStateChange,

    offer = null, community = null, modal = false,

  } = props;

  const model = draft.itinerary;

  const step = model && stepId ? stepById(model, stepId) : undefined;

  const containerRef = useRef<HTMLDivElement | null>(null);

  // La prop reste prioritaire, mais la fiche ne doit pas attendre un parent lent

  // pour refléter le clic de l'utilisateur.

  const [chosen, setChosen] = useState<BookingState | null>(null);

  const titleId = `prep-step-title-${stepId ?? 'inconnue'}`;

  useStepSheetDialog(containerRef, stepId, onClose, modal);

  const shell = stepShell(titleId, modal);



  if (!model || !step) {

    return (

      <div {...shell} ref={containerRef}>

        <h2 className="prep-title" id={titleId} tabIndex={-1} data-prep-step-title="">

          Cette étape n’existe plus dans le programme

        </h2>

        <StepFooter href={null} partner="" onClose={onClose} />

      </div>

    );

  }



  const state = resolveBookingState(bookingState, chosen, step.state);

  const href = resolveOfferHref(offer, step.id);

  return (
    <div {...shell} ref={containerRef}>
      <StepHead
        step={step} titleId={titleId} state={state}
        onState={(next) => { setChosen(next); onBookingStateChange?.(next); }}
      />
      <StepPrice step={step} titleId={titleId} />
      <StepReasons step={step} titleId={titleId} state={state} community={community} />
      {href !== null && offer ? <StepAffiliate offer={offer} titleId={titleId} /> : null}
      <StepFooter href={href} partner={partnerLabel(offer?.link)} onClose={onClose} />
      <StepActions step={step} actions={actions} onClose={onClose} onOpenReplace={props.onOpenReplace} />
    </div>
  );

}

/* ------------------------------------------------------------------ */

/* Programme complet (A6)                                              */

/* ------------------------------------------------------------------ */



/** Familles affichees par la carte du programme : tout le parcours, sans exception. */
const MAP_CATEGORIES: readonly string[] = ['trajet', 'arret', 'repos', 'nuit', 'ravitaillement'];

/** Une position n existe que si la base l arendue finie ET non nulle. */
function located(step: { lat: number | null; lon: number | null }): step is { lat: number; lon: number } {
  if (step.lat === null || step.lon === null) return false;
  return Number.isFinite(step.lat) && Number.isFinite(step.lon);
}

/**
 * Trace du programme, dans l ordre REEL de lecture : jour, puis rang.
 *
 * Deux etape consecutives partageant le meme lieu ne produisent qu un point :
 * une boucle qui revient au meme endroit retrace alors le chemin, pas une suite
 * de bonds de longueur nulle.
 */
function programRoute(steps: readonly ItineraryStep[]): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (const step of [...steps].sort((a, b) => a.day - b.day || a.order - b.order)) {
    if (!located(step)) continue;
    const last = coords[coords.length - 1];
    if (last && last[0] === step.lat && last[1] === step.lon) continue;
    coords.push([step.lat, step.lon]);
  }
  return coords;
}

/** Une entree de marqueur par etape reellement localisee, et rien d invente. */
function programPoints(steps: readonly ItineraryStep[]): PrepMapPoint[] {
  return programRoute(steps)
    .length === 0
    ? []
    : [...steps]
        .sort((a, b) => a.day - b.day || a.order - b.order)
        .flatMap((step) =>
          located(step)
            ? [{
                id: step.id,
                lat: step.lat,
                lon: step.lon,
                label: step.title,
                color: PREP_POINT_COLORS[step.kind],
                category: step.kind,
                stepId: step.id,
              }]
            : [],
        );
}

export function StepsSheet({ draft, actions, onClose }: ItinerarySheetProps) {

  const model = draft.itinerary;

  if (!model) {

    return (

      <div>

        <p className="prep-note">Le programme n’est pas encore généré.</p>

        <div style={{ marginTop: 16 }}>

          <Button variant="secondary" size="md" onClick={onClose}>

            Fermer

          </Button>

        </div>

      </div>

    );

  }



  const coords = programRoute(model.steps);
  const points = programPoints(model.steps);

  return (

    <div>

      {coords.length > 0 ? (

        <div className="prep-map--inline" data-program-map="on">

          <PrepMap

            name="Ton programme"

            routeCoords={coords}

            points={points}

            scopeLabel="Ensemble"

            filterCategories={MAP_CATEGORIES}

            hideExpand

          />

          <p className="prep-maphint">

            {`${points.length} étapes localisées. Touche une étape ci-dessous pour l’ouvrir sur le parcours.`}

          </p>

        </div>

      ) : (

        <p className="prep-maphint" data-program-map="pending">

          Les positions de ce programme ne sont pas encore mesurées : la carte s’affichera dès que les lieux réels seront accrochés au parcours.

        </p>

      )}

      {Array.from({ length: model.days }, (_, index) => index + 1).map((day) => {

        const steps = daySteps(model, day);

        return (

          <section key={day} style={{ marginBottom: 20 }}>

            <h3 className="prep-section-title" style={{ marginBottom: 8 }}>

              Jour {day}

            </h3>

            {steps.length === 0 ? (

              <p className="prep-block__hint" style={{ paddingInline: 0 }}>

                Aucune étape proposée pour cette journée.

              </p>

            ) : (

              <ul className="prep-acts">

                {steps.map((step) => (

                  <li key={step.id}>

                    <button

                      type="button"

                      className="prep-act"

                      onClick={() => {

                        onClose();

                        window.dispatchEvent(

                          new CustomEvent('prep:focus-step', { detail: { stepId: step.id } }),

                        );

                      }}

                    >

                      <span className="prep-act__icon">

                        <Icon name={step.icon || STEP_ICONS[step.kind]} size={20} />

                      </span>

                      <span className="prep-act__name">

                        {step.startTime ? `${step.startTime} · ` : ''}

                        {step.title}

                      </span>

                      <span className="prep-act__meta">{KIND_LABELS[step.kind]}</span>

                    </button>

                  </li>

                ))}

              </ul>

            )}

          </section>

        );

      })}

      <div className="prep-actionrow" style={{ justifyContent: 'flex-end' }}>

        <Button variant="secondary" size="md" onClick={onClose}>

          Fermer

        </Button>

      </div>

      <p className="prep-visually-hidden" aria-live="polite">

        {model.steps.length} étapes au programme

      </p>

    </div>

  );

}



/* ------------------------------------------------------------------ */

/* Ajuster (A6)                                                        */

/* ------------------------------------------------------------------ */



export function AdjustSheet({ draft, actions, onClose }: ItinerarySheetProps) {

  const model = draft.itinerary;

  const [pending, setPending] = useState<AdjustmentId | null>(null);

  const [freeText, setFreeText] = useState('');

  const [applied, setApplied] = useState<string | null>(null);



  const preview = useMemo(

    () => (model && pending ? previewAdjustment(model, pending) : null),

    [model, pending],

  );



  if (!model) {

    return (

      <div>

        <p className="prep-note">Ajuster un parcours n’a de sens qu’une fois le programme créé.</p>

        <div style={{ marginTop: 16 }}>

          <Button variant="secondary" size="md" onClick={onClose}>

            Fermer

          </Button>

        </div>

      </div>

    );

  }



  return (

    <div>

      {section('Réglage simple', (

        <ul className="prep-acts">

          {adjustmentIds().map((id) => (

            <li key={id}>

              <button

                type="button"

                className="prep-act"

                aria-pressed={pending === id}

                onClick={() => setPending(pending === id ? null : id)}

              >

                <span className="prep-act__icon">

                  <Icon name="sparkles" size={20} />

                </span>

                <span className="prep-act__name">{ADJUSTMENT_LABELS[id]}</span>

                {pending === id ? <Icon name="check" size={18} className="prep-act__check" /> : null}

              </button>

            </li>

          ))}

        </ul>

      ))}



      {preview && (

        <div className="prep-note" style={{ marginBottom: 16 }}>

          <p style={{ margin: 0 }}>{preview.impact}</p>

          {preview.preservedStepIds.length > 0 && (

            <p style={{ margin: '6px 0 0' }}>

              {preview.preservedStepIds.length} étape(s) conservée(s) ou confirmée(s) ne bougent

              pas.

            </p>

          )}

        </div>

      )}



      {section('Ou en une phrase', (

        <input

          className="prep-block__row"

          value={freeText}

          onChange={(event) => setFreeText(event.target.value)}

          placeholder="Ex. moins de route, plus de forêt"

          aria-label="Ajustement libre en une phrase"

        />

      ))}



      {applied && (

        <p className="prep-note" role="status" style={{ marginBottom: 14 }}>

          {applied}

        </p>

      )}



      <div className="prep-actionrow" style={{ justifyContent: 'flex-end' }}>

        <Button variant="ghost" size="md" onClick={onClose}>

          Garder l’actuel

        </Button>

        <Button

          variant="primary"

          size="md"

          disabled={!preview && freeText.trim().length < 2}

          onClick={() => {

            if (preview) {

              actions.adjust(preview.id);

              setApplied(`${ADJUSTMENT_LABELS[preview.id]} — ${preview.impact}`);

            } else {

              // Un ajustement libre est enregistré comme intention : aucune

              // réorganisation n'est inventée sans moteur derrière.

              setApplied(

                `« ${freeText.trim()} » sera pris en compte au prochain calcul. Aucun changement n'est appliqué à l'aveugle.`,

              );

            }

            setPending(null);

            setFreeText('');

          }}

        >

          Appliquer

        </Button>

      </div>

    </div>

  );

}



/* ------------------------------------------------------------------ */

/* Ajouter une etape (A6)                                             */

/* ------------------------------------------------------------------ */



const ADD_KINDS: readonly { id: ItineraryStepKind; label: string }[] = [

  { id: 'arret', label: 'Lieu' },

  { id: 'trajet', label: 'Trajet' },

  { id: 'nuit', label: 'Hébergement' },

  { id: 'ravitaillement', label: 'Ravitaillement' },

  { id: 'repos', label: 'Pause' },

];



export function AddStepSheet({ draft, actions, onClose }: ItinerarySheetProps) {

  const model = draft.itinerary;

  const [kind, setKind] = useState<ItineraryStepKind>('arret');

  const [title, setTitle] = useState('');

  const [place, setPlace] = useState('');

  const [day, setDay] = useState(1);

  const [meal, setMeal] = useState<MealSlot | null>(null);



  if (!model) {

    return (

      <div>

        <p className="prep-note">Il faut d’abord un programme pour y ajouter une étape.</p>

        <div style={{ marginTop: 16 }}>

          <Button variant="secondary" size="md" onClick={onClose}>

            Fermer

          </Button>

        </div>

      </div>

    );

  }



  const gaps = knownGaps(model);



  return (

    <div>

      {section('Nature de l’étape', (

        <div className="prep-cats">

          {ADD_KINDS.map((option) => (

            <Chip key={option.id} selected={kind === option.id} onClick={() => setKind(option.id)}>

              {option.label}

            </Chip>

          ))}

        </div>

      ))}



      {section('Intitulé', (

        <input

          className="prep-block__row"

          value={title}

          onChange={(event) => setTitle(event.target.value)}

          placeholder="Ex. Pause au viewpoint"

          aria-label="Intitulé de l'étape"

        />

      ))}



      {section('Lieu (facultatif)', (

        <input

          className="prep-block__row"

          value={place}

          onChange={(event) => setPlace(event.target.value)}

          placeholder="Nom du lieu"

          aria-label="Lieu de l'étape"

        />

      ))}



      {section('Jour', (

        <div className="prep-days">

          {Array.from({ length: model.days }, (_, index) => index + 1).map((value) => (

            <button

              key={value}

              type="button"

              className="prep-day"

              aria-pressed={day === value}

              onClick={() => setDay(value)}

            >

              Jour {value}

            </button>

          ))}

        </div>

      ))}



      {section('Repas couvert (facultatif)', (

        <div className="prep-cats">

          <Chip selected={meal === null} onClick={() => setMeal(null)}>

            Aucun

          </Chip>

          {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (

            <Chip key={slot} selected={meal === slot} onClick={() => setMeal(slot)}>

              {MEAL_SLOT_LABELS[slot]}

            </Chip>

          ))}

        </div>

      ))}



      {gaps.length > 0 && (

        <p className="prep-note" style={{ marginBottom: 14 }}>

          {gaps.length} information(s) restent inconnues : rien n’est inventé pour les

          combler.

        </p>

      )}



      <div className="prep-actionrow" style={{ justifyContent: 'flex-end' }}>

        <Button variant="ghost" size="md" onClick={onClose}>

          Annuler

        </Button>

        <Button

          variant="primary"

          size="md"

          disabled={title.trim().length < 2}

          onClick={() => {

            actions.addStepToDay(day, kind, {

              title: title.trim(),

              placeName: place.trim() || null,

              mealSlot: meal,

            });

            onClose();

          }}

        >

          Ajouter au parcours

        </Button>

      </div>

    </div>

  );

}

