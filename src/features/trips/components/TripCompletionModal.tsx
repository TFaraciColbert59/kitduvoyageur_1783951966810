'use client';

import React, { useState, useTransition } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  MapPin,
  Mountain,
  Navigation,
  Package,
  Star,
  X,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import {
  calculateTripRetrospectiveMetrics,
  extractCertifiedPlaceCandidates,
} from '../engine/carnetConversionEngine';
import {
  updateTripStatusAction,
  publishTripCarnetAction,
  submitTripFieldReviewsAction,
} from '@/app/voyages/completion-actions';
import type { TripFull } from '../types/trip.types';

interface TripCompletionModalProps {
  trip: TripFull;
  isOpen: boolean;
  onClose: () => void;
}

export function TripCompletionModal({ trip, isOpen, onClose }: TripCompletionModalProps) {
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Options de publication carnet
  const [publishCarnet, setPublishCarnet] = useState(true);
  const [carnetTitle, setCarnetTitle] = useState(trip.title);
  const [carnetDescription, setCarnetDescription] = useState(trip.description || '');
  const [isPublic, setIsPublic] = useState(true);

  // Avis certifiés terrain
  const placeCandidates = extractCertifiedPlaceCandidates(trip);
  const [reviews, setReviews] = useState<Record<string, { rating: number; comment: string }>>(() => {
    const initial: Record<string, { rating: number; comment: string }> = {};
    placeCandidates.forEach(p => {
      initial[p.placeId] = { rating: 5, comment: '' };
    });
    return initial;
  });

  if (!isOpen) return null;

  const metrics = calculateTripRetrospectiveMetrics(trip);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        // 1. Clôturer le voyage si pas déjà fait
        if (trip.status !== 'completed') {
          const statusData = new FormData();
          statusData.set('tripId', trip.id);
          statusData.set('status', 'completed');
          statusData.set('tripSlug', trip.slug);
          const statusRes = await updateTripStatusAction(null, statusData);
          if (!statusRes.success) {
            setErrorMessage(statusRes.error || 'Erreur lors de la clôture du voyage');
            return;
          }
        }

        // 2. Publier en carnet communautaire si coché
        if (publishCarnet) {
          const carnetData = new FormData();
          carnetData.set('tripId', trip.id);
          carnetData.set('title', carnetTitle);
          carnetData.set('description', carnetDescription);
          carnetData.set('isPublic', isPublic ? 'true' : 'false');
          carnetData.set('tripSlug', trip.slug);
          const carnetRes = await publishTripCarnetAction(null, carnetData);
          if (!carnetRes.success) {
            setErrorMessage(carnetRes.error || 'Erreur lors de la publication du carnet');
            return;
          }
        }

        // 3. Soumettre les avis certifiés terrain s'il y en a de renseignés
        const reviewsToSubmit = Object.entries(reviews)
          .filter(([, val]) => val.comment.trim().length >= 5)
          .map(([placeId, val]) => ({
            placeId,
            rating: val.rating,
            comment: val.comment.trim(),
          }));

        if (reviewsToSubmit.length > 0) {
          const reviewsData = new FormData();
          reviewsData.set('tripId', trip.id);
          reviewsData.set('tripSlug', trip.slug);
          reviewsData.set('reviews', JSON.stringify(reviewsToSubmit));
          await submitTripFieldReviewsAction(null, reviewsData);
        }

        setSuccessMessage('Félicitations ! Votre rétrospective est enregistrée et partagée.');
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err: any) {
        setErrorMessage(err.message || 'Une erreur inattendue est survenue');
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-[#FAF8F5] border border-white/80 rounded-[28px] max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
        {/* En-tête modal */}
        <div className="flex items-center justify-between border-b border-black/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#17402C]/10 flex items-center justify-center text-[#17402C]">
              <Award size={22} />
            </div>
            <div>
              <h3 id="completion-modal-title" className="text-xl font-bold text-[#17402C]">
                Rétrospective & Carnet de Voyage
              </h3>
              <p className="text-xs text-[#5B7F55]">
                Clôturez votre aventure, célébrez vos kilomètres et inspirez la communauté.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 text-[#5B7F55] transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages de retour */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-[#17402C]/10 border border-[#17402C]/20 text-sm text-[#17402C] flex items-center gap-2">
            <CheckCircle2 size={18} className="text-[#17402C] shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {/* Métriques d'aventure */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard tone="neutral" className="p-3.5 rounded-[18px] border border-white/60 text-center">
            <Navigation size={18} className="mx-auto text-[#17402C] mb-1" />
            <div className="text-lg font-bold text-[#17402C]">{metrics.totalKm} km</div>
            <div className="text-[11px] text-[#5B7F55]">Distance totale</div>
          </GlassCard>

          <GlassCard tone="neutral" className="p-3.5 rounded-[18px] border border-white/60 text-center">
            <Mountain size={18} className="mx-auto text-[#17402C] mb-1" />
            <div className="text-lg font-bold text-[#17402C]">+{metrics.totalElevationGainM} m</div>
            <div className="text-[11px] text-[#5B7F55]">Dénivelé positif</div>
          </GlassCard>

          <GlassCard tone="neutral" className="p-3.5 rounded-[18px] border border-white/60 text-center">
            <Package size={18} className="mx-auto text-[#17402C] mb-1" />
            <div className="text-lg font-bold text-[#17402C]">{metrics.packedWeightKg} kg</div>
            <div className="text-[11px] text-[#5B7F55]">{metrics.packedGearCount} items emportés</div>
          </GlassCard>

          <GlassCard tone="neutral" className="p-3.5 rounded-[18px] border border-white/60 text-center">
            <Award size={18} className="mx-auto text-[#17402C] mb-1" />
            <div className="text-lg font-bold text-[#17402C]">{metrics.durationDays} jours</div>
            <div className="text-[11px] text-[#5B7F55]">{metrics.nbNuits} nuits vécues</div>
          </GlassCard>
        </div>

        {/* Formulaire REX */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1 : Publication Carnet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={publishCarnet}
                  onChange={e => setPublishCarnet(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#17402C] focus:ring-[#17402C]"
                />
                <span className="text-sm font-semibold text-[#17402C] flex items-center gap-1.5">
                  <BookOpen size={16} /> Publier en carnet de bord communautaire
                </span>
              </label>
            </div>

            {publishCarnet && (
              <div className="p-4 rounded-2xl bg-white/70 border border-black/5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Titre du carnet d&apos;expédition
                  </label>
                  <input
                    type="text"
                    value={carnetTitle}
                    onChange={e => setCarnetTitle(e.target.value)}
                    required
                    className="w-full text-sm px-3 py-2 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Introduction / Récit de synthèse
                  </label>
                  <textarea
                    rows={3}
                    value={carnetDescription}
                    onChange={e => setCarnetDescription(e.target.value)}
                    placeholder="Résumez les moments forts, la météo, l'ambiance..."
                    className="w-full text-sm px-3 py-2 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#17402C]">
                    <input
                      type="radio"
                      name="visibility"
                      checked={isPublic}
                      onChange={() => setIsPublic(true)}
                      className="text-[#17402C]"
                    />
                    <span>Public (visible dans Explorer & Carnets)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#5B7F55]">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!isPublic}
                      onChange={() => setIsPublic(false)}
                      className="text-[#17402C]"
                    />
                    <span>Privé (visible uniquement par l&apos;équipe)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 2 : Avis certifiés terrain (Preuve terrain) */}
          {placeCandidates.length > 0 && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-[#17402C] flex items-center gap-1.5">
                  <MapPin size={16} /> Certifier vos lieux visités (Preuve terrain)
                </h4>
                <p className="text-xs text-[#5B7F55]">
                  Vos avis sont certifiés réels (pondération x2 dans le scoring communautaire).
                </p>
              </div>

              <div className="space-y-3">
                {placeCandidates.map(candidate => {
                  const currentRev = reviews[candidate.placeId] || { rating: 5, comment: '' };
                  return (
                    <div key={candidate.placeId} className="p-3.5 rounded-2xl bg-white/70 border border-black/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#17402C]">{candidate.name}</span>
                        {/* Note étoiles */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setReviews(prev => ({
                                  ...prev,
                                  [candidate.placeId]: { ...currentRev, rating: star },
                                }))
                              }
                              className="text-amber-500 hover:scale-110 transition-transform"
                            >
                              <Star
                                size={16}
                                fill={star <= currentRev.rating ? 'currentColor' : 'none'}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Votre retour terrain (état du bivouac, source en eau, accueil...)"
                        value={currentRev.comment}
                        onChange={e =>
                          setReviews(prev => ({
                            ...prev,
                            [candidate.placeId]: { ...currentRev, comment: e.target.value },
                          }))
                        }
                        className="w-full text-xs px-3 py-1.5 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/5">
            <LkvButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
              Annuler
            </LkvButton>
            <LkvButton type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? 'Enregistrement en cours...' : 'Valider & Clôturer l\'expédition'}
            </LkvButton>
          </div>
        </form>
      </div>
    </div>
  );
}
