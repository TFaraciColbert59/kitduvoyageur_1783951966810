/**
 * Écran 41 — « Fiche lieu avec offre ».
 *
 * Même harnais que `prep-screens.test.tsx` : la suite vit en `environment: node`,
 * sans DOM ni testing-library dans le repo. Deux principes, donc deux harnais.
 * - Le rendu passe par `renderToStaticMarkup` : le composant est RÉELLEMENT exécuté.
 * - Les interactions passent soit par le sous-composant pur rendu (`BookingStatePicker`),
 *   soit par les décisions pures exportées avec un faux conteneur.
 *
 * `StepSheet` ne lit aucun store : il reçoit `draft` et `actions` en props. Aucun mock
 * n'est nécessaire, et le test ne peut pas dériver d'un état global sans le voir.
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BOOKING_SEGMENT_LABELS,
  BOOKING_STATES,
  BookingStatePicker,
  CONFIRMED_BOOKING_STATES,
  ESTIMATION_NOTICE,
  STEP_SHEET_FOCUS_SELECTOR,
  StepSheet,
  applyStepSheetFocus,
  collectStepSheetFocusable,
  handleStepSheetKeyEvent,
  priceRows,
  resolveBookingState,
  resolveOfferHref,
  resolveSourceLine,
  resolveTruncatedPlace,
  type StepSheetOffer,
  type StepSheetProps,
} from '../components/PrepItinerarySheets';
import { A_VERIFIER } from '../engine/trust';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type {
  AdventurePrepDraft,
  BookingState,
  ItineraryModel,
  ItineraryStep,
  MoneyValue,
  PriceBreakdown,
} from '../types';
import type { AffiliateLink } from '@/features/affiliation/types/affiliate.types';

  /* ===== Fixtures ===== */

const UNKNOWN: MoneyValue = { amount: null, currency: 'EUR', state: 'a_reserver' };

/** Un montant connu, pour prouver que le formatage fonctionne vraiment. */
const KNOWN: MoneyValue = { amount: 42.5, currency: 'EUR', state: 'confirme' };

function breakdown(overrides: Partial<PriceBreakdown> = {}): PriceBreakdown {
  return {
    unitLabel: 'par nuit',
    perUnit: UNKNOWN,
    perPerson: UNKNOWN,
    groupTotal: UNKNOWN,
    isEstimate: false,
    ...overrides,
  };
}

const PARTNER: NonNullable<AffiliateLink['partner']> = {
  id: 'p-1',
  slug: 'booking-partenaire',
  name: 'Refuges & Co',
  network: 'travelpayouts',
  commission_rate_desc: '5 % du séjour',
  is_active: true,
  created_at: '2026-01-01',
};

function affiliateLink(overrides: Partial<AffiliateLink> = {}): AffiliateLink {
  return {
    id: 'l-1',
    slug: 'refuge-chamonix',
    partner_id: 'p-1',
    partner: PARTNER,
    category: 'hotel',
    country_code: 'FR',
    title: 'Nuit au refuge des Aiguilles',
    destination_name: 'Chamonix',
    target_url: 'https://partenaire.test/refuge?checkin=2026-07-11',
    tracking_params: { marker: 'lkdv', campaign: 'prep' },
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function offer(overrides: Partial<StepSheetOffer> = {}): StepSheetOffer {
  return { link: affiliateLink(), ...overrides };
}

function model(): ItineraryModel {
  const built = buildItinerary(fullDraft());
  if (!built) throw new Error('modele attendu');
  return built;
}

/** Une étape de référence : un lieu, un motif, aucun prix. */
function step(overrides: Partial<ItineraryStep> = {}): ItineraryStep {
  const [first] = model().steps;
  return {
    ...first,
    id: 's-refuge',
    kind: 'nuit',
    title: 'Nuit au refuge',
    placeName: 'Refuge des Aiguilles, Chamonix',
    startTime: '18:30',
    durationMin: 840,
    reason: 'Proche du dernier col du jour',
    price: UNKNOWN,
    state: 'propose',
    priceBreakdown: null,
    ...overrides,
  };
}

function draftWith(stepValue: ItineraryStep): AdventurePrepDraft {
  const base = model();
  return {
    ...fullDraft(),
    itinerary: { ...base, steps: [stepValue] },
  };
}

const NOOP = () => undefined;

function actions(): StepSheetProps['actions'] {
  return {
    linkMeal: vi.fn(),
    dropStep: vi.fn(),
    keepStep: vi.fn(),
  } as unknown as StepSheetProps['actions'];
}

function render(stepValue: ItineraryStep, props: Partial<StepSheetProps> = {}): string {
  const merged: StepSheetProps = {
    draft: draftWith(stepValue),
    actions: actions(),
    onClose: NOOP,
    stepId: stepValue.id,
    ...props,
  };
  return renderToStaticMarkup(React.createElement(StepSheet, merged));
}

/** Ce que l'utilisateur LIT : balises et attributs retires. */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RenderedAction {
  tag: string;
  text: string;
}

/** Les boutons et les liens rendus, dans l'ordre du document. */
function actionsOf(html: string): RenderedAction[] {
  const found: RenderedAction[] = [];
  const pattern = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null = pattern.exec(html);
  while (match !== null) {
    found.push({ tag: match[2] ?? '', text: visible(match[3] ?? '') });
    match = pattern.exec(html);
  }
  return found;
}

function actionLabels(html: string): string[] {
  return actionsOf(html).map((action) => action.text);
}

function openTags(html: string, name: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`<${name}\\b[^>]*>`, 'g');
  let match: RegExpExecArray | null = pattern.exec(html);
  while (match !== null) {
    found.push(match[0]);
    match = pattern.exec(html);
  }
  return found;
}

/* --- Parcours de l'arbre React (sous-composant pur, aucun hook) ---------- */

type RenderedElement = { type?: unknown; props?: Record<string, unknown> };

function walk(node: unknown, visit: (element: Required<RenderedElement>) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const element = node as RenderedElement;
  if (element.type === undefined || element.props === undefined) return;
  visit(element as Required<RenderedElement>);
  walk(element.props.children, visit);
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const element = node as { props?: { children?: unknown } };
  if (element?.props?.children === undefined) return '';
  return textOf(element.props.children);
}

interface RenderedButton {
  label: string;
  checked: boolean | undefined;
  confirmed: string | undefined;
  disabled: boolean;
  onClick: (() => void) | undefined;
}

/** Les quatre segments, dans l'ordre du document. */
function segmentsOf(node: unknown): RenderedButton[] {
  const found: RenderedButton[] = [];
  walk(node, (element) => {
    if (element.type !== 'button') return;
    found.push({
      label: textOf(element.props.children),
      checked: element.props['aria-checked'] as boolean | undefined,
      confirmed: element.props['data-confirmed'] as string | undefined,
      disabled: element.props.disabled === true,
      onClick: element.props.onClick as (() => void) | undefined,
    });
  });
  return found;
}

function picker(props: Partial<React.ComponentProps<typeof BookingStatePicker>> = {}) {
  return BookingStatePicker({ value: 'propose', stepId: 's-refuge', onChange: NOOP, ...props });
}

/* --- Faux DOM : le contrat clavier / focus ------------------------------- */

interface FakeFocusable {
  readonly label: string;
  focusCount: number;
  focus: () => void;
  getAttribute: (name: string) => string | null;
}

function makeFocusable(label: string, hidden = false): FakeFocusable {
  const node: FakeFocusable = {
    label,
    focusCount: 0,
    focus() {
      node.focusCount += 1;
    },
    getAttribute: (name: string) => (name === 'aria-hidden' && hidden ? 'true' : null),
  };
  return node;
}

function makeContainer(nodes: readonly FakeFocusable[], preferred?: FakeFocusable): Element {
  return {
    querySelectorAll: () => nodes,
    querySelector: () => preferred ?? null,
  } as unknown as Element;
}

function keyEvent(key: string, shiftKey = false) {
  const event = {
    key,
    shiftKey,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

const SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/features/adventure-prep/components/PrepItinerarySheets.tsx'),
  'utf8',
);

  /* ===== 1. En-tête + segmented control d'état ===== */

describe('Fiche lieu — en-tête et état', () => {
  it('SS-01: les quatre positions portent le libellé français exact', () => {
    const html = render(step());
    for (const label of ['Proposé', 'À réserver', 'Confirmé par toi', 'Confirmé par la communauté']) {
      expect(visible(html)).toContain(label);
    }
    expect(BOOKING_SEGMENT_LABELS).toEqual({
      propose: 'Proposé',
      a_reserver: 'À réserver',
      confirme: 'Confirmé par toi',
      confirme_communaute: 'Confirmé par la communauté',
    });
    expect(BOOKING_STATES).toHaveLength(4);
  });

  it('SS-02: le sélecteur est un groupe radio, pas un menu', () => {
    const html = render(step());
    expect(html).toContain('role="radiogroup"');
    expect((html.match(/role="radio"/g) ?? []).length).toBe(4);
    // Aucune liste déroulante : un menu cacherait les états derrière un clic.
    expect(html).not.toMatch(/<select|<option/);
  });

  it('SS-03: la position retenue suit la prop, pas un état caché', () => {
    const checked = segmentsOf(picker({ value: 'confirme' })).filter((s) => s.checked === true);
    expect(checked.map((s) => s.label)).toEqual(['Confirmé par toi']);
    expect(render(step({ state: 'propose' }), { bookingState: 'confirme' })).toContain(
      'aria-checked="true"',
    );
  });

  it('SS-04: chaque position est sélectionnable et appelle le parent', () => {
    const asked: BookingState[] = [];
    const segments = segmentsOf(
      picker({ value: 'propose', onChange: (state: BookingState) => asked.push(state) }),
    );
    expect(segments.map((s) => s.label)).toEqual([
      'Proposé',
      'À réserver',
      'Confirmé par toi',
      'Confirmé par la communauté',
    ]);
    for (const segment of segments) expect(segment.disabled).toBe(false);
    segments[2]?.onClick?.();
    segments[3]?.onClick?.();
    expect(asked).toEqual(['confirme', 'confirme_communaute']);
  });

  it('SS-05: les états confirmés sont distingués, pas une nuance', () => {
    // « Pas une nuance de 5 % » : un marqueur explicite dans la sémantique,
    // pas seulement une teinte que personne ne voit au contraste près.
    expect(CONFIRMED_BOOKING_STATES).toEqual(['confirme', 'confirme_communaute']);
    const segments = segmentsOf(picker());
    segments.forEach((segment, index) => {
      const state = BOOKING_STATES[index] as BookingState;
      const expected = CONFIRMED_BOOKING_STATES.includes(state);
      expect(segment.confirmed).toBe(expected ? 'true' : 'false');
    });
    expect(render(step(), { bookingState: 'confirme' })).toContain('data-confirmed="true"');
  });

  it('SS-06: l en-tête nomme le lieu, sa catégorie et son adresse tronquée', () => {
    const long =
      'Refuge des Aiguilles, 1875 m, route du Goûter, Chamonix-Mont-Blanc, Auvergne-Rhône-Alpes';
    const html = render(step({ placeName: long }));
    expect(visible(html)).toContain('Nuit au refuge');
    expect(visible(html)).toContain('Hébergement');
    const shown = resolveTruncatedPlace(long, 44);
    expect(shown.truncated).toBe(true);
    expect(shown.text.length).toBeLessThanOrEqual(44);
    expect(visible(html)).toContain(shown.text);
    // Le texte complet reste lisible au survol et pour les lecteurs d'écran.
    expect(html).toContain(`title="${long}"`);
  });

  it('SS-07: sans localisation, la ligne d adresse le dit', () => {
    expect(visible(render(step({ placeName: null })))).toContain('Lieu à vérifier');
  });
});

  /* ===== 2. Tableau de prix ===== */

describe('Fiche lieu — tableau de prix', () => {
  /** Les cellules du tableau : label + valeur, dans l'ordre du document. */
  function priceCells(html: string): Array<{ label: string; value: string }> {
    const cells: Array<{ label: string; value: string }> = [];
    const pattern = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
    let match: RegExpExecArray | null = pattern.exec(html);
    while (match !== null) {
      cells.push({ label: visible(match[1]), value: visible(match[2]) });
      match = pattern.exec(html);
    }
    return cells;
  }

  it('SS-08: trois lignes, unité comprise, et rien d inventé', () => {
    const cells = priceCells(render(step({ priceBreakdown: breakdown() })));
    expect(cells.map((cell) => cell.label)).toEqual(['par nuit', 'par personne', 'total groupe']);
  });

  it('SS-09: la ligne d unité disparaît quand l unité n a pas de sens', () => {
    const cells = priceCells(render(step({ priceBreakdown: breakdown({ unitLabel: null }) })));
    expect(cells.map((cell) => cell.label)).toEqual(['par personne', 'total groupe']);
  });

  it('SS-10: un montant absent dit « à vérifier », jamais un chiffre', () => {
    // Un `priceBreakdown` absent n est pas un montant manquant : les trois lignes
    // restent et disent la meme chose. Jamais 0, jamais un tiret, jamais une cellule vide.
    for (const value of [breakdown(), null, undefined]) {
      const cells = priceCells(render(step({ priceBreakdown: value })));
      expect(cells).toHaveLength(3);
      for (const cell of cells) {
        expect(cell.value.toLowerCase()).toBe(A_VERIFIER.toLowerCase());
        expect(cell.value).not.toMatch(/[\d€]/);
      }
    }
  });

  it('SS-12: un montant connu est formaté en fr-FR, zéro compris', () => {
    const zero: MoneyValue = { amount: 0, currency: 'EUR', state: 'confirme' };
    const value = breakdown({ unitLabel: 'par nuit', perUnit: KNOWN, perPerson: KNOWN, groupTotal: zero });
    const cells = priceCells(render(step({ priceBreakdown: value })));
    expect(cells.map((cell) => cell.value)).toEqual(['42,50 €', '42,50 €', '0 €']);
  });

  it('SS-13: isEstimate porte le badge ET la mention complète', () => {
    const html = render(step({ priceBreakdown: breakdown({ isEstimate: true }) }));
    expect(ESTIMATION_NOTICE).toBe(
      'Estimations non contractuelles : vérifié à la source juste avant ton départ',
    );
    expect(visible(html)).toContain('Estimation');
    expect(visible(html)).toContain(ESTIMATION_NOTICE);
  });

  it('SS-14: sans estimation, ni badge ni mention', () => {
    const html = render(step({ priceBreakdown: breakdown({ isEstimate: false }) }));
    expect(visible(html)).not.toContain('Estimation');
    expect(visible(html)).not.toContain('non contractuelles');
  });

  it('SS-15: priceRows est une fonction pure et ne touche pas son entrée', () => {
    const input = breakdown({ unitLabel: 'par trajet', perUnit: KNOWN });
    const copy = { ...input };
    const rows = priceRows(input);
    expect(rows.map((row) => row.label)).toEqual(['par trajet', 'par personne', 'total groupe']);
    expect(rows[0]?.value).toBe('42,50 €');
    expect(input).toEqual(copy);
    expect(priceRows(null).every((row) => row.value === A_VERIFIER)).toBe(true);
  });
});

  /* ===== 3. Hypothèses et source ===== */

describe('Fiche lieu — hypothèses et source', () => {
  it('SS-16: le motif de l étape est rendu tel quel', () => {
    expect(visible(render(step({ reason: 'Proche du dernier col du jour' })))).toContain(
      'Proche du dernier col du jour',
    );
  });

  it('SS-17: un motif absent ne laisse pas de trou silencieux', () => {
    expect(visible(render(step({ reason: null })))).toContain('Motif à vérifier');
  });

  it('SS-18: la source communauté est nommée quand la donnée existe', () => {
    const html = render(step({ state: 'confirme_communaute' }), {
      community: { reportCount: 12 },
    });
    expect(visible(html)).toContain('Confirmé par la communauté · 12 signalements');
    expect(visible(html)).not.toContain('Source à vérifier');
  });

  it('SS-19: aucun nombre de signalements n est inventé', () => {
    const html = render(step({ state: 'confirme_communaute' }), { community: { reportCount: null } });
    expect(visible(html)).toContain('Confirmé par la communauté');
    expect(visible(html)).not.toMatch(/signalements/);
  });

  it('SS-20: la source suit l état retenu, jamais un compteur inventé', () => {
    for (const state of ['propose', 'a_reserver'] as BookingState[]) {
      expect(visible(render(step({ state })))).toContain('Source à vérifier');
    }
    expect(visible(render(step({ state: 'confirme' })))).toContain('Confirmé par toi');
  });
  it('SS-21: un état confirmé par l utilisateur nomme l utilisateur', () => {
    expect(visible(render(step({ state: 'confirme' })))).toContain('Confirmé par toi');
  });

  it('SS-22: resolveSourceLine est une décision pure', () => {
    expect(resolveSourceLine('confirme_communaute', { reportCount: 3 })).toBe(
      'Confirmé par la communauté · 3 signalements',
    );
    expect(resolveSourceLine('confirme', null)).toBe('Confirmé par toi');
    expect(resolveSourceLine('a_reserver', null)).toBe('Source à vérifier');
    expect(resolveSourceLine('propose', null)).toBe('Source à vérifier');
  });
});

  /* ===== 4. Affiliation ===== */

describe('Fiche lieu — affiliation', () => {
  it('SS-23: sans offre, aucun bloc affiliation du tout', () => {
    for (const value of [null, undefined]) {
      const text = visible(render(step(), { offer: value }));
      expect(text).not.toContain('Offre partenaire');
      expect(text).not.toContain('Transparence & Indépendance');
      expect(text).not.toContain('Sponsorisé');
    }
  });

  it('SS-24: sans offre, AUCUN bouton de réservation', () => {
    const bookable = actionLabels(render(step())).filter((label) => /Réserver via/i.test(label));
    expect(bookable).toEqual([]);
  });

  it('SS-25: avec offre, le double CTA nomme honnêtement le partenaire', () => {
    const labels = actionLabels(render(step(), { offer: offer() }));
    expect(labels).toContain('Voir l’offre ↗');
    expect(labels).toContain('Réserver via Refuges & Co');
  });

  it('SS-26: le lien sortant est un vrai lien sortant, protégé', () => {
    const outgoing = actionsOf(render(step(), { offer: offer() })).filter((action) =>
      action.text.includes('Voir l’offre'),
    );
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]?.tag).toContain('target="_blank"');
    expect(outgoing[0]?.tag).toContain('rel="noopener noreferrer');
    expect(outgoing[0]?.tag).toContain('sponsored nofollow"');
    expect(outgoing[0]?.tag).toMatch(/href="https:\/\//);
  });

  it('SS-27: l URL passe par le moteur d affiliation, tracking compris', () => {
    const href = resolveOfferHref(offer(), 's-refuge');
    expect(href).not.toBeNull();
    const url = new URL(href as string);
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('partenaire.test');
    expect(url.searchParams.get('checkin')).toBe('2026-07-11');
    expect(url.searchParams.get('marker')).toBe('lkdv');
    expect(url.searchParams.get('campaign')).toBe('prep');
  });

  it('SS-28: une URL partenaire non sécurisée ne produit AUCUNE offre', () => {
    // Le moteur refuse le HTTP : la fiche ne doit ni republier un lien bricolé,
    // ni afficher un CTA vers une cible que l'affiliation a refusée.
    const unsafe = offer({ link: affiliateLink({ target_url: 'http://partenaire.test/x' }) });
    expect(resolveOfferHref(unsafe, 's-refuge')).toBeNull();
    const html = render(step(), { offer: unsafe });
    expect(visible(html)).not.toContain('Offre partenaire');
    expect(actionLabels(html).filter((label) => /Réserver via/i.test(label))).toEqual([]);
  });

  it('SS-29: la commission annoncée vient de la donnée, jamais du vide', () => {
    expect(visible(render(step(), { offer: offer() }))).toContain('5 % du séjour');

    const withoutRate = visible(
      render(step(), {
        offer: offer({ link: affiliateLink({ partner: { ...PARTNER, commission_rate_desc: null } }) }),
      }),
    );
    expect(withoutRate).toContain('Affilié LKDV');
    expect(withoutRate).not.toMatch(/\d+\s*%/);
  });

  it('SS-30: un partenaire sans nom n est jamais remplacé par un nom inventé', () => {
    const labels = actionLabels(
      render(step(), { offer: offer({ link: affiliateLink({ partner: undefined }) }) }),
    );
    expect(labels).toContain('Réserver via le partenaire');
  });
});

  /* ===== 5. Accessibilité de la fiche ===== */

describe('Fiche lieu — accessibilité', () => {
  it('SS-31: quand la fiche EST le dialogue, elle le nomme par son titre', () => {
    const html = render(step(), { modal: true });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain('Nuit au refuge');
  });

  it('SS-32: par défaut la fiche est le CONTENU du dialogue, pas un dialogue', () => {
    // L'hôte de production est une `Sheet` Radix qui pose déjà role=dialog et
    // FocusScope. Empiler un second dialogue ferait annoncer « 2 dialogs » à l'AT.
    const html = render(step());
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('role="dialog"');
    // L'intitulé reste associé à la région : le nom du lieu est toujours lu.
    expect(html).toMatch(/aria-labelledby="prep-step-title-/);
  });

  it('SS-32b: le piège de clavier n existe que si la fiche possède le dialogue', () => {
    // Sans cette garde, le Tab et la Maj+Tab sont traités deux fois : `FocusScope`
    // reboucle sur `last` après notre saut et la Maj+Tab resterait bloquée.
    const hook = SOURCE.slice(
      SOURCE.indexOf('function useStepSheetDialog'),
      SOURCE.indexOf('export function StepsSheet'),
    );
    const keyEffect = hook.slice(hook.lastIndexOf('useEffect'));
    expect(keyEffect).toMatch(/if \(!container \|\| !ownsTrap\) return;/);
    expect(SOURCE).toMatch(/useStepSheetDialog\(containerRef, stepId, onClose, modal\)/);
    // Le focus d'ouverture, lui, reste actif sous un hôte modal : le titre avant
    // « Réserver », sinon la tabulation consentirait à la réservation.
    const focusEffect = hook.slice(hook.indexOf('useEffect'), hook.indexOf('useEffect', hook.indexOf('useEffect') + 1));
    expect(focusEffect).toContain('applyStepSheetFocus({');
    expect(focusEffect).toContain('return ownsTrap ? restore : undefined;');
  });

  it('SS-33: le titre est une cible de focus, pas un texte orphelin', () => {
    const title = /<(h[1-6])[^>]*data-prep-step-title[^>]*>/.exec(render(step()));
    expect(title).not.toBeNull();
    expect(title?.[0]).toContain('tabindex="-1"');
    expect(STEP_SHEET_FOCUS_SELECTOR).toBe('[data-prep-step-title]');
  });

  it('SS-34: tous les boutons sont de type button', () => {
    for (const html of [render(step()), render(step(), { offer: offer() })]) {
      const buttons = openTags(html, 'button');
      expect(buttons.length).toBeGreaterThan(0);
      for (const tag of buttons) expect(tag).toContain('type="button"');
    }
  });

  it('SS-35: le CTA primaire Fermer est toujours présent', () => {
    for (const props of [{}, { offer: offer() }]) {
      const primary = openTags(render(step(), props), 'button').find((tag) =>
        tag.includes('prep-primary'),
      );
      expect(primary).toBeDefined();
      expect(actionLabels(render(step(), props)).filter((l) => l === 'Fermer')).toHaveLength(1);
    }
  });

  it('SS-36: la vue principale ne fait pas défiler — le détail est replié', () => {
    const html = render(step(), { offer: offer() });
    expect(html).toContain('role="region"');
    expect(html).toContain('<details');
    // Les chips de repas vivent dans la zone repliée, pas sur la vue principale.
    expect(html.indexOf('Repas associé')).toBeGreaterThan(html.indexOf('<details'));
  });

  it('SS-37: Échap ferme la fiche', () => {
    const closed: string[] = [];
    handleStepSheetKeyEvent(keyEvent('Escape'), {
      container: makeContainer([makeFocusable('segment')]),
      activeElement: () => makeFocusable('segment') as unknown as Element,
      onEscape: () => closed.push('escape'),
    });
    expect(closed).toEqual(['escape']);
  });

  it('SS-38: Tab et Shift+Tab bouclent dans la fiche', () => {
    const items = [makeFocusable('a'), makeFocusable('b'), makeFocusable('c')];
    const options = {
      container: makeContainer(items),
      activeElement: () => active as unknown as Element,
      onEscape: NOOP,
    };
    let active: FakeFocusable = items[0] as FakeFocusable;

    const forward = keyEvent('Tab');
    handleStepSheetKeyEvent(forward, options);
    expect(forward.defaultPrevented).toBe(true);
    expect(items[1].focusCount).toBe(1);

    active = items[2] as FakeFocusable;
    handleStepSheetKeyEvent(keyEvent('Tab'), options);
    expect(items[0].focusCount).toBe(1);

    active = items[0] as FakeFocusable;
    handleStepSheetKeyEvent(keyEvent('Tab', true), options);
    expect(items[2].focusCount).toBe(1);
  });

  it('SS-38b: ni touche parasite, ni anneau vide, ni focus dehors ne perdent le clavier', () => {
    const items = [makeFocusable('a'), makeFocusable('b')];
    const outside = makeFocusable('dehors');
    const base = { container: makeContainer(items), activeElement: () => outside as unknown as Element, onEscape: NOOP };
    // Une touche qui n est ni Échap ni Tab reste au navigateur : rien n est saisi.
    const typed = keyEvent('Enter');
    handleStepSheetKeyEvent(typed, base);
    expect(typed.defaultPrevented).toBe(false);
    expect(items[1]?.focusCount).toBe(0);
    // Un anneau vide ne leve rien et ne deplace rien.
    expect(() => handleStepSheetKeyEvent(keyEvent('Tab'), { ...base, container: makeContainer([]) })).not.toThrow();
    // Le focus reste dehors entre par le debut de l anneau : la fiche redevient atteignable.
    handleStepSheetKeyEvent(keyEvent('Tab'), base);
    expect(items[0]?.focusCount).toBe(1);
  });

  it('SS-39: les éléments masqués ne sont pas des cibles de tabulation', () => {
    const shown = makeFocusable('visible');
    expect(collectStepSheetFocusable(makeContainer([shown, makeFocusable('hidden', true)]))).toEqual([
      shown,
    ]);
    // Une fiche qui se detruit n a plus de conteneur : aucune cible, aucune exception.
    expect(collectStepSheetFocusable(null)).toEqual([]);
  });

  it('SS-40: le focus part sur le titre et revient sur le déclencheur', () => {
    const trigger = makeFocusable('declencheur');
    const title = makeFocusable('titre');
    const segment = makeFocusable('segment');
    const container = makeContainer([title, segment], title);
    let active: FakeFocusable = trigger;

    const restore = applyStepSheetFocus({
      container,
      activeElement: () => active as unknown as Element,
      preferredSelector: STEP_SHEET_FOCUS_SELECTOR,
    });

    expect(title.focusCount).toBe(1);
    active = segment;
    restore();
    expect(trigger.focusCount).toBe(1);
  });

  it('SS-41: un titre introuvable ne fait pas perdre la fiche', () => {
    const segment = makeFocusable('segment');
    applyStepSheetFocus({
      container: makeContainer([segment]),
      activeElement: () => null,
      preferredSelector: STEP_SHEET_FOCUS_SELECTOR,
    });
    expect(segment.focusCount).toBe(1);
  });
});

  /* ===== 6. États dégradés et règles de code ===== */

describe('Fiche lieu — robuste et conforme', () => {
  it('SS-42: une étape disparue ne casse pas la fiche', () => {
    const html = renderToStaticMarkup(
      React.createElement(StepSheet, {
        draft: fullDraft(),
        actions: actions(),
        onClose: NOOP,
        stepId: 'fantome',
      } satisfies StepSheetProps),
    );
    expect(visible(html)).toContain('Cette étape n’existe plus');
    expect(actionLabels(html)).toContain('Fermer');
  });

  it('SS-43: la sélection par prop prime sur l état de l étape', () => {
    expect(resolveBookingState('confirme', null, 'propose')).toBe('confirme');
    // Sans prop, le choix de l'utilisateur puis l'état de l étape suffisent.
    expect(resolveBookingState(null, 'a_reserver', 'propose')).toBe('a_reserver');
    expect(resolveBookingState(null, null, 'propose')).toBe('propose');
  });

  it('SS-44: aucune couleur en dur, la couleur ne passe que par des tokens', () => {
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(SOURCE.match(/rgba?\(|hsla?\(/g)).toBeNull();
  });

  it('SS-46: aucun token inventé n est requis', () => {
    // Le CSS du préparateur est partagé avec un autre agent : la fiche ne doit
    // pas dépendre d'un token qui n'existe nulle part. On contrôle donc
    // l'ensemble des feuilles de l'app, pas seulement le fichier local.
    const sheets = [
      'src/features/adventure-prep/adventure-prep.css',
      'src/styles/tokens.css',
    ]
      .map((relative) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8'))
      .join('\n');
    const used = new Set(
      SOURCE.match(/var\((--[a-z0-9-]+)/gi)?.map((token) => token.slice(4)) ?? [],
    );
    const unknown = [...used].filter(
      (token) => !new RegExp(`(^|[^a-z0-9-])${token}\\s*:`, 'i').test(sheets),
    );
    expect(unknown).toEqual([]);
  });

  // SS-38 et SS-40 n'exercent que les décisions pures : un effet qui n'appelle jamais `applyStepSheetFocus` passerait.
  it('SS-47: la fiche branche le focus et le clavier, pas seulement leurs décisions', () => {
    const hook = SOURCE.slice(SOURCE.indexOf('function useStepSheetDialog'), SOURCE.indexOf('export function StepsSheet'));
    const first = hook.indexOf('useEffect');
    const focusEffect = hook.slice(first, hook.indexOf('useEffect', first + 1)); // 1er effet = focus
    expect(focusEffect).toContain('STEP_SHEET_FOCUS_SELECTOR');
    // Un parent qui recrée `onClose` rejouerait le focus à chaque rendu.
    expect(focusEffect).not.toContain('onClose');
    expect(hook).toContain("addEventListener('keydown'");
    expect(hook).toContain("removeEventListener('keydown'");
  });

  it('SS-48: les liens sortants ne dépendent pas d une classe CSS absente', () => {
    // Sans style en ligne, les deux CTA retomberaient sur le chrome de lien du navigateur.
    expect(SOURCE).toContain('style={OUTGOING}');
    expect(SOURCE.match(/style=\{OUTGOING\}/g)?.length).toBe(1);
  });
});
