'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ORDER_STEPS,
  orderStageLabel,
  type OrderSummary,
} from '@/features/compte/server/compte';
import { DrawerEmpty, DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { fetchJson, formatMoney, formatOrderDate } from './shared';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export function OrdersPane({ filter = 0 }: { filter?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['compte', 'orders'],
    queryFn: () => fetchJson<{ orders: OrderSummary[] }>('/api/compte/compte/orders'),
    staleTime: 30_000,
  });

  const orders = useMemo(() => query.data?.orders ?? [], [query.data]);
  const filtered = useMemo(() => {
    if (filter === 1) return orders.filter((order) => ['confirmed', 'prepared', 'shipped'].includes(order.status));
    if (filter === 2) return orders.filter((order) => order.status === 'delivered');
    if (filter === 3) return orders.filter((order) => order.status === 'cancelled');
    return orders;
  }, [filter, orders]);

  const active = orders.filter((order) => ['confirmed', 'prepared', 'shipped'].includes(order.status)).length;
  const past = orders.filter((order) => order.status === 'delivered').length;

  if (query.isLoading) return <DrawerSkeleton />;
  if (query.isError) return <DrawerError onRetry={() => void query.refetch()} />;

  return (
    <div className="lkdv-compte-pane">
      <div className="lkdv-compte-count">
        <b>
          {active} en cours · {past} passée{past > 1 ? 's' : ''}
        </b>
        <span>Suivi réel de tes achats LKDV.</span>
      </div>

      {filtered.length === 0 ? (
        <DrawerEmpty
          title={orders.length === 0 ? 'Aucune commande' : 'Aucune commande dans ce filtre'}
          hint={
            orders.length === 0
              ? 'Tes achats et réservations apparaîtront ici, avec leur suivi transporteur.'
              : 'Change de filtre pour retrouver tes autres commandes.'
          }
          action={
            orders.length === 0 ? (
              <Link href="/boutique" className="lkdv-compte-btn primary">
                <LKDVIcon name="boutique" size={15} aria-hidden="true" /> Découvrir la boutique
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="lkdv-compte-orders">
          {filtered.map((order) => {
            const cancelled = order.status === 'cancelled';
            const stageIndex = ORDER_STEPS.findIndex((step) => step.id === order.status);
            const expanded = openId === order.id;
            return (
              <article key={order.id} className={`lkdv-compte-order ${cancelled ? 'cancelled' : ''}`}>
                <header>
                  <div>
                    <b>{order.reference}</b>
                    <small>{formatOrderDate(order.createdAt)}</small>
                  </div>
                  <span className={`lkdv-compte-order-status ${order.status}`}>{orderStageLabel(order.status)}</span>
                </header>

                {cancelled ? (
                  <p className="lkdv-compte-order-cancel">Cette commande a été annulée. Aucun paiement n’est prélevé.</p>
                ) : (
                  <div className="lkdv-compte-stepper" aria-label={`Suivi : ${orderStageLabel(order.status)}`}>
                    {ORDER_STEPS.map((step, index) => (
                      <span
                        key={step.id}
                        className={index <= stageIndex ? 'done' : ''}
                        data-current={index === stageIndex ? 'true' : undefined}
                      >
                        <i aria-hidden="true" />
                        <small>{step.label}</small>
                      </span>
                    ))}
                  </div>
                )}

                <ul className="lkdv-compte-order-items">
                  {order.items.map((item, index) => (
                    <li key={`${order.id}-${index}`}>
                      <span className="lkdv-compte-order-thumb" aria-hidden="true">
                        <LKDVIcon name="inventaire" size={15} />
                      </span>
                      <span>{item.title}</span>
                      <small>×{item.qty}</small>
                    </li>
                  ))}
                  {order.items.length === 0 ? <li className="muted">Articles non détaillés</li> : null}
                </ul>

                <div className="lkdv-compte-order-total">
                  <span>{order.items.reduce((sum, item) => sum + item.qty, 0)} article(s)</span>
                  <b>{formatMoney(order.totalCents)}</b>
                </div>

                <div className="lkdv-compte-order-actions">
                  {order.trackingUrl ? (
                    <a
                      className="lkdv-compte-btn primary"
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <LKDVIcon name="lien" size={14} aria-hidden="true" /> Suivre
                    </a>
                  ) : null}
                  <Link className="lkdv-compte-btn ghost" href={`/contact?commande=${encodeURIComponent(order.reference)}`}>
                    <LKDVIcon name="aide" size={14} aria-hidden="true" /> Aide
                  </Link>
                  <button
                    type="button"
                    className="lkdv-compte-btn ghost"
                    onClick={() => setOpenId(expanded ? null : order.id)}
                    aria-expanded={expanded}
                  >
                    <LKDVIcon name="bas" size={14} aria-hidden="true" /> Détails
                  </button>
                </div>

                {expanded ? (
                  <dl className="lkdv-compte-order-detail">
                    <div>
                      <dt>Livraison</dt>
                      <dd>
                        {[order.shippingCity, order.shippingCountry].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                      </dd>
                    </div>
                    <div>
                      <dt>Paiement</dt>
                      <dd>{order.paymentMethod === 'card' ? 'Carte bancaire' : order.paymentMethod || 'Non renseigné'}</dd>
                    </div>
                    <div>
                      <dt>Transporteur</dt>
                      <dd>{order.carrier || 'Pas encore expédiée'}</dd>
                    </div>
                    <div>
                      <dt>Livraison estimée</dt>
                      <dd>{order.estimatedDelivery || 'Non renseignée'}</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OrdersPane;
