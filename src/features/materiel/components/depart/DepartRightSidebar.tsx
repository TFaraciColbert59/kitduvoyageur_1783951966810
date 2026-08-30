'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { Calendar, Backpack, ShieldCheck, PhoneCall, CheckSquare, Clock, MapPin } from 'lucide-react';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

// Chargement lazy de Leaflet pour la mini-carte de la sidebar droite
const DepartMap = dynamic(
  () => import('./DepartMap').then((m) => ({ default: m.DepartMap })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden h-[180px] bg-[#E8E4D6] flex items-center justify-center">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    ),
  }
);

interface DepartRightSidebarProps {
  depart: DepartDetail;
}

export function DepartRightSidebar({ depart }: DepartRightSidebarProps) {
  const departsAt = new Date(depart.startsAt);
  const dateLabel = departsAt.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const checkedCount = depart.assignedKit.items.filter((i) => i.is_checked).length;
  const itemsCount = depart.assignedKit.items.length;

  return (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      {/* 1. COMPTE À REBOURS EN DIRECT */}
      <div className="glass p-3.5 space-y-2 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/40 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0">
            <Calendar size={14} />
          </div>
          <div>
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] block">
              Départ prévu
            </span>
            <span className="text-xs font-semibold text-[#17402C]">{dateLabel}</span>
          </div>
        </div>

        <div className="glass-sub-card p-2.5 text-center">
          <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] block mb-0.5">
            Compte à rebours
          </span>
          <div className="text-xl font-mono font-bold text-[#17402C] tabular-nums" aria-live="polite">
            <CountdownLive target={depart.startsAt} />
          </div>
        </div>
      </div>

      {/* 2. SYNTHÈSE DES MÉTRIQUES DU PACK */}
      <div className="glass p-3 space-y-1.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] px-1 block mb-1">
          Métriques clés
        </span>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {/* Poids de base */}
          <div className="p-2 rounded-xl bg-white/80 border border-white/60 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-[#5A7064] text-[9.5px] font-semibold uppercase">
              <Backpack size={11} />
              <span>Poids</span>
            </div>
            <div className="font-mono font-bold text-[#17402C] text-sm">
              {formatWeight(depart.assignedKit.totalWeightG)}
            </div>
          </div>

          {/* Grade de préparation */}
          <div className="p-2 rounded-xl bg-white/80 border border-white/60 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-[#5A7064] text-[9.5px] font-semibold uppercase">
              <CheckSquare size={11} />
              <span>Niveau</span>
            </div>
            <div className="font-display font-bold text-[#17402C] text-sm flex items-center justify-between">
              <span>{depart.readinessScore.grade}</span>
              <span className="text-[10px] font-mono text-[#5A7064]">({depart.checklistPct}%)</span>
            </div>
          </div>

          {/* Articles prêts */}
          <div className="p-2 rounded-xl bg-white/80 border border-white/60 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-[#5A7064] text-[9.5px] font-semibold uppercase">
              <CheckSquare size={11} />
              <span>Articles</span>
            </div>
            <div className="font-mono font-bold text-[#17402C] text-sm">
              {checkedCount}/{itemsCount}
            </div>
          </div>

          {/* Autonomie trek */}
          <div className="p-2 rounded-xl bg-white/80 border border-white/60 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-[#5A7064] text-[9.5px] font-semibold uppercase">
              <Clock size={11} />
              <span>Autonomie</span>
            </div>
            <div className="font-mono font-bold text-[#17402C] text-sm">
              {depart.durationDays} jours
            </div>
          </div>
        </div>
      </div>

      {/* 3. MINI-CARTE & APERÇU DU TRACÉ */}
      {depart.trail && (
        <div className="glass p-3 space-y-2 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#17402C]">
              <MapPin size={13} className="text-[#5A7064]" />
              <span className="truncate max-w-[170px]">{depart.trail.name || 'Tracé GPX'}</span>
            </div>
            {depart.trail.distance_km && (
              <span className="text-[10px] font-mono font-bold text-[#5A7064]">
                {depart.trail.distance_km} km
              </span>
            )}
          </div>

          <div className="rounded-xl overflow-hidden border border-white/60 shadow-2xs">
            <DepartMap trail={depart.trail} height="170px" />
          </div>
        </div>
      )}

      {/* 4. SÉCURITÉ & ICE D'URGENCE */}
      {depart.emergencyContact && (
        <div className="glass p-3 space-y-2 rounded-2xl border border-white/70 shadow-xs text-[#17402C] bg-[rgba(168,68,58,0.05)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[rgba(168,68,58,0.12)] text-[#8A241B] flex items-center justify-center shrink-0">
              <ShieldCheck size={14} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A241B]">
              Contact d’urgence (ICE)
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs font-mono font-bold text-[#17402C] truncate">
              {depart.emergencyContact}
            </span>
            <a
              href={`tel:${depart.emergencyContact.replace(/\s+/g, '')}`}
              className="glass-capsule-btn primary !h-7 !px-2.5 !text-[11px] shrink-0 flex items-center gap-1"
              aria-label={`Appeler le contact d'urgence : ${depart.emergencyContact}`}
            >
              <PhoneCall size={11} />
              <span>Appeler</span>
            </a>
          </div>
        </div>
      )}
    </aside>
  );
}
