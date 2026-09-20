'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button, Card, Chip, IconButton } from '@/components/ui';
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
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[color:var(--lkv-overlay-scrim)] p-4 backdrop-blur-[var(--blur-sm)]">
      <div className="w-full max-w-lg">
        <Card className="relative p-6 sm:p-7">
          {/* Close button */}
          <IconButton
            variant="ghost"
            size="md"
            onClick={handleResetAndClose}
            className="absolute right-3 top-3"
            aria-label="Fermer"
          >
            <Icon name="x" className="h-5 w-5" />
          </IconButton>

          {/* Modal Header */}
          <div className="mb-[var(--space-5)] pr-8">
            <span className="text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
              Intégration d’Itinéraire
            </span>
            <h2 className="mt-1 font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              Ajouter à un Voyage
            </h2>
            <p className="mt-1 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
              Intégrez <strong className="text-[color:var(--lkv-text-primary)]">{place.name}</strong> comme étape ou point
              d’intérêt.
            </p>
          </div>

          {/* Success State */}
          {successResult ? (
            <div className="py-[var(--space-4)] text-center">
              <div className="mx-auto mb-[var(--space-3)] flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-primary)]">
                <Icon name="check-circle2" className="h-6 w-6" />
              </div>
              <h3 className="mb-[var(--space-1)] text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
                Lieu ajouté avec succès !
              </h3>
              <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
                Le lieu a été inséré dans votre journée {selectedDay} et ajouté à votre kit de
                préparation.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={`/voyages/${successResult.tripSlug}/itineraire`} className="flex-1 no-underline">
                  <Button
                    variant="primary"
                    fullWidth
                    className="gap-2"
                  >
                    Voir l’itinéraire
                    <Icon name="arrow-right" className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleResetAndClose}
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-[var(--space-4)]">
              {errorMsg && (
                <Card tone="danger" className="flex items-center gap-2 p-[var(--space-3)] text-[length:var(--lkv-text-caption-1)]">
                  <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </Card>
              )}

              {userTrips.length === 0 ? (
                <Card variant="compact" className="p-[var(--space-4)] text-center">
                  <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
                    Vous n’avez aucun voyage en cours de préparation.
                  </p>
                  <Link href="/voyages/nouveau" className="no-underline">
                    <Button variant="primary" size="sm">
                      Créer un nouveau voyage
                    </Button>
                  </Link>
                </Card>
              ) : (
                <>
                  {/* Select Trip */}
                  <div>
                    <label
                      htmlFor="trip-select"
                      className="mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]"
                    >
                      Choisir le voyage
                    </label>
                    <select
                      id="trip-select"
                      value={selectedTripId}
                      onChange={(e) => handleTripChange(e.target.value)}
                      className="h-11 w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-3.5 text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
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
                    <span className="mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
                      Journée de destination
                    </span>
                    <div className="grid max-h-40 grid-cols-5 gap-2 overflow-y-auto p-1">
                      {Array.from({ length: maxDays }, (_, i) => i + 1).map((day) => (
                        <Chip
                          key={day}
                          selected={selectedDay === day}
                          onClick={() => setSelectedDay(day)}
                          className="w-full justify-center"
                        >
                          Jour {day}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-[var(--space-3)]">
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      disabled={isPending}
                      className="gap-2 font-bold"
                    >
                      {isPending ? (
                        <span>Ajout en cours...</span>
                      ) : (
                        <>
                          <Icon name="plus" className="h-4 w-4" />
                          Confirmer l’ajout au Jour {selectedDay}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
