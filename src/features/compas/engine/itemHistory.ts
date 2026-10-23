/**
 * Historique d'un objet du kit (appui long → fiche → « Historique »), fonctions pures.
 *
 * Trois sources RÉELLES, chacune lue sous la RLS de la personne : ses prêts (`materiel_loans`), les
 * autres voyages où l'objet de son inventaire a été emporté (`trip_items`), les commandes passées du
 * produit choisi (`orders` + `order_items`). Rien n'est reconstitué : sans ligne en base, l'historique
 * dit « aucun événement enregistré ».
 *
 * Les textes sont calculés dans la langue demandée (`compas.engine.history.*`, PLAN-100 6.1) ; sans
 * locale, c'est le français d'avant, au caractère près.
 */

import { formatDate, formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import type { TranslationKey } from '@/lib/i18n/translate';
import { engineT, type EngineT } from './engineI18n';

export interface RawLoan {
  id: string;
  status: string;
  loaned_at: string | null;
  due_date: string | null;
  returned_at: string | null;
  borrower_contact: string | null;
}

export interface RawPastTrip {
  trip_id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface RawOrder {
  id: string;
  order_number: string | null;
  status: string | null;
  created_at: string | null;
  quantity: number | null;
  total_price_eur: number | null;
  transaction_type: string | null;
}

export type HistoryKind = 'pret' | 'voyage' | 'commande'; // i18n-ok : identifiants

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  /** Jour de l'événement (AAAA-MM-JJ), null s'il n'est pas daté. */
  date: string | null;
  title: string;
  detail: string | null;
  tone?: 'good' | 'warn' | 'bad';
}

type Tone = HistoryEntry['tone'];

/** Statut d'un prêt → clé du libellé et ton. Un statut inconnu est dit tel quel. */
export const LOAN_STATUS: Record<string, { key: TranslationKey; tone?: Tone }> = {
  en_cours: { key: 'compas.engine.history.loanActive', tone: 'warn' },
  rendu: { key: 'compas.engine.history.loanReturned', tone: 'good' },
  en_retard: { key: 'compas.engine.history.loanLate', tone: 'bad' },
  litige: { key: 'compas.engine.history.loanDispute', tone: 'bad' },
};

/** Statut d'une commande → clé du libellé et ton. Un statut inconnu est dit tel quel. */
export const ORDER_STATUS: Record<string, { key: TranslationKey; tone?: Tone }> = {
  pending: { key: 'compas.engine.history.orderPending', tone: 'warn' },
  confirmed: { key: 'compas.engine.history.orderConfirmed', tone: 'good' },
  preparing: { key: 'compas.engine.history.orderPreparing', tone: 'good' },
  shipped: { key: 'compas.engine.history.orderShipped', tone: 'good' },
  delivered: { key: 'compas.engine.history.orderDelivered', tone: 'good' },
  cancelled: { key: 'compas.engine.history.orderCancelled', tone: 'bad' },
  refunded: { key: 'compas.engine.history.orderRefunded', tone: 'warn' },
};

const day = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : null;
};

const DAY_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

/** « 20 oct. 2026 » (« Oct 20, 2026 »), null si la valeur n'est pas une date. */
export function dayText(iso: string | null, locale: Locale = 'fr'): string | null {
  const d = day(iso);
  return d ? formatDate(new Date(`${d}T12:00:00Z`), DAY_OPTIONS, locale) : null;
}

function span(a: string | null, b: string | null, locale: Locale): string | null {
  const x = dayText(a, locale);
  const y = dayText(b, locale);
  if (x && y && x !== y) return `${x} → ${y}`;
  return x ?? y;
}

/**
 * Les événements, du plus récent au plus ancien ; les non datés à la fin. Aucun n'est inventé :
 * « prêté à » ne sort que d'un contact écrit sur le prêt.
 */
export function buildItemHistory(
  src: {
    loans: readonly RawLoan[];
    trips: readonly RawPastTrip[];
    orders: readonly RawOrder[];
  },
  locale: Locale = 'fr'
): HistoryEntry[] {
  const t: EngineT = engineT(locale);
  const out: HistoryEntry[] = [];
  for (const l of src.loans) {
    const st = LOAN_STATUS[l.status];
    const who = l.borrower_contact?.trim();
    out.push({
      id: `pret-${l.id}`,
      kind: 'pret',
      date: day(l.loaned_at),
      title: who ? t('compas.engine.history.lentTo', { who }) : t('compas.engine.history.lent'),
      detail: [
        span(l.loaned_at, l.returned_at ?? l.due_date, locale),
        l.returned_at
          ? null
          : l.due_date
            ? t('compas.engine.history.returnDue', { date: dayText(l.due_date, locale) ?? '' })
            : null,
        st ? t(st.key) : l.status,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: st?.tone,
    });
  }
  for (const trip of src.trips) {
    out.push({
      id: `voyage-${trip.trip_id}`,
      kind: 'voyage', // i18n-ok : identifiant
      date: day(trip.start_date),
      title: t('compas.engine.history.tripCarried', {
        title: trip.title?.trim() || t('compas.engine.history.untitledTrip'),
      }),
      detail:
        span(trip.start_date, trip.end_date, locale) ?? t('compas.engine.history.datesMissing'),
    });
  }
  for (const o of src.orders) {
    const st = o.status ? ORDER_STATUS[o.status] : undefined;
    const total =
      o.total_price_eur != null && Number.isFinite(o.total_price_eur)
        ? formatNumber(
            o.total_price_eur,
            {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: o.total_price_eur % 1 === 0 ? 0 : 2,
            },
            locale
          )
        : null;
    out.push({
      id: `commande-${o.id}`,
      kind: 'commande',
      date: day(o.created_at),
      title: o.order_number
        ? t('compas.engine.history.orderNumbered', { number: o.order_number })
        : t('compas.engine.history.order'),
      detail:
        [
          o.transaction_type === 'location' ? t('compas.engine.history.rental') : null,
          o.quantity && o.quantity > 1
            ? t('compas.engine.history.copies', { count: formatNumber(o.quantity, {}, locale) })
            : null,
          total,
          st ? t(st.key) : (o.status ?? null),
        ]
          .filter(Boolean)
          .join(' · ') || null,
      tone: st?.tone,
    });
  }
  return out.sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.id.localeCompare(b.id);
  });
}

/** Faits de l'inventaire déjà chargés avec l'écran : entretien dû, péremption, état. Jamais devinés. */
export function inventoryFacts(
  inv: {
    condition: string | null;
    maintenanceDueAt: string | null;
    expiryDate: string | null;
    isLent: boolean;
  },
  locale: Locale = 'fr'
): Array<{ label: string; value: string }> {
  const t = engineT(locale);
  const facts: Array<{ label: string; value: string }> = [];
  if (inv.condition)
    facts.push({ label: t('compas.engine.history.factCondition'), value: inv.condition.replace(/_/g, ' ') });
  const m = dayText(inv.maintenanceDueAt, locale);
  if (m) facts.push({ label: t('compas.engine.history.factMaintenance'), value: m });
  const e = dayText(inv.expiryDate, locale);
  if (e) facts.push({ label: t('compas.engine.history.factExpiry'), value: e });
  if (inv.isLent)
    facts.push({
      label: t('compas.engine.history.factLoan'),
      value: t('compas.engine.history.lentNow'),
    });
  return facts;
}
