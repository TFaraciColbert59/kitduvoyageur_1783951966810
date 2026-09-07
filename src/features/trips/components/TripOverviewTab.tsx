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
import { getTripDuration } from '../hooks/useTripDuration';
import { getKitCounters } from '../hooks/useKitCounters';
import { getTripDistance } from '../hooks/useTripDistance';
import { getCanonicalTripSteps, getTripCounters } from '../hooks/useTripCounters';
import type { TripFull, TripStats } from '../types/trip.types';

export interface TripOverviewTabProps {
  trip: TripFull;
  stats: TripStats;
  onTabChange: (tabId: string) => void;
}

export function TripOverviewTab({ trip, stats, onTabChange }: TripOverviewTabProps) {
  // Source de vérité unique (Z-R3 / Chantier Z3) : toutes les métriques sont
  // dérivées de trip (pas de stats serveur) pour être identiques aux autres onglets.
  const duration = getTripDuration(trip);
  const kit = getKitCounters(trip.items);
  const dist = getTripDistance(trip.steps);
  const steps = getCanonicalTripSteps(trip.steps);
  const participants = getTripCounters(trip).participantsCount;

  const packedPercent =
    kit.total > 0
      ? Math.round((kit.ready / kit.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* 1. Métriques Clés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard tone="sage" blur="sm" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60">
          <div className="flex items-center gap-2 text-lkv-secondary text-xs font-medium uppercase tracking-wider mb-1">
            <Calendar size={14} />
            Durée
          </div>
          <div className="text-xl sm:text-2xl font-bold text-lkv-primary">
            {duration.durationDays} {duration.durationDays > 1 ? 'jours' : 'jour'}
          </div>
          <div className="text-xs text-lkv-secondary mt-0.5">
            {steps.length} étapes prévues
          </div>
        </GlassCard>

        <GlassCard tone="neutral" blur="sm" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60">
          <div className="flex items-center gap-2 text-lkv-secondary text-xs font-medium uppercase tracking-wider mb-1">
            <Navigation size={14} />
            Distance
          </div>
          <div className="text-xl sm:text-2xl font-bold text-lkv-primary">
            {dist.totalKm} km
          </div>
          <div className="text-xs text-lkv-secondary mt-0.5">
            +{dist.dPlus}m / -{dist.dMinus}m D±
          </div>
        </GlassCard>

        <GlassCard tone="neutral" blur="sm" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60">
          <div className="flex items-center gap-2 text-lkv-secondary text-xs font-medium uppercase tracking-wider mb-1">
            <Package size={14} />
            Sac à dos
          </div>
          <div className="text-xl sm:text-2xl font-bold text-lkv-primary">
            {packedPercent}%
          </div>
          <div className="text-xs text-lkv-secondary mt-0.5">
            {kit.ready}/{kit.total} objets prêts
          </div>
        </GlassCard>

        <GlassCard tone="neutral" blur="sm" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60">
          <div className="flex items-center gap-2 text-lkv-secondary text-xs font-medium uppercase tracking-wider mb-1">
            <CreditCard size={14} />
            Budget
          </div>
          <div className="text-xl sm:text-2xl font-bold text-lkv-primary">
            {stats.total_spent} €
          </div>
          <div className="text-xs text-lkv-secondary mt-0.5">
            sur {stats.estimated_budget > 0 ? `${stats.estimated_budget} €` : 'non défini'}
          </div>
        </GlassCard>
      </div>

      {/* 2. Barre de Préparation Matériel */}
      {kit.total > 0 && (
        <GlassCard tone="sage" blur="md" className="p-5 rounded-[24px] border border-white/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-lkv-primary">
              Préparation de l’équipement
            </span>
            <span className="text-xs font-medium text-lkv-secondary">
              {kit.ready} sur {kit.total} emballés ({packedPercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-black/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-var(--lkv-secondary) to-var(--lkv-primary) transition-all duration-500 rounded-full"
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
            <h2 className="text-lg font-bold text-lkv-primary flex items-center gap-2">
              <Navigation size={18} className="text-lkv-secondary" />
              Aperçu de l’itinéraire
            </h2>
            <LkvButton
              variant="ghost"
              size="sm"
              onClick={() => onTabChange('steps')}
              className="text-xs text-lkv-secondary"
            >
              Voir tout ({steps.length})
            </LkvButton>
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-8 text-sm text-lkv-secondary">
              <p>Aucune étape enregistrée pour le moment.</p>
              <p className="text-xs text-lkv-secondary/80 mt-1">
                Ajoutez des étapes à votre voyage pour visualiser l’itinéraire détaillé.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 border-l-2 border-lkv-secondary/30 ml-2">
              {steps.slice(0, 4).map(step => (
                <div key={step.id} className="relative">
                  <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-lkv-secondary border-2 border-white" />
                  <div className="text-xs font-semibold text-lkv-secondary uppercase tracking-wide">
                    Jour {step.day_number}
                  </div>
                  <div className="font-medium text-sm text-lkv-primary">
                    {step.title}
                  </div>
                  {step.location_name && (
                    <div className="text-xs text-lkv-secondary">
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
            <h2 className="text-lg font-bold text-lkv-primary flex items-center gap-2">
              <Users size={18} className="text-lkv-secondary" />
              Équipe d’expédition
            </h2>
            <LkvButton
              variant="ghost"
              size="sm"
              onClick={() => onTabChange('team')}
              className="text-xs text-lkv-secondary"
            >
              Gérer ({participants})
            </LkvButton>
          </div>

          <div className="space-y-3">
            {trip.collaborators.map(collab => (
              <div
                key={collab.id}
                className="flex items-center justify-between p-3 rounded-[16px] bg-white/40 border border-white/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-lkv-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {collab.profile?.full_name?.substring(0, 2) ||
                      collab.user_id.substring(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-lkv-primary">
                      {collab.profile?.full_name || 'Membre de l’expédition'}
                    </div>
                    <div className="text-xs text-lkv-secondary">
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

      {/* 4. Bloc Conseils de préparation */}
      <GlassCard tone="neutral" blur="sm" className="p-6 rounded-[28px] border border-white/60 bg-[#FAF8F5]/80">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-lkv-secondary/15 text-lkv-primary">
            <Compass size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-lkv-primary">
              Conseils pour votre préparation
            </h3>
            <p className="text-xs sm:text-sm text-lkv-secondary mt-1 leading-relaxed">
              Organisez les étapes de votre parcours, invitez vos co-voyageurs pour préparer le matériel ensemble, et ajustez votre équipement selon la météo et le terrain pour partir l’esprit tranquille.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
