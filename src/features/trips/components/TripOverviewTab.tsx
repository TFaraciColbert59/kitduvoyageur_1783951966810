'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Calendar,
  Navigation,
  Package,
  CreditCard,
  Users,
  Compass,
} from 'lucide-react';
import { LkvButton } from '@/components/ui/LkvButton';
import { TripBadge } from './TripBadge';
import type { TripFull, TripStats } from '../types/trip.types';

export interface TripOverviewTabProps {
  trip: TripFull;
  stats: TripStats;
  onTabChange: (tabId: string) => void;
}

export function TripOverviewTab({ trip, stats, onTabChange }: TripOverviewTabProps) {
  const packedPercent =
    stats.items_total > 0
      ? Math.round((stats.items_packed / stats.items_total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* 1. Métriques Clés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard tone="sage" blur="sm" className="p-4 rounded-[20px] border border-white/60">
          <div className="flex items-center gap-2 text-[#5B7F55] text-xs font-medium uppercase tracking-wider mb-1">
            <Calendar size={14} />
            Durée
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#17402C]">
            {stats.total_days} {stats.total_days > 1 ? 'jours' : 'jour'}
          </div>
          <div className="text-xs text-[#5B7F55] mt-0.5">
            {trip.steps.length} étapes prévues
          </div>
        </GlassCard>

        <GlassCard tone="neutral" blur="sm" className="p-4 rounded-[20px] border border-white/60">
          <div className="flex items-center gap-2 text-[#5B7F55] text-xs font-medium uppercase tracking-wider mb-1">
            <Navigation size={14} />
            Distance
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#17402C]">
            {stats.total_distance_km} km
          </div>
          <div className="text-xs text-[#5B7F55] mt-0.5">
            +{stats.total_elevation_gain_m}m / -{stats.total_elevation_loss_m}m D±
          </div>
        </GlassCard>

        <GlassCard tone="neutral" blur="sm" className="p-4 rounded-[20px] border border-white/60">
          <div className="flex items-center gap-2 text-[#5B7F55] text-xs font-medium uppercase tracking-wider mb-1">
            <Package size={14} />
            Sac à dos
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#17402C]">
            {packedPercent}%
          </div>
          <div className="text-xs text-[#5B7F55] mt-0.5">
            {stats.items_packed}/{stats.items_total} objets prêts
          </div>
        </GlassCard>

        <GlassCard tone="neutral" blur="sm" className="p-4 rounded-[20px] border border-white/60">
          <div className="flex items-center gap-2 text-[#5B7F55] text-xs font-medium uppercase tracking-wider mb-1">
            <CreditCard size={14} />
            Budget
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#17402C]">
            {stats.total_spent} €
          </div>
          <div className="text-xs text-[#5B7F55] mt-0.5">
            sur {stats.estimated_budget > 0 ? `${stats.estimated_budget} €` : 'non défini'}
          </div>
        </GlassCard>
      </div>

      {/* 2. Barre de Préparation Matériel */}
      {stats.items_total > 0 && (
        <GlassCard tone="sage" blur="md" className="p-5 rounded-[24px] border border-white/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#17402C]">
              Préparation de l’équipement
            </span>
            <span className="text-xs font-medium text-[#5B7F55]">
              {stats.items_packed} sur {stats.items_total} emballés ({packedPercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-black/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5B7F55] to-[#17402C] transition-all duration-500 rounded-full"
              style={{ width: `${packedPercent}%` }}
            />
          </div>
        </GlassCard>
      )}

      {/* 3. Aperçu Itinéraire & Participants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Aperçu Étapes */}
        <GlassCard tone="neutral" blur="md" className="p-6 rounded-[28px] border border-white/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#17402C] flex items-center gap-2">
              <Navigation size={18} className="text-[#5B7F55]" />
              Aperçu de l’itinéraire
            </h2>
            <LkvButton
              variant="ghost"
              size="sm"
              onClick={() => onTabChange('steps')}
              className="text-xs text-[#5B7F55]"
            >
              Voir tout ({trip.steps.length})
            </LkvButton>
          </div>

          {trip.steps.length === 0 ? (
            <div className="text-center py-8 text-sm text-[#5B7F55]">
              <p>Aucune étape enregistrée pour le moment.</p>
              <p className="text-xs text-[#5B7F55]/80 mt-1">
                L’éditeur d’itinéraire complet sera activé au Chantier 2.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 border-l-2 border-[#5B7F55]/30 ml-2">
              {trip.steps.slice(0, 4).map(step => (
                <div key={step.id} className="relative">
                  <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#5B7F55] border-2 border-white" />
                  <div className="text-xs font-semibold text-[#5B7F55] uppercase tracking-wide">
                    Jour {step.day_number}
                  </div>
                  <div className="font-medium text-sm text-[#17402C]">
                    {step.title}
                  </div>
                  {step.location_name && (
                    <div className="text-xs text-[#5B7F55]">
                      {step.location_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Aperçu Équipe */}
        <GlassCard tone="neutral" blur="md" className="p-6 rounded-[28px] border border-white/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#17402C] flex items-center gap-2">
              <Users size={18} className="text-[#5B7F55]" />
              Équipe d’expédition
            </h2>
            <LkvButton
              variant="ghost"
              size="sm"
              onClick={() => onTabChange('team')}
              className="text-xs text-[#5B7F55]"
            >
              Gérer ({trip.collaborators.length})
            </LkvButton>
          </div>

          <div className="space-y-3">
            {trip.collaborators.map(collab => (
              <div
                key={collab.id}
                className="flex items-center justify-between p-3 rounded-[16px] bg-white/40 border border-white/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {collab.profile?.full_name?.substring(0, 2) ||
                      collab.user_id.substring(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#17402C]">
                      {collab.profile?.full_name || 'Membre de l’expédition'}
                    </div>
                    <div className="text-xs text-[#5B7F55]">
                      {collab.profile?.username ? `@${collab.profile.username}` : 'Voyageur LKDV'}
                    </div>
                  </div>
                </div>

                <TripBadge type="role" value={collab.role} size="sm" />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* 4. Bloc Prochaines Étapes / Roadmap */}
      <GlassCard tone="neutral" blur="sm" className="p-6 rounded-[28px] border border-white/60 bg-[#FAF8F5]/80">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#5B7F55]/15 text-[#17402C]">
            <Compass size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#17402C]">
              Feuille de route du voyage
            </h3>
            <p className="text-xs sm:text-sm text-[#5B7F55] mt-1 leading-relaxed">
              Ce voyage est actuellement en phase de fondation (Chantier 1). Les modules d’édition fine d’itinéraire (C2), de collaboration temps réel (C3), de shakedown de sac à dos (C4) et de split de budget (C5) seront déployés progressivement.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
