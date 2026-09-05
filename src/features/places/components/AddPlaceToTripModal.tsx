'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { X, CheckCircle2, AlertCircle, Plus, ArrowRight } from 'lucide-react';
import { addPlaceToTripAction } from '@/app/lieux/actions';
import type { PlaceWithDistance } from '../types/place.types';

export interface UserTripOption {
  id: string;
  title: string;
  slug: string;
  duration_days: number;
}

export interface AddPlaceToTripModalProps {
  place: PlaceWithDistance | null;
  isOpen: boolean;
  onClose: () => void;
  userTrips: UserTripOption[];
}

export function AddPlaceToTripModal({
  place,
  isOpen,
  onClose,
  userTrips,
}: AddPlaceToTripModalProps) {
  const [selectedTripId, setSelectedTripId] = useState<string>(userTrips[0]?.id || '');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ stepId: string; tripSlug: string } | null>(
    null
  );

  if (!isOpen || !place) return null;

  const currentTrip = userTrips.find((t) => t.id === selectedTripId) || userTrips[0];
  const maxDays = currentTrip?.duration_days || 7;

  const handleTripChange = (tripId: string) => {
    setSelectedTripId(tripId);
    setSelectedDay(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) {
      setErrorMsg('Veuillez sélectionner un voyage.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await addPlaceToTripAction({
        tripId: selectedTripId,
        dayNumber: selectedDay,
        placeId: place.id,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.data) {
        setSuccessResult(res.data);
      }
    });
  };

  const handleResetAndClose = () => {
    setSuccessResult(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg">
        <GlassCard
          tone="neutral"
          blur="lg"
          className="border border-white/70 shadow-2xl rounded-[28px] overflow-hidden p-6 sm:p-7 relative bg-white/95"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleResetAndClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="mb-5 pr-8">
            <span className="text-xs font-bold text-[#5B7F55] uppercase tracking-wider">
              Intégration d’Itinéraire
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
              Ajouter à un Voyage
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Intégrez <strong className="text-stone-900">{place.name}</strong> comme étape ou point d’intérêt.
            </p>
          </div>

          {/* Success State */}
          {successResult ? (
            <div className="py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-1">
                Lieu ajouté avec succès !
              </h3>
              <p className="text-sm text-stone-600 mb-6">
                Le lieu a été inséré dans votre journée {selectedDay} et ajouté à votre kit de préparation.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/voyages/${successResult.tripSlug}/itineraire`}
                  className="flex-1"
                >
                  <LkvButton
                    variant="primary"
                    className="w-full flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    Voir l’itinéraire
                    <ArrowRight className="w-4 h-4" />
                  </LkvButton>
                </Link>
                <LkvButton
                  variant="secondary"
                  className="flex-1 min-h-[44px]"
                  onClick={handleResetAndClose}
                >
                  Fermer
                </LkvButton>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {userTrips.length === 0 ? (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center">
                  <p className="text-sm text-stone-600 mb-3">
                    Vous n’avez aucun voyage en cours de préparation.
                  </p>
                  <Link href="/voyages/nouveau">
                    <LkvButton variant="primary" size="sm" className="min-h-[44px]">
                      Créer un nouveau voyage
                    </LkvButton>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Select Trip */}
                  <div>
                    <label
                      htmlFor="trip-select"
                      className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
                    >
                      Choisir le voyage
                    </label>
                    <select
                      id="trip-select"
                      value={selectedTripId}
                      onChange={(e) => handleTripChange(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#17402C]/20 focus:border-[#17402C]"
                    >
                      {userTrips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.duration_days} jours)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Day */}
                  <div>
                    <label
                      htmlFor="day-select"
                      className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
                    >
                      Journée de destination
                    </label>
                    <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                      {Array.from({ length: maxDays }, (_, i) => i + 1).map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`min-h-[44px] rounded-xl text-xs font-bold transition-all border ${
                            selectedDay === day
                              ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          Jour {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <LkvButton
                      type="submit"
                      variant="primary"
                      className="w-full flex items-center justify-center gap-2 min-h-[48px] font-bold"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <span>Ajout en cours...</span>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Confirmer l’ajout au Jour {selectedDay}
                        </>
                      )}
                    </LkvButton>
                  </div>
                </>
              )}
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
