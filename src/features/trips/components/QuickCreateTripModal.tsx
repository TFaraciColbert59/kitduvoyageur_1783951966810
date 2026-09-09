'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { LkvInput } from '@/components/ui/LkvInput';
import { Compass, AlertCircle } from 'lucide-react';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import {
  createTripSchema,
  type CreateTripInput,
} from '../schemas/trip.schema';
import type {
  TripActivityType,
  TripDifficulty,
  TripVisibility,
} from '../types/trip.types';

export interface QuickCreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTrip?: (input: CreateTripInput) => Promise<{ slug: string }>;
}

export function QuickCreateTripModal({
  isOpen,
  onClose,
  onSubmitTrip,
}: QuickCreateTripModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activity, setActivity] = useState<TripActivityType>('hiking');
  const [difficulty, setDifficulty] = useState<TripDifficulty>('moderate');
  const [visibility, setVisibility] = useState<TripVisibility>('private');
  const [estimatedBudget, setEstimatedBudget] = useState('');

  if (!isOpen) return null;

  /** Étape 2 — Hub unique : le voyage créé devient l'aventure active du hub. */
  const activateAndOpen = async (slug: string) => {
    await setActiveAdventureAction({
      nature: 'sortie',
      id: slug,
      slug,
      title: title.trim() || 'Nouvelle aventure',
    });
    router.push(tripSectionHref(slug, 'overview'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      title: title.trim(),
      destination_name: destinationName.trim() || undefined,
      destination_country_code: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      primary_activity: activity,
      difficulty,
      visibility,
      estimated_budget: estimatedBudget ? Number(estimatedBudget) : undefined,
    };

    const validation = createTripSchema.safeParse(payload);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || 'Données du formulaire invalides');
      return;
    }

    setLoading(true);
    try {
      if (onSubmitTrip) {
        const res = await onSubmitTrip(validation.data as CreateTripInput);
        onClose();
        await activateAndOpen(res.slug);
      } else {
        // Envoi vers l'API de création
        const response = await fetch('/api/voyages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validation.data),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de la création du voyage');
        }
        const created = await response.json();
        onClose();
        await activateAndOpen(created.slug);
      }
    } catch (err: any) {
      setFormError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassModal open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }} title="Créer un nouveau voyage" variant="sheet">
      <div className="pb-2">
        {/* Error alert */}
        {formError && (
          <div className="p-3 mb-4 rounded-xl glass tone-danger border text-xs text-[var(--lkv-danger)] flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <LkvInput
              label="Titre de l'expédition *"
              placeholder="ex: Traversée des Pyrénées en autonomie"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LkvInput
                label="Destination"
                placeholder="ex: Gavarnie, Hautes-Pyrénées"
                value={destinationName}
                onChange={e => setDestinationName(e.target.value)}
              />
              <LkvInput
                label="Code Pays (ISO 2 lettres)"
                placeholder="ex: FR, ES, NO..."
                maxLength={2}
                value={countryCode}
                onChange={e => setCountryCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LkvInput
                type="date"
                label="Date de début"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <LkvInput
                type="date"
                label="Date de fin"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-lkv-primary block mb-1.5">
                  Activité
                </label>
                <select
                  value={activity}
                  onChange={e => setActivity(e.target.value as TripActivityType)}
                  className="glass-input w-full px-3 py-2.5 text-[16px] sm:text-sm text-[var(--lkv-text-primary)] cursor-pointer"
                >
                  <option value="hiking">Randonnée</option>
                  <option value="trekking">Trek</option>
                  <option value="bivouac">Bivouac</option>
                  <option value="roadtrip">Roadtrip</option>
                  <option value="cultural">Culture</option>
                  <option value="bushcraft">Bushcraft</option>
                  <option value="mixed">Mixte</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-lkv-primary block mb-1.5">
                  Difficulté
                </label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as TripDifficulty)}
                  className="glass-input w-full px-3 py-2.5 text-[16px] sm:text-sm text-[var(--lkv-text-primary)] cursor-pointer"
                >
                  <option value="easy">Facile</option>
                  <option value="moderate">Modéré</option>
                  <option value="hard">Difficile</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-lkv-primary block mb-1.5">
                  Visibilité
                </label>
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value as TripVisibility)}
                  className="glass-input w-full px-3 py-2.5 text-[16px] sm:text-sm text-[var(--lkv-text-primary)] cursor-pointer"
                >
                  <option value="private">Privé</option>
                  <option value="unlisted">Lien partagé</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <LkvInput
              type="number"
              min={0}
              step="any"
              label="Budget prévisionnel (€)"
              placeholder="ex: 350"
              value={estimatedBudget}
              onChange={e => setEstimatedBudget(e.target.value)}
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/40">
              <GlassCapsuleBtn
                variant="default"
                type="button"
                onClick={onClose}
                disabled={loading}
              >
                Annuler
              </GlassCapsuleBtn>
              <GlassCapsuleBtn
                variant="primary"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Création...' : 'Créer l’expédition'}
              </GlassCapsuleBtn>
            </div>
          </form>
      </div>
    </GlassModal>
  );
}
