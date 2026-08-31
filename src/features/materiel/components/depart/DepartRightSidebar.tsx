'use client';
import React from 'react';
import { DepartAlerts } from './DepartAlerts';
import { Badge } from '@/components/ui/Badge';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { FileText, Calendar, Compass, Timer } from 'lucide-react';
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
  const isReady = readiness.status === 'ok';

  return (
    <aside
      className="w-full h-full max-h-full flex flex-col gap-3.5 overflow-y-auto no-scrollbar pb-2 select-none"
      aria-label="Statut du départ et alertes"
    >
      {/* ════ SECTION 1 : STATUT DU DÉPART (Style Apple Live Activity Widget) ════ */}
      <div className="glass rounded-[28px] p-4 sm:p-5 space-y-3.5 border border-white/80 dark:border-white/10 shadow-sm backdrop-blur-md shrink-0">
        {/* En-tête : Badge et Catégorie */}
        <div className="flex items-center justify-between gap-1.5 border-b border-black/5 pb-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#5A7064]">
            <Compass size={13} className="text-[#2D6B4A]" />
            <span>Fiche & Statut</span>
          </div>

          <div className="px-2.5 py-0.5 rounded-full bg-white dark:bg-stone-900 border border-white/90 shadow-2xs">
            <span className="text-[10px] font-bold text-[#17402C]">
              {readiness.percentage}% Prêt
            </span>
          </div>
        </div>

        {/* Titre & Date */}
        <div className="space-y-1">
          <h3 className="font-display font-bold text-sm sm:text-[15px] text-[#17402C] leading-snug line-clamp-2">
            {cleanDestination}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] text-[#5A7064] font-medium">
            <Calendar size={12} className="text-[#5A7064]" />
            <span>
              Départ prévu le{' '}
              {depart?.startsAt
                ? new Date(depart.startsAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })
                : 'prochainement'}
            </span>
          </div>
        </div>

        {/* Compte à rebours temps réel style Apple Live Activity */}
        <div className="p-3 rounded-2xl bg-white/80 dark:bg-stone-900/80 border border-white/90 dark:border-white/20 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-semibold text-[#5A7064]">
            <Timer size={13} className="text-[#2D6B4A]" />
            <span>Compte à rebours :</span>
          </div>
          <div className="font-mono text-xs sm:text-[13px] font-bold text-[#17402C]">
            <CountdownLive target={depart?.startsAt} />
          </div>
        </div>

        {/* Bouton Fiche de départ Liquid Glass */}
        {onOpenDepartureSheet && (
          <button
            type="button"
            onClick={onOpenDepartureSheet}
            className="glass-capsule-btn primary w-full !py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <FileText size={14} />
            <span>Ouvrir la fiche de départ</span>
          </button>
        )}
      </div>

      {/* ════ SECTION 2 : ALERTES & FIABILITÉ (Widgets iOS) ════ */}
      <div className="flex-1 min-h-0">
        <DepartAlerts input={alertInput} />
      </div>
    </aside>
  );
}
