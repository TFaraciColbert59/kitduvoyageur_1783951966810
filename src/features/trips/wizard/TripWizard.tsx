'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTripDraft } from './useTripDraft';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import { Step1Destinations } from './Step1Destinations';
import { Step2Dates } from './Step2Dates';
import { Step3StylePace } from './Step3StylePace';
import { Step4Travelers } from './Step4Travelers';
import { Step5Preview } from './Step5Preview';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { GlassCard, GlassSubCard, GlassPill, GlassCapsuleBtn } from '@/components/ui';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Compass,
  Users,
  Eye,
  Check,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

const STEP_LABELS = [
  { step: 1, label: 'Destinations', Icon: MapPin, desc: 'Choix des pays et territoires' },
  { step: 2, label: 'Dates & Durée', Icon: Calendar, desc: 'Période et calendrier' },
  { step: 3, label: 'Style & Rythme', Icon: Compass, desc: 'Activité, niveau et hébergement' },
  { step: 4, label: 'Équipage', Icon: Users, desc: 'Participants et nom du projet' },
  { step: 5, label: 'Aperçu & Validation', Icon: Eye, desc: 'Bilan et création du cockpit' },
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
        <div className="w-8 h-8 rounded-full border-2 border-lkv-primary border-t-transparent animate-spin" />
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

  const handleComplete = async (slug: string) => {
    resetDraft();
    // Étape 2 — Hub unique : le voyage créé devient l'aventure active, la
    // destination est la section Aperçu du hub (jamais une page concurrente).
    await setActiveAdventureAction({
      nature: 'sortie',
      id: slug,
      slug,
      title: state.title.trim() || defaultSuggestedTitle,
    });
    router.push(tripSectionHref(slug, 'overview'));
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

  // Colonne Gauche Desktop (260px) : Stepper vertical
  const renderSidebarLeft = () => (
    <div className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-2xl p-3.5 text-forest-900 font-sans overflow-y-auto no-scrollbar border border-white/40 shadow-sm select-none gap-3">
      <div className="space-y-3 shrink-0">
        <Link
          href="/voyages"
          className="inline-flex items-center gap-1.5 text-xs text-forest-800 hover:underline font-medium"
        >
          <ArrowLeft size={13} />
          <span>Annuler la création</span>
        </Link>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-sage-800">
            Création d’expédition
          </h3>
          <p className="text-[11px] text-sage-700">5 étapes pour planifier votre trek</p>
        </div>

        {/* Stepper Vertical */}
        <div className="space-y-1.5 pt-1">
          {STEP_LABELS.map(({ step, label, Icon, desc }) => {
            const isDone = state.step > step;
            const isCurrent = state.step === step;

            return (
              <button
                key={step}
                type="button"
                onClick={() => isDone && setStep(step)}
                disabled={!isDone && !isCurrent}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                  isCurrent
                    ? 'bg-[var(--lkv-primary)] text-white shadow-sm'
                    : isDone
                    ? 'hover:bg-white/60 text-forest-900 cursor-pointer'
                    : 'text-sage-400 cursor-default opacity-60'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    isCurrent
                      ? 'bg-white text-[var(--lkv-primary)]'
                      : isDone
                      ? 'bg-[var(--lkv-success)] text-white'
                      : 'bg-white/40 border border-black/10 text-sage-400'
                  }`}
                >
                  {isDone ? <Check size={12} /> : step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-tight truncate">{label}</div>
                  <div
                    className={`text-[9.5px] truncate ${
                      isCurrent ? 'text-white/80' : 'text-sage-600'
                    }`}
                  >
                    {desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-white/30 text-[10px] text-sage-700">
        <div>Planificateur d’expédition</div>
        <div className="font-mono">LKDV WIZARD V2</div>
      </div>
    </div>
  );

  // Colonne Droite Desktop (300px) : Résumé du projet
  const renderSidebarRight = () => (
    <div className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      <GlassCard className="p-3.5 space-y-2.5 text-forest-900">
        <span className="text-xs font-bold uppercase tracking-wider text-sage-800 flex items-center gap-1.5">
          <Sparkles size={13} />
          <span>Brouillon en cours</span>
        </span>
        <div className="space-y-2 text-xs">
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Pays choisis</span>
            <span className="font-semibold text-forest-900">
              {state.countries.length > 0
                ? state.countries.map((c) => c.name).join(', ')
                : 'En sélection...'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Durée estimée</span>
            <span className="font-semibold text-forest-900">{state.durationDays} jours</span>
          </div>
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Style & Difficulté</span>
            <span className="font-semibold capitalize text-forest-900">
              {state.activityType} · {state.difficulty}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <AppShellDesktop
      sidebarLeft={renderSidebarLeft()}
      sidebarRight={renderSidebarRight()}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={false} className="pb-24">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between text-xs text-forest-800 font-semibold mb-1.5">
              <span>Étape {state.step} sur 5</span>
              <span>{STEP_LABELS[state.step - 1].label}</span>
            </div>
            <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-[var(--lkv-primary)] transition-all duration-300 rounded-full"
                style={{ width: `${(state.step / 5) * 100}%` }}
              />
            </div>
            <div className="glass rounded-2xl p-5 border border-white/60 shadow-md">
              {renderCurrentStep()}
            </div>
          </div>
        </MobilePageShell>
      }
    >
      <div className="space-y-4">
        {/* Conteneur principal de l'étape */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-white/60 shadow-md">
          {renderCurrentStep()}

          {/* Contrôles de navigation */}
          {state.step < 5 && (
            <div className="flex mt-8 pt-6 border-t border-white/40 items-center justify-between">
              <GlassCapsuleBtn
                type="button"
                onClick={handlePrev}
                disabled={state.step === 1}
                variant="default"
                icon={<ChevronLeft size={16} />}
                className="flex-1 justify-center"
              >
                Précédent
              </GlassCapsuleBtn>

              <GlassCapsuleBtn
                type="button"
                onClick={handleNext}
                variant="primary"
                icon={<ChevronRight size={16} />}
                className="flex-1 justify-center"
              >
                Continuer
              </GlassCapsuleBtn>
            </div>
          )}
        </div>
      </div>
    </AppShellDesktop>
  );
}
