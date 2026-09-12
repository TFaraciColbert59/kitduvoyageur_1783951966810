'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
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
  const [isPublic, setIsPublic] = useState(false);

  // Avis certifiés terrain
  const placeCandidates = extractCertifiedPlaceCandidates(trip);
  const [reviews, setReviews] = useState<Record<string, { rating: number; comment: string }>>(
    () => {
      const initial: Record<string, { rating: number; comment: string }> = {};
      placeCandidates.forEach((p) => {
        initial[p.placeId] = { rating: 5, comment: '' };
      });
      return initial;
    }
  );

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
    <GlassModal
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Rétrospective & Carnet de Voyage"
      variant="sheet"
    >
      <div className="pb-2 space-y-6">
        {/* Messages de retour */}
        {successMessage && (
          <div className="p-4 rounded-2xl glass tone-sage border text-sm text-[var(--lkv-success)] flex items-center gap-2">
            <Icon name="check-circle2" size={18} className="text-lkv-primary shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl glass tone-danger border text-sm text-[var(--lkv-danger)]">
            {errorMessage}
          </div>
        )}

        {/* Métriques d'aventure */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard
            tone="neutral"
            className="p-3.5 rounded-[var(--lkv-radius-lg)] border border-white/60 text-center"
          >
            <Icon name="navigation" size={18} className="mx-auto text-lkv-primary mb-1" />
            <div className="text-lg font-bold text-lkv-primary">{metrics.totalKm} km</div>
            <div className="text-[11px] text-lkv-secondary">Distance totale</div>
          </GlassCard>

          <GlassCard
            tone="neutral"
            className="p-3.5 rounded-[var(--lkv-radius-lg)] border border-white/60 text-center"
          >
            <Icon name="mountain" size={18} className="mx-auto text-lkv-primary mb-1" />
            <div className="text-lg font-bold text-lkv-primary">
              +{metrics.totalElevationGainM} m
            </div>
            <div className="text-[11px] text-lkv-secondary">Dénivelé positif</div>
          </GlassCard>

          <GlassCard
            tone="neutral"
            className="p-3.5 rounded-[var(--lkv-radius-lg)] border border-white/60 text-center"
          >
            <Icon name="package" size={18} className="mx-auto text-lkv-primary mb-1" />
            <div className="text-lg font-bold text-lkv-primary">{metrics.packedWeightKg} kg</div>
            <div className="text-[11px] text-lkv-secondary">
              {metrics.packedGearCount} items emportés
            </div>
          </GlassCard>

          <GlassCard
            tone="neutral"
            className="p-3.5 rounded-[var(--lkv-radius-lg)] border border-white/60 text-center"
          >
            <Icon name="award" size={18} className="mx-auto text-lkv-primary mb-1" />
            <div className="text-lg font-bold text-lkv-primary">{metrics.durationDays} jours</div>
            <div className="text-[11px] text-lkv-secondary">{metrics.nbNuits} nuits vécues</div>
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
                  onChange={(e) => setPublishCarnet(e.target.checked)}
                  className="w-4 h-4 rounded text-lkv-primary focus:ring-lkv-primary"
                />
                <span className="text-sm font-semibold text-lkv-primary flex items-center gap-1.5">
                  <Icon name="book-open" size={16} /> Publier en carnet de bord communautaire
                </span>
              </label>
            </div>

            {publishCarnet && (
              <div className="p-4 rounded-2xl glass-sub-card border border-white/60 shadow-2xs space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Titre du carnet d&apos;expédition
                  </label>
                  <input
                    type="text"
                    value={carnetTitle}
                    onChange={(e) => setCarnetTitle(e.target.value)}
                    required
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Introduction / Récit de synthèse
                  </label>
                  <textarea
                    rows={3}
                    value={carnetDescription}
                    onChange={(e) => setCarnetDescription(e.target.value)}
                    placeholder="Résumez les moments forts, la météo, l'ambiance..."
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-lkv-primary">
                    <input
                      type="radio"
                      name="visibility"
                      checked={isPublic}
                      onChange={() => setIsPublic(true)}
                      className="text-lkv-primary"
                    />
                    <span>Public (visible dans Explorer & Carnets)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-lkv-secondary">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!isPublic}
                      onChange={() => setIsPublic(false)}
                      className="text-lkv-primary"
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
                <h4 className="text-sm font-semibold text-lkv-primary flex items-center gap-1.5">
                  <Icon name="map-pin" size={16} /> Certifier vos lieux visités (Preuve terrain)
                </h4>
                <p className="text-xs text-lkv-secondary">
                  Vos avis sont certifiés réels (pondération x2 dans le scoring communautaire).
                </p>
              </div>

              <div className="space-y-3">
                {placeCandidates.map((candidate) => {
                  const currentRev = reviews[candidate.placeId] || { rating: 5, comment: '' };
                  return (
                    <div
                      key={candidate.placeId}
                      className="p-3.5 rounded-2xl glass-sub-card border border-white/60 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-lkv-primary">
                          {candidate.name}
                        </span>
                        {/* Note étoiles */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setReviews((prev) => ({
                                  ...prev,
                                  [candidate.placeId]: { ...currentRev, rating: star },
                                }))
                              }
                              className="text-[var(--lkv-warning)] hover:scale-110 transition-transform"
                            >
                              <Icon name="star" size={16} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Votre retour terrain (état du bivouac, source en eau, accueil...)"
                        value={currentRev.comment}
                        onChange={(e) =>
                          setReviews((prev) => ({
                            ...prev,
                            [candidate.placeId]: { ...currentRev, comment: e.target.value },
                          }))
                        }
                        className="glass-input w-full px-3 py-1.5 text-xs text-[var(--lkv-text-primary)]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/40">
            <GlassCapsuleBtn
              type="button"
              variant="default"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Annuler
            </GlassCapsuleBtn>
            <GlassCapsuleBtn type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? 'Enregistrement en cours...' : "Valider & Clôturer l'expédition"}
            </GlassCapsuleBtn>
          </div>
        </form>
      </div>
    </GlassModal>
  );
}
