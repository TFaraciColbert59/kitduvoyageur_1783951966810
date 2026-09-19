'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import { Footprints, Car, Bus, Train, Plane, Ship, Bike, Compass } from 'lucide-react';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { GlassModal } from '@/components/ui/GlassModal';
import type { PlannerStep } from './plannerEngine';

export interface StepEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stepData: Partial<PlannerStep>) => Promise<void>;
  initialStep?: PlannerStep | null;
  dayNumber: number;
}

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
    <GlassModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${initialStep ? 'Modifier l’étape' : 'Ajouter une étape'} (Jour ${initialStep ? initialStep.day_number : dayNumber})`}
      variant="centered"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {error && (
            <div className="p-3 rounded-xl glass tone-danger border text-xs text-[var(--lkv-danger)]">
              {error}
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
              Titre de l’étape *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Montée au refuge du glacier"
              required
              className="glass-input w-full px-3.5 py-2.5 text-sm text-[var(--lkv-text-primary)]"
            />
          </div>

          {/* Moyen de transport */}
          <div>
            <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1.5">
              Mode de transport / Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {transportModesList.map(({ id, label, Icon }) => {
                const isSelected = transportMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTransportMode(id)}
                    className={`glass-capsule-btn flex items-center gap-1.5 !px-3 !py-1.5 text-xs font-medium transition-all ${
                      isSelected ? 'primary shadow-sm' : ''
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horaires */}
          <div>
            <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1.5">
              Heure de passage (roadbook)
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="Heure de passage de l'étape"
              className="glass-input w-full px-3.5 py-2.5 text-sm text-[var(--lkv-text-primary)]"
            />
          </div>

          {/* Lieu & Hébergement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                Lieu / Destination
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Ex: Refuge des Écrins"
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                Hébergement
              </label>
              <input
                type="text"
                value={accommodationName}
                onChange={(e) => setAccommodationName(e.target.value)}
                placeholder="Ex: Bivouac sous tente"
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>
          </div>

          {/* Distance & Dénivelés */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="0"
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                D+ (mètres)
              </label>
              <input
                type="number"
                min="0"
                value={elevationGainM}
                onChange={(e) => setElevationGainM(e.target.value)}
                placeholder="0"
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                D- (mètres)
              </label>
              <input
                type="number"
                min="0"
                value={elevationLossM}
                onChange={(e) => setElevationLossM(e.target.value)}
                placeholder="0"
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
              Description / Conseils
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conseils d'accès, horaires de départ conseillés..."
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/40">
            <GlassCapsuleBtn variant="default" size="sm" type="button" onClick={onClose}>
              Annuler
            </GlassCapsuleBtn>
            <GlassCapsuleBtn variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </GlassCapsuleBtn>
          </div>
        </form>
    </GlassModal>
  );
}
