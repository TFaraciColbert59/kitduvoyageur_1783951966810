'use client';

import Icon from '@/components/ui/Icon';
import Link from 'next/link';
import React, { useState, useTransition } from 'react';
import { Badge, Button, Card, IconButton } from '@/components/ui';
import type { TripFull, TripStep, TripStats } from '../types/trip.types';
import { addExpenseAction } from '@/app/voyages/budget-actions';
import { TripSafetyView } from './TripSafetyView';
import { TripItineraryTab } from './TripItineraryTab';
import { getTripPhaseDetails } from '../engine/temporalPhaseEngine';

export interface TripLiveCockpitViewProps {
  trip: TripFull;
  stats: TripStats;
  dayIndex?: number | null;
  totalDays?: number | null;
}

const FIELD_SUN_CLASS =
  'min-h-[44px] w-full rounded-[var(--lkv-radius-control)] border px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

export function getCurrentStepForDay(steps: TripStep[], dayNumber: number): TripStep | null {
  if (!steps || steps.length === 0) return null;
  const exact = steps.find((s) => s.day_number === dayNumber);
  if (exact) return exact;

  // Si le jour dépasse le nombre d'étapes, fallback sur la dernière étape
  if (dayNumber > steps.length) {
    return steps[steps.length - 1];
  }

  // Sinon première étape
  return steps[0];
}

export function hasVerifiedEmergencyCoordinates(trip: TripFull, step: TripStep | null): boolean {
  if (!step || typeof step.latitude !== 'number' || typeof step.longitude !== 'number') {
    return false;
  }
  const stepAny = step as any;
  if (
    stepAny.source === 'user' ||
    stepAny.source === 'import' ||
    stepAny.is_user_defined === true
  ) {
    return true;
  }
  const meta = (trip.metadata || {}) as Record<string, any>;
  if (
    meta.has_imported_gpx === true ||
    meta.source === 'gpx_import' ||
    meta.has_verified_coordinates === true
  ) {
    return true;
  }
  // RÈGLE Z1.1 / D13 : Tout voyage issu d'un blueprint, template ou auto-généré sans import réel
  // ne doit JAMAIS afficher de coordonnées dans le panneau de secours.
  return false;
}

export function formatEmergencyCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined
): string {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return 'Position non disponible — utilise l’application de ton téléphone pour communiquer ta position exacte au 112';
  }

  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';

  const absLat = Math.abs(lat).toFixed(4);
  const absLng = Math.abs(lng).toFixed(4);

  return `${absLat}° ${latDir}, ${absLng}° ${lngDir}`;
}

export function TripLiveCockpitView({
  trip,
  stats,
  dayIndex = 1,
  totalDays,
}: TripLiveCockpitViewProps) {
  const calculatedTotalDays = totalDays || stats.total_days || trip.steps.length || 1;
  const initialDay = Math.max(1, Math.min(calculatedTotalDays, dayIndex || 1));

  const [activeDay, setActiveDay] = useState<number>(initialDay);
  const [isSunMode, setIsSunMode] = useState<boolean>(false);
  const [showFullItinerary, setShowFullItinerary] = useState<boolean>(false);
  const [showSafetyCheckpoints, setShowSafetyCheckpoints] = useState<boolean>(false);
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);

  // Quick expense form state
  const [isPendingExpense, startExpenseTransition] = useTransition();
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState<string | null>(null);
  const [expenseErrorMsg, setExpenseErrorMsg] = useState<string | null>(null);

  const phaseDetails = getTripPhaseDetails(trip);
  const isFutureTrip = phaseDetails.phase === 'prepare';

  const steps = trip.steps || [];
  const currentStep = getCurrentStepForDay(steps, activeDay);

  const isEmergencyCoordsVerified = hasVerifiedEmergencyCoordinates(trip, currentStep);
  const emergencyCoordsText = isEmergencyCoordsVerified
    ? formatEmergencyCoordinates(currentStep?.latitude, currentStep?.longitude)
    : formatEmergencyCoordinates(null, null);

  const handleCopyCoordinates = () => {
    if (!isEmergencyCoordsVerified) return;
    navigator.clipboard.writeText(emergencyCoordsText);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2500);
  };

  const handleQuickExpenseSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setExpenseSuccessMsg(null);
    setExpenseErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);
    formData.set('currency', trip.budget_currency || 'EUR');

    startExpenseTransition(async () => {
      const res = await addExpenseAction(null, formData);
      if (res.success) {
        setExpenseSuccessMsg('Dépense enregistrée avec succès !');
        setTimeout(() => {
          setIsQuickExpenseOpen(false);
          setExpenseSuccessMsg(null);
        }, 1500);
      } else {
        setExpenseErrorMsg(res.error || 'Erreur lors de l’enregistrement');
      }
    });
  };

  const fieldClass = (sunAware = true) =>
    sunAware && isSunMode
      ? `${FIELD_SUN_CLASS} border-white/30 bg-black text-white`
      : `${FIELD_SUN_CLASS} border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] text-[color:var(--lkv-text-primary)]`;

  const metricCardClass = isSunMode
    ? 'border-white/10 bg-white/5'
    : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset';

  return (
    <div
      className={`space-y-[var(--space-6)] transition-colors duration-200 ${
        isSunMode ? 'rounded-[var(--lkv-radius-card)] bg-black p-[var(--space-4)] text-white sm:p-[var(--space-6)]' : ''
      }`}
    >
      {/* 1. Barre de statut Cockpit & Mode Plein Soleil */}
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--lkv-success)]/80 opacity-75 [animation-iteration-count:3]" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[color:var(--lkv-success)]" />
          </span>
          <span
            className={`text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider ${
              isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-primary)]'
            }`}
          >
            Cockpit Terrain · Mode Vivre
          </span>
        </div>

        {/* Bouton Plein Soleil (Contraste maximal en extérieur) */}
        <Button
          type="button"
          variant={isSunMode ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setIsSunMode(!isSunMode)}
          icon={<Icon name={isSunMode ? 'sun' : 'moon'} size={16} />}
          aria-pressed={isSunMode}
          title="Bascule en contraste élevé plein soleil pour consultation sous forte luminosité"
        >
          {isSunMode ? 'Mode Standard' : 'Plein Soleil'}
        </Button>
      </div>

      {/* 2. Sélecteur de Jour & Progression de l'étape */}
      <Card
        tone={isSunMode ? 'neutral' : 'sage'}
        className={isSunMode ? 'border-white/20 bg-black/90 text-white' : ''}
      >
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-[var(--space-2)]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={activeDay <= 1}
            onClick={() => setActiveDay((prev) => Math.max(1, prev - 1))}
            icon={<Icon name="chevron-left" size={16} />}
          >
            <span className="hidden sm:inline">Jour précédent</span>
          </Button>

          <div className="text-center">
            <span
              className={`text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider ${
                isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-secondary)]'
              }`}
            >
              {isFutureTrip ? 'Voyage à venir' : 'Étape active'}
            </span>
            <div
              className={`text-[length:var(--lkv-text-title-sm)] font-extrabold sm:text-[length:var(--lkv-text-title-lg)] ${
                isSunMode ? 'text-white' : 'text-[color:var(--lkv-text-primary)]'
              }`}
            >
              {isFutureTrip && phaseDetails.daysUntilStart !== null
                ? `Départ dans ${phaseDetails.daysUntilStart} jour${phaseDetails.daysUntilStart > 1 ? 's' : ''}`
                : `Jour ${activeDay} / ${calculatedTotalDays}`}
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={activeDay >= calculatedTotalDays}
            onClick={() => setActiveDay((prev) => Math.min(calculatedTotalDays, prev + 1))}
            icon={<Icon name="chevron-right" size={16} />}
            iconPosition="trailing"
          >
            <span className="hidden sm:inline">Jour suivant</span>
          </Button>
        </div>

        {/* Barre de progression */}
        <div className="mb-[var(--space-6)] h-2 w-full overflow-hidden rounded-full bg-[color:var(--btn-tint)]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isSunMode ? 'bg-[color:var(--lkv-warning)]' : 'bg-[color:var(--lkv-primary)]'
            }`}
            style={{ width: `${Math.round((activeDay / calculatedTotalDays) * 100)}%` }}
          />
        </div>

        {/* Détails de l'étape courante */}
        {currentStep ? (
          <div className="space-y-[var(--space-4)]">
            <div>
              <div
                className={`text-[length:var(--lkv-text-footnote)] font-semibold ${
                  isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-secondary)]'
                }`}
              >
                {currentStep.location_name || 'En chemin'}
              </div>
              <h3
                className={`mt-0.5 text-[length:var(--lkv-text-subheadline)] font-bold sm:text-[length:var(--lkv-text-title-sm)] ${
                  isSunMode ? 'font-black text-white' : 'text-[color:var(--lkv-text-primary)]'
                }`}
              >
                {currentStep.title}
              </h3>
              {currentStep.description && (
                <p
                  className={`mt-1 text-[length:var(--lkv-text-footnote)] leading-relaxed sm:text-[length:var(--lkv-text-body-sm)] ${
                    isSunMode ? 'text-white/80' : 'text-[color:var(--lkv-text-secondary)]'
                  }`}
                >
                  {currentStep.description}
                </p>
              )}
            </div>

            {/* Cartes métriques de l'étape */}
            <div className="grid grid-cols-2 gap-[var(--space-2)] pt-[var(--space-2)] sm:grid-cols-4 sm:gap-[var(--space-3)]">
              <div className={`rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] ${metricCardClass}`}>
                <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  <Icon
                    name="navigation"
                    size={13}
                    className={isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-primary)]'}
                  />
                  <span>Distance</span>
                </div>
                <div
                  className={`text-[length:var(--lkv-text-subheadline)] font-black sm:text-[length:var(--lkv-text-title-sm)] ${
                    isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-primary)]'
                  }`}
                >
                  {currentStep.distance_km ? `${currentStep.distance_km} km` : '—'}
                </div>
              </div>

              <div className={`rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] ${metricCardClass}`}>
                <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  <Icon
                    name="mountain"
                    size={13}
                    className={isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-primary)]'}
                  />
                  <span>Dénivelé +</span>
                </div>
                <div
                  className={`text-[length:var(--lkv-text-subheadline)] font-black sm:text-[length:var(--lkv-text-title-sm)] ${
                    isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-primary)]'
                  }`}
                >
                  {currentStep.elevation_gain_m ? `+${currentStep.elevation_gain_m} m` : '—'}
                </div>
              </div>

              <div className={`rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] ${metricCardClass}`}>
                <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  <Icon
                    name="mountain"
                    size={13}
                    className={isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-primary)]'}
                  />
                  <span>Dénivelé -</span>
                </div>
                <div
                  className={`text-[length:var(--lkv-text-subheadline)] font-black sm:text-[length:var(--lkv-text-title-sm)] ${
                    isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-primary)]'
                  }`}
                >
                  {currentStep.elevation_loss_m ? `-${currentStep.elevation_loss_m} m` : '—'}
                </div>
              </div>

              <div className={`rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] ${metricCardClass}`}>
                <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                  <Icon
                    name="home"
                    size={13}
                    className={isSunMode ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-primary)]'}
                  />
                  <span>Hébergement</span>
                </div>
                <div
                  className={`truncate text-[length:var(--lkv-text-footnote)] font-bold sm:text-[length:var(--lkv-text-body-sm)] ${
                    isSunMode ? 'text-white' : 'text-[color:var(--lkv-text-primary)]'
                  }`}
                >
                  {currentStep.accommodation_name || 'Bivouac / Refuge'}
                </div>
              </div>
            </div>

            {/* Mode de transport & Ravitaillement */}
            {currentStep.transport_mode && (
              <div
                className={`flex items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] ${
                  isSunMode
                    ? 'border-[color:var(--lkv-warning)]/30 bg-[color:var(--lkv-warning)]/10 text-[color:var(--lkv-warning)]'
                    : 'border-[color:var(--lkv-primary)]/10 bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
                }`}
              >
                <Icon name="droplets" size={16} className="mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Déplacement : </span>
                  Progression en{' '}
                  {currentStep.transport_mode === 'foot'
                    ? 'marche / trek'
                    : currentStep.transport_mode}
                  .
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-[var(--space-6)] text-center">
            <Icon
              name="compass"
              size={40}
              className="mx-auto mb-2 text-[color:var(--lkv-text-secondary)]/60"
            />
            <p className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
              Aucune étape détaillée définie pour ce jour.
            </p>
          </div>
        )}
      </Card>

      {/* 3. Actions Rapides Terrain (Dépense en 2 taps & Secours) */}
      <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
        {/* Saisie rapide de dépense en 2 clics */}
        <Card
          className={isSunMode ? 'border-white/20 bg-black/80 text-white' : ''}
        >
          <div className="mb-[var(--space-3)] flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <Icon name="credit-card" size={20} className="text-[color:var(--lkv-success)]" />
              <h4 className="text-[length:var(--lkv-text-footnote)] font-bold">
                Dépense Express Terrain
              </h4>
            </div>
            <Badge tone="sage">2 taps</Badge>
          </div>

          <p
            className={`mb-[var(--space-4)] text-[length:var(--lkv-text-footnote)] ${
              isSunMode ? 'text-white/70' : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            Enregistrez instantanément vos frais de refuge, ravitaillement ou transport sans quitter
            la piste.
          </p>

          {!isQuickExpenseOpen ? (
            <Button
              variant="primary"
              onClick={() => setIsQuickExpenseOpen(true)}
              icon={<Icon name="plus" size={18} />}
              fullWidth
            >
              Saisir une dépense
            </Button>
          ) : (
            <form onSubmit={handleQuickExpenseSubmit} className="space-y-[var(--space-3)]">
              {expenseSuccessMsg && (
                <Card
                  tone="sage"
                  className="flex items-center gap-[var(--space-2)] p-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]"
                >
                  <Icon name="check-circle2" size={16} />
                  <span>{expenseSuccessMsg}</span>
                </Card>
              )}
              {expenseErrorMsg && (
                <Card
                  role="alert"
                  tone="danger"
                  className="flex items-center gap-[var(--space-2)] p-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-danger-dark)]"
                >
                  <Icon name="alert-triangle" size={16} />
                  <span>{expenseErrorMsg}</span>
                </Card>
              )}

              <label className="block">
                <span className="mb-1 block text-[length:var(--lkv-text-footnote)] font-medium">
                  Montant (€)
                </span>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  required
                  placeholder="Ex: 24.50"
                  className={`${fieldClass()} font-semibold`}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[length:var(--lkv-text-footnote)] font-medium">
                  Objet / Titre
                </span>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Ex: Repas refuge ou pain"
                  className={fieldClass()}
                />
              </label>

              <div className="grid grid-cols-2 gap-[var(--space-2)]">
                <label className="block">
                  <span className="mb-1 block text-[length:var(--lkv-text-footnote)] font-medium">
                    Catégorie
                  </span>
                  <select name="category" className={`${fieldClass()} text-[length:var(--lkv-text-footnote)]`}>
                    <option value="food">Ravitaillement</option>
                    <option value="accommodation">Hébergement</option>
                    <option value="transport">Transport</option>
                    <option value="activities">Activité</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[length:var(--lkv-text-footnote)] font-medium">
                    Payé par
                  </span>
                  <select name="paidBy" className={`${fieldClass()} text-[length:var(--lkv-text-footnote)]`}>
                    <option value={trip.user_id}>Moi-même</option>
                    {trip.collaborators?.map((c) => (
                      <option key={c.id} value={c.user_id}>
                        {c.profile?.full_name || 'Coéquipier'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-[var(--space-2)] pt-[var(--space-1)]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsQuickExpenseOpen(false)}
                  className="flex-1 justify-center"
                >
                  Annuler
                </Button>
                <Button type="submit" size="sm" loading={isPendingExpense} className="flex-1 justify-center">
                  {isPendingExpense ? 'Enregistrement…' : 'Valider'}
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Urgence & Secours Montagne Hors-Ligne */}
        <Card className={isSunMode ? 'border-white/20 bg-black/80 text-white' : ''}>
          <div className="mb-[var(--space-3)] flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <Icon name="shield" size={20} className="text-[color:var(--lkv-danger)]" />
              <h4 className="text-[length:var(--lkv-text-footnote)] font-bold">Secours & Urgences</h4>
            </div>
            <Badge tone="danger">Hors-Ligne</Badge>
          </div>

          <div className="space-y-[var(--space-3)]">
            {/* Boutons d'appel rapide */}
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <a
                href="tel:112"
                className="flex min-h-[48px] items-center justify-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] p-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] font-extrabold text-[color:var(--lkv-danger)] shadow-elevation-2 transition-colors hover:brightness-[1.05]"
              >
                <Icon name="phone-call" size={16} />
                <span>Appel 112</span>
              </a>

              <a
                href="sms:114"
                className="flex min-h-[48px] items-center justify-center gap-[var(--space-2)] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] font-extrabold text-[color:var(--lkv-danger)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
              >
                <Icon name="message-square" size={16} />
                <span>SMS 114</span>
              </a>
            </div>

            {/* Coordonnées GPS de l'étape courante */}
            <div
              className={`flex items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-sm)] border p-[var(--space-3)] ${
                isSunMode
                  ? 'border-white/20 bg-black'
                  : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
                  Position étape
                </div>
                <div className="truncate font-mono text-[length:var(--lkv-text-footnote)] font-bold">
                  {emergencyCoordsText}
                </div>
              </div>

              <IconButton
                type="button"
                size="sm"
                onClick={handleCopyCoordinates}
                disabled={!isEmergencyCoordsVerified}
                aria-label="Copier les coordonnées pour les secours"
                title="Copier les coordonnées pour les secours"
              >
                {copiedCoords ? (
                  <Icon name="check" size={16} className="text-[color:var(--lkv-success)]" />
                ) : (
                  <Icon name="copy" size={16} />
                )}
              </IconButton>
            </div>

            <p className="text-[11px] leading-snug text-[color:var(--lkv-text-secondary)]">
              En cas d’urgence vitale, composez immédiatement le 112 ou envoyez un SMS au 114.
            </p>
          </div>
        </Card>
      </div>

      {/* 4. Points de contrôle & Tracé détaillé (Extensible) */}
      <div className="space-y-[var(--space-3)] pt-[var(--space-2)]">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <Button
            type="button"
            variant={showSafetyCheckpoints ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowSafetyCheckpoints(!showSafetyCheckpoints)}
            aria-pressed={showSafetyCheckpoints}
            icon={<Icon name="shield" size={14} />}
          >
            {showSafetyCheckpoints
              ? 'Masquer les jalons sécurité'
              : 'Consulter les jalons de sécurité'}
          </Button>

          <Button
            type="button"
            variant={showFullItinerary ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowFullItinerary(!showFullItinerary)}
            aria-pressed={showFullItinerary}
            icon={<Icon name="navigation" size={14} />}
          >
            {showFullItinerary ? 'Masquer l’itinéraire complet' : 'Voir tout le tracé'}
          </Button>

          <Link
            href="/progression"
            className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
          >
            <Icon name="award" size={14} />
            <span>Ma progression LKDV</span>
          </Link>
        </div>

        {showSafetyCheckpoints && (
          <div className="pt-[var(--space-2)] animate-in fade-in duration-200">
            <TripSafetyView trip={trip} />
          </div>
        )}

        {showFullItinerary && (
          <div className="pt-[var(--space-2)] animate-in fade-in duration-200">
            <TripItineraryTab trip={trip} stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
}
