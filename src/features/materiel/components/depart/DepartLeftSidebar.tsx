'use client';
import React from 'react';
import Link from 'next/link';
import {
  Compass,
  ListChecks,
  AlertTriangle,
  CheckSquare,
  Scale,
  Droplets,
  MapPin,
  LayoutGrid,
  Edit3,
  Printer,
  ChevronRight,
  Zap,
  Wifi,
  WifiOff,
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
  const checkedCount = depart.assignedKit.items.filter((i) => i.is_checked).length;
  const itemsCount = depart.assignedKit.items.length;
  const totalWeightStr = formatWeight(depart.assignedKit.totalWeightG);

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
      label: '1. Départ & Synthèse',
      icon: Compass,
      badge: depart.readinessScore.grade,
      badgeColor: 'bg-[#17402C] text-white',
    },
    {
      id: 'progression',
      label: '2. Progression',
      icon: ListChecks,
      badge: `${depart.checklistPct}%`,
      badgeColor: depart.checklistPct >= 80 ? 'bg-[#2D6B4A] text-white' : 'bg-[#8C6418] text-white',
    },
    {
      id: 'alerts',
      label: '3. Alertes',
      icon: AlertTriangle,
      badge: alertsCount > 0 ? alertsCount : undefined,
      badgeColor: 'bg-[#8A241B] text-white',
    },
    {
      id: 'checklist',
      label: '4. Checklist',
      icon: CheckSquare,
      badge: `${checkedCount}/${itemsCount}`,
    },
    {
      id: 'weight',
      label: '5. Analyse du Poids',
      icon: Scale,
      badge: totalWeightStr !== '--' ? totalWeightStr : undefined,
    },
    {
      id: 'consumables',
      label: '6. Consommables',
      icon: Droplets,
      badge: `${depart.durationDays}j`,
    },
    {
      id: 'terrain',
      label: '7. Terrain & Météo',
      icon: MapPin,
      badge: depart.trail?.distance_km ? `${depart.trail.distance_km}km` : undefined,
    },
  ];

  return (
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/60 shadow-sm backdrop-blur-md">
      {/* Haut : Identité du trek & Navigation */}
      <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
        {/* En-tête miniature du départ */}
        <div className="p-3 rounded-2xl glass-sub-card space-y-2 border border-white/60 shadow-2xs">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              Prochain départ
            </span>
            <Badge tone={depart.checklistPct >= 80 ? 'sage' : depart.checklistPct >= 40 ? 'warn' : 'danger'}>
              <span className="text-[9.5px] font-bold">
                {depart.checklistPct >= 80 ? '✓ Prêt' : depart.checklistPct >= 40 ? '⚠️ En cours' : 'Incomplet'}
              </span>
            </Badge>
          </div>

          <h3 className="font-display font-bold text-sm text-[#17402C] leading-tight line-clamp-2">
            {depart.destination}
          </h3>

          {/* Statut réseau & Ultra-Save toggle (§19) */}
          <div className="pt-1.5 border-t border-white/30 flex items-center justify-between gap-1.5">
            <span className={cn('flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full', isOnline ? 'bg-emerald-100/80 text-emerald-900' : 'bg-amber-100 text-amber-900')}>
              {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
              {isOnline ? 'En ligne' : 'Hors-ligne'}
            </span>

            {onToggleUltraSave && (
              <button
                type="button"
                onClick={onToggleUltraSave}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition-all',
                  isUltraSave
                    ? 'bg-[#2D6B4A] text-white shadow-xs'
                    : 'bg-white/40 text-[#17402C] hover:bg-white/60'
                )}
                title="Mode Éco Batterie Ultra-Save (§19)"
                aria-pressed={isUltraSave}
              >
                <Zap size={9} />
                <span>{isUltraSave ? 'ECO' : 'ÉCO'}</span>
                {batteryLevel !== null && (
                  <span className="font-mono text-[8.5px] opacity-80">
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

        {/* Navigation verticale des 7 sections */}
        <nav className="space-y-1" aria-label="Sections du cockpit de départ">
          {sections.map((sec) => {
            const IconComp = sec.icon;
            const isSelected = activeSection === sec.id;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange(sec.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
                  isSelected
                    ? 'bg-[#17402C] text-white shadow-xs'
                    : 'text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/40'
                )}
                aria-current={isSelected ? 'page' : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconComp size={14} className={isSelected ? 'text-white' : 'text-[#5A7064]'} />
                  <span className="truncate">{sec.label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {sec.badge !== undefined && (
                    <span
                      className={cn(
                        'text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold',
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
                  {isSelected && <ChevronRight size={12} className="text-white/70" />}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bas : Actions rapides */}
      <div className="pt-2.5 border-t border-white/40 grid grid-cols-2 gap-1.5 shrink-0">
        <Link
          href="/materiel/kits"
          className="glass-capsule-btn text-[10.5px] !py-1.5 !px-2 flex items-center justify-center gap-1 font-semibold truncate"
          title="Modifier le kit"
        >
          <Edit3 size={11} />
          <span>Gérer kit</span>
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="glass-capsule-btn text-[10.5px] !py-1.5 !px-2 flex items-center justify-center gap-1 font-semibold truncate"
          title="Imprimer la checklist de départ"
        >
          <Printer size={11} />
          <span>Imprimer</span>
        </button>
      </div>
    </aside>
  );
}
