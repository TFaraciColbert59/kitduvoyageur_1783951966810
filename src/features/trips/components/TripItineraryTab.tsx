'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { TripFull, TripStats } from '../types/trip.types';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { EmptyState } from '@/components/ui/EmptyState';
import { checkSeasonalityForDates } from '../engine/seasonality';
import { getCanonicalTripSteps } from '../hooks/useTripCounters';
import { getTripDistance } from '../hooks/useTripDistance';
import { regenerateItineraryAction } from '@/app/voyages/actions';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import Link from 'next/link';
import {
  Navigation,
  MapPin,
  Footprints,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Home,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface TripItineraryTabProps {
  trip: TripFull;
  stats: TripStats;
}

export function TripItineraryTab({ trip }: TripItineraryTabProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Évaluation de la saisonnalité
  const seasonalityWarnings = useMemo(() => {
    if (!trip.destination_country_code) return [];
    return checkSeasonalityForDates(
      trip.destination_country_code,
      trip.start_date,
      trip.end_date
    );
  }, [trip.destination_country_code, trip.start_date, trip.end_date]);

  // Source de vérité unique (Z-R3 / Chantier Z3) : étapes canoniques (dédupliquées
  // par jour) et distances/dénivelés dérivés de trip, cohérents avec l'Aperçu.
  const canonicalSteps = useMemo(
    () => getCanonicalTripSteps(trip.steps),
    [trip.steps]
  );
  const distance = useMemo(() => getTripDistance(trip.steps), [trip.steps]);

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
    <div className="space-y-6">
      {/* 0. Bandeau d'information squelette si aucune donnée de référence */}
      {provenanceInfo.variant === 'skeleton' && (
        <div className="p-4 glass tone-warn border rounded-2xl flex items-start gap-3 text-[var(--lkv-warning)]">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block mb-0.5">Squelette d’itinéraire :</span>
            Aucun tracé de référence pour cette destination. Ajoute tes étapes, les distances se calculeront automatiquement.
          </div>
        </div>
      )}

      {/* 1. Bandeau de Saisonnalité */}
      {seasonalityWarnings.length > 0 ? (
        <div className="space-y-2">
          {seasonalityWarnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                w.severity === 'alert'
                  ? 'glass tone-danger text-[var(--lkv-danger)]'
                  : 'glass tone-warn text-[var(--lkv-warning)]'
              }`}
            >
              <AlertTriangle
                size={18}
                className="shrink-0"
              />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">Alerte météo & praticabilité :</span>
                {w.message}
              </div>
            </div>
          ))}
        </div>
      ) : trip.start_date ? (
        <div className="p-3.5 glass tone-sage border rounded-2xl flex items-center gap-3 text-[var(--lkv-success)]">
          <CheckCircle2 size={16} className="shrink-0" />
          <div className="text-xs">
            <span className="font-semibold">Période optimale :</span> les dates prévues correspondent à la meilleure saison pour cette destination.
          </div>
        </div>
      ) : null}

      {/* 2. Barre d'outils et statistiques */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 glass border border-white/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div>
            <span className="text-[var(--lkv-text-muted)] block">Étapes</span>
            <span className="font-bold text-lkv-primary text-sm">{canonicalSteps.length} jours</span>
          </div>
          <div className="h-6 w-px bg-white/30" />
          <div>
            <span className="text-[var(--lkv-text-muted)] block">Distance totale</span>
            <span className="font-bold text-lkv-primary text-sm">{distance.totalKm} km</span>
          </div>
          <div className="h-6 w-px bg-white/30" />
          <div>
            <span className="text-[var(--lkv-text-muted)] block">Dénivelé positif</span>
            <span className="font-bold text-lkv-primary text-sm">+{distance.dPlus}m D+</span>
          </div>
          <div className="h-6 w-px bg-white/30" />
          <div>
            <span className="text-[var(--lkv-text-muted)] block">Provenance</span>
            <span className="inline-flex items-center gap-1 font-semibold text-xs text-lkv-primary">
              <Sparkles size={12} className="text-[var(--lkv-text-secondary)]" />
              {provenanceInfo.label}
            </span>
          </div>
        </div>

        {trip.permissions.canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <GlassCapsuleBtn
              href={tripSectionHref(trip.slug, 'itinerary')}
              variant="primary"
              size="sm"
              icon={<Calendar size={15} />}
            >
              Ouvrir le Planificateur
            </GlassCapsuleBtn>
          </div>
        )}
      </div>

      {/* Message d'erreur éventuel */}
      {error && (
        <div className="p-3 glass tone-danger border rounded-xl text-xs text-[var(--lkv-danger)]">
          {error}
        </div>
      )}

      {/* Modal de confirmation régénération */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass border border-white/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="glass-sub-card w-10 h-10 rounded-full text-[var(--lkv-warning)] flex items-center justify-center border border-white/60 shadow-2xs">
                <RotateCcw size={20} />
              </div>
              <h3 className="text-base font-bold text-lkv-primary">
                Régénérer cet itinéraire ?
              </h3>
            </div>
            <p className="text-xs text-[var(--lkv-text-muted)] leading-relaxed">
              Le moteur déterministe recalculera les étapes journalières selon les dates et le pays.
              <br />
              <strong className="text-lkv-primary">Vos articles de matériel ajoutés manuellement seront scrupuleusement conservés.</strong>
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <GlassCapsuleBtn
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isRegenerating}
                size="sm"
                variant="default"
              >
                Annuler
              </GlassCapsuleBtn>
              <GlassCapsuleBtn
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                size="sm"
                variant="primary"
                icon={<RotateCcw size={14} className={isRegenerating ? 'animate-spin' : ''} />}
              >
                {isRegenerating ? 'Calcul...' : 'Confirmer le recalcul'}
              </GlassCapsuleBtn>
            </div>
          </div>
        </div>
      )}

      {/* 3. Liste détaillée des étapes */}
      {canonicalSteps.length > 0 ? (
        <div className="space-y-3">
          {canonicalSteps.map((step) => (
            <GlassCard key={step.id} tone="neutral" className="p-4 sm:p-5 rounded-[var(--lkv-radius-lg)] border border-white/60">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-lkv-secondary uppercase tracking-wider">
                      Jour {step.day_number}
                    </span>
                    {step.accommodation_name && (
                      <span className="text-[11px] glass-sub-card text-lkv-primary px-2.5 py-1 rounded-full border border-white/60 flex items-center gap-1 shadow-2xs">
                        <Home size={10} />
                        {step.accommodation_name}
                      </span>
                    )}
                  </div>

                  <h4 className="font-semibold text-lkv-primary text-base">{step.title}</h4>

                  {step.location_name && (
                    <div className="text-xs text-lkv-secondary flex items-center gap-1">
                      <MapPin size={12} />
                      {step.location_name}
                    </div>
                  )}

                  {step.description && (
                    <p className="text-xs text-[var(--lkv-text-muted)] leading-relaxed max-w-2xl pt-1">
                      {step.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1 text-xs text-lkv-secondary shrink-0 self-start">
                  {step.distance_km ? (
                    <div className="flex items-center gap-1">
                      <Footprints size={13} />
                      <span>{step.distance_km} km</span>
                    </div>
                  ) : null}
                  {step.elevation_gain_m ? (
                    <div className="font-semibold text-lkv-primary">
                      +{step.elevation_gain_m}m D+
                    </div>
                  ) : null}
                  {step.elevation_loss_m ? (
                    <div className="text-[var(--lkv-text-muted)] text-[11px]">
                      -{step.elevation_loss_m}m D-
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Navigation size={36} className="text-[var(--lkv-text-muted)]" />}
          title="Aucune étape définie"
          description="Ce voyage n'a pas encore d'itinéraire journalier. Vous pouvez le générer automatiquement avec notre moteur de répartition."
          actionLabel={trip.permissions.canEdit ? (isRegenerating ? 'Calcul...' : 'Générer l’itinéraire maintenant') : undefined}
          onAction={trip.permissions.canEdit ? handleRegenerate : undefined}
        />
      )}
    </div>
  );
}
