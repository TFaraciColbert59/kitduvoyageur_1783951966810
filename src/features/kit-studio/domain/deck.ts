// Deck « Remplir le sac » / « Débrief » (moteur pur). Maquette Kit_Studio_v2.html l.1754-1791 :
// fillOrder, startDeck, deckDecide, deckEnd, lighten. Aucune mutation : chaque fonction renvoie une nouvelle valeur.
import type { PackZoneId } from './catalog';
import { currentKit, getItem } from './state';
import { autoSlot, effG } from './totals';
import { unpack } from './packing';
import { formatWeight } from './format';
import type { AnyItemId, KitState } from './types';

export type DeckKind = 'fill' | 'debrief';

export interface Deck {
  readonly kind: DeckKind;
  readonly list: readonly AnyItemId[];
  /** Index de la carte courante ; égal à list.length quand tout est passé en revue. */
  readonly i: number;
  readonly yes: readonly AnyItemId[];
  readonly no: readonly AnyItemId[];
}

const MAIN_SLOTS = ['bottom', 'bottomF', 'midBack', 'midFront', 'top'] as const;
const FILL_ZONES: readonly PackZoneId[] = ['lid', 'sides', 'hip', 'front', 'worn'];
const DEBRIEF_ZONES: readonly PackZoneId[] = ['back', 'main', 'lid', 'sides', 'hip', 'front'];

/** Libellés des emplacements du compartiment principal (maquette SLOTD). */
export const SLOT_LABEL: Readonly<Record<string, string>> = {
  bottom: 'au fond',
  bottomF: 'au fond, côté poche',
  midBack: 'au milieu, contre le dos',
  midFront: 'au milieu, côté poche',
  top: 'en haut',
};

/** Emplacement fin d'un objet du principal : placement manuel sinon automatique. */
export function slotOf(s: KitState, id: AnyItemId): string {
  const k = currentKit(s);
  const manual = k.slots?.[id];
  if (manual) return manual;
  const it = getItem(s, id);
  return it ? autoSlot(s, it) : 'midFront';
}

/** Ordre de remplissage : dos, principal du fond vers le haut, puis couvercle, côtés, ceinture, extérieur, sur toi. */
export function fillOrder(s: KitState): AnyItemId[] {
  const k = currentKit(s);
  const known = (id: AnyItemId) => getItem(s, id) !== undefined;
  const out: AnyItemId[] = k.packed.back.filter(known);
  for (const sl of MAIN_SLOTS) out.push(...k.packed.main.filter((id) => known(id) && slotOf(s, id) === sl));
  for (const z of FILL_ZONES) out.push(...k.packed[z].filter(known));
  return out;
}

/** Débrief : tout ce qui est rangé, sauf les consommables. */
function debriefOrder(s: KitState): AnyItemId[] {
  const k = currentKit(s);
  return DEBRIEF_ZONES.flatMap((z) => k.packed[z]).filter((id) => {
    const it = getItem(s, id);
    return it !== undefined && !it.cons;
  });
}

export function createDeck(s: KitState, kind: DeckKind): Deck {
  return { kind, list: kind === 'fill' ? fillOrder(s) : debriefOrder(s), i: 0, yes: [], no: [] };
}

export const deckCurrent = (d: Deck): AnyItemId | undefined => d.list[d.i];
export const deckDone = (d: Deck): boolean => d.i >= d.list.length;

/** Réponse à la carte courante (droite = oui, gauche = non). Sans effet une fois le deck terminé. */
export function decide(d: Deck, yes: boolean): Deck {
  const id = deckCurrent(d);
  if (id === undefined) return d;
  return { ...d, i: d.i + 1, yes: yes ? [...d.yes, id] : d.yes, no: yes ? d.no : [...d.no, id] };
}

export interface DeckSummary {
  readonly title: string;
  readonly text: string;
  /** Débrief : refusés non vitaux, proposés à l'allègement. */
  readonly cut: readonly AnyItemId[];
  /** Débrief : refusés vitaux, à garder quand même. */
  readonly keep: readonly AnyItemId[];
  /** Grammes gagnés si on allège. */
  readonly savedG: number;
  readonly savedLabel: string;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export function deckSummary(s: KitState, d: Deck): DeckSummary {
  const name = (id: AnyItemId) => getItem(s, id)?.n ?? String(id);
  if (d.kind === 'fill') {
    const text =
      `${d.yes.length} ${plural(d.yes.length, 'objet dedans', 'objets dedans')}` +
      (d.no.length ? ` · plus tard : ${d.no.map(name).join(', ')}` : '.');
    return { title: 'Sac rempli', text, cut: [], keep: [], savedG: 0, savedLabel: '' };
  }
  const cut = d.no.filter((id) => !getItem(s, id)?.vital);
  const keep = d.no.filter((id) => !!getItem(s, id)?.vital);
  const savedG = cut.reduce((a, id) => {
    const it = getItem(s, id);
    return a + (it ? effG(s, it) : 0);
  }, 0);
  const title = d.no.length
    ? `${d.no.length} ${plural(d.no.length, 'objet pas utilisé', 'objets pas utilisés')}`
    : 'Tout a servi';
  const text =
    (cut.length ? `${cut.map(name).join(', ')}. ` : '') +
    (keep.length ? `${keep.map(name).join(', ')} : à garder, vital même sans servir.` : '') +
    (d.no.length ? '' : 'Kit éprouvé une fois de plus.');
  return { title, text: text.trim(), cut, keep, savedG, savedLabel: `−${formatWeight(savedG)}` };
}

/** Retire du sac les objets refusés non vitaux (débrief). Ne modifie ni l'état ni le deck reçus. */
export function lighten(s: KitState, d: Deck): { state: KitState; removed: readonly AnyItemId[] } {
  if (d.kind !== 'debrief') return { state: s, removed: [] };
  const removed = deckSummary(s, d).cut;
  const state = removed.reduce((acc, id) => unpack(acc, id), s);
  return { state, removed };
}
