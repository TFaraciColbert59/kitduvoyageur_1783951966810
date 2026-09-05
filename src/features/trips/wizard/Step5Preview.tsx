'use client';

import React, { useEffect, useState } from 'react';
import type { TripWizardState } from './wizardTypes';
import type { PlannerOutput } from '../engine/types';
import { generateAndPersistItinerary } from '@/app/voyages/actions';
import {
  Sparkles,
  Navigation,
  Package,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Footprints,
} from 'lucide-react';

interface Step5PreviewProps {
  state: TripWizardState;
  suggestedTitle: string;
  onUpdateDraft: (updates: Partial<TripWizardState>) => void;
  onComplete: (slug: string) => void;
  onBackToEdit: () => void;
}

export function Step5Preview({
  state,
  suggestedTitle,
  onUpdateDraft,
  onComplete,
  onBackToEdit,
}: Step5PreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<PlannerOutput | null>(state.generatedOutput);
  const [persistedSlug, setPersistedSlug] = useState<string | null>(state.slug);

  const finalTitle = state.title.trim() || suggestedTitle;

  useEffect(() => {
    let isMounted = true;

    async function runGeneration() {
      // Si on a déjà un output en cache pour les mêmes paramètres, on l'affiche
      if (state.generatedOutput && state.slug) {
        setOutput(state.generatedOutput);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await generateAndPersistItinerary({
          tripId: state.tripId || undefined,
          title: finalTitle,
          description: state.description || undefined,
          countries: state.countries.map((c) => c.code),
          destinationName: state.countries.map((c) => c.name).join(', '),
          startDate: state.startDate || undefined,
          endDate: state.endDate || undefined,
          durationDays: state.durationDays,
          pace: state.pace,
          activityType: state.activityType,
          difficulty: state.difficulty,
          accommodationType: state.accommodationType,
          travelersCount: state.travelersCount,
          groupType: state.groupType,
          groupId: state.groupId,
          publishStatus: 'planned',
        });

        if (!isMounted) return;

        if (res.success) {
          setOutput(res.output);
          if (res.slug) setPersistedSlug(res.slug);
          onUpdateDraft({
            generatedOutput: res.output,
            tripId: res.tripId,
            slug: res.slug,
          });
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[LKDV wizard] Erreur génération itinéraire:', err);
        setError(err.message || 'Impossible de générer l’itinéraire.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    runGeneration();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-[#17402C] flex items-center justify-center animate-spin">
          <Navigation size={28} />
        </div>
        <h3 className="text-xl font-bold text-[#17402C]">
          Calcul déterministe de votre itinéraire...
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Répartition des étapes journalières, calcul altimétrique et sélection du matériel selon les règles de sécurité LKDV.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-3">
        <AlertTriangle size={32} className="text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-rose-900">
          Erreur de planification
        </h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
        <button
          type="button"
          onClick={onBackToEdit}
          className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl"
        >
          Modifier les paramètres
        </button>
      </div>
    );
  }

  if (!output) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5B7F55] mb-1">
          <Sparkles size={14} />
          <span>Étape 5 sur 5 — Aperçu complet</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#17402C]">
          {finalTitle}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Voici votre proposition d&apos;itinéraire détaillée, calculée sans compromis et prête pour l&apos;aventure.
        </p>
      </div>

      {/* Métriques clés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white/80 rounded-2xl border border-black/5 text-center">
          <div className="text-[11px] font-semibold text-[#5B7F55] uppercase">Durée</div>
          <div className="text-xl font-bold text-[#17402C] mt-0.5">
            {output.total_days} jours
          </div>
        </div>
        <div className="p-3.5 bg-white/80 rounded-2xl border border-black/5 text-center">
          <div className="text-[11px] font-semibold text-[#5B7F55] uppercase">Distance estimée</div>
          <div className="text-xl font-bold text-[#17402C] mt-0.5">
            {output.total_distance_km} km
          </div>
        </div>
        <div className="p-3.5 bg-white/80 rounded-2xl border border-black/5 text-center">
          <div className="text-[11px] font-semibold text-[#5B7F55] uppercase">Dénivelé positif</div>
          <div className="text-xl font-bold text-[#17402C] mt-0.5">
            +{output.total_elevation_gain_m}m D+
          </div>
        </div>
        <div className="p-3.5 bg-white/80 rounded-2xl border border-black/5 text-center">
          <div className="text-[11px] font-semibold text-[#5B7F55] uppercase">Rythme</div>
          <div className="text-xl font-bold text-[#17402C] mt-0.5 capitalize">
            {state.pace}
          </div>
        </div>
      </div>

      {/* Alertes météo / saisonnalité */}
      {output.warnings.length > 0 && (
        <div className="space-y-2">
          {output.warnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                w.severity === 'alert'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <AlertTriangle
                size={18}
                className={w.severity === 'alert' ? 'text-rose-600 shrink-0' : 'text-amber-600 shrink-0'}
              />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">Note du guide :</span>
                {w.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Déroulé des étapes jour par jour */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#17402C] uppercase tracking-wider flex items-center gap-2">
            <Navigation size={15} />
            <span>Itinéraire jour par jour ({output.steps.length} étapes)</span>
          </h3>
        </div>

        <div className="space-y-3">
          {output.steps.map((step, idx) => (
            <div
              key={idx}
              className="p-4 bg-white/90 rounded-2xl border border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#17402C] text-white text-[11px] font-bold rounded-md">
                    Jour {step.day_number}
                  </span>
                  <span className="text-xs font-semibold text-[#5B7F55]">
                    {step.country_code}
                  </span>
                  {step.accommodation_name && (
                    <span className="text-[11px] text-gray-500">
                      · {step.accommodation_name}
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-sm text-[#17402C]">{step.title}</h4>
                {step.description && (
                  <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                    {step.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-gray-600 shrink-0 self-start sm:self-center">
                {step.distance_km ? (
                  <span className="flex items-center gap-1">
                    <Footprints size={14} className="text-[#5B7F55]" />
                    {step.distance_km} km
                  </span>
                ) : null}
                {step.elevation_gain_m ? (
                  <span className="flex items-center gap-1 text-[#17402C] font-semibold">
                    +{step.elevation_gain_m}m D+
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liste d'équipement suggérée */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#17402C] uppercase tracking-wider flex items-center gap-2">
            <Package size={15} />
            <span>Matériel & sac à dos recommandé ({output.items.length} articles)</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {output.items.map((it, idx) => (
            <div
              key={idx}
              className="p-3 bg-white/80 rounded-xl border border-black/5 flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-semibold text-[#17402C]">{it.item_name}</div>
                <div className="text-[10px] text-[#5B7F55]">
                  {it.category || 'Général'} · Qté : {it.quantity}
                </div>
              </div>
              {it.weight_grams ? (
                <span className="text-[11px] font-medium text-gray-500">
                  {it.weight_grams}g
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Barre d'action finale */}
      <div className="pt-4 border-t border-black/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToEdit}
          className="w-full sm:w-auto px-5 py-3 rounded-xl border border-black/10 text-xs font-semibold text-[#17402C] hover:bg-black/5 flex items-center justify-center gap-2 min-h-[48px]"
        >
          <RotateCcw size={14} />
          <span>Modifier les paramètres</span>
        </button>

        <button
          type="button"
          onClick={() => onComplete(persistedSlug || 'mon-voyage')}
          className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#17402C] hover:bg-[#1f563b] text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-all min-h-[48px]"
        >
          <span>Enregistrer et ouvrir mon voyage</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
