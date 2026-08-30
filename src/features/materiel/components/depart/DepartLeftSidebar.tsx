'use client';
import React from 'react';
import Link from 'next/link';
import {
  Zap,
  Wifi,
  WifiOff,
  Layers,
  Printer,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { KitSwitcher } from './KitSwitcher';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { DepartSectionId } from './DepartCockpit';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

interface DepartLeftSidebarProps {
  depart: DepartDetail;
  activeSection: DepartSectionId;
  onSectionChange: (section: DepartSectionId) => void;
  kits: { id: string; name: string }[];
  alertsCount?: number;
  isUltraSave?: boolean;
  onToggleUltraSave?: () => void;
  batteryLevel?: number | null;
  isOnline?: boolean;
}

function cleanText(text: string): string {
  return (text || '').replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim();
}

export function DepartLeftSidebar({
  depart,
  activeSection,
  onSectionChange,
  kits,
  isUltraSave = false,
  onToggleUltraSave,
  batteryLevel = null,
  isOnline = true,
}: DepartLeftSidebarProps) {
  const cleanDestination = cleanText(depart.destination);

  const sections: {
    id: DepartSectionId;
    label: string;
  }[] = [
    {
      id: 'all',
      label: "Vue d'ensemble",
    },
    {
      id: 'weight',
      label: 'Analyse du Poids',
    },
    {
      id: 'equipment_hub',
      label: 'Parc Matériel & Terrain',
    },
  ];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
      {/* ── 1. ZONE HAUTE FIXE (Identité du trek & Actions) — IMMOBILE ── */}
      <div className="shrink-0 space-y-2">
        <div className="p-2.5 rounded-2xl glass-sub-card space-y-1.5 relative overflow-hidden border border-white/50">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#5A7064]">
              Départ Actif
            </span>
            <Badge tone={depart.readinessScore.status === 'ok' ? 'sage' : 'warn'}>
              <span className="text-[8.5px] font-bold">
                {depart.readinessScore.status === 'ok' ? '✓ Prêt' : 'En préparation'}
              </span>
            </Badge>
          </div>

          <h4 className="font-display font-bold text-xs text-[#17402C] line-clamp-2 leading-tight">
            {cleanDestination}
          </h4>

          {/* Statut réseau & Ultra-Save toggle */}
          <div className="pt-1 border-t border-white/30 flex items-center justify-between gap-1.5">
            <span className={cn('flex items-center gap-1 text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded-full', isOnline ? 'bg-emerald-100/80 text-emerald-900' : 'bg-amber-100 text-amber-900')}>
              {isOnline ? <Wifi size={8.5} /> : <WifiOff size={8.5} />}
              {isOnline ? 'En ligne' : 'Hors-ligne'}
            </span>

            {onToggleUltraSave && (
              <button
                type="button"
                onClick={onToggleUltraSave}
                className={cn(
                  'px-1.5 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer',
                  isUltraSave
                    ? 'bg-[#2D6B4A] text-white shadow-xs'
                    : 'bg-white/40 text-[#17402C] hover:bg-white/60'
                )}
                title="Mode Éco Batterie Ultra-Save"
                aria-pressed={isUltraSave}
              >
                <Zap size={8.5} />
                <span>{isUltraSave ? 'ECO' : 'ÉCO'}</span>
                {batteryLevel !== null && (
                  <span className="font-mono text-[8px] opacity-80">
                    {Math.round(batteryLevel * 100)}%
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Kit Switcher */}
          {kits.length > 1 && (
            <div className="pt-1 border-t border-white/30">
              <KitSwitcher kits={kits} currentId={depart.id} />
            </div>
          )}
        </div>

        {/* Quick actions buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/materiel/kits"
            className="glass-capsule-btn text-[10px] font-bold !py-1 !px-1.5 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Layers size={11} />
            <span>Mes Kits</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="glass-capsule-btn primary text-[10px] font-bold !py-1 !px-1.5 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Printer size={11} />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE : 3 ENTRÉES ÉPURÉES ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-1 space-y-1" aria-label="Navigation du départ">
        <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-1.5 mb-0.5">
          Navigation
        </p>

        {sections.map((t) => {
          const isActive = activeSection === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSectionChange(t.id)}
              className={`w-full px-2.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
              }`}
            >
              <span className="truncate text-left">{t.label}</span>
              {isActive && <ChevronRight size={12} className="text-white/70 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE FIXE (Partage & Footer) — TOUJOURS VISIBLE ── */}
      <div className="shrink-0 pt-1.5 border-t border-[#17402C]/5 space-y-1">
        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: cleanDestination,
                text: `Fiche de départ : ${cleanDestination}`,
                url: window.location.href,
              }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(window.location.href);
            }
          }}
          className="w-full glass-sub-card text-xs font-semibold text-[#365233] p-1.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-white/80 transition-colors cursor-pointer border border-white/40"
        >
          <Share2 size={12} />
          <span>Partager ce départ</span>
        </button>

        <div className="text-center">
          <span className="text-[8px] font-mono text-[#5A7064] tracking-wider uppercase">
            Le Kit du Voyageur · Cockpit v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
