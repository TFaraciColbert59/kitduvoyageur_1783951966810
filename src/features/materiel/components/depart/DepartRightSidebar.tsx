'use client';
import React from 'react';
import { DepartAlerts } from './DepartAlerts';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { Calendar, ShieldCheck } from 'lucide-react';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { DocIcon as FileText } from '@/components/icons/doc';
import { TimerIcon as Timer } from '@/components/icons/timer';
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
    <div role="complementary"
      className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[var(--lkv-primary)] font-sans overflow-hidden border border-white/40 shadow-sm select-none"
      aria-label="Statut du départ et alertes"
    >
      {/* ── 1. ZONE HAUTE FIXE (Fiche & Statut, Compte à Rebours, Bouton d'action) ── */}
      <div className="shrink-0 space-y-2.5">
        <div className="p-3 rounded-2xl glass-sub-card space-y-2.5 relative overflow-hidden border border-white/50">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1">
              <Compass size={11} className="text-[var(--lkv-primary-hover)]" />
              Fiche & Statut
            </span>
            <div className="px-2 py-0.5 rounded-full bg-white dark:bg-stone-900 border border-white/90 shadow-2xs">
              <span className="text-[9px] font-bold text-[var(--lkv-primary)]">
                {readiness.percentage}% Prêt
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs sm:text-sm text-[var(--lkv-primary)] line-clamp-2 leading-snug">
              {cleanDestination}
            </h4>
            <div className="flex items-center gap-1 text-[10.5px] text-[var(--lkv-text-muted)] font-medium mt-0.5">
              <Calendar size={11} className="text-[var(--lkv-text-muted)] shrink-0" />
              <span>
                Départ le{' '}
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
          <div className="p-2.5 rounded-xl bg-white/90 dark:bg-stone-900/90 border border-white/90 dark:border-white/20 shadow-2xs flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-mono font-semibold text-[var(--lkv-text-muted)]">
              Compte à rebours :
            </span>
            <div className="font-mono text-xs font-bold text-[var(--lkv-primary)]">
              <CountdownLive target={depart?.startsAt} />
            </div>
          </div>

          {/* Bouton Fiche de départ Liquid Glass */}
          {onOpenDepartureSheet && (
            <button
              type="button"
              onClick={onOpenDepartureSheet}
              className="glass-capsule-btn primary w-full !py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileText size={13} />
              <span>Ouvrir la fiche de départ</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Alertes & Fiabilité) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2">
        <DepartAlerts input={alertInput} />
      </div>

      {/* ── 3. ZONE BASSE FIXE (Statut de préparation & Fiabilité) ── */}
      <div className="shrink-0 pt-2 border-t border-[var(--lkv-primary)]/5 flex items-center justify-between gap-1 px-1">
        <div className="flex items-center gap-1 text-[9px] font-mono text-[var(--lkv-text-muted)]">
          <ShieldCheck size={11} className="text-[var(--lkv-primary-hover)]" />
          <span>Contrôle de sécurité actif</span>
        </div>
        <span className="text-[8.5px] font-mono font-bold text-[var(--lkv-primary-hover)]">
          v2.0 OK
        </span>
      </div>
    </div>
  );
}
