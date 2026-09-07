'use client';

import React, { useState, useTransition } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import {
  Sun,
  Moon,
  Navigation,
  Mountain,
  Compass,
  PhoneCall,
  MessageSquare,
  Plus,
  Droplets,
  Home,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Copy,
  Check,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
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

export function getCurrentStepForDay(steps: TripStep[], dayNumber: number): TripStep | null {
  if (!steps || steps.length === 0) return null;
  const exact = steps.find(s => s.day_number === dayNumber);
  if (exact) return exact;

  // Si le jour dépasse le nombre d'étapes, fallback sur la dernière étape
  if (dayNumber > steps.length) {
    return steps[steps.length - 1];
  }

  // Sinon première étape
  return steps[0];
}

export function hasVerifiedEmergencyCoordinates(
  trip: TripFull,
  step: TripStep | null
): boolean {
  if (!step || typeof step.latitude !== 'number' || typeof step.longitude !== 'number') {
    return false;
  }
  const stepAny = step as any;
  if (stepAny.source === 'user' || stepAny.source === 'import' || stepAny.is_user_defined === true) {
    return true;
  }
  const meta = (trip.metadata || {}) as Record<string, any>;
  if (meta.has_imported_gpx === true || meta.source === 'gpx_import' || meta.has_verified_coordinates === true) {
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

  return (
    <div
      className={`space-y-6 transition-colors duration-200 ${
        isSunMode ? 'bg-black text-white p-4 sm:p-6 rounded-3xl' : ''
      }`}
    >
      {/* 1. Barre de statut Cockpit & Mode Plein Soleil */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--lkv-success)]/80 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--lkv-success)]" />
          </span>
          <span
            className={`text-xs font-bold uppercase tracking-wider ${
              isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'
            }`}
          >
            Cockpit Terrain · Mode Vivre
          </span>
        </div>

        {/* Bouton Plein Soleil (Contraste maximal en extérieur) */}
        <button
          type="button"
          onClick={() => setIsSunMode(!isSunMode)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all min-h-[44px] ${
            isSunMode
              ? 'bg-[var(--lkv-warning)] text-black shadow-lg'
              : 'bg-white/80 hover:bg-white text-lkv-primary border border-black/10'
          }`}
          title="Bascule en contraste élevé plein soleil pour consultation sous forte luminosité"
        >
          {isSunMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{isSunMode ? 'Mode Standard' : 'Plein Soleil'}</span>
        </button>
      </div>

      {/* 2. Sélecteur de Jour & Progression de l'étape */}
      <GlassCard
        tone={isSunMode ? 'neutral' : 'sage'}
        className={`p-4 sm:p-6 rounded-3xl border transition-all ${
          isSunMode ? 'bg-black/90 border-white/20 text-white' : 'border-white/70'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            disabled={activeDay <= 1}
            onClick={() => setActiveDay(prev => Math.max(1, prev - 1))}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold min-h-[44px] transition-all ${
              activeDay <= 1
                ? 'opacity-30 cursor-not-allowed'
                : isSunMode
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-white/70 hover:bg-white text-lkv-primary border border-black/5'
            }`}
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Jour précédent</span>
          </button>

          <div className="text-center">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-secondary'
              }`}
            >
              {isFutureTrip ? 'Voyage à venir' : 'Étape active'}
            </span>
            <div
              className={`text-xl sm:text-2xl font-extrabold ${
                isSunMode ? 'text-white' : 'text-lkv-primary'
              }`}
            >
              {isFutureTrip && phaseDetails.daysUntilStart !== null
                ? `Départ dans ${phaseDetails.daysUntilStart} jour${phaseDetails.daysUntilStart > 1 ? 's' : ''}`
                : `Jour ${activeDay} / ${calculatedTotalDays}`}
            </div>
          </div>

          <button
            type="button"
            disabled={activeDay >= calculatedTotalDays}
            onClick={() => setActiveDay(prev => Math.min(calculatedTotalDays, prev + 1))}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold min-h-[44px] transition-all ${
              activeDay >= calculatedTotalDays
                ? 'opacity-30 cursor-not-allowed'
                : isSunMode
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-white/70 hover:bg-white text-lkv-primary border border-black/5'
            }`}
          >
            <span className="hidden sm:inline">Jour suivant</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Barre de progression */}
        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden mb-6">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isSunMode ? 'bg-[var(--lkv-warning)]' : 'bg-lkv-primary'
            }`}
            style={{ width: `${Math.round((activeDay / calculatedTotalDays) * 100)}%` }}
          />
        </div>

        {/* Détails de l'étape courante */}
        {currentStep ? (
          <div className="space-y-4">
            <div>
              <div
                className={`text-xs font-semibold ${
                  isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-secondary'
                }`}
              >
                {currentStep.location_name || 'En chemin'}
              </div>
              <h3
                className={`text-lg sm:text-xl font-bold mt-0.5 ${
                  isSunMode ? 'text-white font-black' : 'text-lkv-primary'
                }`}
              >
                {currentStep.title}
              </h3>
              {currentStep.description && (
                <p
                  className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                    isSunMode ? 'text-white/80' : 'text-lkv-secondary'
                  }`}
                >
                  {currentStep.description}
                </p>
              )}
            </div>

            {/* Cartes métriques de l'étape */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
              <div
                className={`p-3 rounded-2xl border ${
                  isSunMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-black/5'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-lkv-secondary mb-1">
                  <Navigation size={13} className={isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'} />
                  <span>Distance</span>
                </div>
                <div
                  className={`text-lg sm:text-xl font-black ${
                    isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'
                  }`}
                >
                  {currentStep.distance_km ? `${currentStep.distance_km} km` : '—'}
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  isSunMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-black/5'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-lkv-secondary mb-1">
                  <Mountain size={13} className={isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'} />
                  <span>Dénivelé +</span>
                </div>
                <div
                  className={`text-lg sm:text-xl font-black ${
                    isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'
                  }`}
                >
                  {currentStep.elevation_gain_m ? `+${currentStep.elevation_gain_m} m` : '—'}
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  isSunMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-black/5'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-lkv-secondary mb-1">
                  <Mountain size={13} className={isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'} />
                  <span>Dénivelé -</span>
                </div>
                <div
                  className={`text-lg sm:text-xl font-black ${
                    isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'
                  }`}
                >
                  {currentStep.elevation_loss_m ? `-${currentStep.elevation_loss_m} m` : '—'}
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  isSunMode ? 'bg-white/5 border-white/10' : 'bg-white/60 border-black/5'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-lkv-secondary mb-1">
                  <Home size={13} className={isSunMode ? 'text-[var(--lkv-warning)]' : 'text-lkv-primary'} />
                  <span>Hébergement</span>
                </div>
                <div
                  className={`text-xs sm:text-sm font-bold truncate ${
                    isSunMode ? 'text-white' : 'text-lkv-primary'
                  }`}
                >
                  {currentStep.accommodation_name || 'Bivouac / Refuge'}
                </div>
              </div>
            </div>

            {/* Mode de transport & Ravitaillement */}
            {currentStep.transport_mode && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-start gap-2 ${
                  isSunMode
                    ? 'bg-[var(--lkv-warning)]/10 border-[var(--lkv-warning)]/30 text-[var(--lkv-warning)]'
                    : 'bg-lkv-primary/5 border-lkv-primary/10 text-lkv-primary'
                }`}
              >
                <Droplets size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Déplacement : </span>
                  Progression en {currentStep.transport_mode === 'foot' ? 'marche / trek' : currentStep.transport_mode}.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Compass className="w-10 h-10 mx-auto text-lkv-secondary/60 mb-2" />
            <p className="text-sm font-semibold text-lkv-primary">
              Aucune étape détaillée définie pour ce jour.
            </p>
          </div>
        )}
      </GlassCard>

      {/* 3. Actions Rapides Terrain (Dépense en 2 taps & Secours) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Saisie rapide de dépense en 2 clics */}
        <GlassCard
          tone="neutral"
          className={`p-5 rounded-3xl border ${
            isSunMode ? 'bg-black/80 border-white/20 text-white' : 'border-white/60'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--lkv-success)]" />
              <h4 className="font-bold text-sm">Dépense Express Terrain</h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--lkv-success)]/10 text-[var(--lkv-success)] font-semibold">
              2 taps
            </span>
          </div>

          <p className={`text-xs mb-4 ${isSunMode ? 'text-white/70' : 'text-lkv-secondary'}`}>
            Enregistrez instantanément vos frais de refuge, ravitaillement ou transport sans
            quitter la piste.
          </p>

          {!isQuickExpenseOpen ? (
            <LkvButton
              variant="primary"
              size="md"
              onClick={() => setIsQuickExpenseOpen(true)}
              className="w-full flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Plus size={18} />
              <span>Saisir une dépense</span>
            </LkvButton>
          ) : (
            <form onSubmit={handleQuickExpenseSubmit} className="space-y-3">
              {expenseSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-[var(--lkv-success)]/15 border border-[var(--lkv-success)]/30 text-[var(--lkv-success)] text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{expenseSuccessMsg}</span>
                </div>
              )}
              {expenseErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{expenseErrorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  required
                  placeholder="Ex: 24.50"
                  className={`w-full px-3 py-2 rounded-xl text-sm border font-semibold min-h-[44px] ${
                    isSunMode ? 'bg-black text-white border-white/30' : 'bg-white border-black/10'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Objet / Titre</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Ex: Repas refuge ou pain"
                  className={`w-full px-3 py-2 rounded-xl text-sm border min-h-[44px] ${
                    isSunMode ? 'bg-black text-white border-white/30' : 'bg-white border-black/10'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Catégorie</label>
                  <select
                    name="category"
                    className={`w-full px-3 py-2 rounded-xl text-xs border min-h-[44px] ${
                      isSunMode ? 'bg-black text-white border-white/30' : 'bg-white border-black/10'
                    }`}
                  >
                    <option value="food">Ravitaillement</option>
                    <option value="accommodation">Hébergement</option>
                    <option value="transport">Transport</option>
                    <option value="activities">Activité</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Payé par</label>
                  <select
                    name="paidBy"
                    className={`w-full px-3 py-2 rounded-xl text-xs border min-h-[44px] ${
                      isSunMode ? 'bg-black text-white border-white/30' : 'bg-white border-black/10'
                    }`}
                  >
                    <option value={trip.user_id}>Moi-même</option>
                    {trip.collaborators?.map(c => (
                      <option key={c.id} value={c.user_id}>
                        {c.profile?.full_name || 'Coéquipier'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsQuickExpenseOpen(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium min-h-[44px] border ${
                    isSunMode ? 'border-white/20 text-white/70' : 'border-black/10 text-text-secondary'
                  }`}
                >
                  Annuler
                </button>
                <LkvButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPendingExpense}
                  className="flex-1 min-h-[44px]"
                >
                  {isPendingExpense ? 'Enregistrement…' : 'Valider'}
                </LkvButton>
              </div>
            </form>
          )}
        </GlassCard>

        {/* Urgence & Secours Montagne Hors-Ligne */}
        <GlassCard
          tone="neutral"
          className={`p-5 rounded-3xl border ${
            isSunMode ? 'bg-black/80 border-white/20 text-white' : 'border-white/60'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-500" />
              <h4 className="font-bold text-sm">Secours & Urgences</h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-semibold">
              Hors-Ligne
            </span>
          </div>

          <div className="space-y-3">
            {/* Boutons d'appel rapide */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="tel:112"
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold shadow-md min-h-[48px] transition-all"
              >
                <PhoneCall size={16} />
                <span>Appel 112</span>
              </a>

              <a
                href="sms:114"
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white hover:bg-surface-subtle text-rose-600 border border-rose-200 text-sm font-extrabold shadow-xs min-h-[48px] transition-all"
              >
                <MessageSquare size={16} />
                <span>SMS 114</span>
              </a>
            </div>

            {/* Coordonnées GPS de l'étape courante */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                isSunMode ? 'bg-black border-white/20' : 'bg-black/5 border-black/5'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[10px] text-lkv-secondary font-bold uppercase tracking-wider">
                  Position étape
                </div>
                <div className="font-mono text-xs font-bold truncate">
                  {emergencyCoordsText}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCoordinates}
                disabled={!isEmergencyCoordsVerified}
                className="p-2 rounded-lg bg-white/80 hover:bg-white text-lkv-primary shadow-2xs border border-black/5 min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Copier les coordonnées pour les secours"
              >
                {copiedCoords ? (
                  <Check size={16} className="text-[var(--lkv-success)]" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>

            <p className="text-[11px] text-lkv-secondary leading-snug">
              En cas d’urgence vitale, composez immédiatement le 112 ou envoyez un SMS au 114.
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 4. Points de contrôle & Tracé détaillé (Extensible) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSafetyCheckpoints(!showSafetyCheckpoints)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all min-h-[44px] flex items-center gap-2 ${
              showSafetyCheckpoints
                ? 'bg-lkv-primary text-white border-lkv-primary'
                : 'bg-white/80 hover:bg-white text-lkv-primary border-black/10'
            }`}
          >
            <Shield size={14} />
            <span>
              {showSafetyCheckpoints
                ? 'Masquer les jalons sécurité'
                : 'Consulter les jalons de sécurité'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowFullItinerary(!showFullItinerary)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all min-h-[44px] flex items-center gap-2 ${
              showFullItinerary
                ? 'bg-lkv-primary text-white border-lkv-primary'
                : 'bg-white/80 hover:bg-white text-lkv-primary border-black/10'
            }`}
          >
            <Navigation size={14} />
            <span>
              {showFullItinerary ? 'Masquer l’itinéraire complet' : 'Voir tout le tracé'}
            </span>
          </button>
        </div>

        {showSafetyCheckpoints && (
          <div className="pt-2 animate-in fade-in duration-200">
            <TripSafetyView trip={trip} />
          </div>
        )}

        {showFullItinerary && (
          <div className="pt-2 animate-in fade-in duration-200">
            <TripItineraryTab trip={trip} stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
}
