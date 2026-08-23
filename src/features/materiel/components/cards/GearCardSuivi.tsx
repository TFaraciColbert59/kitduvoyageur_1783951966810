'use client';

import Link from 'next/link';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, Check, ArrowRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';

interface Props {
  alertes: MaterielSummary['alertes'];
  dispo: MaterielSummary['dispo'];
  forget: MaterielSummary['forget'];
  className?: string;
}

/**
 * GearCardSuivi — Carte consolidée fusionnant :
 * 1. Diagnostic & Fiabilité
 * 2. Disponibilité & Prêts
 * 3. Checklist & À ne pas oublier
 */
export function GearCardSuivi({ alertes, dispo, forget, className }: Props) {
  const forgetPct = forget.totalItems > 0 ? Math.round((forget.checkedItems / forget.totalItems) * 100) : 100;
  const available = dispo.availableCount !== undefined ? dispo.availableCount : Math.max(0, dispo.total - dispo.unavailableCount);
  const availablePct = dispo.total > 0 ? Math.round((available / dispo.total) * 100) : 100;

  return (
    <GlassCard as="article" interactive ariaLabelledBy="suivi-title" className={className}>
      <div className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
        {/* Header Principal */}
        <div className="flex items-start justify-between pr-10 md:pr-12">
          <div className="space-y-1">
            <Eyebrow>Suivi & Vigilance</Eyebrow>
            <h2 id="suivi-title" className="text-[20px] sm:text-[22px] font-display font-bold text-[#17402C]">
              Diagnostic, Prêts & Checklist
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {alertes.criticalCount > 0 ? (
              <Badge tone="danger">
                <span className="flex items-center gap-1">
                  <AlertTriangle size={11} aria-hidden="true" />
                  <span>{alertes.criticalCount} critique(s)</span>
                </span>
              </Badge>
            ) : (
              <Badge tone="sage">
                <span className="flex items-center gap-1">
                  <ShieldCheck size={11} aria-hidden="true" />
                  <span>Matériel opérationnel</span>
                </span>
              </Badge>
            )}
          </div>
        </div>

        {/* 3 Blocs Consolidés en Grille Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Bloc 1: Diagnostic & Santé */}
          <div className="glass-sub-card p-3 rounded-xl flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#5A7064] tracking-wider">Diagnostic</span>
                <p className="text-[13px] font-bold text-[#17402C] leading-tight mt-0.5">Santé & Alertes</p>
              </div>
              <span className="font-mono text-lg font-bold text-[#17402C]">{alertes.reliabilityScore}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#365233] font-medium">
                <span>Fiabilité</span>
                <span>{alertes.count} alerte(s)</span>
              </div>
              <ProgressBar value={alertes.reliabilityScore} label="Fiabilité" tone={alertes.criticalCount > 0 ? 'danger' : 'sage'} />
            </div>

            <Link href="/materiel/alertes" className="flex items-center justify-between text-[10.5px] font-bold text-[#17402C] hover:text-[#2D6B4A] pt-1 border-t border-white/10">
              <span>Voir diagnostic</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Bloc 2: Disponibilité & Prêts */}
          <div className="glass-sub-card p-3 rounded-xl flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#5A7064] tracking-wider">Parc & Prêts</span>
                <p className="text-[13px] font-bold text-[#17402C] leading-tight mt-0.5">Disponibilité</p>
              </div>
              <span className="font-mono text-lg font-bold text-[#17402C]">{availablePct}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#365233] font-medium">
                <span>{available} dispo(s)</span>
                <span>{dispo.unavailableCount} en prêt</span>
              </div>
              <ProgressBar value={availablePct} label="Disponibilité" tone={dispo.unavailableCount > 0 ? 'warn' : 'sage'} />
            </div>

            <Link href="/materiel/disponibilite" className="flex items-center justify-between text-[10.5px] font-bold text-[#17402C] hover:text-[#2D6B4A] pt-1 border-t border-white/10">
              <span>Gérer les prêts</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Bloc 3: À ne pas oublier (Checklist) */}
          <div className="glass-sub-card p-3 rounded-xl flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#5A7064] tracking-wider">Départ</span>
                <p className="text-[13px] font-bold text-[#17402C] leading-tight mt-0.5">À ne pas oublier</p>
              </div>
              <span className="font-mono text-lg font-bold text-[#17402C]">{forgetPct}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#365233] font-medium">
                <span>{forget.checkedItems}/{forget.totalItems} vérifié(s)</span>
                <span>{forget.forgetRemaining} restant(s)</span>
              </div>
              <ProgressBar value={forgetPct} label="Complétude checklist" tone={forgetPct === 100 ? 'sage' : 'warn'} />
            </div>

            <Link href="/materiel/forget" className="flex items-center justify-between text-[10.5px] font-bold text-[#17402C] hover:text-[#2D6B4A] pt-1 border-t border-white/10">
              <span>Ouvrir checklist</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
