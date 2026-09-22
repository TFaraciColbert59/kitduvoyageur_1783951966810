'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button } from '@/components/ui';
import { Aventure } from '@/lib/mock/compte-marceline';

interface MesAventuresCardProps {
  aventures: Aventure[];
}

export default function MesAventuresCard({ aventures }: MesAventuresCardProps) {
  const [selectedYear, setSelectedYear] = useState('2026');

  const getStatusBadge = (status: Aventure['status']) => {
    switch (status) {
      case 'En cours':
        return <Badge tone="warn">En cours</Badge>;
      case 'Terminée':
        return <Badge tone="sage">Terminée</Badge>;
      case 'Brouillon':
        return <Badge tone="stone">Brouillon</Badge>;
      default:
        return <Badge tone="info">{status}</Badge>;
    }
  };

  return (
    <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 space-y-6 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[color:var(--lkv-primary)]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[color:var(--lkv-primary)] tracking-tight">
            Mes <span className="font-serif italic font-normal">groupes</span>
          </h3>
          <p className="text-xs font-mono text-[color:var(--lkv-text-muted)] mt-0.5">
            42 terminées · 1 en cours · 2 planifiées
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="FunnelIcon" size={14} />}
              className="font-bold"
            >
              Filtrer
            </Button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Filtrer par année"
              className="min-h-[var(--control-height-sm)] rounded-full border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-1.5 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] cursor-pointer"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <Link href="/compte?tab=aventures" className="text-xs font-bold text-[color:var(--lkv-forest-600)] hover:text-[color:var(--lkv-primary)] transition-colors whitespace-nowrap">
            Tout voir →
          </Link>
        </div>
      </div>

      <p className="text-xs text-[color:var(--lkv-forest-600)]/70 leading-relaxed">
        Vos derniers voyages, du plus récent au plus ancien. Cliquez pour retrouver la trace GPX et les photos.
      </p>

      {/* List */}
      <div className="space-y-3">
        {aventures.map((item) => (
          <Link
            key={item.id}
            href={`/groupes/${item.id}`}
            className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 transition-all gap-4 cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-xl overflow-hidden relative shrink-0 border border-[color:var(--lkv-primary)]/10">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.title}
                  fill
                  sizes="56px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-base text-[color:var(--lkv-primary)] truncate group-hover:text-[color:var(--lkv-forest-600)] transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-[color:var(--lkv-forest-600)]/60 font-medium mt-0.5 truncate">
                  {item.date_detail}
                </p>
                <div className="flex items-center gap-2 mt-1 font-mono text-[11px] font-bold text-[color:var(--lkv-forest-600)]/70">
                  <span>{item.distance}</span>
                  <span>•</span>
                  <span>{item.elevation}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[color:var(--lkv-primary)]/5">
              {/* Avatars */}
              <div className="flex -space-x-2 overflow-hidden">
                {item.companions.slice(0, 3).map((name, i) => (
                  <div
                    key={name + i}
                    className="w-7 h-7 rounded-full bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)] border-2 border-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {name[0]}
                  </div>
                ))}
                {item.companions.length > 3 && (
                  <div className="w-7 h-7 rounded-full bg-[color:var(--lkv-secondary)] text-white border-2 border-white text-[10px] font-bold flex items-center justify-center">
                    +{item.companions.length - 3}
                  </div>
                )}
              </div>

              {getStatusBadge(item.status)}
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
