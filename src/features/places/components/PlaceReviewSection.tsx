'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';
import { addPlaceReviewAction } from '@/app/lieux/actions';
import type { PlaceReview } from '../types/place.types';

export interface PlaceReviewSectionProps {
  placeId: string;
  initialReviews: PlaceReview[];
  bayesianRating: number;
  reviewsCount: number;
}

const INPUT_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-3.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export function PlaceReviewSection({
  placeId,
  initialReviews,
  bayesianRating,
  reviewsCount,
}: PlaceReviewSectionProps) {
  const [reviews, setReviews] = useState<PlaceReview[]>(initialReviews);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [hasFieldProof, setHasFieldProof] = useState<boolean>(false);
  const [visitDate, setVisitDate] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || comment.trim().length < 10) {
      setErrorMsg('Votre retour d’expérience doit comporter au moins 10 caractères.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await addPlaceReviewAction({
        place_id: placeId,
        rating,
        comment: comment.trim(),
        has_field_proof: hasFieldProof,
        visit_date: visitDate || null,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Merci ! Votre avis a été enregistré et certifié.');
        // Ajout optimiste dans la liste
        const newReview: PlaceReview = {
          id: res.data?.reviewId || String(Date.now()),
          place_id: placeId,
          author_id: 'current-user',
          rating,
          comment: comment.trim(),
          has_field_proof: hasFieldProof,
          visit_date: visitDate || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setReviews([newReview, ...reviews]);
        setComment('');
        setShowForm(false);
      }
    });
  };

  return (
    <section className="mt-[var(--space-8)] space-y-[var(--space-6)]">
      {/* Score Header */}
      <Card className="flex flex-col items-center justify-between gap-[var(--space-6)] p-6 sm:flex-row">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)] shadow-md">
            <span className="text-[length:var(--lkv-text-title-lg)] font-black leading-none">
              {bayesianRating > 0 ? bayesianRating.toFixed(1) : '-'}
            </span>
            <span className="text-[length:var(--lkv-text-caption-2)] font-semibold opacity-80">/ 5.0</span>
          </div>

          <div>
            <h3 className="text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
              Évaluation Communautaire
            </h3>
            <div className="mt-[var(--space-1)] flex items-center gap-2">
              <div className="flex items-center text-[color:var(--lkv-warning-dark)]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Icon
                    name="star"
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(bayesianRating)
                        ? 'text-[color:var(--lkv-warning-dark)]'
                        : 'text-[color:var(--lkv-text-muted)]/40'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[length:var(--lkv-text-caption-1)] font-semibold text-[color:var(--lkv-text-muted)]">
                ({reviewsCount} avis recueillis)
              </span>
            </div>
            <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
              Moyenne bayésienne pondérée avec doublement du score pour les retours terrain
              certifiés.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="shrink-0"
          icon={<Icon name="message-square-plus" className="h-4 w-4" />}
        >
          {showForm ? 'Masquer le formulaire' : 'Donner mon avis'}
        </Button>
      </Card>

      {/* Formulaire d'Avis */}
      {showForm && (
        <Card className="p-6">
          <h4 className="mb-[var(--space-4)] flex items-center gap-2 text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
            <Icon name="compass" className="h-4 w-4 text-[color:var(--lkv-primary)]" />
            Votre retour d’expérience terrain
          </h4>

          <form onSubmit={handleSubmitReview} className="space-y-[var(--space-4)]">
            {errorMsg && (
              <Card tone="danger" className="flex items-center gap-2 p-[var(--space-3)] text-[length:var(--lkv-text-caption-1)]">
                <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </Card>
            )}

            {/* Note en étoiles */}
            <div>
              <span className="mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
                Note globale
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <IconButton
                    key={s}
                    variant="ghost"
                    size="md"
                    aria-label={`Donner la note de ${s} sur 5`}
                    aria-pressed={s <= rating}
                    onClick={() => setRating(s)}
                  >
                    <Icon
                      name="star"
                      className={`h-6 w-6 ${
                        s <= rating ? 'text-[color:var(--lkv-warning-dark)]' : 'text-[color:var(--lkv-text-muted)]/40'
                      }`}
                    />
                  </IconButton>
                ))}
              </div>
            </div>

            {/* Date de visite */}
            <div>
              <label
                htmlFor="visit-date"
                className="mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]"
              >
                Date de passage (facultatif)
              </label>
              <input
                type="date"
                id="visit-date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className={`${INPUT_CLASS} h-11 sm:w-64`}
              />
            </div>

            {/* Commentaire */}
            <div>
              <label
                htmlFor="review-comment"
                className="mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]"
              >
                Observations, état du site, eau, accessibilité
              </label>
              <textarea
                id="review-comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Décrivez l'état actuel de la source, la propreté du bivouac, l'accueil du gardien..."
                className={`${INPUT_CLASS} p-3.5`}
                required
              />
            </div>

            {/* Certification Terrain */}
            <div className="flex items-start gap-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-secondary)]/20 bg-[color:var(--lkv-secondary)]/10 p-3.5">
              <input
                type="checkbox"
                id="field-proof"
                checked={hasFieldProof}
                onChange={(e) => setHasFieldProof(e.target.checked)}
                className="mt-1 h-4 w-4 rounded text-[color:var(--lkv-primary)] focus:ring-[color:var(--lkv-focus-ring)]"
              />
              <label htmlFor="field-proof" className="cursor-pointer text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-secondary)]">
                <strong className="block font-semibold text-[color:var(--lkv-text-primary)]">
                  Preuve de passage sur le terrain
                </strong>
                J’atteste m’être rendu personnellement sur ce site. Mon avis aura un coefficient
                double dans le calcul bayésien du lieu.
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-[var(--space-2)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending}
              >
                {isPending ? 'Enregistrement...' : 'Publier mon avis certifié'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {successMsg && (
        <Card tone="sage" className="flex items-center gap-2 p-[var(--space-4)] text-[length:var(--lkv-text-caption-1)]">
          <Icon name="check-circle2" className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </Card>
      )}

      {/* Liste des Avis */}
      <div className="space-y-[var(--space-4)]">
        <h4 className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Avis des randonneurs ({reviews.length})
        </h4>

        {reviews.length === 0 ? (
          <EmptyState
            compact
            title="Aucun avis pour le moment"
            description="Soyez le premier randonneur à certifier les conditions de ce lieu !"
          />
        ) : (
          reviews.map((rev) => (
            <Card key={rev.id} variant="compact" className="p-5">
              <div className="mb-[var(--space-2)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-[color:var(--lkv-warning-dark)]">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Icon
                        name="star"
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= rev.rating ? 'text-[color:var(--lkv-warning-dark)]' : 'text-[color:var(--lkv-text-muted)]/40'
                        }`}
                      />
                    ))}
                  </div>

                  {rev.has_field_proof && (
                    <Badge tone="sage" className="gap-1">
                      <Icon name="shield-check" className="h-3.5 w-3.5 text-[color:var(--lkv-primary)]" />
                      Preuve terrain certifiée
                    </Badge>
                  )}
                </div>

                {rev.visit_date && (
                  <span className="flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    <Icon name="calendar" className="h-3 w-3" />
                    Visité le {rev.visit_date}
                  </span>
                )}
              </div>

              <p className="whitespace-pre-line text-[length:var(--lkv-text-caption-1)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                {rev.comment}
              </p>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
