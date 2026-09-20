'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { Button, Card, IconButton } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
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

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

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
    <Sheet
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Rétrospective & Carnet de Voyage"
    >
      <div className="space-y-[var(--space-6)] pb-2">
        {/* Messages de retour */}
        {successMessage && (
          <Card
            tone="sage"
            className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)]"
          >
            <Icon name="check-circle2" size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </Card>
        )}

        {errorMessage && (
          <Card
            role="alert"
            tone="danger"
            className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-danger-dark)]"
          >
            {errorMessage}
          </Card>
        )}

        {/* Métriques d'aventure */}
        <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
          <Card variant="compact" className="text-center">
            <Icon name="navigation" size={18} className="mx-auto mb-1 text-[color:var(--lkv-primary)]" />
            <div className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              {metrics.totalKm} km
            </div>
            <div className="text-[11px] text-[color:var(--lkv-text-secondary)]">Distance totale</div>
          </Card>

          <Card variant="compact" className="text-center">
            <Icon name="mountain" size={18} className="mx-auto mb-1 text-[color:var(--lkv-primary)]" />
            <div className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              +{metrics.totalElevationGainM} m
            </div>
            <div className="text-[11px] text-[color:var(--lkv-text-secondary)]">Dénivelé positif</div>
          </Card>

          <Card variant="compact" className="text-center">
            <Icon name="package" size={18} className="mx-auto mb-1 text-[color:var(--lkv-primary)]" />
            <div className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              {metrics.packedWeightKg} kg
            </div>
            <div className="text-[11px] text-[color:var(--lkv-text-secondary)]">
              {metrics.packedGearCount} items emportés
            </div>
          </Card>

          <Card variant="compact" className="text-center">
            <Icon name="award" size={18} className="mx-auto mb-1 text-[color:var(--lkv-primary)]" />
            <div className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
              {metrics.durationDays} jours
            </div>
            <div className="text-[11px] text-[color:var(--lkv-text-secondary)]">
              {metrics.nbNuits} nuits vécues
            </div>
          </Card>
        </div>

        {/* Formulaire REX */}
        <form onSubmit={handleSubmit} className="space-y-[var(--space-6)]">
          {/* Section 1 : Publication Carnet */}
          <div className="space-y-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)]">
                <input
                  type="checkbox"
                  checked={publishCarnet}
                  onChange={(e) => setPublishCarnet(e.target.checked)}
                  className="h-4 w-4 rounded accent-[color:var(--lkv-primary)]"
                />
                <span className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                  <Icon name="book-open" size={16} /> Publier en carnet de bord communautaire
                </span>
              </label>
            </div>

            {publishCarnet && (
              <Card variant="compact" className="space-y-[var(--space-3)]">
                <label className="block">
                  <span className={LABEL_CLASS}>Titre du carnet d&apos;expédition</span>
                  <input
                    type="text"
                    value={carnetTitle}
                    onChange={(e) => setCarnetTitle(e.target.value)}
                    required
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="block">
                  <span className={LABEL_CLASS}>Introduction / Récit de synthèse</span>
                  <textarea
                    rows={3}
                    value={carnetDescription}
                    onChange={(e) => setCarnetDescription(e.target.value)}
                    placeholder="Résumez les moments forts, la météo, l'ambiance..."
                    className={FIELD_CLASS}
                  />
                </label>

                <div className="flex items-center gap-[var(--space-4)] text-[length:var(--lkv-text-footnote)]">
                  <label className="flex cursor-pointer items-center gap-[var(--space-2)] text-[color:var(--lkv-text-primary)]">
                    <input
                      type="radio"
                      name="visibility"
                      checked={isPublic}
                      onChange={() => setIsPublic(true)}
                      className="accent-[color:var(--lkv-primary)]"
                    />
                    <span>Public (visible dans Explorer & Carnets)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-[var(--space-2)] text-[color:var(--lkv-text-secondary)]">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!isPublic}
                      onChange={() => setIsPublic(false)}
                      className="accent-[color:var(--lkv-primary)]"
                    />
                    <span>Privé (visible uniquement par l&apos;équipe)</span>
                  </label>
                </div>
              </Card>
            )}
          </div>

          {/* Section 2 : Avis certifiés terrain (Preuve terrain) */}
          {placeCandidates.length > 0 && (
            <div className="space-y-[var(--space-3)]">
              <div>
                <h4 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                  <Icon name="map-pin" size={16} /> Certifier vos lieux visités (Preuve terrain)
                </h4>
                <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  Vos avis sont certifiés réels (pondération x2 dans le scoring communautaire).
                </p>
              </div>

              <div className="space-y-[var(--space-3)]">
                {placeCandidates.map((candidate) => {
                  const currentRev = reviews[candidate.placeId] || { rating: 5, comment: '' };
                  return (
                    <Card key={candidate.placeId} variant="compact" className="space-y-[var(--space-2)]">
                      <div className="flex items-center justify-between">
                        <span className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                          {candidate.name}
                        </span>
                        {/* Note étoiles */}
                        <div className="flex items-center gap-[var(--space-1)]">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <IconButton
                              key={star}
                              type="button"
                              size="sm"
                              aria-label={`Noter ${star} étoile${star > 1 ? 's' : ''}`}
                              aria-pressed={currentRev.rating === star}
                              onClick={() =>
                                setReviews((prev) => ({
                                  ...prev,
                                  [candidate.placeId]: { ...currentRev, rating: star },
                                }))
                              }
                              className={currentRev.rating === star ? 'text-[color:var(--lkv-warning)]' : ''}
                            >
                              <Icon name="star" size={16} />
                            </IconButton>
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
                        className={FIELD_CLASS}
                      />
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={isPending}>
              {isPending ? 'Enregistrement en cours...' : "Valider & Clôturer l'expédition"}
            </Button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}
