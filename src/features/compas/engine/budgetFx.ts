/**
 * Compas — le budget aussi dans d'autres devises (PLAN-100 4.2 et 4.6).
 *
 * Le calcul reste dans la devise du voyage (l'euro, le plus souvent) : seule
 * l'AFFICHAGE change. En plus du montant du voyage, on montre le même montant dans la
 * devise du voyageur (son profil, si elle est connue et n'est pas déjà celle du voyage) et
 * dans celle du pays de destination (ISO 4217), chacun avec son taux, sa date et sa source
 * dits à côté. Rien n'est stocké : un voyage n'enregistre que six devises (enum
 * `trip_budget_currency`), la conversion se refait à l'affichage. Un taux qu'aucune source ne
 * donne n'est jamais deviné : la ligne dit « indisponible ».
 *
 * Module PUR : les taux sont lus par le serveur (`server/rates.ts`) et passés ici.
 */

import { convertBetween, type FxRate } from './currency';
import { frenchDay } from './entry';
import { formatMoney } from './format';
import { knownIsoCode } from './intentWords';

export type FxKind = 'voyageur' | 'destination';

export interface FxTarget {
  currency: string;
  /** Pourquoi cette devise est montrée : celle du voyageur, celle du pays, ou les deux. */
  kinds: FxKind[];
}

/** Ce que le serveur donne à l'écran : les devises à montrer et les taux EUR → devise trouvés. */
export interface BudgetFxData {
  targets: FxTarget[];
  /** Taux EUR → devise, pour les devises ci-dessus et celle du voyage si ce n'est pas l'euro. */
  rates: Record<string, FxRate>;
}

/**
 * Les devises à montrer en plus : celle du voyageur d'abord, puis celle du pays de
 * destination. Jamais celle du voyage (déjà affichée), jamais deux fois la même, jamais un
 * code mal écrit.
 */
export function fxTargets(input: {
  tripCurrency: string;
  traveller: string | null | undefined;
  destination: string | null | undefined;
}): FxTarget[] {
  const out: FxTarget[] = [];
  const add = (code: string | null | undefined, kind: FxKind) => {
    if (!code || !knownIsoCode(code) || code === input.tripCurrency) return;
    const known = out.find((t) => t.currency === code);
    if (known) known.kinds.push(kind);
    else out.push({ currency: code, kinds: [kind] });
  };
  add(input.traveller, 'voyageur');
  add(input.destination, 'destination');
  return out;
}

export interface FxLine {
  currency: string;
  /** « Dans ta devise (CHF) ». */
  title: string;
  /** Les montants convertis, dans l'ordre donné. */
  parts: Array<{ label: string; text: string }>;
  /** Le taux, sa date et sa source ; ou pourquoi la conversion manque. */
  note: string;
  unavailable: boolean;
}

const rateNumber = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 4 });
const rateWhole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const symbolOf = (code: string) => (code === 'EUR' ? '€' : code);

function titleOf(t: FxTarget): string {
  if (t.kinds.length > 1) return `Dans ta devise et celle du pays (${t.currency})`;
  return t.kinds[0] === 'voyageur'
    ? `Dans ta devise (${t.currency})`
    : `Dans la devise du pays (${t.currency})`;
}

/** Montant approché : à l'unité à partir de 100, au centime en dessous. */
function approx(amount: number, currency: string): string {
  return `≈ ${formatMoney(amount >= 100 ? Math.round(amount) : Math.round(amount * 100) / 100, currency)}`;
}

/**
 * Les montants du voyage (dans `tripCurrency`) dans chaque autre devise à montrer. Un montant
 * absent ou nul est ignoré. Sans montant à convertir ni devise, aucune ligne.
 */
export function budgetInOtherCurrencies(
  items: Array<{ label: string; amount: number | null | undefined }>,
  tripCurrency: string,
  fx: BudgetFxData | null | undefined
): FxLine[] {
  const todo = items.filter(
    (i): i is { label: string; amount: number } =>
      typeof i.amount === 'number' && Number.isFinite(i.amount) && i.amount > 0
  );
  if (!fx || !fx.targets.length || !todo.length) return [];
  return fx.targets.map((target) => {
    const converted = todo.map((i) => ({
      item: i,
      conv: convertBetween(i.amount, tripCurrency, target.currency, fx.rates),
    }));
    const first = converted[0].conv;
    if (!first || converted.some((c) => !c.conv)) {
      return {
        currency: target.currency,
        title: titleOf(target),
        parts: [],
        note: `Conversion en ${target.currency} indisponible : taux de change non joignable pour l’instant.`,
        unavailable: true,
      };
    }
    // Le taux dit est celui du premier montant : le même pour tous (un produit de taux).
    const rate = first.rate;
    const day = frenchDay(first.date) ?? first.date;
    return {
      currency: target.currency,
      title: titleOf(target),
      parts: converted.map((c) => ({
        label: c.item.label,
        text: approx((c.conv as NonNullable<typeof c.conv>).amount, target.currency),
      })),
      note: `1 ${symbolOf(tripCurrency)} = ${rate >= 1000 ? rateWhole.format(rate) : rateNumber.format(rate)} ${target.currency} · taux du ${day} · ${first.source}`,
      unavailable: false,
    };
  });
}
