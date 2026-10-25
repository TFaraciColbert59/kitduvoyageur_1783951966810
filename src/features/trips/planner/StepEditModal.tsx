'use client';

import React, { useState, useEffect } from 'react';
import { Footprints, Car, Bus, Train, Plane, Ship, Bike, Compass } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button, Card, Chip } from '@/components/ui';
import type { PlannerStep } from './plannerEngine';

export interface StepEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stepData: Partial<PlannerStep>) => Promise<void>;
  initialStep?: PlannerStep | null;
  dayNumber: number;
}

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

const transportModesList = [
  { id: 'walking', label: 'À pied', Icon: Footprints },
  { id: 'hiking', label: 'Rando', Icon: Footprints },
  { id: 'car', label: 'Voiture', Icon: Car },
  { id: 'bus', label: 'Bus', Icon: Bus },
  { id: 'train', label: 'Train', Icon: Train },
  { id: 'flight', label: 'Vol', Icon: Plane },
  { id: 'boat', label: 'Bateau', Icon: Ship },
  { id: 'bike', label: 'Vélo', Icon: Bike },
  { id: 'other', label: 'Autre', Icon: Compass },
] as const;

export function StepEditModal({
  isOpen,
  onClose,
  onSave,
  initialStep,
  dayNumber,
}: StepEditModalProps) {
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [transportMode, setTransportMode] = useState<string>('walking');
  const [startTime, setStartTime] = useState<string>('');
  const [accommodationName, setAccommodationName] = useState('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [elevationGainM, setElevationGainM] = useState<string>('');
  const [elevationLossM, setElevationLossM] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStep) {
      setTitle(initialStep.title || '');
      setLocationName(initialStep.location_name || '');
      setDescription(initialStep.description || '');
      setTransportMode(initialStep.transport_mode || 'walking');
      setStartTime(initialStep.start_time ? initialStep.start_time.slice(0, 5) : '');
      setAccommodationName(initialStep.accommodation_name || '');
      setDistanceKm(initialStep.distance_km != null ? String(initialStep.distance_km) : '');
      setElevationGainM(
        initialStep.elevation_gain_m != null ? String(initialStep.elevation_gain_m) : ''
      );
      setElevationLossM(
        initialStep.elevation_loss_m != null ? String(initialStep.elevation_loss_m) : ''
      );
    } else {
      setTitle('');
      setLocationName('');
      setDescription('');
      setTransportMode('walking');
      setStartTime('');
      setAccommodationName('');
      setDistanceKm('');
      setElevationGainM('');
      setElevationLossM('');
    }
    setError(null);
  }, [initialStep, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre de l’étape est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        id: initialStep?.id,
        day_number: initialStep ? initialStep.day_number : dayNumber,
        title: title.trim(),
        location_name: locationName.trim() || null,
        description: description.trim() || null,
        transport_mode: transportMode || null,
        start_time: startTime || null,
        accommodation_name: accommodationName.trim() || null,
        distance_km: distanceKm ? parseFloat(distanceKm) : null,
        elevation_gain_m: elevationGainM ? parseInt(elevationGainM, 10) : null,
        elevation_loss_m: elevationLossM ? parseInt(elevationLossM, 10) : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${initialStep ? 'Modifier l’étape' : 'Ajouter une étape'} (Jour ${initialStep ? initialStep.day_number : dayNumber})`}
    >
      <form onSubmit={handleSubmit} className="space-y-[var(--space-4)] pr-1">
        {error && (
          <Card
            tone="danger"
            className="p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
          >
            {error}
          </Card>
        )}

        {/* Titre */}
        <div>
          <label className={LABEL_CLASS}>Titre de l’étape *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Montée au refuge du glacier"
            required
            className={FIELD_CLASS}
          />
        </div>

        {/* Moyen de transport */}
        <div>
          <label className={LABEL_CLASS}>Mode de transport / Type</label>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {transportModesList.map(({ id, label, Icon }) => {
              const isSelected = transportMode === id;
              return (
                <Chip
                  key={id}
                  selected={isSelected}
                  icon={<Icon className="h-3.5 w-3.5" />}
                  onClick={() => setTransportMode(id)}
                >
                  {label}
                </Chip>
              );
            })}
          </div>
        </div>

        {/* Horaires */}
        <div>
          <label className={LABEL_CLASS}>Heure de passage (roadbook)</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-label="Heure de passage de l'étape"
            className={FIELD_CLASS}
          />
        </div>

        {/* Lieu & Hébergement */}
        <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS}>Lieu / Destination</label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Ex: Refuge des Écrins"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Hébergement</label>
            <input
              type="text"
              value={accommodationName}
              onChange={(e) => setAccommodationName(e.target.value)}
              placeholder="Ex: Bivouac sous tente"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        {/* Distance & Dénivelés */}
        <div className="grid grid-cols-3 gap-[var(--space-2)] sm:gap-[var(--space-3)]">
          <div>
            <label className={LABEL_CLASS}>Distance (km)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="0"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>D+ (mètres)</label>
            <input
              type="number"
              min="0"
              value={elevationGainM}
              onChange={(e) => setElevationGainM(e.target.value)}
              placeholder="0"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>D- (mètres)</label>
            <input
              type="number"
              min="0"
              value={elevationLossM}
              onChange={(e) => setElevationLossM(e.target.value)}
              placeholder="0"
              className={FIELD_CLASS}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={LABEL_CLASS}>Description / Conseils</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Conseils d'accès, horaires de départ conseillés..."
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)]">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
