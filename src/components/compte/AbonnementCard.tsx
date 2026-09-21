'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';

interface AbonnementCardProps {
  subscription: any;
}

export default function AbonnementCard({ subscription }: AbonnementCardProps) {
  return (
    <Card variant="featured" className="p-3.5 space-y-2.5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xs text-[color:var(--lkv-primary)]">Abonnement</h3>
        <Badge tone="sage" className="text-[9px] font-mono font-bold">
          {subscription?.status === 'Actif' || !subscription ? 'ACTIF' : subscription.status}
        </Badge>
      </div>

      {/* Content */}
      <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex items-center justify-between p-2">
        <div>
          <div className="text-xs font-bold text-[color:var(--lkv-primary)]">{subscription?.plan_name || 'Guide Alpin'}</div>
          <div className="text-[9.5px] text-[color:var(--lkv-text-muted)]">
            {subscription?.renewal_date ? `Renouvellement : ${subscription.renewal_date}` : 'Accès illimité topos & GPX'}
          </div>
        </div>
        <Link
          href="/tarifs"
          className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-xs)] rounded-full px-[10px] text-[length:var(--lkv-text-caption-2)] font-bold border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
        >
          Gérer
        </Link>
      </div>
    </Card>
  );
}
