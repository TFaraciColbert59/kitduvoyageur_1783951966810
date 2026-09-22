'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { Button, Card, EmptyState } from '@/components/ui';
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

  const packedPercent = kit.total > 0 ? Math.round((kit.ready / kit.total) * 100) : 0;

  return (
    <div className="space-y-[var(--space-6)]">
      {/* 1. Métriques Clés */}
      <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4 sm:gap-[var(--space-4)]">
        <Card variant="compact" className="p-[var(--space-4)]">
          <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            <Icon name="calendar" size={13} />
            <span>Durée</span>
          </div>
          <div className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
            {duration.durationDays} {duration.durationDays > 1 ? 'jours' : 'jour'}
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            {steps.length} étapes prévues
          </div>
        </Card>

        <Card variant="compact" className="p-[var(--space-4)]">
          <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            <Icon name="navigation" size={13} />
            <span>Distance</span>
          </div>
          <div className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
            {dist.totalKm} km
          </div>
          <div className="mt-0.5 font-mono text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            +{dist.dPlus}m / -{dist.dMinus}m D±
          </div>
        </Card>

        <Card variant="compact" className="p-[var(--space-4)]">
          <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            <Icon name="package" size={13} />
            <span>Sac à dos</span>
          </div>
          <div className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
            {packedPercent}%
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            {kit.ready}/{kit.total} objets prêts
          </div>
        </Card>

        <Card variant="compact" className="p-[var(--space-4)]">
          <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            <Icon name="credit-card" size={13} />
            <span>Budget</span>
          </div>
          <div className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
            {stats.total_spent} €
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            sur {stats.estimated_budget > 0 ? `${stats.estimated_budget} €` : 'non défini'}
          </div>
        </Card>
      </div>

      {/* 2. Barre de Préparation Matériel */}
      {kit.total > 0 && (
        <Card>
          <div className="mb-[var(--space-2)] flex items-center justify-between">
            <span className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
              Préparation de l’équipement
            </span>
            <span className="text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
              {kit.ready} sur {kit.total} emballés ({packedPercent}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--btn-tint)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(to_right,var(--lkv-secondary),var(--lkv-primary))] transition-all duration-500"
              style={{ width: `${packedPercent}%` }}
            />
          </div>
        </Card>
      )}

      {/* 3. Aperçu Itinéraire & Participants */}
      <div className="grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2">
        {/* Aperçu Étapes */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="mb-[var(--space-4)] flex items-center justify-between">
              <h2 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                <Icon name="navigation" size={18} className="text-[color:var(--lkv-text-secondary)]" />
                <span>Aperçu de l’itinéraire</span>
              </h2>
              <Button size="sm" variant="secondary" onClick={() => onTabChange('itinerary')}>
                Voir tout ({steps.length})
              </Button>
            </div>

            {steps.length === 0 ? (
              <EmptyState
                compact
                title="Aucune étape enregistrée pour le moment."
                description="Ajoutez des étapes à votre voyage pour visualiser l’itinéraire détaillé."
              />
            ) : (
              <div className="relative ml-2 space-y-[var(--space-4)] border-l-2 border-[color:var(--lkv-secondary)]/30 pl-[var(--space-6)]">
                {steps.slice(0, 4).map((step) => (
                  <div key={step.id} className="relative">
                    <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[color:var(--lkv-secondary)]" />
                    <div className="text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wide text-[color:var(--lkv-text-secondary)]">
                      Jour {step.day_number}
                    </div>
                    <div className="text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]">
                      {step.title}
                    </div>
                    {step.location_name && (
                      <div className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                        {step.location_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Aperçu Équipe */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="mb-[var(--space-4)] flex items-center justify-between">
              <h2 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                <Icon name="users" size={18} className="text-[color:var(--lkv-text-secondary)]" />
                <span>Équipe d’expédition</span>
              </h2>
              <Button size="sm" variant="secondary" onClick={() => onTabChange('team')}>
                Gérer ({participants})
              </Button>
            </div>

            <div className="space-y-[var(--space-2)]">
              {trip.collaborators.map((collab) => (
                <Card
                  key={collab.id}
                  variant="compact"
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-[var(--space-3)]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-footnote)] font-bold uppercase text-[color:var(--lkv-text-primary)]">
                      {collab.profile?.full_name?.substring(0, 2) || collab.user_id.substring(0, 2)}
                    </div>
                    <div>
                      <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                        {collab.profile?.full_name || 'Membre de l’expédition'}
                      </div>
                      <div className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                        {collab.profile?.username ? `@${collab.profile.username}` : 'Voyageur LKDV'}
                      </div>
                    </div>
                  </div>

                  <TripBadge type="role" value={collab.role} size="sm" />
                </Card>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Bloc Conseils de préparation */}
      <Card>
        <div className="flex items-start gap-[var(--space-4)]">
          <div className="shrink-0 rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)] text-[color:var(--lkv-primary)]">
            <Icon name="compass" size={22} />
          </div>
          <div>
            <h3 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              Conseils pour votre préparation
            </h3>
            <p className="mt-1 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)] sm:text-[length:var(--lkv-text-body-sm)]">
              Organisez les étapes de votre parcours, invitez vos co-voyageurs pour préparer le
              matériel ensemble, et ajustez votre équipement selon la météo et le terrain pour
              partir l’esprit tranquille.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
