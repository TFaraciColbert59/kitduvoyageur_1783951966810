/**
 * Compas v5 : façons de venir au départ (fonctions pures).
 *
 * Rien n'est recalculé ici : les options reprennent ce que la préparation a déjà chiffré et rangé dans le
 * budget prévu du voyage (lignes de catégorie transport, avec leur base) et le choix déjà fait par la
 * personne. Le covoiturage n'a pas de prix (aucun tarif relevé) ; il porte le lien d'un partenaire du site
 * seulement s'il en existe un. « À pied ou sans trajet » est un choix de la personne, à zéro euro.
 */

import type { V5TransportOption } from '../types';

/** Une ligne de budget prévu de catégorie transport (`trip_expenses`, `is_planned`). */
export interface PlannedTransportLine {
  title: string;
  amount: number;
  /** `metadata.basis` : d'où vient le montant. */
  basis: string | null;
  /** `metadata.choice` : ligne écrite par un choix de l'écran v5 (sinon, par la préparation). */
  choice: string | null;
}

/** Le choix rangé dans `trips.metadata.compas.transport`. */
export interface TransportChoice {
  id: V5TransportOption['id'];
  amountEur: number | null;
  perPerson: boolean;
  source: string;
}

export interface TransportInput {
  lines: readonly PlannedTransportLine[];
  chosen: TransportChoice | null;
  /** Taille du groupe, pour un montant par personne rangé sans elle. */
  party: number;
  /** Départ dit (« Lyon »), si la personne l'a donné. */
  originName: string | null;
  /** Sans voiture : jamais d'option voiture. */
  carFree: boolean;
  carpoolLink: { url: string; partner: string | null } | null;
}

const CHOICE_IDS = new Set<V5TransportOption['id']>(['car', 'train', 'carpool', 'bus', 'flight', 'foot']);

/** Le choix rangé sur le voyage, lu avec prudence (les éditeurs d'un voyage peuvent écrire `metadata`). */
export function parseTransportChoice(raw: unknown): TransportChoice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !CHOICE_IDS.has(o.id as V5TransportOption['id'])) return null;
  const amount = typeof o.amountEur === 'number' && Number.isFinite(o.amountEur) && o.amountEur >= 0 ? o.amountEur : null;
  return {
    id: o.id as V5TransportOption['id'],
    amountEur: amount,
    perPerson: o.perPerson === true,
    source: typeof o.source === 'string' ? o.source.slice(0, 400) : '',
  };
}

export type ApproachLineKind ='car-fuel' | 'toll' | 'train' | 'flight';

const TOLL_TITLE = /^(vignette|vi[nñ]eta|vinjeta)\b|p[ée]age|\btoll|maut/i;

/**
 * Le rôle d'une ligne de transport : carburant du trajet d'approche, vignette ou péage, train, vol.
 * Les autres (carburant sur place, location, transports sur place) ne sont pas le trajet d'approche.
 * Les titres sont ceux que la préparation range en base (`autofillActions`), en français.
 */
export function approachLineKind(line: Pick<PlannedTransportLine, 'title' | 'choice'>): ApproachLineKind | null {
  if (line.choice === 'car') return 'car-fuel';
  if (line.choice === 'train') return 'train';
  if (line.choice === 'flight') return 'flight';
  const title = line.title.trim();
  if (/^Carburant aller-retour/i.test(title)) return 'car-fuel';
  if (/^Train aller-retour/i.test(title)) return 'train';
  if (/^Vol aller-retour/i.test(title)) return 'flight';
  if (TOLL_TITLE.test(title) && !/^Carburant/i.test(title)) return 'toll';
  return null;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Nombre de personnes du titre (« Train aller-retour × 4 ») : le montant a été calculé pour ce nombre-là. */
function partyOfTitle(title: string): number | null {
  const m = /×\s*(\d{1,2})\b/.exec(title);
  return m ? Math.max(1, Number(m[1])) : null;
}

const trim = (s: string | null, max = 280) => (s ? s.trim().slice(0, max) : '');

const LABEL: Record<V5TransportOption['id'], string> = {
  car: 'Voiture',
  train: 'Train',
  carpool: 'Covoiturage',
  bus: 'Bus',
  flight: 'Avion',
  foot: 'À pied ou sans trajet',
};

const fromOrigin = (origin: string | null) => (origin ? `Depuis ${origin} · ` : '');

/** Lien de covoiturage parmi les liens partenaires du voyage, s'il en existe un (jamais un lien générique). */
export function pickCarpoolLink(
  links: ReadonlyArray<{ label: string; partner: string | null; url: string }>
): { url: string; partner: string | null } | null {
  const hit = links.find((l) => /covoitur|blablacar|carpool|ride.?shar/i.test(`${l.label} ${l.partner ?? ''}`) && l.url);
  return hit ? { url: hit.url, partner: hit.partner } : null;
}

function base(id: V5TransportOption['id']): Pick<V5TransportOption, 'id' | 'label' | 'url' | 'partner'> {
  return { id, label: LABEL[id], url: null, partner: null };
}

export function transportOptions(input: TransportInput): V5TransportOption[] {
  const party = Math.max(1, Math.floor(input.party) || 1);
  const out: V5TransportOption[] = [];
  const valid = input.lines.filter((l) => Number.isFinite(l.amount) && l.amount >= 0);
  const of = (kind: ApproachLineKind) => valid.filter((l) => approachLineKind(l) === kind);

  // Voiture : le carburant du trajet d'approche, plus la vignette si la préparation en a compté une.
  const fuel = of('car-fuel');
  if (!input.carFree && fuel.length) {
    const tolls = of('toll');
    const total = cents([...fuel, ...tolls].reduce((t, l) => t + l.amount, 0));
    out.push({
      ...base('car'),
      detail: `${fromOrigin(input.originName)}carburant${tolls.length ? ' et vignette' : ''}, aller-retour, pour tout le groupe`,
      amountEur: total,
      perPerson: false,
      source: trim(fuel[0].basis) || 'budget prévu du Compas',
    });
  }

  // Train et avion : le montant du budget est celui de tout le groupe ; la personne le voit par personne.
  for (const kind of ['train', 'flight'] as const) {
    const line = of(kind)[0];
    if (!line) continue;
    const id = kind === 'train' ? 'train' : 'flight';
    out.push({
      ...base(id),
      detail: `${fromOrigin(input.originName)}aller-retour, par personne`,
      amountEur: cents(line.amount / (partyOfTitle(line.title) ?? party)),
      perPerson: true,
      source: trim(line.basis) || 'budget prévu du Compas',
    });
  }

  // Un choix déjà fait dont la ligne n'est plus au budget (covoiturage ou à pied l'ont retirée) reste proposé tel qu'il a été chiffré.
  const c = input.chosen;
  if (c && (c.id === 'car' || c.id === 'train' || c.id === 'flight' || c.id === 'bus') && !out.some((o) => o.id === c.id)) {
    if (!(c.id === 'car' && input.carFree))
      out.push({
        ...base(c.id),
        detail: `${fromOrigin(input.originName)}choisi plus tôt`,
        amountEur: c.amountEur,
        perPerson: c.perPerson,
        source: trim(c.source) || 'ton choix',
      });
  }

  out.push({
    ...base('carpool'),
    detail: 'Aucun tarif relevé : le prix se voit chez le partenaire',
    amountEur: null,
    perPerson: false,
    source: input.carpoolLink ? 'lien partenaire, sans tarif' : 'aucun tarif relevé',
    url: input.carpoolLink?.url ?? null,
    partner: input.carpoolLink ? (input.carpoolLink.partner ?? 'partenaire') : null,
  });

  out.push({
    ...base('foot'),
    detail: 'Tu es déjà sur place, ou tu y vas par tes propres moyens : rien à budgéter',
    amountEur: 0,
    perPerson: false,
    source: 'ton choix : aucun trajet à budgéter',
  });

  return out;
}
