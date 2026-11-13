import Link from 'next/link';
import s from '../../../../ui/crm.module.css';
import { Label } from '../../../../ui/card';
import { Chip } from '../../../../ui/chip';
import { ErrorState } from '../../../../ui/error-state';
import { Workspace } from '../../../../components/shell/workspace';
import { ActionButtons } from '../../../../components/command/action-buttons';
import { getOrderDetail } from '../../../../components/data/admin-rpc';
import { euros, relativeFr } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

/** Commande (maquette `Membre.dc.html` adaptée : client, paiement, logistique). */
const ORDER_STATUS: Record<string, string> = {
  paid: 'payée',
  pending: 'en attente de paiement',
  shipped: 'expédiée',
  delivered: 'livrée',
  cancelled: 'annulée',
  refunded: 'remboursée',
  disputed: 'en litige'
};
const PAYMENT_STATUS: Record<string, string> = {
  succeeded: 'réussi',
  requires_action: 'action requise',
  processing: 'en cours',
  canceled: 'annulé',
  failed: 'échoué'
};
const orderStatus = (value: string) => ORDER_STATUS[value] ?? value;
const paymentStatus = (value: string) => PAYMENT_STATUS[value] ?? value;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getOrderDetail(id);

  if (!result.data) {
    return (
      <Workspace>
        <span className={s.muted} style={{ fontSize: 13 }}>
          <Link href="/">À traiter</Link> › Commande
        </span>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Cette commande n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Ouvrez-la depuis la barre de commande ou depuis un cas.'}
          />
        </div>
      </Workspace>
    );
  }

  const order = result.data;
  const refundable = Math.max(0, order.total_cents - order.payment.refunded_cents);

  return (
    <Workspace
      rail={
        <>
          <Label>Contexte de la commande</Label>
          <div className={`${s.card} ${s.railCard}`}>
            <Label>Articles</Label>
            {order.items.length === 0 ? (
              <span className={s.muted} style={{ fontSize: 13 }}>Aucun article renseigné.</span>
            ) : (
              order.items.map((item) => (
                <span key={item.label} className={s.between} style={{ fontSize: 13 }}>
                  <span>
                    {item.label} ×{item.qty}
                  </span>
                  <span>{euros(item.amount_cents)}</span>
                </span>
              ))
            )}
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Risque</Label>
            <span style={{ fontSize: 13 }}>Encore remboursable : {euros(refundable)}</span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Litiges et remboursements antérieurs : non renseignés sur cet écran.
            </span>
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Ce qui se passera</Label>
            <span style={{ fontSize: 13 }}>1. L’action est exécutée (Stripe ou base selon la commande).</span>
            <span style={{ fontSize: 13 }}>2. Le membre reçoit un message.</span>
            <span style={{ fontSize: 13 }}>3. Une ligne est écrite au journal d’audit.</span>
          </div>
        </>
      }
    >
      <span className={s.muted} style={{ fontSize: 13 }}>
        <Link href="/">À traiter</Link> › Commerce › Commande
      </span>

      <div className={s.between}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.titleSm}>Commande {order.number}</h1>
          <span className={s.subtitle}>
            {relativeFr(order.created_at)} · {order.customer.name} · {orderStatus(order.status)}
          </span>
        </div>
        <div className={s.rowFlexWrap}>
          <ActionButtons
            actions={order.actions.map((action) => ({ command: action.command, label: action.label, tone: action.tone }))}
            target={{ kind: 'commande', id: order.id, label: order.number }}
          />
        </div>
      </div>

      <div className={s.facts} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className={s.fact}>
          <span className={s.label}>Client</span>
          <span className={s.factValue}>{order.customer.name || 'non renseigné'}</span>
          <Link href={`/membres/${order.customer.id}`} style={{ fontSize: 12.5, fontWeight: 600 }}>
            Ouvrir la fiche →
          </Link>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Paiement</span>
          <span className={s.factValue}>{paymentStatus(order.payment.status)}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>
            <span className={s.mono}>{order.payment.intent_id ?? 'intention non renseignée'}</span> · remboursé{' '}
            {euros(order.payment.refunded_cents)}
          </span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Montant</span>
          <span className={s.factValue}>{euros(order.total_cents)}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>{order.currency}</span>
        </div>
      </div>

      <section className={`${s.card} ${s.tableWrap}`} aria-label="Articles de la commande">
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Article</th>
              <th scope="col">Quantité</th>
              <th scope="col">Montant</th>
            </tr>
          </thead>
          <tbody>
            {order.items.length === 0 ? (
              <tr>
                <td colSpan={3} className={s.muted}>Aucun article renseigné.</td>
              </tr>
            ) : (
              order.items.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{item.qty}</td>
                  <td className={s.mono}>{euros(item.amount_cents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className={s.rowFlexWrap}>
        <Chip tone="stone">Statut : {orderStatus(order.status)}</Chip>
        <Chip tone={refundable > 0 ? 'warn' : 'stone'}>Encore remboursable : {euros(refundable)}</Chip>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Tout remboursement passe par une validation : jamais automatique, jamais par un agent.
        </span>
      </div>
    </Workspace>
  );
}
