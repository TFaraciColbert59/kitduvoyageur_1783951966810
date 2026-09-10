'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { AddPlaceToTripModal, type UserTripOption } from './AddPlaceToTripModal';
import { ReportPlaceModal } from './ReportPlaceModal';
import { PlaceReviewSection } from './PlaceReviewSection';
import { getCategoryLabel, getCategoryIcon } from './PlaceCard';
import type { PlaceWithDistance, PlaceReview, PlacePhoto } from '../types/place.types';

export interface PlaceDetailClientProps {
  place: PlaceWithDistance;
  reviews: PlaceReview[];
  photos: PlacePhoto[];
  userTrips: UserTripOption[];
}

export function PlaceDetailClient({ place, reviews, photos, userTrips }: PlaceDetailClientProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const Icon = getCategoryIcon(place.category);
  const categoryLabel = getCategoryLabel(place.category);
  const info = place.practical_info || {};

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Bouton Retour */}
      <div>
        <Link
          href="/lieux"
          className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors py-2"
        >
          <Icon name="arrow-left" className="w-4 h-4" />
          Retour aux lieux et topos
        </Link>
      </div>

      {/* Hero du Lieu */}
      <GlassCard
        tone="neutral"
        blur="md"
        className="p-6 sm:p-8 rounded-2xl border border-white/70 shadow-sm relative overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-[#17402C]/10 text-[#17402C] border border-[#17402C]/15">
              <Icon className="w-4 h-4 text-[#5B7F55]" />
              {categoryLabel}
            </span>

            {place.altitude_m && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                <Icon name="mountain" className="w-3.5 h-3.5 text-stone-500" />
                {place.altitude_m} m
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {place.is_verified && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#17402C] bg-[#5B7F55]/15 px-3 py-1 rounded-full border border-[#5B7F55]/20">
                <Icon name="shield-check" className="w-3.5 h-3.5 text-[#17402C]" />
                Lieu vérifié terrain
              </span>
            )}
            <span className="text-xs font-black text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200 uppercase">
              {place.country_code}
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight mb-2">
          {place.name}
        </h1>

        <div className="flex items-center gap-2 text-sm text-stone-600 mb-6">
          <Icon name="map-pin" className="w-4 h-4 text-[#5B7F55] shrink-0" />
          <span>
            {place.city ? `${place.city}, ` : ''}
            {place.region ? `${place.region}, ` : ''}
            {place.country_code}
          </span>
        </div>

        {/* Alerte Floutage Éthique */}
        {place.is_blurred && (
          <div className="mb-6 p-4 rounded-2xl bg-sand-50 border border-sand-200/80 text-sand-900 text-xs sm:text-sm flex items-start gap-3">
            <Icon name="shield-alert" className="w-5 h-5 text-sand-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold block">
                Préservation de la biodiversité & sécurité physique (Charte LKDV §5.7)
              </strong>
              <p className="text-xs text-sand-800/90 leading-relaxed">
                Ce spot fragile fait l’objet d’un floutage serveur systématique à ~500 m
                (coordonnées arrondies à 2 décimales) afin de prévenir le surbivouac et protéger les
                écosystèmes montagnards.
              </p>
            </div>
          </div>
        )}

        {/* Actions Principales */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-stone-200/60">
          <LkvButton
            variant="primary"
            className="flex-1 flex items-center justify-center gap-2 min-h-[48px] font-bold"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Icon name="plus" className="w-4 h-4" />
            Ajouter à mon voyage
          </LkvButton>

          <LkvButton
            variant="secondary"
            className="flex items-center justify-center gap-2 min-h-[48px] text-xs text-stone-600"
            onClick={() => setIsReportModalOpen(true)}
          >
            <Icon name="alert-triangle" className="w-4 h-4 text-stone-500" />
            Signaler un problème
          </LkvButton>
        </div>
      </GlassCard>

      {/* Description */}
      {place.description && (
        <GlassCard
          tone="neutral"
          blur="sm"
          className="p-6 sm:p-7 rounded-card border border-white/60"
        >
          <h2 className="text-base font-bold text-stone-900 mb-3 flex items-center gap-2">
            <Icon name="compass" className="w-4 h-4 text-[#17402C]" />
            Présentation & Caractéristiques
          </h2>
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
            {place.description}
          </p>
        </GlassCard>
      )}

      {/* Informations Pratiques */}
      <GlassCard
        tone="neutral"
        blur="sm"
        className="p-6 sm:p-7 rounded-card border border-white/60"
      >
        <h2 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
          <Icon name="calendar" className="w-4 h-4 text-[#17402C]" />
          Informations Pratiques & Équipements
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Eau */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
            <Icon name="droplet" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
            <div>
              <span className="text-stone-500 font-semibold block">Eau potable / Source</span>
              <strong className="text-stone-900 text-sm">
                {info.waterAvailable === true
                  ? 'Disponible'
                  : info.waterAvailable === false
                    ? 'Non disponible (filtrage requis)'
                    : 'À vérifier sur place'}
              </strong>
            </div>
          </div>

          {/* Accès & Frais */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
            <Icon name="users" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
            <div>
              <span className="text-stone-500 font-semibold block">Accès / Tarifs</span>
              <strong className="text-stone-900 text-sm">
                {info.feesRequired ? 'Payant / Taxe de séjour' : 'Accès libre'}
                {info.bookingRequired ? ' (Réservation obligatoire)' : ''}
              </strong>
            </div>
          </div>

          {/* Saison */}
          {info.openingSeason && (
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
              <Icon name="calendar" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
              <div>
                <span className="text-stone-500 font-semibold block">Période gardée / Saison</span>
                <strong className="text-stone-900 text-sm">{info.openingSeason}</strong>
              </div>
            </div>
          )}

          {/* Capacité */}
          {info.capacity && (
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
              <Icon name="mountain" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
              <div>
                <span className="text-stone-500 font-semibold block">Capacité d’accueil</span>
                <strong className="text-stone-900 text-sm">{info.capacity} places</strong>
              </div>
            </div>
          )}

          {/* Feux */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
            <Icon name="flame" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
            <div>
              <span className="text-stone-500 font-semibold block">Feux de camp</span>
              <strong className="text-stone-900 text-sm">
                {info.fireAllowed ? 'Tolérés avec prudence' : 'Strictement interdits'}
              </strong>
            </div>
          </div>

          {/* Coordonnées */}
          <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
            <Icon name="map-pin" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
            <div>
              <span className="text-stone-500 font-semibold block">
                Position GPS {place.is_blurred ? '(floutée ~500m)' : '(précise)'}
              </span>
              <strong className="text-stone-900 text-xs font-mono">
                {place.latitude.toFixed(place.is_blurred ? 2 : 5)},{' '}
                {place.longitude.toFixed(place.is_blurred ? 2 : 5)}
              </strong>
            </div>
          </div>

          {/* Téléphone si renseigné */}
          {info.phone && (
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
              <Icon name="phone" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
              <div>
                <span className="text-stone-500 font-semibold block">Contact téléphonique</span>
                <a
                  href={`tel:${info.phone}`}
                  className="text-stone-900 text-sm font-semibold hover:underline"
                >
                  {info.phone}
                </a>
              </div>
            </div>
          )}

          {/* Site Web si renseigné */}
          {info.website && (
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/60 flex items-start gap-3">
              <Icon name="globe" className="w-4 h-4 text-[#5B7F55] shrink-0 mt-0.5" />
              <div>
                <span className="text-stone-500 font-semibold block">Site officiel</span>
                <a
                  href={info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#17402C] text-sm font-semibold hover:underline truncate block max-w-[200px]"
                >
                  Consulter
                </a>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Galerie Photos si présente */}
      {photos.length > 0 && (
        <GlassCard
          tone="neutral"
          blur="sm"
          className="p-6 sm:p-7 rounded-card border border-white/60"
        >
          <h2 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
            <Icon name="compass" className="w-4 h-4 text-[#17402C]" />
            Photos Communautaires ({photos.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-video rounded-2xl overflow-hidden bg-stone-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || place.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Avis & Preuve de Terrain */}
      <PlaceReviewSection
        placeId={place.id}
        initialReviews={reviews}
        bayesianRating={place.bayesian_rating}
        reviewsCount={place.reviews_count}
      />

      {/* Modales */}
      <AddPlaceToTripModal
        place={place}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        userTrips={userTrips}
      />

      <ReportPlaceModal
        placeId={place.id}
        placeName={place.name}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
