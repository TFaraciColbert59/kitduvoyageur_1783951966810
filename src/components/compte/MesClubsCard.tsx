'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ClubItem } from '@/lib/mock/compte-marceline';
import { Badge, Card } from '@/components/ui';

interface MesClubsCardProps {
  clubs: ClubItem[];
}

export default function MesClubsCard({ clubs }: MesClubsCardProps) {
  return (
    <Card className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[color:var(--lkv-primary)]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[color:var(--lkv-primary)] tracking-tight">
            Mes <span className="font-serif italic font-normal">clubs</span>
          </h3>
          <p className="text-xs font-mono text-[color:var(--lkv-text-muted)] mt-0.5">
            4 clubs · 1 en tant qu'admin
          </p>
        </div>

        <Link href="/clubs" className="text-xs font-bold text-[color:var(--lkv-forest-600)] hover:text-[color:var(--lkv-primary)] transition-colors">
          Explorer l'annuaire →
        </Link>
      </div>

      <p className="text-xs text-[color:var(--lkv-forest-600)]/70 leading-relaxed">
        Vos communautés régulières. Ouvrez un club pour voir les prochaines sorties et le fil du groupe.
      </p>

      {/* List */}
      <div className="space-y-3">
        {clubs.map((club) => (
          <div
            key={club.id}
            className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 transition-all gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl overflow-hidden relative shrink-0 border border-[color:var(--lkv-primary)]/10 bg-[color:var(--btn-tint)]">
                <Image
                  src={club.logo_url || '/assets/images/no_image.png'}
                  alt={club.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-[color:var(--lkv-primary)] truncate">
                    {club.name}
                  </h4>
                  {club.role === 'Admin' ? (
                    <Badge tone="warn" className="px-2 py-0.5 text-[10px] font-bold">
                      Admin
                    </Badge>
                  ) : (
                    <Badge tone="stone" className="px-2 py-0.5 text-[10px] font-bold">
                      Membre
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[color:var(--lkv-forest-600)]/60 font-medium mt-0.5 truncate">
                  {club.detail}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
              {club.badge && (
                <Badge tone="warn">{club.badge}</Badge>
              )}
              <Link
                href={`/clubs/${club.slug}`}
                className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-sm)] rounded-full px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-bold border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
              >
                Ouvrir
              </Link>
            </div>
          </div>
        ))}
      </div>

    </Card>
  );
}
