'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/ui/Sheet';
import { Button, Card } from '@/components/ui';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import { createTripSchema, type CreateTripInput } from '../schemas/trip.schema';
import type { TripActivityType, TripDifficulty, TripVisibility } from '../types/trip.types';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1.5 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

export interface QuickCreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTrip?: (input: CreateTripInput) => Promise<{ slug: string }>;
}

export function QuickCreateTripModal({ isOpen, onClose, onSubmitTrip }: QuickCreateTripModalProps) {
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
    <Sheet
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Créer un nouveau voyage"
    >
      <div className="pb-2">
        {/* Error alert */}
        {formError && (
          <Card
            role="alert"
            tone="danger"
            className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
          >
            <Icon name="alert-circle" size={16} />
            <span>{formError}</span>
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-[var(--space-4)]">
          <label className="block">
            <span className={LABEL_CLASS}>Titre de l&apos;expédition *</span>
            <input
              type="text"
              placeholder="ex: Traversée des Pyrénées en autonomie"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={FIELD_CLASS}
            />
          </label>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <label className="block">
              <span className={LABEL_CLASS}>Destination</span>
              <input
                type="text"
                placeholder="ex: Gavarnie, Hautes-Pyrénées"
                value={destinationName}
                onChange={(e) => setDestinationName(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Code Pays (ISO 2 lettres)</span>
              <input
                type="text"
                placeholder="ex: FR, ES, NO..."
                maxLength={2}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <label className="block">
              <span className={LABEL_CLASS}>Date de début</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Date de fin</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
            <label className="block">
              <span className={LABEL_CLASS}>Activité</span>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value as TripActivityType)}
                className={`${FIELD_CLASS} cursor-pointer`}
              >
                <option value="hiking">Randonnée</option>
                <option value="trekking">Trek</option>
                <option value="bivouac">Bivouac</option>
                <option value="roadtrip">Roadtrip</option>
                <option value="cultural">Culture</option>
                <option value="bushcraft">Bushcraft</option>
                <option value="mixed">Mixte</option>
              </select>
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Difficulté</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as TripDifficulty)}
                className={`${FIELD_CLASS} cursor-pointer`}
              >
                <option value="easy">Facile</option>
                <option value="moderate">Modéré</option>
                <option value="hard">Difficile</option>
                <option value="expert">Expert</option>
              </select>
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Visibilité</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as TripVisibility)}
                className={`${FIELD_CLASS} cursor-pointer`}
              >
                <option value="private">Privé</option>
                <option value="unlisted">Lien partagé</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className={LABEL_CLASS}>Budget prévisionnel (€)</span>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="ex: 350"
              value={estimatedBudget}
              onChange={(e) => setEstimatedBudget(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)]">
            <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" loading={loading}>
              {loading ? 'Création...' : 'Créer l’expédition'}
            </Button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}
