'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTripDraft } from './useTripDraft';
import { Step1Destinations } from './Step1Destinations';
import { Step2Dates } from './Step2Dates';
import { Step3StylePace } from './Step3StylePace';
import { Step4Travelers } from './Step4Travelers';
import { Step5Preview } from './Step5Preview';
import AppShell from '@/components/shell/AppShell';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Compass,
  Users,
  Eye,
  Check,
} from 'lucide-react';

const STEP_LABELS = [
  { step: 1, label: 'Destinations', Icon: MapPin },
  { step: 2, label: 'Dates', Icon: Calendar },
  { step: 3, label: 'Style', Icon: Compass },
  { step: 4, label: 'Voyageurs', Icon: Users },
  { step: 5, label: 'Aperçu', Icon: Eye },
];

export function TripWizard() {
  const router = useRouter();
  const {
    state,
    isInitialized,
    setStep,
    updateDraft,
    saveDraftToDatabase,
    resetDraft,
  } = useTripDraft();

  // Titre suggéré automatiquement
  const defaultSuggestedTitle = useMemo(() => {
    const countryNames = state.countries.map((c) => c.name.split(' ')[0]).join(' / ');
    return `Expédition ${countryNames || 'Aventure'} (${state.durationDays}j)`;
  }, [state.countries, state.durationDays]);

  if (!isInitialized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#17402C] border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleNext = async () => {
    if (state.step === 3) {
      // Sauvegarde du brouillon dès l'étape 3
      saveDraftToDatabase().catch(() => {});
    }
    setStep(state.step + 1);
  };

  const handlePrev = () => {
    if (state.step > 1) {
      setStep(state.step - 1);
    }
  };

  const handleComplete = (slug: string) => {
    resetDraft();
    router.push(`/voyages/${slug}`);
  };

  // Contenu interactif de l'étape active
  const renderCurrentStep = () => {
    switch (state.step) {
      case 1:
        return (
          <Step1Destinations
            selectedCountries={state.countries}
            onChange={(countries) => updateDraft({ countries })}
          />
        );
      case 2:
        return (
          <Step2Dates
            countries={state.countries}
            datesChoice={state.datesChoice}
            startDate={state.startDate}
            endDate={state.endDate}
            durationDays={state.durationDays}
            onDatesChoiceChange={(datesChoice) => updateDraft({ datesChoice })}
            onStartDateChange={(startDate) => updateDraft({ startDate })}
            onEndDateChange={(endDate) => updateDraft({ endDate })}
            onDurationChange={(durationDays) => updateDraft({ durationDays })}
          />
        );
      case 3:
        return (
          <Step3StylePace
            accommodationType={state.accommodationType}
            activityType={state.activityType}
            pace={state.pace}
            difficulty={state.difficulty}
            onAccommodationChange={(accommodationType) => updateDraft({ accommodationType })}
            onActivityChange={(activityType) => updateDraft({ activityType })}
            onPaceChange={(pace) => updateDraft({ pace })}
            onDifficultyChange={(difficulty) => updateDraft({ difficulty })}
          />
        );
      case 4:
        return (
          <Step4Travelers
            travelersCount={state.travelersCount}
            groupType={state.groupType}
            title={state.title}
            description={state.description}
            defaultSuggestedTitle={defaultSuggestedTitle}
            onTravelersCountChange={(travelersCount) => updateDraft({ travelersCount })}
            onGroupTypeChange={(groupType) => updateDraft({ groupType })}
            onTitleChange={(title) => updateDraft({ title })}
            onDescriptionChange={(description) => updateDraft({ description })}
          />
        );
      case 5:
        return (
          <Step5Preview
            state={state}
            suggestedTitle={defaultSuggestedTitle}
            onUpdateDraft={updateDraft}
            onComplete={handleComplete}
            onBackToEdit={() => setStep(1)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* 1. DESKTOP VIEW (md+) */}
      <div className="hidden md:block">
        <AppShell safeTop={true} hasBottomNav={true}>
          <div className="max-w-4xl mx-auto px-6 py-8 pb-32">
            {/* Stepper Progress Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-black/5 -translate-y-1/2 z-0" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-[#17402C] -translate-y-1/2 transition-all duration-300 z-0"
                  style={{ width: `${((state.step - 1) / 4) * 100}%` }}
                />
                {STEP_LABELS.map(({ step, label, Icon }) => {
                  const isDone = state.step > step;
                  const isCurrent = state.step === step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setStep(step)}
                      className={`relative z-10 flex flex-col items-center gap-1.5 focus:outline-none transition-all ${
                        isCurrent
                          ? 'scale-105'
                          : isDone
                          ? 'hover:opacity-80'
                          : 'opacity-60 cursor-default'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          isCurrent
                            ? 'bg-[#17402C] text-white shadow-md ring-4 ring-emerald-100'
                            : isDone
                            ? 'bg-[#17402C] text-white'
                            : 'bg-white border border-black/15 text-gray-400'
                        }`}
                      >
                        {isDone ? <Check size={16} /> : <Icon size={16} />}
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isCurrent
                            ? 'text-[#17402C] font-bold'
                            : isDone
                            ? 'text-[#5B7F55]'
                            : 'text-gray-400'
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Container de l'étape */}
            <div className="bg-white/90 backdrop-blur-md rounded-[32px] p-8 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
              {renderCurrentStep()}

              {/* Barre de navigation Desktop (sauf à l'étape 5 où l'aperçu gère la fin) */}
              {state.step < 5 && (
                <div className="mt-8 pt-6 border-t border-black/5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={state.step === 1}
                    className="px-5 py-2.5 rounded-xl border border-black/10 text-xs font-semibold text-[#17402C] hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5 min-h-[44px]"
                  >
                    <ChevronLeft size={16} />
                    <span>Précédent</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2.5 rounded-xl bg-[#17402C] hover:bg-[#1f563b] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all min-h-[44px]"
                  >
                    <span>Continuer</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </AppShell>
      </div>

      {/* 2. MOBILE VIEW (<md) avec AppShell et styles tactiles Apple HIG */}
      <div className="block md:hidden">
        <AppShell safeTop={true} hasBottomNav={false}>
          <div className="p-4 pb-28">
            {/* Barre de progression compacte */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-[#5B7F55] font-semibold mb-1.5">
                <span>Étape {state.step} sur 5</span>
                <span>{STEP_LABELS[state.step - 1].label}</span>
              </div>
              <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#17402C] transition-all duration-300 rounded-full"
                  style={{ width: `${(state.step / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Contenu mobile */}
            <div className="space-y-4">{renderCurrentStep()}</div>

            {/* Barre d'action collante en bas (Sticky Bottom Bar) */}
            {state.step < 5 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-black/10 z-50 flex items-center gap-3">
                {state.step > 1 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3 px-4 rounded-xl border border-black/10 text-xs font-semibold text-[#17402C] hover:bg-black/5 flex items-center justify-center gap-1 min-h-[48px]"
                  >
                    <ChevronLeft size={16} />
                    <span>Retour</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-2 py-3 px-6 rounded-xl bg-[#17402C] text-white text-xs font-bold shadow-md flex items-center justify-center gap-1 min-h-[48px]"
                >
                  <span>Continuer</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </AppShell>
      </div>
    </>
  );
}
