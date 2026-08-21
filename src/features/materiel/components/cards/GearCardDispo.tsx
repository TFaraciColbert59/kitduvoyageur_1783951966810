'use client';
import Link from 'next/link';
import { Share2, CheckCircle2, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface DispoData {
  unavailableCount: number;
  total: number;
  hasConflict: boolean;
  nextReturnLabel: string | null;
  availableCount?: number;
}

export function GearCardDispo({ data, className }: { data: DispoData; className?: string }) {
  const available = data.availableCount !== undefined ? data.availableCount : Math.max(0, data.total - data.unavailableCount);
  const availablePct = data.total > 0 ? Math.round((available / data.total) * 100) : 100;
  const tone = availablePct === 100 ? 'sage' : data.unavailableCount <= 2 ? 'warn' : 'danger';

  return (
    <GlassCard as="article" interactive ariaLabelledBy="dispo-title" className={className}>
      <div className="p-5 flex flex-col justify-between h-full gap-4">
        {/* Header & Main KPIs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Share2 size={14} className="text-[#17402C]" />
              <Eyebrow>Parc & Prêts</Eyebrow>
            </div>
            <h2 id="dispo-title" className="text-[20px] font-display font-bold text-[#0B1F17]">
              Disponibilité de l&apos;équipement
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass-sub-card px-3.5 py-1.5 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#17402C]" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5A7064]">Disponibles</span>
                <span className="text-[16px] font-mono font-bold text-[#17402C]">{available} / {data.total || available}</span>
              </div>
            </div>

            <div className="glass-sub-card px-3.5 py-1.5 flex items-center gap-2">
              <Clock size={16} className="text-[#8C6418]" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5A7064]">En prêt</span>
                <span className="text-[16px] font-mono font-bold text-[#8C6418]">{data.unavailableCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar & Status Badges */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2D4A3A]">
            <span>Taux de disponibilité immédiate</span>
            <span className="font-mono">{availablePct}%</span>
          </div>
          <ProgressBar value={availablePct} label="Équipement disponible" tone={tone} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {data.hasConflict ? (
              <Badge tone="danger">
                <span className="flex items-center gap-1">
                  <AlertCircle size={11} />
                  <span>Conflit détecté</span>
                </span>
              </Badge>
            ) : (
              <Badge tone="sage">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  <span>0 conflit</span>
                </span>
              </Badge>
            )}
            <span className="text-xs text-[#5A7064] hidden sm:inline truncate">
              {data.nextReturnLabel ? `Prochain ${data.nextReturnLabel}` : 'Aucun retard'}
            </span>
          </div>

          <Link href="/materiel/disponibilite" className="glass-capsule-btn secondary">
            <span>Voir les prêts</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
