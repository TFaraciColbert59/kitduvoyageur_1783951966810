'use client';

import React from 'react';
import {
  Calendar,
  Navigation,
  Package,
  CreditCard,
  Users,
  Compass,
} from 'lucide-react';
import { GlassSubCard, GlassCapsuleBtn } from '@/components/ui';
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
        <GlassSubCard className="p-4 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1">
            <Calendar size={13} />
            <span>Durée</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">
            {duration.durationDays} {duration.durationDays > 1 ? 'jours' : 'jour'}
          </div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
            {steps.length} étapes prévues
          </div>
        </GlassSubCard>

        <GlassSubCard className="p-4 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1">
            <Navigation size={13} />
            <span>Distance</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">
            {dist.totalKm} km
          </div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5 font-mono">
            +{dist.dPlus}m / -{dist.dMinus}m D±
          </div>
        </GlassSubCard>

        <GlassSubCard className="p-4 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1">
            <Package size={13} />
            <span>Sac à dos</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">
            {packedPercent}%
          </div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
            {kit.ready}/{kit.total} objets prêts
          </div>
        </GlassSubCard>

        <GlassSubCard className="p-4 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1">
            <CreditCard size={13} />
            <span>Budget</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[var(--lkv-text-primary)]">
            {stats.total_spent} €
          </div>
          <div className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
            sur {stats.estimated_budget > 0 ? `${stats.estimated_budget} €` : 'non défini'}
          </div>
        </GlassSubCard>
      </div>

      {/* 2. Barre de Préparation Matériel */}
      {kit.total > 0 && (
        <div className="glass p-5 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--lkv-text-primary)]">
              Préparation de l’équipement
            </span>
            <span className="text-xs font-medium text-[var(--lkv-text-secondary)]">
              {kit.ready} sur {kit.total} emballés ({packedPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)] transition-all duration-500 rounded-full"
              style={{ width: `${packedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. Aperçu Itinéraire & Participants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Aperçu Étapes */}
        <div className="glass p-5 sm:p-6 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-[var(--lkv-text-primary)] flex items-center gap-2">
                <Navigation size={18} className="text-[var(--lkv-text-secondary)]" />
                <span>Aperçu de l’itinéraire</span>
              </h2>
              <GlassCapsuleBtn
                size="xs"
                onClick={() => onTabChange('itinerary')}
              >
                Voir tout ({steps.length})
              </GlassCapsuleBtn>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--lkv-text-secondary)]">
                <p>Aucune étape enregistrée pour le moment.</p>
                <p className="text-xs text-[var(--lkv-text-secondary)]/80 mt-1">
                  Ajoutez des étapes à votre voyage pour visualiser l’itinéraire détaillé.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 border-l-2 border-[var(--lkv-secondary)]/30 ml-2">
                {steps.slice(0, 4).map(step => (
                  <div key={step.id} className="relative">
                    <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[var(--lkv-secondary)] border-2 border-white" />
                    <div className="text-xs font-semibold text-[var(--lkv-text-secondary)] uppercase tracking-wide">
                      Jour {step.day_number}
                    </div>
                    <div className="font-medium text-sm text-[var(--lkv-text-primary)]">
                      {step.title}
                    </div>
                    {step.location_name && (
                      <div className="text-xs text-[var(--lkv-text-secondary)]">
                        {step.location_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aperçu Équipe */}
        <div className="glass p-5 sm:p-6 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-[var(--lkv-text-primary)] flex items-center gap-2">
                <Users size={18} className="text-[var(--lkv-text-secondary)]" />
                <span>Équipe d’expédition</span>
              </h2>
              <GlassCapsuleBtn
                size="xs"
                onClick={() => onTabChange('team')}
              >
                Gérer ({participants})
              </GlassCapsuleBtn>
            </div>

            <div className="space-y-2.5">
              {trip.collaborators.map(collab => (
                <div
                  key={collab.id}
                  className="glass-sub-card flex items-center justify-between p-3 rounded-[var(--lkv-radius-md)] border border-white/50 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--lkv-primary)] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                      {collab.profile?.full_name?.substring(0, 2) ||
                        collab.user_id.substring(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--lkv-text-primary)]">
                        {collab.profile?.full_name || 'Membre de l’expédition'}
                      </div>
                      <div className="text-xs text-[var(--lkv-text-secondary)]">
                        {collab.profile?.username ? `@${collab.profile.username}` : 'Voyageur LKDV'}
                      </div>
                    </div>
                  </div>

                  <TripBadge type="role" value={collab.role} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bloc Conseils de préparation */}
      <div className="glass p-5 sm:p-6 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-[var(--lkv-radius-md)] glass-sub-card text-[var(--lkv-primary)] shrink-0">
            <Compass size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--lkv-text-primary)]">
              Conseils pour votre préparation
            </h3>
            <p className="text-xs sm:text-sm text-[var(--lkv-text-secondary)] mt-1 leading-relaxed">
              Organisez les étapes de votre parcours, invitez vos co-voyageurs pour préparer le matériel ensemble, et ajustez votre équipement selon la météo et le terrain pour partir l’esprit tranquille.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
