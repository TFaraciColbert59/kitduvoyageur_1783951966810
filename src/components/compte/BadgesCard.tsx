'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { BadgeItem } from '@/lib/mock/compte-marceline';
import Link from 'next/link';
import { Card } from '@/components/ui';

interface BadgesCardProps {
  badges: BadgeItem[];
  trustScore?: number;
}

export default function BadgesCard({ badges, trustScore = 50 }: BadgesCardProps) {
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <Card variant="featured" className="p-3.5 space-y-2.5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[color:var(--lkv-secondary)] animate-pulse" />
          <h3 className="font-display font-bold text-xs text-[color:var(--lkv-primary)]">Badges &amp; Jalons</h3>
        </div>
        <Link
          href="/profil"
          className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[9px] font-mono font-bold text-[color:var(--lkv-primary)] hover:text-[color:var(--lkv-secondary)] transition-colors"
          title="Trust Score LKDV"
        >
          🛡️ {trustScore}/100
        </Link>
      </div>

      {/* 4 Badges in compact row */}
      <div className="grid grid-cols-4 gap-1.5">
        {badges.slice(0, 4).map((b) => (
          <div
            key={b.id}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all text-center group cursor-pointer ${
              b.earned
                ? 'bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] border-[color:var(--glass-border)] text-[color:var(--lkv-primary)] shadow-2xs hover:border-[color:var(--lkv-secondary)]/40'
                : 'bg-[color:var(--glass-bg-medium)]  border-[color:var(--glass-border)] text-[color:var(--lkv-text-muted)]/50 grayscale hover:grayscale-0'
            }`}
            title={b.title}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center mb-1 transition-transform group-hover:scale-105 ${
                b.earned ? 'bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary)]' : 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-muted)]/40'
              }`}
            >
              <Icon name={b.icon_name} size={13} />
            </div>
            <span className="text-[8.5px] font-bold leading-tight line-clamp-1">
              {b.title}
            </span>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div className="flex items-center justify-between text-[9.5px] font-mono pt-1 border-t border-[color:var(--lkv-primary)]/5">
        <span className="text-[color:var(--lkv-text-muted)]">{earnedCount}/{badges.length || 32} débloqués</span>
        <Link href="/recompenses" className="text-[color:var(--lkv-secondary)] hover:text-[color:var(--lkv-primary)] font-bold">
          Voir tout →
        </Link>
      </div>
    </Card>
  );
}
