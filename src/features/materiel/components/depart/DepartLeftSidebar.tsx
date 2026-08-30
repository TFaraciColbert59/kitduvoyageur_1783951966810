'use client';
import React from 'react';
import Link from 'next/link';
import {
  Compass,
  AlertTriangle,
  Scale,
  MapPin,
  LayoutGrid,
  Edit3,
  Printer,
  ChevronRight,
  Zap,
  Wifi,
  WifiOff,
  Boxes,
  Layers,
} from 'lucide-react';
import { KitSwitcher } from './KitSwitcher';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import type { DepartSectionId } from './DepartCockpit';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

interface DepartLeftSidebarProps {
  depart: DepartDetail;
  activeSection: DepartSectionId;
  onSectionChange: (section: DepartSectionId) => void;
  kits: { id: string; name: string }[];
  alertsCount: number;
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
  alertsCount,
  isUltraSave = false,
  onToggleUltraSave,
  batteryLevel = null,
  isOnline = true,
}: DepartLeftSidebarProps) {
  const totalWeightStr = formatWeight(depart.totalPackWeightG);
  const cleanDestination = cleanText(depart.destination);

  const sections: {
    id: DepartSectionId;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'all',
      label: 'Vue complète',
      icon: LayoutGrid,
    },
    {
      id: 'overview',
      label: '1. Statut & Fiche',
      icon: Compass,
      badge: `${depart.readinessScore.percentage}%`,
      badgeColor:
        depart.readinessScore.status === 'ok'
          ? 'bg-[#17402C] text-white'
          : depart.readinessScore.status === 'warning'
          ? 'bg-[#8C6418] text-white'
          : 'bg-[#8A241B] text-white',
    },
    {
      id: 'alerts',
      label: '2. Alertes & Fiabilité',
      icon: AlertTriangle,
      badge: alertsCount > 0 ? alertsCount : undefined,
      badgeColor: 'bg-[#8A241B] text-white',
    },
    {
      id: 'weight',
      label: '3. Analyse du Poids',
      icon: Scale,
      badge: totalWeightStr !== '--' ? totalWeightStr : undefined,
      badgeColor: 'bg-[#17402C]/15 text-[#17402C]',
    },
    {
      id: 'terrain',
      label: '4. Terrain & Météo',
      icon: MapPin,
      badge: depart.trail?.distance_km ? `${Math.round(depart.trail.distance_km)}km` : undefined,
      badgeColor: 'bg-[#17402C]/15 text-[#17402C]',
    },
    {
      id: 'equipment_hub',
      label: '5. Parc Matériel & Sac',
      icon: Boxes,
      badgeColor: 'bg-[#17402C]/15 text-[#17402C]',
    },
  ];

  return (
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-3 text-[#17402C] font-sans overflow-hidden border border-white/60 shadow-sm backdrop-blur-md">
      {/* Haut : Identité du trek & Navigation */}
      <div className="space-y-2 overflow-y-auto no-scrollbar pr-0.5">
        {/* En-tête miniature du départ */}
        <div className="p-2.5 rounded-2xl glass-sub-card space-y-1.5 border border-white/60 shadow-2xs">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-[#5A7064]">
              Départ Actif
            </span>
            <Badge tone={depart.readinessScore.status === 'ok' ? 'sage' : depart.readinessScore.status === 'warning' ? 'warn' : 'danger'}>
              <span className="text-[9px] font-bold">
                {depart.readinessScore.status === 'ok' ? '✓ Prêt' : depart.readinessScore.status === 'warning' ? '⚠️ En cours' : 'Critique'}
              </span>
            </Badge>
          </div>

          <h3 className="font-display font-bold text-xs text-[#17402C] leading-tight line-clamp-2">
            {cleanDestination}
          </h3>

          {/* Statut réseau & Ultra-Save toggle */}
          <div className="pt-1 border-t border-white/30 flex items-center justify-between gap-1.5">
            <span className={cn('flex items-center gap-1 text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded-full', isOnline ? 'bg-emerald-100/80 text-emerald-900' : 'bg-amber-100 text-amber-900')}>
              {isOnline ? <Wifi size={8} /> : <WifiOff size={8} />}
              {isOnline ? 'En ligne' : 'Hors-ligne'}
            </span>

            {onToggleUltraSave && (
              <button
                type="button"
                onClick={onToggleUltraSave}
                className={cn(
                  'px-1.5 py-0.2 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer',
                  isUltraSave
                    ? 'bg-[#2D6B4A] text-white shadow-xs'
                    : 'bg-white/40 text-[#17402C] hover:bg-white/60'
                )}
                title="Mode Éco Batterie Ultra-Save (§19)"
                aria-pressed={isUltraSave}
              >
                <Zap size={8} />
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

        {/* Navigation verticale des 5 sections principales */}
        <nav className="space-y-0.5" aria-label="Sections du cockpit">
          {sections.map((sec) => {
            const IconComp = sec.icon;
            const isSelected = activeSection === sec.id;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange(sec.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer text-left',
                  isSelected
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/40'
                )}
                aria-current={isSelected ? 'page' : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconComp size={13} className={isSelected ? 'text-white' : 'text-[#5A7064]'} />
                  <span className="truncate">{sec.label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {sec.badge !== undefined && (
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold',
                        sec.badgeColor
                          ? isSelected
                            ? 'bg-white/20 text-white'
                            : sec.badgeColor
                          : isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[#17402C]/10 text-[#17402C]'
                      )}
                    >
                      {sec.badge}
                    </span>
                  )}
                  {isSelected && <ChevronRight size={11} className="text-white/70" />}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bas : Actions rapides */}
      <div className="pt-2 border-t border-white/40 grid grid-cols-2 gap-1.5 shrink-0">
        <Link
          href="/materiel/kits"
          className="glass-capsule-btn text-[10px] !py-1.5 !px-2 flex items-center justify-center gap-1 font-semibold truncate cursor-pointer"
          title="Gérer tous mes kits"
        >
          <Layers size={11} />
          <span>Mes Kits</span>
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="glass-capsule-btn text-[10px] !py-1.5 !px-2 flex items-center justify-center gap-1 font-semibold truncate cursor-pointer"
          title="Imprimer la checklist de départ"
        >
          <Printer size={11} />
          <span>Imprimer</span>
        </button>
      </div>
    </aside>
  );
}
