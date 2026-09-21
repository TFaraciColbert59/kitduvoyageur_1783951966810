'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { Commande } from '@/lib/mock/compte-marceline';

interface CommandesCardProps {
  commandes: Commande[];
}

export default function CommandesCard({ commandes }: CommandesCardProps) {
  const getStatusBadge = (status: Commande['status']) => {
    switch (status) {
      case 'Expédiée':
        return <Badge tone="info">Expédiée</Badge>;
      case 'Préparation':
        return <Badge tone="warn">Préparation</Badge>;
      case 'Livrée':
        return <Badge tone="sage">Livrée</Badge>;
      default:
        return <Badge tone="stone">{status}</Badge>;
    }
  };

  return (
    <Card className="p-6 space-y-6 my-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[color:var(--lkv-primary)]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[color:var(--lkv-primary)] tracking-tight">
            Commandes <span className="font-serif italic font-normal">& abonnements</span>
          </h3>
          <p className="text-xs font-mono text-[color:var(--lkv-text-muted)] mt-0.5">
            3 en cours · abonnement Guide
          </p>
        </div>

        <Link href="/compte/commandes" className="text-xs font-bold text-[color:var(--lkv-forest-600)] hover:text-[color:var(--lkv-primary)] transition-colors">
          Historique complet →
        </Link>
      </div>

      <p className="text-xs text-[color:var(--lkv-forest-600)]/70 leading-relaxed">
        Les dernières commandes passées sur la boutique, plus l'état de votre abonnement premium.
      </p>

      {/* List */}
      <div className="space-y-3">
        {commandes.map((item) => (
          <div
            key={item.id}
            className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 transition-all gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-[color:var(--lkv-primary)]/10 bg-white">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.product_name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm sm:text-base text-[color:var(--lkv-primary)] truncate">
                  {item.product_name}
                </h4>
                <p className="text-xs font-mono text-[color:var(--lkv-forest-600)]/60 mt-0.5">
                  {item.order_number} · <span className="font-bold text-[color:var(--lkv-primary)]">{item.price}</span>
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              {getStatusBadge(item.status)}
            </div>
          </div>
        ))}
      </div>

    </Card>
  );
}
