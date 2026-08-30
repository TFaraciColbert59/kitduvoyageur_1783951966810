'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  AlertTriangle,
  CheckSquare,
  Scale,
  MapPin,
  LayoutGrid,
  Edit3,
  Printer,
  ChevronRight,
  ChevronDown,
  Zap,
  Wifi,
  WifiOff,
  Boxes,
  Layers,
  Sparkles,
  ShoppingBag,
  Share2,
  Bell,
  Handshake,
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
  const [isEcosystemOpen, setIsEcosystemOpen] = useState(true);
  const checkedCount = depart.assignedKit.items.filter((i) => i.is_checked).length;
  const itemsCount = depart.assignedKit.items.length;
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
      label: '1. Statut & Départ',
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
      label: '2. Alertes',
      icon: AlertTriangle,
      badge: alertsCount > 0 ? alertsCount : undefined,
      badgeColor: 'bg-[#8A241B] text-white',
    },
    {
      id: 'checklist',
      label: '3. Sac & Vivres',
      icon: CheckSquare,
      badge: `${checkedCount}/${itemsCount}`,
      badgeColor: 'bg-[#17402C]/15 text-[#17402C]',
    },
    {
      id: 'weight',
      label: '4. Analyse du Poids',
      icon: Scale,
      badge: totalWeightStr !== '--' ? totalWeightStr : undefined,
      badgeColor: 'bg-[#17402C]/15 text-[#17402C]',
    },
    {
      id: 'terrain',
      label: '5. Terrain & Météo',
      icon: MapPin,
      badge: depart.trail?.distance_km ? `${Math.round(depart.trail.distance_km)}km` : undefined,
      badgeColor: 'bg-[#17402C]/15 text-[#17402C]',
    },
  ];

  return (
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/60 shadow-sm backdrop-blur-md">
      {/* Haut : Identité du trek & Navigation */}
      <div className="space-y-2.5 overflow-y-auto no-scrollbar pr-0.5">
        {/* En-tête miniature du départ */}
        <div className="p-3 rounded-2xl glass-sub-card space-y-2 border border-white/60 shadow-2xs">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
              Prochain départ
            </span>
            <Badge tone={depart.readinessScore.status === 'ok' ? 'sage' : depart.readinessScore.status === 'warning' ? 'warn' : 'danger'}>
              <span className="text-[9.5px] font-bold">
                {depart.readinessScore.status === 'ok' ? '✓ Prêt' : depart.readinessScore.status === 'warning' ? '⚠️ En cours' : 'Critique'}
              </span>
            </Badge>
          </div>

          <h3 className="font-display font-bold text-sm text-[#17402C] leading-tight line-clamp-2">
            {cleanDestination}
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
                  'px-2 py-0.5 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer',
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

        {/* Navigation verticale des 5 sections du cockpit */}
        <nav className="space-y-0.5" aria-label="Sections du cockpit de départ">
          {sections.map((sec) => {
            const IconComp = sec.icon;
            const isSelected = activeSection === sec.id;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange(sec.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left',
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
                  {isSelected && <ChevronRight size={11} className="text-white/70" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* ════ ÉCOSYSTÈME MATÉRIEL (Hub unifié) ════ */}
        <div className="pt-2 border-t border-white/40 space-y-1">
          <button
            type="button"
            onClick={() => setIsEcosystemOpen((v) => !v)}
            className="w-full flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-[#5A7064] hover:text-[#17402C] px-1 py-0.5 cursor-pointer"
          >
            <span>Écosystème Matériel</span>
            <ChevronDown size={12} className={cn('transition-transform', !isEcosystemOpen && '-rotate-90')} />
          </button>

          {isEcosystemOpen && (
            <div className="space-y-0.5 pt-0.5">
              <Link
                href="/materiel/kits"
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers size={13} className="text-[#2D6B4A]" />
                  <span>Mes Kits</span>
                </div>
                <span className="text-[10px] font-mono text-[#5A7064]">{kits.length}</span>
              </Link>

              <Link
                href="/materiel/inventaire"
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Boxes size={13} className="text-[#2D6B4A]" />
                  <span>Mon Inventaire</span>
                </div>
                <ChevronRight size={11} className="text-[#5A7064]" />
              </Link>

              <Link
                href="/materiel/alertes"
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-[#8A241B]" />
                  <span>Alertes & Entretien</span>
                </div>
                <ChevronRight size={11} className="text-[#5A7064]" />
              </Link>

              <Link
                href="/materiel/disponibilite"
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Handshake size={13} className="text-[#8C6418]" />
                  <span>Prêts & Disponibilité</span>
                </div>
                <ChevronRight size={11} className="text-[#5A7064]" />
              </Link>

              <Link
                href="/materiel/boutique"
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#17402C]/80 hover:text-[#17402C] hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag size={13} className="text-[#17402C]" />
                  <span>Boutique LKDV</span>
                </div>
                <ChevronRight size={11} className="text-[#5A7064]" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bas : Actions rapides */}
      <div className="pt-2 border-t border-white/40 grid grid-cols-2 gap-1.5 shrink-0">
        <Link
          href="/materiel/kits"
          className="glass-capsule-btn text-[10.5px] !py-1.5 !px-2 flex items-center justify-center gap-1 font-semibold truncate cursor-pointer"
          title="Modifier le kit"
        >
          <Edit3 size={11} />
          <span>Gérer kit</span>
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="glass-capsule-btn text-[10.5px] !py-1.5 !px-2 flex items-center justify-center gap-1 font-semibold truncate cursor-pointer"
          title="Imprimer la checklist de départ"
        >
          <Printer size={11} />
          <span>Imprimer</span>
        </button>
      </div>
    </aside>
  );
}
