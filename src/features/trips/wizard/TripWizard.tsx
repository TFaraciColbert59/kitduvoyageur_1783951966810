'use client';

import Icon from '@/components/ui/Icon';
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
import { Button, Card, Spinner, StepIndicator } from '@/components/ui';
import { MapPin, Calendar, Compass, Users, Eye } from 'lucide-react';

const STEP_LABELS = [
  { step: 1, label: 'Destinations', Icon: MapPin, desc: 'Choix des pays et territoires' },
  { step: 2, label: 'Dates & Durée', Icon: Calendar, desc: 'Période et calendrier' },
  { step: 3, label: 'Style & Rythme', Icon: Compass, desc: 'Activité, niveau et hébergement' },
  { step: 4, label: 'Équipage', Icon: Users, desc: 'Participants et nom du projet' },
  { step: 5, label: 'Aperçu & Validation', Icon: Eye, desc: 'Bilan et création du cockpit' },
];

export function TripWizard() {
  const router = useRouter();
  const { state, isInitialized, setStep, updateDraft, saveDraftToDatabase, resetDraft } =
    useTripDraft();

  // Titre suggéré automatiquement
  const defaultSuggestedTitle = useMemo(() => {
    const countryNames = state.countries.map((c) => c.name.split(' ')[0]).join(' / ');
    return `Expédition ${countryNames || 'Aventure'} (${state.durationDays}j)`;
  }, [state.countries, state.durationDays]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" label="Initialisation du brouillon" />
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
    <div className="flex h-full max-h-full w-full flex-1 flex-col justify-between gap-[var(--space-3)] overflow-y-auto rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] p-[var(--space-3)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 [scrollbar-width:none] select-none">
      <div className="shrink-0 space-y-[var(--space-3)]">
        <Link
          href="/voyages"
          className="inline-flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)] hover:underline"
        >
          <Icon name="arrow-left" size={13} />
          <span>Annuler la création</span>
        </Link>

        <div>
          <h3 className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--sage-800)]">
            Création d’expédition
          </h3>
          <p className="text-[11px] text-[color:var(--sage-700)]">
            5 étapes pour planifier votre trek
          </p>
        </div>

        {/* Stepper Vertical */}
        <div className="space-y-[var(--space-1)] pt-[var(--space-1)]">
          {STEP_LABELS.map(({ step, label, Icon, desc }) => {
            const isDone = state.step > step;
            const isCurrent = state.step === step;

            return (
              <Button
                key={step}
                type="button"
                variant={isCurrent ? 'primary' : isDone ? 'secondary' : 'ghost'}
                onClick={() => isDone && setStep(step)}
                disabled={!isDone && !isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                className="h-auto w-full items-start justify-start gap-[var(--space-2)] whitespace-normal rounded-[var(--lkv-radius-control)] p-[var(--space-2)] text-left"
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[length:var(--lkv-text-caption-2)] font-bold ${
                    isCurrent
                      ? 'bg-white text-[color:var(--lkv-primary)]'
                      : isDone
                        ? 'bg-[color:var(--lkv-success)] text-[color:var(--lkv-text-inverted)]'
                        : 'border border-[color:var(--lkv-border)] bg-white/40 text-[color:var(--sage-400)]'
                  }`}
                >
                  {isDone ? <Icon name="check" size={12} /> : step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--lkv-text-footnote)] font-bold leading-tight">
                    {label}
                  </div>
                  <div
                    className={`truncate text-[9.5px] ${
                      isCurrent ? 'text-white/80' : 'text-[color:var(--sage-600)]'
                    }`}
                  >
                    {desc}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)] text-[10px] text-[color:var(--sage-700)]">
        <div>Planificateur d’expédition</div>
        <div className="font-medium text-[color:var(--glass-label)]">Assistant d’expédition</div>
      </div>
    </div>
  );

  // Colonne Droite Desktop (300px) : Résumé du projet
  const renderSidebarRight = () => (
    <div className="flex h-full w-full shrink-0 flex-col gap-[var(--space-3)] overflow-y-auto pb-6">
      <Card className="space-y-[var(--space-3)]">
        <span className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--sage-800)]">
          <Icon name="sparkles" size={13} />
          <span>Brouillon en cours</span>
        </span>
        <div className="space-y-[var(--space-2)] text-[length:var(--lkv-text-footnote)]">
          <Card variant="compact" className="flex flex-col">
            <span className="block text-[10px] text-[color:var(--sage-700)]">Pays choisis</span>
            <span className="font-semibold text-[color:var(--lkv-text-primary)]">
              {state.countries.length > 0
                ? state.countries.map((c) => c.name).join(', ')
                : 'En sélection...'}
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col">
            <span className="block text-[10px] text-[color:var(--sage-700)]">Durée estimée</span>
            <span className="font-semibold text-[color:var(--lkv-text-primary)]">
              {state.durationDays} jours
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col">
            <span className="block text-[10px] text-[color:var(--sage-700)]">
              Style & Difficulté
            </span>
            <span className="font-semibold capitalize text-[color:var(--lkv-text-primary)]">
              {state.activityType} · {state.difficulty}
            </span>
          </Card>
        </div>
      </Card>
    </div>
  );

  const renderNavControls = (compact?: boolean) =>
    state.step < 5 && (
      <div
        className={`flex items-center justify-between gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] ${
          compact ? 'mt-6 pt-5' : 'mt-8 pt-6'
        }`}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={handlePrev}
          disabled={state.step === 1}
          icon={<Icon name="chevron-left" size={16} />}
          className="flex-1 justify-center"
        >
          Précédent
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          icon={<Icon name="chevron-right" size={16} />}
          iconPosition="trailing"
          className="flex-1 justify-center"
        >
          Continuer
        </Button>
      </div>
    );

  return (
    <AppShellDesktop
      sidebarLeft={renderSidebarLeft()}
      sidebarRight={renderSidebarRight()}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={false} className="pb-24">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <StepIndicator
              currentStep={state.step}
              totalSteps={5}
              labels={STEP_LABELS.map((s) => s.label)}
              className="mb-4"
            />
            <Card>
              {renderCurrentStep()}
              {renderNavControls(true)}
            </Card>
          </div>
        </MobilePageShell>
      }
    >
      <div className="space-y-4">
        {/* Conteneur principal de l'étape */}
        <Card className="sm:p-[var(--space-6)]">
          {renderCurrentStep()}
          {renderNavControls()}
        </Card>
      </div>
    </AppShellDesktop>
  );
}
