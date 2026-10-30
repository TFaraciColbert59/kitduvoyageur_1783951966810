'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, HelpCircle, Package, ShoppingBag, Truck } from 'lucide-react';
import {
  ORDER_STEPS,
  orderStageLabel,
  type OrderSummary,
} from '@/features/compte/server/compte';
import { ActionPill } from '@/components/ui/ActionPill';
import { DrawerEmpty, DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { fetchJson, formatMoney, formatOrderDate } from './shared';

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
              <Link href="/boutique" className="lkdv-apill is-primary has-text">
                <ShoppingBag aria-hidden="true" /> <span>Boutique</span>
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
                  <p className="lkdv-compte-order-cancel">Commande annulée, rien n’est prélevé.</p>
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
                        <Package size={15} />
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

                <div className="lkdv-compte-order-actions lkdv-apill-row">
                  {order.trackingUrl ? (
                    <a
                      className="lkdv-apill is-primary"
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Suivre le colis"
                      title="Suivre le colis"
                    >
                      <Truck aria-hidden="true" />
                    </a>
                  ) : null}
                  <Link
                    className="lkdv-apill"
                    href={`/contact?commande=${encodeURIComponent(order.reference)}`}
                    aria-label="Aide sur la commande"
                    title="Aide sur la commande"
                  >
                    <HelpCircle aria-hidden="true" />
                  </Link>
                  <ActionPill
                    label="Détails"
                    icon={<ChevronDown style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />}
                    onClick={() => setOpenId(expanded ? null : order.id)}
                    aria-expanded={expanded}
                  />
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
