/**
 * Historique d'un objet du kit (appui long → fiche → « Historique »), fonctions pures.
 *
 * Trois sources RÉELLES, chacune lue sous la RLS de la personne : ses prêts (`materiel_loans`), les
 * autres voyages où l'objet de son inventaire a été emporté (`trip_items`), les commandes passées du
 * produit choisi (`orders` + `order_items`). Rien n'est reconstitué : sans ligne en base, l'historique
 * dit « aucun événement enregistré ».
 */

import { formatMoney } from './format';

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

export type HistoryKind = 'pret' | 'voyage' | 'commande';

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  /** Jour de l'événement (AAAA-MM-JJ), null s'il n'est pas daté. */
  date: string | null;
  title: string;
  detail: string | null;
  tone?: 'good' | 'warn' | 'bad';
}

export const LOAN_STATUS: Record<string, { label: string; tone?: HistoryEntry['tone'] }> = {
  en_cours: { label: 'prêt en cours', tone: 'warn' },
  rendu: { label: 'rendu', tone: 'good' },
  en_retard: { label: 'en retard', tone: 'bad' },
  litige: { label: 'en litige', tone: 'bad' },
};

export const ORDER_STATUS: Record<string, { label: string; tone?: HistoryEntry['tone'] }> = {
  pending: { label: 'en attente de paiement', tone: 'warn' },
  confirmed: { label: 'confirmée', tone: 'good' },
  preparing: { label: 'en préparation', tone: 'good' },
  shipped: { label: 'expédiée', tone: 'good' },
  delivered: { label: 'livrée', tone: 'good' },
  cancelled: { label: 'annulée', tone: 'bad' },
  refunded: { label: 'remboursée', tone: 'warn' },
};

const day = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : null;
};

const fmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export function dayText(iso: string | null): string | null {
  const d = day(iso);
  return d ? fmt.format(new Date(`${d}T12:00:00Z`)) : null;
}

function span(a: string | null, b: string | null): string | null {
  const x = dayText(a);
  const y = dayText(b);
  if (x && y && x !== y) return `${x} → ${y}`;
  return x ?? y;
}

/**
 * Les événements, du plus récent au plus ancien ; les non datés à la fin. Aucun n'est inventé :
 * « prêté à » ne sort que d'un contact écrit sur le prêt.
 */
export function buildItemHistory(src: {
  loans: readonly RawLoan[];
  trips: readonly RawPastTrip[];
  orders: readonly RawOrder[];
}): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const l of src.loans) {
    const st = LOAN_STATUS[l.status] ?? { label: l.status };
    const who = l.borrower_contact?.trim();
    out.push({
      id: `pret-${l.id}`,
      kind: 'pret',
      date: day(l.loaned_at),
      title: who ? `Prêté à ${who}` : 'Prêté',
      detail: [
        span(l.loaned_at, l.returned_at ?? l.due_date),
        l.returned_at ? null : l.due_date ? `retour prévu le ${dayText(l.due_date)}` : null,
        st.label,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: st.tone,
    });
  }
  for (const t of src.trips) {
    out.push({
      id: `voyage-${t.trip_id}`,
      kind: 'voyage',
      date: day(t.start_date),
      title: `Emporté pour « ${t.title?.trim() || 'un voyage sans titre'} »`,
      detail: span(t.start_date, t.end_date) ?? 'dates non renseignées',
    });
  }
  for (const o of src.orders) {
    const st = o.status ? (ORDER_STATUS[o.status] ?? { label: o.status }) : null;
    const total =
      o.total_price_eur != null && Number.isFinite(o.total_price_eur)
        ? formatMoney(o.total_price_eur)
        : null;
    out.push({
      id: `commande-${o.id}`,
      kind: 'commande',
      date: day(o.created_at),
      title: `Commande${o.order_number ? ` ${o.order_number}` : ''}`,
      detail:
        [
          o.transaction_type === 'location' ? 'location' : null,
          o.quantity && o.quantity > 1 ? `${o.quantity} exemplaires` : null,
          total,
          st?.label ?? null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      tone: st?.tone,
    });
  }
  return out.sort((a, b) => {
    if (a.date && b.date)
      return a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.id.localeCompare(b.id);
  });
}

/** Faits de l'inventaire déjà chargés avec l'écran : entretien dû, péremption, état. Jamais devinés. */
export function inventoryFacts(inv: {
  condition: string | null;
  maintenanceDueAt: string | null;
  expiryDate: string | null;
  isLent: boolean;
}): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (inv.condition) facts.push({ label: 'État', value: inv.condition.replace(/_/g, ' ') });
  const m = dayText(inv.maintenanceDueAt);
  if (m) facts.push({ label: 'Entretien dû', value: m });
  const e = dayText(inv.expiryDate);
  if (e) facts.push({ label: 'Péremption', value: e });
  if (inv.isLent) facts.push({ label: 'Prêt', value: 'prêté en ce moment' });
  return facts;
}
