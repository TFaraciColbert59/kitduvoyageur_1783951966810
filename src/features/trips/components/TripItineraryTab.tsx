'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { TripFull, TripStats, TripStep } from '../types/trip.types';
import { Badge, Button, Card, ConfirmDialog, EmptyState } from '@/components/ui';
import { checkSeasonalityForDates } from '../engine/seasonality';
import { getCanonicalTripSteps } from '../hooks/useTripCounters';
import { getTripDistance } from '../hooks/useTripDistance';
import { regenerateItineraryAction } from '@/app/voyages/actions';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import { useTripAffiliate } from '@/features/affiliation/components/TripAffiliateProvider';
import { StepBookingLinkCta } from '@/features/affiliation/components/StepBookingLinkCta';
import { LiveArrivalReveal } from '@/features/hub/components/live/LiveArrivalReveal';
import { useLiveArrivalReveal } from '@/features/hub/components/live/useLiveArrivalReveal';
import { MomentRow } from './MomentRow';
import { momentSlotOf } from '../engine/momentSlots';
import { isLlmSuggestion } from '../engine/llmProvenance';
import { LlmSuggestionBadge } from './LlmSuggestionBadge';
import Link from 'next/link';

interface TripItineraryTabProps {
  trip: TripFull;
  stats: TripStats;
}

export function TripItineraryTab({ trip }: TripItineraryTabProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // T8 — lien de réservation résolu par étape (hub normal ; hors provider ou
  // hors hub, le contexte retombe sur vide → aucune sortie /go).
  const { bookingByStepId } = useTripAffiliate();

  // Évaluation de la saisonnalité
  const seasonalityWarnings = useMemo(() => {
    if (!trip.destination_country_code) return [];
    return checkSeasonalityForDates(trip.destination_country_code, trip.start_date, trip.end_date);
  }, [trip.destination_country_code, trip.start_date, trip.end_date]);

  // Source de vérité unique (Z-R3 / Chantier Z3) : étapes canoniques (dédupliquées
  // par jour) et distances/dénivelés dérivés de trip, cohérents avec l'Aperçu.
  const canonicalSteps = useMemo(() => getCanonicalTripSteps(trip.steps), [trip.steps]);
  const distance = useMemo(() => getTripDistance(trip.steps), [trip.steps]);

  // T10 — reveal des étapes/moments réellement arrivés par le bus live.
  const { liveIds, containerRef } = useLiveArrivalReveal<HTMLDivElement>('trip_steps');

  // Toutes les lignes du jour (étapes enrichies + moments), pas seulement la
  // carte canonique : les moments §4.3 sont rendus sous leur jour.
  const stepsByDay = useMemo(() => {
    const map = new Map<number, TripStep[]>();
    for (const step of trip.steps ?? []) {
      const day = step.day_number ?? 1;
      const list = map.get(day);
      if (list) list.push(step);
      else map.set(day, [step]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    return map;
  }, [trip.steps]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      await regenerateItineraryAction(trip.id);
      setConfirmOpen(false);
      router.refresh();
    } catch (err: any) {
      console.error('[LKDV trips] Erreur régénération:', err);
      setError(err.message || 'Impossible de régénérer l’itinéraire.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Provenance de l'itinéraire (Tier 1 Template / Tier 2 Paramétrique / Tier 3 Squelette)
  const provenanceInfo = useMemo(() => {
    const metaSource = (trip.metadata as any)?.itinerary_source;
    if (metaSource === 'template' || (trip.metadata as any)?.itinerary_source_label) {
      return {
        label: (trip.metadata as any)?.itinerary_source_label || 'D’après tracé de référence',
        variant: 'template' as const,
      };
    }
    const hasDistances = trip.steps.some((s) => (s.distance_km ?? 0) > 0);
    const hasRest = trip.steps.some((s) => s.title.toLowerCase().includes('repos'));
    if (hasRest || (hasDistances && trip.steps.some((s) => s.description?.includes('Naismith')))) {
      return { label: 'Itinéraire calculé', variant: 'computed' as const };
    }
    if (!hasDistances && trip.steps.length > 0) {
      return { label: 'Squelette d’itinéraire', variant: 'skeleton' as const };
    }
    const dest = (trip.destination_name || trip.title || '').toLowerCase();
    if (dest.includes('gr20') || dest.includes('gr 20')) {
      return { label: 'D’après le tracé GR20', variant: 'template' as const };
    }
    return { label: 'Calculé', variant: 'computed' as const };
  }, [trip]);

  return (
    <div className="space-y-[var(--space-6)]">
      {/* 0. Bandeau d'information squelette si aucune donnée de référence */}
      {provenanceInfo.variant === 'skeleton' && (
        <Card tone="warn" className="flex items-start gap-[var(--space-3)] text-[color:var(--lkv-warning-dark)]">
          <Icon name="alert-triangle" size={18} className="mt-0.5 shrink-0" />
          <div className="text-[length:var(--lkv-text-footnote)] leading-relaxed">
            <span className="mb-0.5 block font-semibold">Squelette d’itinéraire :</span>
            Aucun tracé de référence pour cette destination. Ajoute tes étapes, les distances se
            calculeront automatiquement.
          </div>
        </Card>
      )}

      {/* 1. Bandeau de Saisonnalité */}
      {seasonalityWarnings.length > 0 ? (
        <div className="space-y-[var(--space-2)]">
          {seasonalityWarnings.map((w, idx) => (
            <Card
              key={idx}
              tone={w.severity === 'alert' ? 'danger' : 'warn'}
              className="flex items-start gap-[var(--space-3)]"
            >
              <Icon name="alert-triangle" size={18} className="shrink-0" />
              <div className="text-[length:var(--lkv-text-footnote)] leading-relaxed">
                <span className="mb-0.5 block font-semibold">Alerte météo & praticabilité :</span>
                {w.message}
              </div>
            </Card>
          ))}
        </div>
      ) : trip.start_date ? (
        <Card tone="sage" className="flex items-center gap-[var(--space-3)]">
          <Icon name="check-circle2" size={16} className="shrink-0" />
          <div className="text-[length:var(--lkv-text-footnote)]">
            <span className="font-semibold">Période optimale :</span> les dates prévues
            correspondent à la meilleure saison pour cette destination.
          </div>
        </Card>
      ) : null}

      {/* 2. Barre d'outils et statistiques */}
      <Card className="flex flex-col justify-between gap-[var(--space-4)] sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-[var(--space-4)] text-[length:var(--lkv-text-footnote)]">
          <div>
            <span className="block text-[color:var(--lkv-text-muted)]">Étapes</span>
            <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {canonicalSteps.length} jours
            </span>
          </div>
          <div className="h-6 w-px bg-[color:var(--lkv-border)]" />
          <div>
            <span className="block text-[color:var(--lkv-text-muted)]">Distance totale</span>
            <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {distance.totalKm} km
            </span>
          </div>
          <div className="h-6 w-px bg-[color:var(--lkv-border)]" />
          <div>
            <span className="block text-[color:var(--lkv-text-muted)]">Dénivelé positif</span>
            <span className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              +{distance.dPlus}m D+
            </span>
          </div>
          <div className="h-6 w-px bg-[color:var(--lkv-border)]" />
          <div>
            <span className="block text-[color:var(--lkv-text-muted)]">Provenance</span>
            <span className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
              <Icon name="sparkles" size={12} className="text-[color:var(--lkv-text-secondary)]" />
              {provenanceInfo.label}
            </span>
          </div>
        </div>

        {trip.permissions.canEdit && (
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Link
              href={tripSectionHref(trip.slug, 'itinerary')}
              className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-2)] rounded-full bg-[color:var(--lkv-action)] px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-on-action)] transition-colors hover:bg-[color:var(--lkv-action-hover)]"
            >
              <Icon name="calendar" size={15} />
              Ouvrir le Planificateur
            </Link>
          </div>
        )}
      </Card>

      {/* Message d'erreur éventuel */}
      {error && (
        <Card tone="danger" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]">
          {error}
        </Card>
      )}

      {/* Modal de confirmation régénération */}
      <ConfirmDialog
        open={confirmOpen}
        title="Régénérer cet itinéraire ?"
        description="Le moteur déterministe recalculera les étapes journalières selon les dates et le pays. Vos articles de matériel ajoutés manuellement seront scrupuleusement conservés."
        confirmLabel={isRegenerating ? 'Calcul...' : 'Confirmer le recalcul'}
        loading={isRegenerating}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleRegenerate}
      />

      {/* 3. Liste détaillée des étapes */}
      {canonicalSteps.length > 0 ? (
        <div ref={containerRef} className="space-y-[var(--space-3)]">
          {canonicalSteps.map((step, stepIndex) => {
            const booking = bookingByStepId[step.id];
            const extraSteps = (stepsByDay.get(step.day_number) ?? []).filter(
              (entry) => entry.id !== step.id
            );
            return (
              <LiveArrivalReveal key={step.id} id={step.id} liveIds={liveIds} index={stepIndex}>
                <Card>
                  <div className="flex flex-col justify-between gap-[var(--space-3)] sm:flex-row sm:items-start">
                    <div className="space-y-[var(--space-1)]">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <span className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
                          Jour {step.day_number}
                        </span>
                        {step.accommodation_name && (
                          <Badge tone="stone">
                            <Icon name="home" size={10} />
                            {step.accommodation_name}
                          </Badge>
                        )}
                        {isLlmSuggestion(step.source, step.metadata) && <LlmSuggestionBadge />}
                      </div>

                      <h4 className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                        {step.title}
                      </h4>

                      {step.location_name && (
                        <div className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                          <Icon name="map-pin" size={12} />
                          {step.location_name}
                        </div>
                      )}

                      {step.description && (
                        <p className="max-w-2xl pt-1 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                          {step.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-[var(--space-3)] self-start text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)] sm:flex-col sm:items-end sm:gap-[var(--space-1)]">
                      {step.distance_km ? (
                        <div className="flex items-center gap-[var(--space-1)]">
                          <Icon name="footprints" size={13} />
                          <span>{step.distance_km} km</span>
                        </div>
                      ) : null}
                      {step.elevation_gain_m ? (
                        <div className="font-semibold text-[color:var(--lkv-text-primary)]">
                          +{step.elevation_gain_m}m D+
                        </div>
                      ) : null}
                      {step.elevation_loss_m ? (
                        <div className="text-[11px] text-[color:var(--lkv-text-muted)]">
                          -{step.elevation_loss_m}m D-
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {booking && (
                    <div className="mt-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)]">
                      <StepBookingLinkCta
                        booking={booking}
                        slug={booking.slug}
                        partnerName={booking.partnerName}
                        tripId={trip.id}
                      />
                    </div>
                  )}

                  {extraSteps.length > 0 && (
                    <ul
                      className="mt-[var(--space-3)] space-y-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)]"
                      aria-label={`Étapes enrichies du jour ${step.day_number}`}
                    >
                      {extraSteps.map((extra, extraIndex) => {
                        const slot = momentSlotOf(extra);
                        return (
                          <li key={extra.id}>
                            <LiveArrivalReveal id={extra.id} liveIds={liveIds} index={extraIndex}>
                              {slot ? (
                                <MomentRow
                                  title={extra.title}
                                  slot={slot}
                                  startTime={extra.start_time}
                                  source={extra.source}
                                  metadata={extra.metadata}
                                />
                              ) : (
                                <Card
                                  variant="compact"
                                  className="flex items-start gap-[var(--space-2)]"
                                >
                                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[color:var(--lkv-text-secondary)]">
                                    {extra.start_time?.slice(0, 5) ?? '—'}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                                      {extra.title}
                                    </p>
                                    {(extra.distance_km != null ||
                                      extra.elevation_gain_m != null) && (
                                      <p className="text-[10px] font-medium text-[color:var(--lkv-text-secondary)]">
                                        {[
                                          extra.distance_km != null && `${extra.distance_km} km`,
                                          extra.elevation_gain_m != null &&
                                            `+${extra.elevation_gain_m} m`,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </p>
                                    )}
                                  </div>
                                </Card>
                              )}
                            </LiveArrivalReveal>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </LiveArrivalReveal>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Icon name="navigation" size={36} className="text-[color:var(--lkv-text-muted)]" />}
          title="Aucune étape définie"
          description="Ce voyage n'a pas encore d'itinéraire journalier. Vous pouvez le générer automatiquement avec notre moteur de répartition."
          actionLabel={
            trip.permissions.canEdit
              ? isRegenerating
                ? 'Calcul...'
                : 'Générer l’itinéraire maintenant'
              : undefined
          }
          onAction={trip.permissions.canEdit ? handleRegenerate : undefined}
        />
      )}
    </div>
  );
}
