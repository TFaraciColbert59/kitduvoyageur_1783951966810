'use client';
import { useState } from 'react';
import { studioData } from '../../domain/studioData';
import { formatEuro, formatLitres, formatWeight } from '../../domain/format';
import { confirmOrder, orderLines, orderTotalCents, toOrder } from '../../domain/order';
import type { OrderLine } from '../../domain/order';
import { colorwaySwatch } from '../../domain/palette';
import { bagWeight, totalCap } from '../../domain/totals';
import type { KitState } from '../../domain/types';
import { Pager } from '../Drawer/Pager';
import { Icon } from '../icons';
import { piecesLabel } from '../OrderButton';
import './sheets.css';

const TXT = {
  title: 'Ta configuration',
  pages: ['Commande', 'Pourquoi ONE'],
  label: 'Commande',
  own: 'À toi',
  ordered: 'Commandé',
  toOrder: 'À commander',
  preordered: ' · précommandé',
  nothing: 'Rien à commander',
  toOrderSuffix: 'à commander',
  allOwned: 'Tu as déjà toutes ces pièces. Change de corps ou ajoute un module pour faire évoluer ton sac.',
  preorder: 'Précommander',
  preorderTitle: 'Précommande',
  back: 'Retour',
  indicative: 'Total indicatif',
  confirm: 'Confirmer la précommande',
  noPayment: 'Aucun paiement n’est demandé à cette étape.',
  offline: 'Hors ligne : la commande ne peut pas être envoyée. Ta configuration reste modifiable, reviens quand la connexion est rétablie.',
  whyTitle: 'Pourquoi ONE',
  whyText: 'Un seul châssis durable porte tous les corps. Tu changes le volume ou les modules au lieu de racheter un sac complet.',
  indicTitle: 'Prix indicatifs',
  indicText: 'Chiffrage en cours avec l’atelier. Le prix final sera confirmé avant tout paiement.',
  repairTitle: 'Réparable',
  repairText: 'Chaque pièce se remplace seule : une poche abîmée ne condamne pas le sac.',
  preDates: 'Précommandes de janvier à avril 2027',
  preDatesText: 'Fabrication à l’unité ou en très petites séries, sans stock.',
  preDelivery: 'Livraison annoncée par l’atelier',
  preDeliveryText: 'La date dépend de sa capacité. Elle te sera donnée avant de payer.',
  preBatch: 'Première série : 25 à 50 sacs',
  preBatchText: 'Sous réserve de la validation des prototypes et des coûts.',
} as const;

const STATE_TXT: Record<OrderLine['state'], string> = { own: TXT.own, order: TXT.ordered, new: TXT.toOrder };

interface OrderSheetProps {
  state: KitState;
  /** Appelé avec l'état dont les pièces à commander sont passées en « commandé » (aucun paiement). */
  onConfirmOrder: (next: KitState) => void;
  /** Hors ligne : la validation est désactivée et expliquée dans la feuille. */
  offline?: boolean;
  /** Page courante (contrôlée, optionnelle). */
  page?: number;
  onPageChange?: (page: number) => void;
}

export const ORDER_PAGE_LABELS: readonly string[] = TXT.pages;

function PieceRow({ line }: { line: OrderLine }) {
  const sw = colorwaySwatch(studioData().colorways[line.colorway]);
  const tint = line.key === 'chassis' ? sw.trim : line.key.startsWith('corps') ? sw.body : sw.pocket;
  return (
    <li className="ks-sh-row" data-state={line.state}>
      <span className="ks-sh-rg" style={{ background: tint }}>
        <Icon name={line.key === 'chassis' ? 'link' : line.key.startsWith('corps') ? 'bag' : 'cube'} />
      </span>
      <span className="ks-sh-txt">
        <b>{line.name}</b>
        <small>{line.colorwayName + (line.state === 'order' ? TXT.preordered : '')}</small>
      </span>
      <span className="ks-sh-price" data-own={line.state !== 'new'}>
        {line.state === 'new' ? `${TXT.toOrder} · ${formatEuro(line.priceCents)}` : STATE_TXT[line.state]}
      </span>
    </li>
  );
}

function InfoRow({ icon, title, text }: { icon: 'info' | 'cal' | 'clock' | 'swap'; title: string; text: string }) {
  return (
    <li className="ks-sh-row">
      <span className="ks-sh-rg" data-on="true">
        <Icon name={icon} />
      </span>
      <span className="ks-sh-txt">
        <b>{title}</b>
        <small>{text}</small>
      </span>
    </li>
  );
}

/** Feuille Commande : lignes de pièces, total, validation (sans paiement). Composant contrôlé. */
export function OrderSheet({ state, onConfirmOrder, offline = false, page, onPageChange }: OrderSheetProps) {
  const [own, setOwn] = useState(0);
  const [step, setStep] = useState<'list' | 'pre'>('list');
  const p = page ?? own;
  const setPage = (n: number) => {
    setOwn(n);
    onPageChange?.(n);
  };

  const lines = orderLines(state);
  const pending = toOrder(state);
  const total = formatEuro(orderTotalCents(state));
  const count = pending.length;

  const summary = (
    <div className="ks-sh-ph">
      <span className="ks-sh-t17">{TXT.title}</span>
      <span className="ks-sh-t13">{`${formatWeight(bagWeight(state))} à vide · ${formatLitres(totalCap(state))}`}</span>
    </div>
  );

  const list = (
    <>
      {summary}
      <ul className="ks-sh-rows" aria-label={TXT.title} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lines.map((l) => (
          <PieceRow key={l.key} line={l} />
        ))}
      </ul>
      <div className="ks-sh-total">
        <span className="ks-sh-t13">{count ? `${piecesLabel(count)} ${TXT.toOrderSuffix}` : TXT.nothing}</span>
        <b>{total}</b>
      </div>
      {count ? (
        <button
          type="button"
          className="ks-gbtn"
          data-pro="true"
          data-wide="true"
          disabled={offline}
          onClick={() => setStep('pre')}
        >
          {`${TXT.preorder} · ${total}`}
        </button>
      ) : (
        <p className="ks-sh-note">{TXT.allOwned}</p>
      )}
      {offline && count > 0 && (
        <p className="ks-sh-note" role="status">
          {TXT.offline}
        </p>
      )}
    </>
  );

  const pre = (
    <>
      <button type="button" className="ks-sh-back" aria-label={TXT.back} onClick={() => setStep('list')}>
        <Icon name="back" />
        {TXT.back}
      </button>
      <div className="ks-sh-ph">
        <span className="ks-sh-t17">{TXT.preorderTitle}</span>
      </div>
      <ul className="ks-sh-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lines
          .filter((l) => l.state === 'new')
          .map((l) => (
            <PieceRow key={l.key} line={l} />
          ))}
      </ul>
      <div className="ks-sh-total">
        <span className="ks-sh-t13">{TXT.indicative}</span>
        <b>{total}</b>
      </div>
      <ul className="ks-sh-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <InfoRow icon="cal" title={TXT.preDates} text={TXT.preDatesText} />
        <InfoRow icon="clock" title={TXT.preDelivery} text={TXT.preDeliveryText} />
        <InfoRow icon="info" title={TXT.preBatch} text={TXT.preBatchText} />
      </ul>
      <button
        type="button"
        className="ks-gbtn"
        data-pro="true"
        data-wide="true"
        disabled={offline || count === 0}
        onClick={() => {
          onConfirmOrder(confirmOrder(state));
          setStep('list');
        }}
      >
        {TXT.confirm}
      </button>
      {offline ? (
        <p className="ks-sh-note" role="status">
          {TXT.offline}
        </p>
      ) : (
        <p className="ks-sh-t13" style={{ textAlign: 'center' }}>
          {TXT.noPayment}
        </p>
      )}
    </>
  );

  const why = (
    <>
      <span className="ks-sh-t17">{TXT.whyTitle}</span>
      <p className="ks-sh-t13">{TXT.whyText}</p>
      <ul className="ks-sh-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <InfoRow icon="info" title={TXT.indicTitle} text={TXT.indicText} />
        <InfoRow icon="swap" title={TXT.repairTitle} text={TXT.repairText} />
      </ul>
    </>
  );

  return <Pager pages={[step === 'list' ? list : pre, why]} page={p} onPageChange={setPage} label={TXT.label} />;
}
