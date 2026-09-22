'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Card, EmptyState, ListItem } from '@/components/ui';
import { ActiviteItem } from '@/lib/mock/compte-marceline';

interface ActiviteCardProps {
  activites: ActiviteItem[];
}

export default function ActiviteCard({ activites }: ActiviteCardProps) {
  const getIcon = (type: ActiviteItem['icon_type']) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[color:var(--lkv-danger)]/10 text-[color:var(--lkv-danger)] flex items-center justify-center shrink-0">
            <Icon name="HeartIcon" size={11} />
          </div>
        );
      case 'badge':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary)] flex items-center justify-center shrink-0">
            <Icon name="SparklesIcon" size={11} />
          </div>
        );
      case 'order':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[color:var(--lkv-info)]/15 text-[color:var(--lkv-info)] flex items-center justify-center shrink-0">
            <Icon name="ShoppingBagIcon" size={11} />
          </div>
        );
      case 'comment':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[color:var(--lkv-warning)]/15 text-[color:var(--lkv-warning-dark)] flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftIcon" size={11} />
          </div>
        );
      default:
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-primary)] flex items-center justify-center shrink-0">
            <Icon name="UserIcon" size={11} />
          </div>
        );
    }
  };

  return (
    <Card variant="featured" className="p-3.5 space-y-2.5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xs text-[color:var(--lkv-primary)]">Activité récente</h3>
        <Link href="/compte?tab=aventures" className="text-[9.5px] font-mono font-bold text-[color:var(--lkv-secondary)] hover:text-[color:var(--lkv-primary)]">
          Tout →
        </Link>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {activites && activites.length > 0 ? (
          activites.slice(0, 3).map((item) => (
            <ListItem
              key={item.id}
              className="border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] p-2"
              leading={getIcon(item.icon_type)}
              title={item.text}
              metadata={item.time}
            />
          ))
        ) : (
          <EmptyState compact title="Aucune notification récente" />
        )}
      </div>
    </Card>
  );
}
