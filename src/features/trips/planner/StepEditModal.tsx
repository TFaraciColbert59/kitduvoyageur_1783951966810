'use client';

import React, { useState, useEffect } from 'react';
import { X, Footprints, Car, Bus, Train, Plane, Ship, Bike, Compass } from 'lucide-react';
import { LkvButton } from '@/components/ui/LkvButton';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full sm:max-w-lg bg-surface-card border border-border/60 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800">
              Jour {initialStep ? initialStep.day_number : dayNumber}
            </span>
            <h3 className="font-bold text-base sm:text-lg text-text-primary">
              {initialStep ? 'Modifier l’étape' : 'Ajouter une étape'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-subtle text-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire défilant */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Titre de l’étape *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Montée au refuge du glacier"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800"
            />
          </div>

          {/* Moyen de transport */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-forest-900 text-white shadow-sm'
                        : 'bg-surface-subtle text-text-secondary hover:text-text-primary border border-border/30'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lieu & Hébergement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Lieu / Destination
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Ex: Refuge des Écrins"
                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Hébergement
              </label>
              <input
                type="text"
                value={accommodationName}
                onChange={(e) => setAccommodationName(e.target.value)}
                placeholder="Ex: Bivouac sous tente"
                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
          </div>

          {/* Distance & Dénivelés */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                D+ (mètres)
              </label>
              <input
                type="number"
                min="0"
                value={elevationGainM}
                onChange={(e) => setElevationGainM(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                D- (mètres)
              </label>
              <input
                type="number"
                min="0"
                value={elevationLossM}
                onChange={(e) => setElevationLossM(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Description / Conseils
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conseils d'accès, horaires de départ conseillés..."
              className="w-full px-3 py-2 rounded-xl border border-border/60 bg-surface-subtle/40 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition-colors min-h-[42px]"
            >
              Annuler
            </button>
            <LkvButton
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              className="min-h-[42px] px-5"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </LkvButton>
          </div>
        </form>
      </div>
    </div>
  );
}
