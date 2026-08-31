'use client';
import React from 'react';
import { DepartAlerts } from './DepartAlerts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { FileText, Calendar, Compass } from 'lucide-react';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';
import type { SmartPromptsInput } from '@/features/materiel/services/generateSmartPrompts';

interface DepartRightSidebarProps {
  depart: DepartDetail;
  weather?: WeatherForecast | null;
  alertInput: SmartPromptsInput;
  onOpenDepartureSheet?: () => void;
}

function cleanText(text: string): string {
  return (text || '').replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim();
}

export function DepartRightSidebar({
  depart,
  alertInput,
  onOpenDepartureSheet,
}: DepartRightSidebarProps) {
  const cleanDestination = cleanText(depart?.destination || 'Mon Départ');
  const readiness = depart?.readinessScore || { status: 'ok', percentage: 100 };

  return (
    <aside className="w-full h-full max-h-full flex flex-col gap-3 overflow-y-auto no-scrollbar pb-2 select-none" aria-label="Statut du départ et alertes">
      {/* ════ SECTION 1 : STATUT DU DÉPART & FICHE RÉCAPITULATIVE ════ */}
      <GlassCard tone="neutral" className="p-3.5 space-y-3 rounded-2xl border border-white/40 shadow-xs shrink-0">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#5A7064]">
            <Compass size={12} className="text-[#2D6B4A]" />
            <span>Fiche & Statut</span>
          </div>
          <Badge tone={readiness.status === 'ok' ? 'sage' : 'warn'}>
            <span className="text-[9px] font-bold">
              {readiness.percentage}% Prêt
            </span>
          </Badge>
        </div>

        <div>
          <h3 className="font-display font-bold text-sm text-[#17402C] leading-snug line-clamp-2">
            {cleanDestination}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-[#5A7064] font-medium mt-0.5">
            <Calendar size={11} />
            <span>Départ prévu le {depart?.startsAt ? new Date(depart.startsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'prochainement'}</span>
          </div>
        </div>

        {/* Compte à rebours temps réel */}
        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-semibold text-[#5A7064]">Compte à rebours :</span>
          <CountdownLive target={depart?.startsAt} />
        </div>

        {/* Bouton Fiche de départ Liquid Glass */}
        {onOpenDepartureSheet && (
          <button
            type="button"
            onClick={onOpenDepartureSheet}
            className="glass-capsule-btn primary w-full !py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText size={13} />
            <span>Ouvrir la fiche de départ</span>
          </button>
        )}
      </GlassCard>

      {/* ════ SECTION 2 : ALERTES & FIABILITÉ (Ce qui empêche de partir) ════ */}
      <div className="flex-1 min-h-0">
        <DepartAlerts input={alertInput} />
      </div>
    </aside>
  );
}
