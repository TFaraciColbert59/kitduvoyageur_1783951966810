'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { TripFull, TripStats } from '../types/trip.types';
import { GlassCard } from '@/components/ui/GlassCard';
import { checkSeasonalityForDates } from '../engine/seasonality';
import { regenerateItineraryAction } from '@/app/voyages/actions';
import {
  Navigation,
  MapPin,
  Footprints,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Home,
  Sparkles,
} from 'lucide-react';

interface TripItineraryTabProps {
  trip: TripFull;
  stats: TripStats;
}

export function TripItineraryTab({ trip, stats }: TripItineraryTabProps) {
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

  return (
    <div className="space-y-6">
      {/* 1. Bandeau de Saisonnalité */}
      {seasonalityWarnings.length > 0 ? (
        <div className="space-y-2">
          {seasonalityWarnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                w.severity === 'alert'
                  ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                  : 'bg-amber-50/90 border-amber-200 text-amber-950'
              }`}
            >
              <AlertTriangle
                size={18}
                className={w.severity === 'alert' ? 'text-rose-600 shrink-0' : 'text-amber-600 shrink-0'}
              />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">Alerte météo & praticabilité :</span>
                {w.message}
              </div>
            </div>
          ))}
        </div>
      ) : trip.start_date ? (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center gap-3 text-emerald-900">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold">Période optimale :</span> les dates prévues correspondent à la meilleure saison pour cette destination.
          </div>
        </div>
      ) : null}

      {/* 2. Barre d'outils et statistiques */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-black/5">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-500 block">Étapes</span>
            <span className="font-bold text-[#17402C] text-sm">{trip.steps.length} jours</span>
          </div>
          <div className="h-6 w-px bg-black/10" />
          <div>
            <span className="text-gray-500 block">Distance totale</span>
            <span className="font-bold text-[#17402C] text-sm">{stats.total_distance_km} km</span>
          </div>
          <div className="h-6 w-px bg-black/10" />
          <div>
            <span className="text-gray-500 block">Dénivelé positif</span>
            <span className="font-bold text-[#17402C] text-sm">+{stats.total_elevation_gain_m}m D+</span>
          </div>
        </div>

        {trip.permissions.canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isRegenerating}
              className="px-3.5 py-2 rounded-xl border border-black/10 text-xs font-semibold text-[#17402C] hover:bg-black/5 flex items-center gap-1.5 transition-all min-h-[40px]"
            >
              <RotateCcw size={14} className={isRegenerating ? 'animate-spin' : ''} />
              <span>{isRegenerating ? 'Calcul en cours...' : 'Régénérer l’itinéraire'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Message d'erreur éventuel */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Modal de confirmation régénération */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-black/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                <RotateCcw size={20} />
              </div>
              <h3 className="text-base font-bold text-[#17402C]">
                Régénérer cet itinéraire ?
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Le moteur déterministe recalculera les étapes journalières selon les dates et le pays.
              <br />
              <strong className="text-[#17402C]">Vos articles de matériel ajoutés manuellement seront scrupuleusement conservés.</strong>
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isRegenerating}
                className="px-4 py-2 rounded-xl border border-black/10 text-xs font-semibold text-gray-600 hover:bg-black/5"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="px-4 py-2 rounded-xl bg-[#17402C] text-white text-xs font-bold hover:bg-[#1f563b] flex items-center gap-1.5 shadow-sm"
              >
                {isRegenerating ? 'Calcul...' : 'Confirmer le recalcul'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Liste détaillée des étapes */}
      {trip.steps.length > 0 ? (
        <div className="space-y-3">
          {trip.steps.map((step) => (
            <GlassCard key={step.id} tone="neutral" className="p-4 sm:p-5 rounded-[22px] border border-white/60">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5B7F55] uppercase tracking-wider">
                      Jour {step.day_number}
                    </span>
                    {step.accommodation_name && (
                      <span className="text-[11px] bg-black/5 text-[#17402C] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Home size={10} />
                        {step.accommodation_name}
                      </span>
                    )}
                  </div>

                  <h4 className="font-semibold text-[#17402C] text-base">{step.title}</h4>

                  {step.location_name && (
                    <div className="text-xs text-[#5B7F55] flex items-center gap-1">
                      <MapPin size={12} />
                      {step.location_name}
                    </div>
                  )}

                  {step.description && (
                    <p className="text-xs text-gray-600 leading-relaxed max-w-2xl pt-1">
                      {step.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1 text-xs text-[#5B7F55] shrink-0 self-start">
                  {step.distance_km ? (
                    <div className="flex items-center gap-1">
                      <Footprints size={13} />
                      <span>{step.distance_km} km</span>
                    </div>
                  ) : null}
                  {step.elevation_gain_m ? (
                    <div className="font-semibold text-[#17402C]">
                      +{step.elevation_gain_m}m D+
                    </div>
                  ) : null}
                  {step.elevation_loss_m ? (
                    <div className="text-gray-500 text-[11px]">
                      -{step.elevation_loss_m}m D-
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="p-8 bg-white/80 rounded-3xl border border-black/5 text-center space-y-3">
          <Navigation size={36} className="text-gray-400 mx-auto" />
          <h4 className="text-sm font-bold text-[#17402C]">Aucune étape définie</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Ce voyage n&apos;a pas encore d&apos;itinéraire journalier. Vous pouvez le générer automatiquement avec notre moteur de répartition.
          </p>
          {trip.permissions.canEdit && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-5 py-2.5 bg-[#17402C] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#1f563b] inline-flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>Générer l’itinéraire maintenant</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
