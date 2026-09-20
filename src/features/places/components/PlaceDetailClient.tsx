'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import { AddPlaceToTripModal, type UserTripOption } from './AddPlaceToTripModal';
import { ReportPlaceModal } from './ReportPlaceModal';
import { PlaceReviewSection } from './PlaceReviewSection';
import { getCategoryLabel, getCategoryIcon } from '../lib/placeCategory';
import type { PlaceWithDistance, PlaceReview, PlacePhoto } from '../types/place.types';

export interface PlaceDetailClientProps {
  place: PlaceWithDistance;
  reviews: PlaceReview[];
  photos: PlacePhoto[];
  userTrips: UserTripOption[];
}

interface InfoTileProps {
  icon: string;
  label: React.ReactNode;
  children: React.ReactNode;
}

function InfoTile({ icon, label, children }: InfoTileProps) {
  return (
    <Card variant="compact" className="flex items-start gap-3 p-3.5">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--lkv-primary)]" />
      <div>
        <span className="block font-semibold text-[color:var(--lkv-text-muted)]">{label}</span>
        <strong className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)]">
          {children}
        </strong>
      </div>
    </Card>
  );
}

export function PlaceDetailClient({ place, reviews, photos, userTrips }: PlaceDetailClientProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const CategoryIcon = getCategoryIcon(place.category);
  const categoryLabel = getCategoryLabel(place.category);
  const info = place.practical_info || {};

  return (
    <div className="mx-auto max-w-4xl space-y-[var(--space-6)] pb-[var(--space-16)]">
      {/* Bouton Retour */}
      <div>
        <Link
          href="/lieux"
          className="inline-flex items-center gap-2 py-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-muted)] no-underline transition-colors hover:text-[color:var(--lkv-text-primary)]"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
          Retour aux lieux et topos
        </Link>
      </div>

      {/* Hero du Lieu */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="mb-[var(--space-4)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="sage" className="gap-1.5">
              <CategoryIcon className="h-4 w-4 text-[color:var(--lkv-primary)]" />
              {categoryLabel}
            </Badge>

            {place.altitude_m && (
              <Badge tone="stone" className="gap-1">
                <Icon name="mountain" className="h-3.5 w-3.5" />
                {place.altitude_m} m
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {place.is_verified && (
              <Badge tone="sage" className="gap-1">
                <Icon name="shield-check" className="h-3.5 w-3.5 text-[color:var(--lkv-primary)]" />
                Lieu vérifié terrain
              </Badge>
            )}
            <Badge tone="stone" className="uppercase">{place.country_code}</Badge>
          </div>
        </div>

        <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-lg)] font-bold tracking-tight text-[color:var(--lkv-text-primary)]">
          {place.name}
        </h1>

        <div className="mb-[var(--space-6)] flex items-center gap-2 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">
          <Icon name="map-pin" className="h-4 w-4 shrink-0 text-[color:var(--lkv-primary)]" />
          <span>
            {place.city ? `${place.city}, ` : ''}
            {place.region ? `${place.region}, ` : ''}
            {place.country_code}
          </span>
        </div>

        {/* Alerte Floutage Éthique */}
        {place.is_blurred && (
          <Card tone="warn" className="mb-[var(--space-6)] flex items-start gap-3 p-[var(--space-4)]">
            <Icon name="shield-alert" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--lkv-warning-dark)]" />
            <div className="space-y-1">
              <strong className="block font-bold">
                Préservation de la biodiversité & sécurité physique (Charte LKDV §5.7)
              </strong>
              <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                Ce spot fragile fait l’objet d’un floutage serveur systématique à ~500 m
                (coordonnées arrondies à 2 décimales) afin de prévenir le surbivouac et protéger les
                écosystèmes montagnards.
              </p>
            </div>
          </Card>
        )}

        {/* Actions Principales */}
        <div className="flex flex-col gap-3 border-t border-[color:var(--lkv-border)] pt-[var(--space-2)] sm:flex-row">
          <Button
            variant="primary"
            className="min-h-[48px] flex-1 gap-2 font-bold"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Icon name="plus" className="h-4 w-4" />
            Ajouter à mon voyage
          </Button>

          <Button
            variant="secondary"
            className="min-h-[48px] gap-2"
            onClick={() => setIsReportModalOpen(true)}
          >
            <Icon name="alert-triangle" className="h-4 w-4 text-[color:var(--lkv-warning-dark)]" />
            Signaler un problème
          </Button>
        </div>
      </Card>

      {/* Description */}
      {place.description && (
        <Card className="p-6 sm:p-7">
          <h2 className="mb-[var(--space-3)] flex items-center gap-2 text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
            <Icon name="compass" className="h-4 w-4 text-[color:var(--lkv-primary)]" />
            Présentation & Caractéristiques
          </h2>
          <p className="whitespace-pre-line text-[length:var(--lkv-text-body-sm)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
            {place.description}
          </p>
        </Card>
      )}

      {/* Informations Pratiques */}
      <Card className="p-6 sm:p-7">
        <h2 className="mb-[var(--space-4)] flex items-center gap-2 text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
          <Icon name="calendar" className="h-4 w-4 text-[color:var(--lkv-primary)]" />
          Informations Pratiques & Équipements
        </h2>

        <div className="grid grid-cols-1 gap-4 text-[length:var(--lkv-text-caption)] sm:grid-cols-2 lg:grid-cols-3">
          {/* Eau */}
          <InfoTile icon="droplet" label="Eau potable / Source">
            {info.waterAvailable === true
              ? 'Disponible'
              : info.waterAvailable === false
                ? 'Non disponible (filtrage requis)'
                : 'À vérifier sur place'}
          </InfoTile>

          {/* Accès & Frais */}
          <InfoTile icon="users" label="Accès / Tarifs">
            {info.feesRequired ? 'Payant / Taxe de séjour' : 'Accès libre'}
            {info.bookingRequired ? ' (Réservation obligatoire)' : ''}
          </InfoTile>

          {/* Saison */}
          {info.openingSeason && (
            <InfoTile icon="calendar" label="Période gardée / Saison">
              {info.openingSeason}
            </InfoTile>
          )}

          {/* Capacité */}
          {info.capacity && (
            <InfoTile icon="mountain" label="Capacité d’accueil">
              {info.capacity} places
            </InfoTile>
          )}

          {/* Feux */}
          <InfoTile icon="flame" label="Feux de camp">
            {info.fireAllowed ? 'Tolérés avec prudence' : 'Strictement interdits'}
          </InfoTile>

          {/* Coordonnées */}
          <InfoTile icon="map-pin" label={<>Position GPS {place.is_blurred ? '(floutée ~500m)' : '(précise)'}</>}>
            <span className="font-mono text-[length:var(--lkv-text-caption)]">
              {place.latitude.toFixed(place.is_blurred ? 2 : 5)},{' '}
              {place.longitude.toFixed(place.is_blurred ? 2 : 5)}
            </span>
          </InfoTile>

          {/* Téléphone si renseigné */}
          {info.phone && (
            <InfoTile icon="phone" label="Contact téléphonique">
              <a
                href={`tel:${info.phone}`}
                className="font-semibold text-[color:var(--lkv-text-primary)] hover:underline"
              >
                {info.phone}
              </a>
            </InfoTile>
          )}

          {/* Site Web si renseigné */}
          {info.website && (
            <InfoTile icon="globe" label="Site officiel">
              <a
                href={info.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-[200px] truncate font-semibold text-[color:var(--lkv-primary)] hover:underline"
              >
                Consulter
              </a>
            </InfoTile>
          )}
        </div>
      </Card>

      {/* Galerie Photos si présente */}
      {photos.length > 0 && (
        <Card className="p-6 sm:p-7">
          <h2 className="mb-[var(--space-4)] flex items-center gap-2 text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
            <Icon name="compass" className="h-4 w-4 text-[color:var(--lkv-primary)]" />
            Photos Communautaires ({photos.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-video overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || place.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </Card>
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
