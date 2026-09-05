'use client';

import React, { useState, useTransition } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import {
  Star,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  MessageSquarePlus,
  Compass,
} from 'lucide-react';
import { addPlaceReviewAction } from '@/app/lieux/actions';
import type { PlaceReview } from '../types/place.types';

export interface PlaceReviewSectionProps {
  placeId: string;
  initialReviews: PlaceReview[];
  bayesianRating: number;
  reviewsCount: number;
}

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
    <section className="mt-8 space-y-6">
      {/* Score Header */}
      <GlassCard
        tone="neutral"
        blur="md"
        className="p-6 rounded-[28px] border border-white/60 flex flex-col sm:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#17402C] text-white flex flex-col items-center justify-center shadow-md">
            <span className="text-2xl font-black leading-none">
              {bayesianRating > 0 ? bayesianRating.toFixed(1) : '-'}
            </span>
            <span className="text-[10px] font-semibold text-stone-300">/ 5.0</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-stone-900">
              Évaluation Communautaire
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(bayesianRating)
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-stone-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-stone-600">
                ({reviewsCount} avis recueillis)
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Moyenne bayésienne pondérée avec doublement du score pour les retours terrain certifiés.
            </p>
          </div>
        </div>

        <LkvButton
          variant="primary"
          size="sm"
          className="min-h-[44px] flex items-center gap-2 shrink-0"
          onClick={() => setShowForm(!showForm)}
        >
          <MessageSquarePlus className="w-4 h-4" />
          {showForm ? 'Masquer le formulaire' : 'Donner mon avis'}
        </LkvButton>
      </GlassCard>

      {/* Formulaire d'Avis */}
      {showForm && (
        <GlassCard
          tone="neutral"
          blur="lg"
          className="p-6 rounded-[28px] border border-white/80 animate-fade-in"
        >
          <h4 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#17402C]" />
            Votre retour d’expérience terrain
          </h4>

          <form onSubmit={handleSubmitReview} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Note en étoiles */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Note globale
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-stone-100 transition-colors"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        s <= rating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Date de visite */}
            <div>
              <label
                htmlFor="visit-date"
                className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
              >
                Date de passage (facultatif)
              </label>
              <input
                type="date"
                id="visit-date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full sm:w-64 h-11 px-3.5 rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
              />
            </div>

            {/* Commentaire */}
            <div>
              <label
                htmlFor="review-comment"
                className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
              >
                Observations, état du site, eau, accessibilité
              </label>
              <textarea
                id="review-comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Décrivez l'état actuel de la source, la propreté du bivouac, l'accueil du gardien..."
                className="w-full p-3.5 rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                required
              />
            </div>

            {/* Certification Terrain */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#5B7F55]/10 border border-[#5B7F55]/20">
              <input
                type="checkbox"
                id="field-proof"
                checked={hasFieldProof}
                onChange={(e) => setHasFieldProof(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-[#17402C] focus:ring-[#17402C]"
              />
              <label htmlFor="field-proof" className="text-xs text-stone-700 cursor-pointer">
                <strong className="text-stone-900 font-semibold block">
                  Preuve de passage sur le terrain
                </strong>
                J’atteste m’être rendu personnellement sur ce site. Mon avis aura un coefficient double dans le calcul bayésien du lieu.
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <LkvButton
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-[44px]"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </LkvButton>
              <LkvButton
                type="submit"
                variant="primary"
                size="sm"
                className="min-h-[44px]"
                disabled={isPending}
              >
                {isPending ? 'Enregistrement...' : 'Publier mon avis certifié'}
              </LkvButton>
            </div>
          </form>
        </GlassCard>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Liste des Avis */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
          Avis des randonneurs ({reviews.length})
        </h4>

        {reviews.length === 0 ? (
          <div className="p-8 rounded-[24px] bg-stone-50 border border-stone-200/60 text-center">
            <p className="text-sm text-stone-600">
              Soyez le premier randonneur à certifier les conditions de ce lieu !
            </p>
          </div>
        ) : (
          reviews.map((rev) => (
            <GlassCard
              key={rev.id}
              tone="neutral"
              blur="sm"
              className="p-5 rounded-[22px] border border-stone-200/70"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                        }`}
                      />
                    ))}
                  </div>

                  {rev.has_field_proof && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#17402C] bg-[#5B7F55]/15 px-2.5 py-0.5 rounded-full border border-[#5B7F55]/20">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#17402C]" />
                      Preuve terrain certifiée
                    </span>
                  )}
                </div>

                {rev.visit_date && (
                  <span className="text-[11px] text-stone-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    Visité le {rev.visit_date}
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                {rev.comment}
              </p>
            </GlassCard>
          ))
        )}
      </div>
    </section>
  );
}
